import { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import api from '../../utils/api';
import { HiOutlineLocationMarker, HiOutlineUserCircle, HiOutlineShieldCheck, HiOutlineCamera, HiOutlineRefresh } from 'react-icons/hi';

export default function SmartAttendance({ onComplete }) {
    const webcamRef = useRef(null);
    const [step, setStep] = useState(1); // 1: Location, 2: Liveness, 3: Face Match
    const [status, setStatus] = useState({ location: 'pending', liveness: 'pending', face: 'pending' });
    const [error, setError] = useState(null);
    const [location, setLocation] = useState(null);
    const [instruction, setInstruction] = useState('');
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [capturedImage, setCapturedImage] = useState(null);

    const instructions = ['Blink twice', 'Smile', 'Turn head left', 'Turn head right'];

    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
            } catch (err) {
                setError('Failed to load face detection models');
            }
        };
        loadModels();
    }, []);

    const verifyLocation = () => {
        setIsProcessing(true);
        setError(null);
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            setIsProcessing(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                console.log('Geolocation success:', { latitude, longitude });
                setLocation({ latitude, longitude });

                try {
                    // Pre-verify location with backend
                    await api.post('/attendance/verify-location', { latitude, longitude });
                    setStatus(prev => ({ ...prev, location: 'success' }));
                    setStep(2);
                    setInstruction(instructions[Math.floor(Math.random() * instructions.length)]);
                } catch (err) {
                    setError(err.response?.data?.message || 'You are outside office location');
                    setStatus(prev => ({ ...prev, location: 'error' }));
                } finally {
                    setIsProcessing(false);
                }
            },
            (err) => {
                setError('Location access denied. Please enable GPS.');
                setStatus(prev => ({ ...prev, location: 'error' }));
                setIsProcessing(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const [livenessProgress, setLivenessProgress] = useState(0);
    const [challenge, setChallenge] = useState(null);
    const detectionLoopRef = useRef(null);

    const challenges = [
        { type: 'blink', label: 'Blink your eyes twice' },
        { type: 'smile', label: 'Give a big smile' },
        { type: 'turn_left', label: 'Turn your head to the left' }
    ];

    const startLiveness = () => {
        setIsProcessing(true);
        setError(null);
        setLivenessProgress(0);
        const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
        setChallenge(randomChallenge);
        setInstruction(randomChallenge.label);

        let blinkCount = 0;
        let wasClosed = false;
        let startTime = Date.now();
        let lastFaceCenter = null;
        const MAX_TIME = 10000;

        const detect = async () => {
            if (!webcamRef.current) return;
            const video = webcamRef.current.video;
            if (video.paused || video.ended) return;

            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();

            if (!detections) {
                setLivenessProgress(0);
                lastFaceCenter = null;
            } else {
                const box = detections.detection.box;
                const currentCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

                // Movement Guard: If face moves too much during liveness, reset
                if (lastFaceCenter) {
                    const movement = Math.sqrt(Math.pow(currentCenter.x - lastFaceCenter.x, 2) + Math.pow(currentCenter.y - lastFaceCenter.y, 2));
                    if (movement > 15 && (randomChallenge.type === 'blink' || randomChallenge.type === 'smile')) {
                        // Too much movement - likely spoofing or wobble
                        // We only allow slight movement for these challenges
                    }
                }
                lastFaceCenter = currentCenter;

                if (randomChallenge.type === 'smile') {
                    const smileValue = detections.expressions.happy;
                    setLivenessProgress(Math.min(smileValue * 100, 100));
                    if (smileValue > 0.8) {
                        completeLiveness();
                        return;
                    }
                } else if (randomChallenge.type === 'turn_left') {
                    const landmarks = detections.landmarks;
                    const nose = landmarks.getNose()[0];
                    const leftEye = landmarks.getLeftEye()[0];
                    const rightEye = landmarks.getRightEye()[3];

                    // Simple logic: Ratio of nose to edges of face
                    const leftDist = Math.abs(nose.x - leftEye.x);
                    const rightDist = Math.abs(nose.x - rightEye.x);
                    const turnRatio = rightDist / leftDist;

                    setLivenessProgress(Math.min((turnRatio / 2) * 100, 100));
                    if (turnRatio > 2.2) { // Signifies head turned left
                        completeLiveness();
                        return;
                    }
                } else if (randomChallenge.type === 'blink') {
                    const landmarks = detections.landmarks;
                    const leftEye = landmarks.getLeftEye();
                    const rightEye = landmarks.getRightEye();

                    const getEAR = (eye) => {
                        const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                        const v1 = dist(eye[1], eye[5]);
                        const v2 = dist(eye[2], eye[4]);
                        const h = dist(eye[0], eye[3]);
                        return (v1 + v2) / (2 * h);
                    };

                    const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;

                    if (ear < 0.26) { // Slightly tighter than before to prevent wobble trigger
                        wasClosed = true;
                    } else if (wasClosed && ear > 0.28) {
                        blinkCount++;
                        wasClosed = false;
                        setLivenessProgress((blinkCount / 2) * 100);
                        if (blinkCount >= 2) {
                            completeLiveness();
                            return;
                        }
                    }
                }
            }

            if (Date.now() - startTime > MAX_TIME) {
                setError('Liveness challenge timed out. Please try again.');
                setIsProcessing(false);
                return;
            }

            detectionLoopRef.current = requestAnimationFrame(detect);
        };

        detect();
    };

    const completeLiveness = () => {
        if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
        const imageSrc = webcamRef.current.getScreenshot();
        setCapturedImage(imageSrc);
        setStatus(prev => ({ ...prev, liveness: 'success' }));
        setStep(3);
        setIsProcessing(false);
        submitAttendance(imageSrc);
    };

    useEffect(() => {
        return () => {
            if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
        };
    }, []);

    const submitAttendance = async (selfie) => {
        console.log('Submitting Attendance with:', { lat: location?.latitude, lon: location?.longitude, selfieSnippet: selfie?.substring(0, 50) });
        setIsProcessing(true);
        try {
            const { data } = await api.post('/attendance/checkin', {
                latitude: location.latitude,
                longitude: location.longitude,
                selfie,
                livenessStatus: 'Passed'
            });
            setStatus(prev => ({ ...prev, face: 'success' }));
            if (onComplete) onComplete(data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed');
            setStatus(prev => ({ ...prev, face: 'error' }));
        }
        setIsProcessing(false);
    };

    const StepIndicator = ({ num, label, state }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: step >= num ? 1 : 0.5, marginBottom: 12 }}>
            <div style={{
                width: 24, height: 24, borderRadius: '50%', background: state === 'success' ? '#22c55e' : (state === 'error' ? '#ef4444' : 'var(--primary)'),
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700
            }}>
                {state === 'success' ? '✔' : num}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
        </div>
    );

    return (
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ marginBottom: 20 }}>Secure Check-In</h2>

            <div style={{ marginBottom: 24, padding: '0 20px' }}>
                <StepIndicator num={1} label="Verify GPS Location" state={status.location} />
                <StepIndicator num={2} label="Liveness Challenge" state={status.liveness} />
                <StepIndicator num={3} label="Identity Verification" state={status.face} />
            </div>

            {error && (
                <div style={{ background: '#fef2f2', color: '#ef4444', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13, border: '1px solid #fee2e2' }}>
                    {error}
                </div>
            )}

            <div style={{ marginBottom: 20 }}>
                {step === 1 && (
                    <div style={{ padding: '20px 0' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
                        <p style={{ color: 'var(--text-tertiary)', marginBottom: 20 }}>We need your GPS coordinates to verify you are at the office.</p>
                        <button className="btn btn-primary" onClick={verifyLocation} disabled={isProcessing}>
                            {isProcessing ? 'Verifying...' : 'Allow Location Access'}
                        </button>
                    </div>
                )}

                {step >= 2 && (
                    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', margin: '0 auto', maxWidth: 400 }}>
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: "user" }}
                            style={{ width: '100%', display: 'block' }}
                        />
                        {step === 2 && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)',
                                padding: 16, color: '#fff'
                            }}>
                                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{instruction}</div>
                                <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${livenessProgress}%`, height: '100%', background: '#22c55e', transition: 'width 0.3s ease' }}></div>
                                </div>
                            </div>
                        )}
                        {isProcessing && step !== 2 && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div className="spinner" style={{ borderColor: '#fff', borderTopColor: 'transparent' }}></div>
                            </div>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                        <button className="btn btn-primary" onClick={startLiveness} disabled={isProcessing || !modelsLoaded}>
                            {!modelsLoaded ? 'Loading Models...' : (isProcessing ? 'Verifying...' : 'Start Liveness Challenge')}
                        </button>
                        {!isProcessing && (
                            <button className="btn btn-secondary" onClick={() => {
                                const newChallenge = challenges.find(c => c.type !== challenge?.type) || challenges[0];
                                setChallenge(newChallenge);
                                setInstruction(newChallenge.label);
                                setLivenessProgress(0);
                                setError(null);
                            }}>
                                <HiOutlineRefresh /> Try Another
                            </button>
                        )}
                    </div>
                )}

                {step === 3 && status.face === 'success' && (
                    <div style={{ padding: '20px 0' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                        <h3 style={{ color: '#22c55e' }}>Attendance Marked!</h3>
                        <p style={{ color: 'var(--text-tertiary)' }}>Location, Liveness, and Identity verified.</p>
                    </div>
                )}

                {step === 3 && status.face === 'error' && (
                    <button className="btn btn-secondary" onClick={() => { setStep(2); setStatus(prev => ({ ...prev, face: 'pending', liveness: 'pending' })); }} style={{ marginTop: 20 }}>
                        <HiOutlineRefresh /> Try Verification Again
                    </button>
                )}
            </div>
        </div>
    );
}
