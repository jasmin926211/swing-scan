export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Clean up scan sessions that were stuck in "running" (server killed mid-scan)
    const { cleanupStuckSessions } = await import('@/lib/scanner/engine');
    await cleanupStuckSessions();

    const { startScheduler } = await import('@/lib/scanner/scheduler');
    startScheduler(15, 30); // 3:30 PM IST
  }
}
