const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const cloudinaryEnabled = Boolean(process.env.CLOUDINARY_URL);
let cloudinary = null;

if (cloudinaryEnabled) {
  // استخدام Cloudinary عند وجود CLOUDINARY_URL
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
}

const tmpDir = path.join(__dirname, '..', 'public', 'uploads', 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024)
  },
  fileFilter: (_req, file, cb) => {
    // Strict allowlist — block SVG (XSS vector), BMP, TIFF, etc.
    const allowedMime = /^image\/(png|jpe?g|gif|webp)$/;
    const allowedExt = /^\.(png|jpe?g|gif|webp)$/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    const blockedExtensions = ['.svg', '.svgz', '.bmp', '.ico', '.tiff', '.tif'];
    if (blockedExtensions.includes(ext)) {
      return cb(new Error('This file type is not allowed'));
    }
    // Require BOTH mimetype AND extension to match the allowlist
    if (allowedMime.test(file.mimetype) && allowedExt.test(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Only image uploads are allowed (PNG, JPG, GIF, WebP)'));
  }
});

function ensureDir(relativeDir) {
  const absPath = path.join(__dirname, '..', 'public', relativeDir);
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
  }
  return absPath;
}

async function storeOneFile(file, targetDir = 'uploads') {
  if (!file) return null;

  if (cloudinaryEnabled && cloudinary) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: `whale/${targetDir}`
      });
      fs.unlink(file.path, () => {});
      return result.secure_url;
    } catch (error) {
      // fallback local storage when cloud upload fails
      console.warn('Cloudinary upload failed, fallback to local:', error.message);
    }
  }

  const destinationDir = ensureDir(targetDir);
  const ext = path.extname(file.originalname || file.filename || '.jpg') || '.jpg';
  const fileName = `${Date.now()}-${uuidv4()}${ext.toLowerCase()}`;
  const destination = path.join(destinationDir, fileName);

  await fs.promises.rename(file.path, destination);
  return `/${targetDir.replace(/\\/g, '/')}/${fileName}`;
}

async function storeFiles(files, targetDir = 'uploads', max = 6) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const limited = files.slice(0, max);
  // Upload files in parallel for much faster performance
  const results = await Promise.allSettled(
    limited.map((file) => storeOneFile(file, targetDir))
  );
  return results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);
}

module.exports = {
  upload,
  storeOneFile,
  storeFiles,
  cloudinaryEnabled
};
