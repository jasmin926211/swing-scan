import cron from 'node-cron';
import { runScan, isScanning } from './engine';

let scheduledTask: cron.ScheduledTask | null = null;

export function startScheduler(hour: number = 15, minute: number = 45) {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  // Cron expression: minute hour * * 1-5 (weekdays only)
  const cronExpression = `${minute} ${hour} * * 1-5`;

  scheduledTask = cron.schedule(
    cronExpression,
    async () => {
      console.log(`[Scheduler] Auto-scan triggered at ${new Date().toISOString()}`);

      if (isScanning()) {
        console.log('[Scheduler] Scan already in progress, skipping');
        return;
      }

      try {
        const sessionId = await runScan('scheduled');
        console.log(`[Scheduler] Scan completed: ${sessionId}`);
      } catch (error) {
        console.error('[Scheduler] Scan failed:', error);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log(`[Scheduler] Auto-scan scheduled at ${hour}:${minute.toString().padStart(2, '0')} IST (weekdays)`);
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Scheduler] Auto-scan stopped');
  }
}

export function isSchedulerRunning(): boolean {
  return scheduledTask !== null;
}
