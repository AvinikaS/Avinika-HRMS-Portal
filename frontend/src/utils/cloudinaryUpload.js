import api from './api';

/**
 * Upload a file directly to Cloudinary from the browser.
 * The file never passes through the backend, so Vercel's 4.5MB body limit is bypassed.
 *
 * Flow:
 * 1. Ask backend for a signed upload signature (tiny JSON request).
 * 2. POST the file directly to Cloudinary's upload endpoint.
 * 3. Return the secure_url (the Cloudinary URL) to the caller.
 *
 * @param {File} file - The File object to upload
 * @param {string} folder - Cloudinary folder, e.g. 'hrms/profiles'
 * @param {Function} [onProgress] - Optional progress callback (0-100)
 * @returns {Promise<{url: string, publicId: string, size: number, format: string}>}
 */
export async function uploadToCloudinary(file, folder = 'hrms/misc', onProgress) {
    // Step 1: Get signed credentials from backend
    const { data: sigRes } = await api.post('/upload/signature', { folder });
    const { signature, timestamp, cloudName, apiKey, folder: signedFolder } = sigRes.data;

    // Step 2: Direct upload to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', signedFolder);

    const xhr = new XMLHttpRequest();
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    return new Promise((resolve, reject) => {
        xhr.open('POST', uploadUrl);

        if (onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const result = JSON.parse(xhr.responseText);
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    size: result.bytes,
                    format: result.format
                });
            } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Upload failed: Network error'));
        xhr.send(formData);
    });
}
