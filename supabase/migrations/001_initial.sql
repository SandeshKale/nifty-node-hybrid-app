-- Nifty Auto-Trader v14 — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run

-- Analysis runs
CREATE TABLE IF NOT EXISTS analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  ist_time TEXT NOT NULL,
  score INTEGER,
  verdict TEXT,
  scorecard JSONB,
  extracted_data JSONB,
  scores JSONB,
  raw_llm_response TEXT,
  provider_used TEXT,
  fallback_used BOOLEAN DEFAULT false,
  duration_ms INTEGER,
  screenshot_url TEXT,
  market_data JSONB,
  error TEXT,
  status TEXT DEFAULT 'completed'
);

-- Structured logs
CREATE TABLE IF NOT EXISTS analysis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES analysis_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  level TEXT NOT NULL,
  component TEXT NOT NULL,
  action TEXT NOT NULL,
  duration_ms INTEGER,
  success BOOLEAN,
  input_summary JSONB,
  output_summary JSONB,
  error TEXT,
  metadata JSONB
);

-- Trade state
CREATE TABLE IF NOT EXISTS trade_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  date TEXT,
  trades_today INTEGER DEFAULT 0,
  in_position BOOLEAN DEFAULT false,
  last_symbol TEXT,
  last_verdict TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Telegram polling offset
CREATE TABLE IF NOT EXISTS tg_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  poll_offset BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Screenshot metadata
CREATE TABLE IF NOT EXISTS screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  storage_path TEXT NOT NULL,
  size_bytes INTEGER,
  session_age_hours REAL,
  uploaded_by TEXT DEFAULT 'local-service'
);

-- Insert initial trade state
INSERT INTO trade_state (id, date, trades_today, in_position)
VALUES ('current', '', 0, false)
ON CONFLICT (id) DO NOTHING;

-- Insert initial telegram state
INSERT INTO tg_state (id, poll_offset)
VALUES ('current', 0)
ON CONFLICT (id) DO NOTHING;

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created ON analysis_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_run_id ON analysis_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_level ON analysis_logs(level);
CREATE INDEX IF NOT EXISTS idx_screenshots_created ON screenshots(created_at DESC);

-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to screenshots bucket
CREATE POLICY "Public read screenshots" ON storage.objects
  FOR SELECT USING (bucket_id = 'screenshots');

-- Allow service role to upload screenshots
CREATE POLICY "Service role upload screenshots" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Service role update screenshots" ON storage.objects
  FOR UPDATE USING (bucket_id = 'screenshots');
