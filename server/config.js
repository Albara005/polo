'use strict';
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
// On Railway, attach a Volume: its mount path is exposed as RAILWAY_VOLUME_MOUNT_PATH.
const DATA_DIR = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) return process.env.SESSION_SECRET;
  const file = path.join(DATA_DIR, '.session-secret');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch (_) { /* create below */ }
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOAD_DIR,
  PORT: Number(process.env.PORT) || 3000,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  SECRET: loadSecret(),
  PROD: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT
};
