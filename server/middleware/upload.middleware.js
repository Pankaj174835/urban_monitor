const multer = require('multer');
const path = require('path');
const fs = require('fs');

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let storage;

if (isServerless) {
  // Use memory storage in serverless environments (read-only filesystem)
  storage = multer.memoryStorage();
} else {
  const uploadDir = path.join(__dirname, '../../uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, uploadDir);
      },
      filename: function (req, file, cb) {
        let ext = path.extname(file.originalname || '').toLowerCase();
        if (!ext || ext === '.') {
          if (file.mimetype === 'image/png') ext = '.png';
          else if (file.mimetype === 'image/webp') ext = '.webp';
          else ext = '.jpg';
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `drain-${uniqueSuffix}${ext}`);
      }
    });
  } catch (err) {
    console.warn('[Upload] Disk storage unavailable, falling back to memory storage:', err.message);
    storage = multer.memoryStorage();
  }
}

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', ''];

  const isMimeValid = allowedMimes.includes(file.mimetype);
  const isExtValid = allowedExts.includes(ext);

  if (isMimeValid && isExtValid) {
    console.log(`[Upload Middleware] File accepted: ${file.originalname || 'camera-capture.jpg'} (${file.mimetype})`);
    return cb(null, true);
  } else {
    console.warn(`[Upload Middleware] File rejected: ${file.originalname || 'unknown'} (${file.mimetype}). Allowed types: JPG, PNG, WebP.`);
    cb(new Error('Invalid file format. Only JPG, JPEG, PNG, and WebP images are allowed.'));
  }
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5;

const upload = multer({
  storage: storage,
  limits: { fileSize: maxFileSizeMB * 1024 * 1024 },
  fileFilter: fileFilter
});

module.exports = upload;
