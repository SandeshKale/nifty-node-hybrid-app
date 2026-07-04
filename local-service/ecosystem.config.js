/**
 * ecosystem.config.js — PM2 config for local screenshot service
 * Only manages the screenshot/upload cycle + watchdog.
 * n8n is no longer used. The Vercel app handles everything else.
 *
 * Start: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'screenshot-loop',
      script: 'C:\\nifty-n8n\\screenshot-loop.js',
      autorestart: true,
      max_restarts: 999,
      min_uptime: '5s',
      restart_delay: 5000,
      watch: false,
    },
  ],
};
