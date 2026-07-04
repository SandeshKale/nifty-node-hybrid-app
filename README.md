# Nifty Auto-Trader v14 — Hybrid Node.js + Vercel

Nifty 50 F&O options analysis system. Replaces the n8n workflow with a standalone Next.js app deployed on Vercel, backed by Supabase.

## Architecture

| Component | Runs where | Purpose |
|---|---|---|
| Next.js app | Vercel (free) | Dashboard, API routes, LLM cascade, market data, Telegram bot |
| Screenshot service | Windows laptop (PM2) | Playwright screenshot capture + upload to Supabase |
| Supabase | Cloud (free) | Database (logs, analysis history, state) + screenshot storage |
| cron-job.org | Cloud (free) | Triggers analysis every 2 min + Telegram polling every 1 min |

## Setup

### 1. Supabase
- Go to Supabase Dashboard → SQL Editor
- Run `supabase/migrations/001_initial.sql`

### 2. Vercel
```bash
npm install
vercel deploy
```
Set environment variables in Vercel Dashboard → Settings → Environment Variables (see `.env.example`).

### 3. Local Screenshot Service
```bash
cd local-service
npm install playwright
npx playwright install chromium
cp config.json.template config.json  # Fill in real values
```
Copy `screenshot.js` from `SandeshKale/nifty-auto-trader` repo into `local-service/`.

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 4. External Cron (cron-job.org)
Create two jobs:

| Job | URL | Schedule | Header |
|-----|-----|----------|--------|
| Analysis | `https://your-app.vercel.app/api/analyse` | `*/2 3-9 * * 1-5` (UTC) | `Authorization: Bearer <CRON_SECRET>` |
| Telegram | `https://your-app.vercel.app/api/telegram` | `* * * * *` | `Authorization: Bearer <CRON_SECRET>` |

## LLM Provider Cascade

| Priority | Provider | Model | Vision? |
|----------|----------|-------|---------|
| 1 | Groq | llama-4-scout-17b | Yes |
| 2 | Cerebras | llama-3.3-70b | No (text-only fallback) |
| 3 | Google AI Studio | gemini-2.5-flash | Yes |
| 4 | OpenRouter | llama-3.2-11b-vision | Yes |

Automatic failover on 429/5xx/timeout. Groq is the only required provider; others are optional.

## Telegram Commands

- `/analyse` — Run analysis now
- `/status` — System health
- `/history` — Last 5 analyses
- `/login` — Trigger Kite login
- `/help` — Command list

## Web Dashboard

- `/` — Latest analysis, scorecard, screenshot
- `/history` — All analysis runs with filters
- `/logs` — Structured log viewer + "Copy for Claude" button
- `/settings` — Provider status, config, health checks
