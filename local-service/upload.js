/**
 * upload.js — Uploads kite.png to Supabase Storage
 * Runs after screenshot.js captures a new screenshot.
 *
 * Usage: node upload.js
 * Requires config.json with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_FILE = path.join(__dirname, 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch(e) { console.error('Missing config.json'); process.exit(1); }

const SUPABASE_URL = cfg.SUPABASE_URL || '';
const SUPABASE_KEY = cfg.SUPABASE_SERVICE_ROLE_KEY || '';
const KITE_PNG = path.join(__dirname, 'kite.png');

async function upload() {
  if (!fs.existsSync(KITE_PNG)) {
    console.error('kite.png not found');
    process.exit(1);
  }

  const imageData = fs.readFileSync(KITE_PNG);
  const sizeKB = Math.round(imageData.length / 1024);
  const fileName = `kite-${Date.now()}.png`;

  console.log(`Uploading kite.png (${sizeKB} KB) as ${fileName}...`);

  // Upload to Supabase Storage
  const url = `${SUPABASE_URL}/storage/v1/object/screenshots/${fileName}`;
  const result = await new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'image/png',
        'Content-Length': imageData.length,
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(imageData);
    req.end();
  });

  if (result.status !== 200) {
    console.error(`Upload failed: HTTP ${result.status} — ${result.data}`);
    process.exit(1);
  }

  console.log(`Uploaded: ${fileName}`);

  // Insert metadata record
  const metaUrl = `${SUPABASE_URL}/rest/v1/screenshots`;
  const metaBody = JSON.stringify({
    storage_path: fileName,
    size_bytes: imageData.length,
    session_age_hours: getSessionAge(),
    uploaded_by: 'local-service',
  });

  await new Promise((resolve, reject) => {
    const parsedUrl = new URL(metaUrl);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(metaBody);
    req.end();
  });

  console.log('Metadata recorded. Done.');
}

function getSessionAge() {
  try {
    const stateFile = path.join(__dirname, 'kite-state.json');
    return parseFloat(((Date.now() - fs.statSync(stateFile).mtimeMs) / 3600000).toFixed(1));
  } catch {
    return -1;
  }
}

upload().catch(e => { console.error(e.message); process.exit(1); });
