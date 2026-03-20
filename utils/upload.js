const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(UPLOAD_DIR, 'whale');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

let cloudinary = null;
let cloudinaryEnabled = false;

try {
  if (process.env.CLOUDINARY_URL) {
    cloudinary = require('cloudinary').v2;
    cloudinaryEnabled = true;
  }
} catch (_e) {
  /* cloudinary not available */
}

async function storeOneFile(file) {
  if (!file) return null;
  if (cloudinaryEnabled && cloudinary) {
    try {
      const result = await cloudinary.uploader.upload(file.path, { folder: 'whale' });
      fs.unlink(file.path, () => {});
      return result.secure_url;
    } catch (_e) {
      /* fall through to local */
    }
  }
  return `/uploads/whale/${file.filename}`;
}

async function storeFiles(files, max = 6) {
  if (!files || !files.length) return [];
  const limited = files.slice(0, max);
  return Promise.all(limited.map(storeOneFile));
}

module.exports = { upload, storeOneFile, storeFiles, cloudinaryEnabled };
