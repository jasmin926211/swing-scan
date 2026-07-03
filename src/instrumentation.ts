export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Clean up scan sessions that were stuck in "running" (server killed mid-scan)
    const { cleanupStuckSessions } = await import('@/lib/scanner/engine');
    await cleanupStuckSessions();

    const { startScheduler } = await import('@/lib/scanner/scheduler');
    // 3:45 PM IST — 15 min after the 3:30 close so the day's candle is settled,
    // not the mid-closing-auction print you'd capture exactly at the bell.
    startScheduler(15, 45);
  }
}
