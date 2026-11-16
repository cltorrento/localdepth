import http from 'node:http';
import crypto from 'node:crypto';
import { createLogger } from '@localdepth/logger';

const logger = createLogger('api-gateway');
const PORT = Number(process.env.API_GATEWAY_PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'localdepth_super_secret_jwt_key_change_in_production_2026';
const personalizedTripRequests = new Map<string, number[]>();
const personalizedTripLimit = 10;
const personalizedTripWindowMs = 60 * 60 * 1000;

// Service Target Map
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  content: process.env.CONTENT_SERVICE_URL || 'http://localhost:4002',
  media: process.env.MEDIA_SERVICE_URL || 'http://localhost:4003',
  search: process.env.SEARCH_SERVICE_URL || 'http://localhost:4004',
  recommendations: process.env.RECOMMENDATIONS_SERVICE_URL || 'http://localhost:4005',
};

function verifyToken(token: string): any | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    if (expectedSig !== signature) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function proxyRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetBaseUrl: string,
  targetPath: string
) {
  const targetUrl = new URL(targetPath, targetBaseUrl);
  const options: http.RequestOptions = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    logger.error(`Proxy forwarding error to ${targetBaseUrl}`, { error: err.message, path: targetPath });
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        error: `Bad Gateway: Could not reach downstream service at ${targetBaseUrl}`,
      })
    );
  });

  req.pipe(proxyReq, { end: true });
}

export function handleGatewayRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  serviceHandlers?: Record<string, (req: any, res: any) => Promise<any> | any>
) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';
  const path = url.pathname;

  // Global CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-role');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Gateway Aggregate Healthcheck
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        gatewayPort: PORT,
        services: SERVICES,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Extract auth token if provided
  let authUser: any = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    authUser = verifyToken(token);
    if (authUser) {
      req.headers['x-user-id'] = authUser.id;
      req.headers['x-user-role'] = authUser.role;
    }
  }

  // Helper dispatcher: direct handler if provided, otherwise proxy
  const dispatch = (serviceKey: 'auth' | 'content' | 'media' | 'search' | 'recommendations') => {
    const downstreamPath = path.replace('/api', '') + url.search;
    if (serviceHandlers && serviceHandlers[serviceKey]) {
      // Direct in-process dispatch
      req.url = downstreamPath;
      return serviceHandlers[serviceKey](req, res);
    }
    return proxyRequest(req, res, SERVICES[serviceKey], downstreamPath);
  };

  // 1. Auth service: /api/auth/*
  if (path.startsWith('/api/auth')) {
    return dispatch('auth');
  }

  // 2. Content service: /api/content/*
  if (path.startsWith('/api/content')) {
    return dispatch('content');
  }

  // 3. Media service: /api/media/*
  if (path.startsWith('/api/media')) {
    return dispatch('media');
  }

  // 4. Search service: /api/search
  if (path.startsWith('/api/search')) {
    return dispatch('search');
  }

  // 5. Recommendations service (Travel Copilot): /api/recommendations/*
  if (path.startsWith('/api/recommendations')) {
    if (path === '/api/recommendations/plan-and-send' && method === 'POST') {
      const clientKey = req.socket?.remoteAddress || 'unknown';
      const now = Date.now();
      const recentRequests = (personalizedTripRequests.get(clientKey) || [])
        .filter((timestamp) => now - timestamp < personalizedTripWindowMs);
      if (recentRequests.length >= personalizedTripLimit) {
        personalizedTripRequests.set(clientKey, recentRequests);
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '3600' });
        res.end(JSON.stringify({ success: false, error: 'Has alcanzado el límite de solicitudes de itinerario. Inténtalo más tarde.' }));
        return;
      }
      recentRequests.push(now);
      personalizedTripRequests.set(clientKey, recentRequests);
    }
    return dispatch('recommendations');
  }

  // 404 Route Not Found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      success: false,
      error: `LocalDepth API Gateway: Endpoint '${method} ${path}' not found. Available prefixes: /api/auth, /api/content, /api/media, /api/search, /api/recommendations`,
    })
  );
}

const server = http.createServer((req, res) => handleGatewayRequest(req, res));

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(PORT, () => {
    logger.info(`LocalDepth API Gateway running on port ${PORT}`);
    logger.info(`Forwarding routes:`);
    logger.info(` - /api/auth/*           -> ${SERVICES.auth}`);
    logger.info(` - /api/content/*        -> ${SERVICES.content}`);
    logger.info(` - /api/media/*          -> ${SERVICES.media}`);
    logger.info(` - /api/search           -> ${SERVICES.search}`);
    logger.info(` - /api/recommendations/* -> ${SERVICES.recommendations}`);
  });
}
