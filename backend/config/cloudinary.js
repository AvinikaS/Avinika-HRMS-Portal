const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Delete a file from Cloudinary by its public_id
 * @param {string} publicId - The public_id of the file to delete
 */
const deleteFromCloudinary = async (publicId, resourceType = null) => {
    try {
        if (!publicId) return;

        // If specific type is provided, use it
        if (resourceType && resourceType !== 'auto') {
            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            return;
        }

        // Otherwise try image first (PDFs are often stored as images)
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });

        // If not found as image, try as raw (Docx, txt, etc)
        if (result.result === 'not_found' || resourceType === 'auto') {
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
        }
    } catch (err) {
        console.error('Cloudinary delete error:', err.message);
    }
};

/**
 * Extract public_id from a Cloudinary URL
 * @param {string} url - Full Cloudinary URL
 * @returns {string|null} - public_id or null
 */
const getPublicIdFromUrl = (url) => {
    if (!url || !url.includes('cloudinary')) return null;
    try {
        // URL format: https://res.cloudinary.com/<cloud>/image/upload/v123/folder/filename.ext
        const parts = url.split('/upload/');
        if (parts.length < 2) return null;
        const afterUpload = parts[1];
        // Remove version prefix (v123456789/)
        const withoutVersion = afterUpload.replace(/^v\d+\//, '');
        // Remove file extension
        return withoutVersion.replace(/\.[^.]+$/, '');
    } catch {
        return null;
    }
};

module.exports = { cloudinary, deleteFromCloudinary, getPublicIdFromUrl };
