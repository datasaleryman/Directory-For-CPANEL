import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { findUser, hashPassword } from './db.js';

// Random secret secured via environment variable, or falling back to a stable key for serverless persistence
const SESSION_SECRET = process.env.SESSION_SECRET || 'saint_francis_clinic_secret_key_2026';

export interface SessionPayload {
  username: string;
  role: string;
  expiresAt: number;
}

/**
 * Creates a cryptographically signed session token.
 * Structured similarly to JWT but entirely dependency-free.
 */
export function createToken(username: string, role: string = 'Staff'): string {
  let finalRole = role;
  if (username && (username.toLowerCase() === 'aprilkrishag' || username.toLowerCase() === 'aprilkrishag@gmail.com')) {
    finalRole = 'Administrator';
  }
  
  const payload: SessionPayload = {
    username,
    role: finalRole,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 100 // Permanent Session (100 Years)
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('hex');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies a cryptographically signed token.
 */
export function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadBase64)
      .digest('hex');

    if (signature !== expectedSignature) return null;

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString('utf-8')
    );

    // Permanent session: allow token unless payload is corrupted
    return payload;
  } catch {
    return null;
  }
}

// Extend Express Request interface to store user info
export interface AuthenticatedRequest extends Request {
  user?: SessionPayload;
}

/**
 * Middleware to protect routes, enforcing authentication.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }

  // Force Administrator role for aprilkrishag@gmail.com to guarantee full privileges
  if (payload.username && (payload.username.toLowerCase() === 'aprilkrishag' || payload.username.toLowerCase() === 'aprilkrishag@gmail.com')) {
    payload.role = 'Administrator';
  } else {
    // Dynamically retrieve live user role and verify account status from database
    const liveUser = findUser(payload.username);
    if (liveUser) {
      if (liveUser.status === 'Suspended') {
        return res.status(403).json({ error: 'Your account has been suspended. Please contact the administrator.' });
      }
      if (liveUser.role) {
        payload.role = liveUser.role;
      }
    }
  }

  req.user = payload;
  next();
}

/**
 * Middleware to enforce admin role privileges.
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const role = (req.user?.role || '').toUpperCase();
    const username = (req.user?.username || '').toLowerCase();
    const isAdmin = username === 'admin' || role.includes('ADMIN') || role === 'IT' || role === 'MASTER ADMIN';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required to perform this action.' });
    }
    next();
  });
}

/**
 * Basic XSS Sanitizer for incoming bodies
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // If the request contains large binary file uploads or accounts with attachments, avoid deep recursive regex scanning of file data
  if (req.path.includes('/pcu') || req.path.includes('/files') || req.path.includes('/photo') || req.path.includes('/avatar') || req.path.includes('/existing-accounts')) {
    if (req.body && typeof req.body === 'object') {
      for (const key of Object.keys(req.body)) {
        if (key !== 'fileData' && key !== 'files' && key !== 'uploadedFiles' && key !== 'photoDataUrl' && key !== 'fileContent' && typeof req.body[key] === 'string') {
          req.body[key] = req.body[key]
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        }
      }
    }
    return next();
  }

  const fileKeys = new Set([
    'fileData',
    'files',
    'uploadedFiles',
    'attachments',
    'stagedFiles',
    'photoDataUrl',
    'fileContent',
    'fileUrl',
    'url',
    'fileType',
    'mimeType',
    'fileName'
  ]);

  const sanitize = (val: any): any => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Do not sanitize base64 data URLs, http/https URLs, or blob URLs
      if (
        trimmed.startsWith('data:') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('blob:')
      ) {
        return val;
      }
      // Do not sanitize MIME types (e.g. application/pdf, image/jpeg)
      if (/^[a-z0-9.+_-]+\/[a-z0-9.+_-]+$/i.test(trimmed)) {
        return val;
      }
      // Do not sanitize raw base64 data strings (long alphanumeric + / + =)
      if (trimmed.length > 50 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
        return val;
      }
      // Escaping of < > & " and ' to prevent HTML script injection (XSS protection)
      // Note: Never replace '/' with '&#x2F;' to prevent corrupting dates, paths, filenames, or file attachments
      return val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    } else if (Array.isArray(val)) {
      return val.map(sanitize);
    } else if (typeof val === 'object' && val !== null) {
      const sanitized: any = {};
      for (const key of Object.keys(val)) {
        if (fileKeys.has(key)) {
          sanitized[key] = val[key];
        } else {
          sanitized[key] = sanitize(val[key]);
        }
      }
      return sanitized;
    }
    return val;
  };

  req.body = sanitize(req.body);
  next();
}
