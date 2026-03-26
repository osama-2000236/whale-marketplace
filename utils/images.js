const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
  },
});

async function uploadToCloud(file) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return '/uploads/' + file.filename;
  }
  const result = await cloudinary.uploader.upload(file.path, {
    folder: 'whale',
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
  });
  const fs = require('fs');
  fs.unlink(file.path, () => {});
  return result.secure_url;
}

async function processImages(files) {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    urls.push(await uploadToCloud(file));
  }
  return urls;
}

module.exports = { upload, processImages, uploadToCloud };
