import http from 'node:http';
import crypto from 'node:crypto';
import { createLogger } from '@localdepth/logger';
import { MemoryStore } from '@localdepth/database';
import type { MediaFile } from '@localdepth/shared-types';

const logger = createLogger('media-service');
const PORT = Number(process.env.MEDIA_SERVICE_PORT) || 4003;
const store = MemoryStore.getInstance();

const readBody = (req: http.IncomingMessage): Promise<any> => {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
};

export async function handleMediaRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-role');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'media-service', timestamp: new Date().toISOString() }));
    return;
  }

  try {
    // GET /media
    if (path === '/media' && method === 'GET') {
      const items = Array.from(store.media.values());
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: items, meta: { total: items.length } }));
      return;
    }

    // POST /media/upload (Simulates / handles S3 MinIO upload)
    if (path === '/media/upload' && method === 'POST') {
      const body = await readBody(req);
      const id = crypto.randomUUID();
      const filename = body.filename || `image-${Date.now()}.jpg`;
      const originalName = body.originalName || filename;
      const mimeType = body.mimeType || 'image/jpeg';
      const size = body.size || 1024 * 250;
      const url =
        body.url ||
        `${process.env.MEDIA_PUBLIC_URL || "/media"}/${id}-${filename}`;

      const mediaItem: MediaFile = {
        id,
        filename,
        originalName,
        mimeType,
        size,
        url,
        altText: body.altText || null,
        width: body.width || 1200,
        height: body.height || 800,
        createdAt: new Date().toISOString(),
      };

      store.media.set(id, mediaItem);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: mediaItem }));
      return;
    }

    // GET /media/:id
    if (path.startsWith('/media/') && method === 'GET') {
      const id = path.replace('/media/', '');
      const item = store.media.get(id);
      if (!item) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Media not found' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: item }));
      return;
    }

    // DELETE /media/:id
    if (path.startsWith('/media/') && method === 'DELETE') {
      const id = path.replace('/media/', '');
      const deleted = store.media.delete(id);
      res.writeHead(deleted ? 200 : 404);
      res.end(JSON.stringify({ success: deleted, message: deleted ? 'Deleted' : 'Not found' }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: `Route ${method} ${path} not found` }));
  } catch (err: any) {
    logger.error('Error in media-service', { error: err.message });
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, error: 'Internal Server Error' }));
  }
}

const server = http.createServer(handleMediaRequest);

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(PORT, () => {
    logger.info(`Media service running on port ${PORT}`);
  });
}
