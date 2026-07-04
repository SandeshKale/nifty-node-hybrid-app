import { getServerSupabase } from '@/lib/supabase';
import { log } from '@/lib/logging/logger';

export async function getLatestScreenshot(): Promise<{
  base64: string | null;
  ageMinutes: number;
  sizeKB: number;
  url: string | null;
}> {
  const start = Date.now();
  const sb = getServerSupabase();

  try {
    // Get latest screenshot metadata
    const { data: meta } = await sb
      .from('screenshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!meta) {
      await log('WARN', 'screenshot', 'get_latest', {
        duration_ms: Date.now() - start,
        success: false,
        error: 'No screenshots found in database',
      });
      return { base64: null, ageMinutes: 9999, sizeKB: 0, url: null };
    }

    const ageMs = Date.now() - new Date(meta.created_at).getTime();
    const ageMinutes = Math.round(ageMs / 60000);

    // Download from storage
    const { data: fileData, error } = await sb.storage
      .from('screenshots')
      .download(meta.storage_path);

    if (error || !fileData) {
      await log('WARN', 'screenshot', 'download', {
        duration_ms: Date.now() - start,
        success: false,
        error: error?.message ?? 'No file data',
      });
      return { base64: null, ageMinutes, sizeKB: 0, url: null };
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString('base64');
    const sizeKB = Math.round(buffer.length / 1024);

    // Get public URL for display
    const { data: urlData } = sb.storage.from('screenshots').getPublicUrl(meta.storage_path);

    await log('INFO', 'screenshot', 'get_latest', {
      duration_ms: Date.now() - start,
      success: true,
      output_summary: { age_minutes: ageMinutes, size_kb: sizeKB, path: meta.storage_path },
    });

    return { base64, ageMinutes, sizeKB, url: urlData?.publicUrl ?? null };
  } catch (e) {
    await log('ERROR', 'screenshot', 'get_latest', {
      duration_ms: Date.now() - start,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return { base64: null, ageMinutes: 9999, sizeKB: 0, url: null };
  }
}
