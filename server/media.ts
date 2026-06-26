import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type MediaItem = {
  name: string;
  url: string;
  type: 'image' | 'audio';
  mimeType?: string;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const mediaDir = path.join(publicDir, 'media');
const imagesDir = path.join(mediaDir, 'images');
const audioDir = path.join(mediaDir, 'audio');
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/ogg']);

const useImageKit = Boolean(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT);

async function ensureLocalFolders() {
  await Promise.all([fs.mkdir(imagesDir, { recursive: true }), fs.mkdir(audioDir, { recursive: true })]);
}

async function listLocalMedia(): Promise<MediaItem[]> {
  const [imageFiles, audioFiles] = await Promise.all([
    fs.readdir(imagesDir, { withFileTypes: true }),
    fs.readdir(audioDir, { withFileTypes: true }),
  ]);

  return [
    ...imageFiles.filter((file) => file.isFile()).map((file) => ({ name: file.name, url: `/media/images/${file.name}`, type: 'image' as const })),
    ...audioFiles.filter((file) => file.isFile()).map((file) => ({ name: file.name, url: `/media/audio/${file.name}`, type: 'audio' as const })),
  ];
}

async function uploadToImageKit(file: Express.Multer.File): Promise<MediaItem> {
  const formData = new FormData();
  formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  formData.append('fileName', file.originalname);
  formData.append('folder', file.mimetype.startsWith('audio/') ? '/quiz/audio' : '/quiz/images');

  const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`ImageKit upload failed: ${response.status}`);
  }

  const result = (await response.json()) as { fileId: string; url: string };

  return {
    name: result.fileId,
    url: result.url,
    type: file.mimetype.startsWith('audio/') ? 'audio' : 'image',
    mimeType: file.mimetype,
  };
}

const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const destination = file.mimetype.startsWith('audio/') ? audioDir : imagesDir;
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safeBase}`);
  },
});

export function createMediaRouter() {
  const router = express.Router();

  if (!useImageKit) {
    void ensureLocalFolders();
    router.use(express.static(mediaDir));
  }

  router.get('/', async (_req, res) => {
    if (useImageKit) {
      return res.json([]);
    }
    const items = await listLocalMedia();
    res.json(items);
  });

  router.post('/', multer({ storage: useImageKit ? memoryStorage : diskStorage, fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Unsupported file type.'));
      return;
    }
    cb(null, true);
  } }).single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    if (useImageKit) {
      const uploaded = await uploadToImageKit(req.file);
      return res.status(201).json(uploaded);
    }

    const type = req.file.mimetype.startsWith('audio/') ? 'audio' : 'image';
    const folder = type === 'audio' ? 'audio' : 'images';
    res.status(201).json({
      name: req.file.filename,
      url: `/media/${folder}/${req.file.filename}`,
      type,
      mimeType: req.file.mimetype,
    });
  });

  router.delete('/:name', async (req, res) => {
    if (useImageKit) {
      const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(req.params.name)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}`,
        },
      });
      if (!response.ok && response.status !== 204) {
        return res.status(response.status).json({ message: 'ImageKit delete failed.' });
      }
      return res.status(204).send();
    }
    const fileName = path.basename(req.params.name);
    const candidatePaths = [path.join(imagesDir, fileName), path.join(audioDir, fileName)];
    for (const filePath of candidatePaths) {
      try {
        await fs.unlink(filePath);
        return res.status(204).send();
      } catch {
        continue;
      }
    }
    return res.status(404).json({ message: 'File not found.' });
  });

  return router;
}
