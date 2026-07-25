const faceapi = require('face-api.js');
const canvas = require('canvas');
const path = require('path');
const fs = require('fs');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

async function loadModels() {
    if (modelsLoaded) return;
    const modelPath = path.join(__dirname, '../models/face_models');

    try {
        await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
        modelsLoaded = true;
        console.log('Face Match models loaded successfully');
    } catch (err) {
        console.error('Error loading face models:', err.message);
    }
}

/**
 * Compare two images for face matching
 * @param {string} capturedImagePath - Path to the live captured selfie
 * @param {string} profileImagePath - Path to the stored profile image
 * @returns {Promise<number>} - Confidence score (0 to 100)
 */
exports.compareFaces = async (capturedImagePath, profileImagePath) => {
    try {
        await loadModels();

        const img1 = await canvas.loadImage(capturedImagePath);
        const img2 = await canvas.loadImage(profileImagePath);

        const detection1 = await faceapi.detectSingleFace(img1, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        const detection2 = await faceapi.detectSingleFace(img2, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

        if (!detection1 || !detection2) {
            console.log('Face not detected in one of the images');
            return 0;
        }

        const distance = faceapi.euclideanDistance(detection1.descriptor, detection2.descriptor);

        // Convert distance to confidence score
        // Distance < 0.6 is typically a match
        let confidence = 0;
        if (distance < 0.6) {
            confidence = Math.max(80, (1 - (distance / 0.6)) * 100);
        } else {
            confidence = Math.max(0, (1 - (distance / 1.5)) * 60);
        }

        return Math.round(confidence);
    } catch (err) {
        console.error('Face comparison error:', err.message);
        return 0;
    }
};
