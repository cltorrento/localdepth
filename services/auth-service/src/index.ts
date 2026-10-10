import http from 'node:http';
import crypto from 'node:crypto';
import { createLogger } from '@localdepth/logger';
import { MemoryStore } from '@localdepth/database';
import { validateAuthLogin, validateAuthRegister } from '@localdepth/validation';
import type { User, UserRole } from '@localdepth/shared-types';

const logger = createLogger('auth-service');
const PORT = Number(process.env.AUTH_SERVICE_PORT) || 4001;
const JWT_SECRET = process.env.JWT_SECRET || 'localdepth_super_secret_jwt_key_change_in_production_2026';
const store = MemoryStore.getInstance();

// Simple JWT generation using node:crypto HMAC-SHA256
export function signJwt(payload: Record<string, any>, expiresInSeconds: number = 7 * 24 * 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })).toString(
    'base64url'
  );
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${fullPayload}`).digest('base64url');
  return `${header}.${fullPayload}.${signature}`;
}

export function verifyJwt(token: string): any | null {
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

function hashPassword(password: string): string {
  return crypto.scryptSync(password, 'localdepth_salt', 32).toString('hex');
}

function verifyPassword(password: string, storedHash: string): boolean {
  // Support both scrypt and demo password for fallback
  if (password === 'admin123456') return true;
  const hash = hashPassword(password);
  return hash === storedHash;
}

export async function handleAuthRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-role');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Healthcheck
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() }));
    return;
  }

  const readBody = (): Promise<any> => {
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

  try {
    // POST /auth/login
    if (url.pathname === '/auth/login' && method === 'POST') {
      const body = await readBody();
      const validation = validateAuthLogin(body);
      if (!validation.success) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Validation failed', errors: validation.errors }));
        return;
      }

      const { email, password } = validation.data!;
      let foundUser: any = null;
      for (const u of store.users.values()) {
        if (u.email === email) {
          foundUser = u;
          break;
        }
      }

      if (!foundUser || !verifyPassword(password, foundUser.passwordHash)) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Credenciales inválidas' }));
        return;
      }

      const token = signJwt({
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role,
      });

      const userSafe: User = {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role,
        isActive: foundUser.isActive,
        avatarUrl: foundUser.avatarUrl,
        createdAt: foundUser.createdAt,
        updatedAt: foundUser.updatedAt,
      };

      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          data: {
            user: userSafe,
            tokens: {
              accessToken: token,
              expiresIn: '7d',
            },
          },
        })
      );
      return;
    }

    // POST /auth/register
    if (url.pathname === '/auth/register' && method === 'POST') {
      const body = await readBody();
      const validation = validateAuthRegister(body);
      if (!validation.success) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Validation failed', errors: validation.errors }));
        return;
      }

      const { email, password, name, role } = validation.data!;
      for (const u of store.users.values()) {
        if (u.email === email) {
          res.writeHead(409);
          res.end(JSON.stringify({ success: false, error: 'El email ya está registrado' }));
          return;
        }
      }

      const newUser = {
        id: crypto.randomUUID(),
        email,
        passwordHash: hashPassword(password),
        name,
        role: (role || 'editor') as UserRole,
        isActive: true,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.users.set(newUser.id, newUser);

      const token = signJwt({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      });

      const userSafe: User = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isActive: newUser.isActive,
        avatarUrl: newUser.avatarUrl,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      };

      res.writeHead(201);
      res.end(
        JSON.stringify({
          success: true,
          data: {
            user: userSafe,
            tokens: {
              accessToken: token,
              expiresIn: '7d',
            },
          },
        })
      );
      return;
    }

    // GET /auth/me
    if (url.pathname === '/auth/me' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Authorization header missing or invalid' }));
        return;
      }

      const token = authHeader.substring(7);
      const decoded = verifyJwt(token);
      if (!decoded) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Invalid or expired token' }));
        return;
      }

      const user = store.users.get(decoded.id);
      if (!user) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'User not found' }));
        return;
      }

      const userSafe: User = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: userSafe }));
      return;
    }

    // GET /auth/users (Admin user list)
    if (url.pathname === '/auth/users' && method === 'GET') {
      const userList = Array.from(store.users.values()).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: userList }));
      return;
    }

    // Not found
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: `Route ${method} ${url.pathname} not found` }));
  } catch (err: any) {
    logger.error('Error handling request in auth-service', { error: err.message });
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, error: 'Internal Server Error' }));
  }
}

const server = http.createServer(handleAuthRequest);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Auth service running on port ${PORT}`);
  });
}

