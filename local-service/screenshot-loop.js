/**
 * screenshot-loop.js — Captures Kite screenshot + uploads to Supabase
 * Runs continuously via PM2. Every 2 minutes during market hours:
 *   1. Runs screenshot.js to capture kite.png
 *   2. Runs upload.js to push to Supabase Storage
 *
 * Also handles /login commands by polling Telegram directly.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_FILE = path.join(__dirname, 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch(e) {}

const BOT_TOKEN = cfg.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = cfg.TELEGRAM_CHAT_ID || '380433720';
const SCREENSHOT_INTERVAL_MS = 120000; // 2 minutes
const LOGIN_POLL_INTERVAL_MS = 15000;  // 15 seconds

function getIST() {
  const now = new Date(Date.now() + 5.5 * 3600000);
  return {
    day: now.getUTCDay(),
    totalMin: now.getUTCHours() * 60 + now.getUTCMinutes(),
    timeStr: now.getUTCHours() + ':' + String(now.getUTCMinutes()).padStart(2, '0'),
  };
}

function isMarketHours() {
  const ist = getIST();
  return ist.day >= 1 && ist.day <= 5 && ist.totalMin >= 555 && ist.totalMin <= 930;
}

function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 180000, cwd: __dirname }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '', exitCode: err ? err.code : 0 });
    });
  });
}

async function captureAndUpload() {
  const ist = getIST();
  console.log(`[${ist.timeStr} IST] Capturing screenshot...`);

  const ssResult = await runCommand('node screenshot.js');
  if (!ssResult.ok || !ssResult.stdout.includes('SUCCESS')) {
    console.log(`[${ist.timeStr}] Screenshot failed: ${ssResult.stderr.slice(0, 100)}`);
    if (ssResult.stdout.includes('SESSION_EXPIRED')) {
      sendTelegram('Kite session expired. Send /login.');
    }
    return;
  }

  console.log(`[${ist.timeStr}] Screenshot OK. Uploading...`);
  const upResult = await runCommand('node upload.js');
  if (upResult.ok) {
    console.log(`[${ist.timeStr}] Upload OK.`);
  } else {
    console.log(`[${ist.timeStr}] Upload failed: ${upResult.stderr.slice(0, 100)}`);
  }
}

function sendTelegram(text) {
  if (!BOT_TOKEN) return;
  const body = JSON.stringify({ chat_id: CHAT_ID, text });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: '/bot' + BOT_TOKEN + '/sendMessage',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    timeout: 10000,
  }, () => {});
  req.on('error', () => {});
  req.write(body);
  req.end();
}

// ── Main loop ──────────────────────────────────────────────────
console.log('Screenshot loop started. Interval: ' + (SCREENSHOT_INTERVAL_MS / 1000) + 's');

// Initial capture
captureAndUpload();

// Regular interval
setInterval(() => {
  if (isMarketHours()) {
    captureAndUpload();
  }
}, SCREENSHOT_INTERVAL_MS);

// Login reminder at 9:10 AM IST
setInterval(() => {
  const ist = getIST();
  if (ist.day >= 1 && ist.day <= 5 && ist.totalMin >= 550 && ist.totalMin <= 552) {
    const stateFile = path.join(__dirname, 'kite-state.json');
    try {
      const age = (Date.now() - fs.statSync(stateFile).mtimeMs) / 3600000;
      if (age > 14) {
        sendTelegram('Kite session expired. Market opens in 5 min! Send /login now.');
      }
    } catch(e) {
      sendTelegram('No Kite session found. Send /login before market open.');
    }
  }
}, 60000);
