import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { hasPermission, requireAuth } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

function detectedImageType(buffer) {
  if (buffer?.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer?.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (buffer?.length >= 12 && buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP') return 'image/webp';
  return null;
}

async function handleImageUpload(req, res, forcedFolder) {
  if (!req.file) return res.status(400).json({ error: 'A JPEG, PNG, or WebP image is required' });
  if (!detectedImageType(req.file.buffer)) return res.status(400).json({ error: { code: 'UPLOAD_TYPE_INVALID', message: 'The uploaded file is not a valid JPEG, PNG, or WebP image' } });
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return res.status(503).json({ error: 'Cloudinary is not configured' });
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });

  const folder = forcedFolder || (req.body.folder === 'profiles' ? 'skyland/profiles' : 'skyland/products');
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image', transformation: [{ width: 1200, height: 1200, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }] }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
    stream.end(req.file.buffer);
  });
  res.status(201).json({ url: result.secure_url, publicId: result.public_id });
}

const registrationUploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
router.post('/registration-profile', registrationUploadLimiter, upload.single('image'), (req, res) => handleImageUpload(req, res, 'skyland/profiles'));
router.post('/image', requireAuth, upload.single('image'), (req, res) => {
  if (req.body.folder !== 'profiles' && !hasPermission(req.user, 'products_manage')) {
    return res.status(403).json({ error: 'You do not have permission to upload product pictures' });
  }
  return handleImageUpload(req, res);
});

export default router;
