const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

const storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
        let folder = 'hrms/misc';
        // 'auto' is generally best as it detects images vs raw files (PDFs/DOCs) automatically
        const resourceType = 'auto'; 

        if (file.fieldname === 'resume') folder = 'hrms/resumes';
        else if (file.fieldname === 'document') folder = 'hrms/documents';
        else if (file.fieldname === 'profileImage') folder = 'hrms/profiles';

        return {
            folder,
            resource_type: resourceType,
            access_mode: 'public',
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
            public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}`
        };
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error('Only documents and images are allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = upload;
