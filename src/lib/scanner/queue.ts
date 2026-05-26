import { ScanProgress } from '@/types/scan';

type Listener = (progress: ScanProgress) => void;

class ScanProgressTracker {
  private listeners: Set<Listener> = new Set();
  private currentProgress: ScanProgress | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Send current progress immediately if scan is running
    if (this.currentProgress) {
      listener(this.currentProgress);
    }
    return () => this.listeners.delete(listener);
  }

  emit(progress: ScanProgress) {
    this.currentProgress = progress;
    this.listeners.forEach((listener) => {
      try {
        listener(progress);
      } catch {
        // Ignore listener errors
      }
    });
  }

  getProgress(): ScanProgress | null {
    return this.currentProgress;
  }

  clear() {
    this.currentProgress = null;
  }
}

export const scanProgressTracker = new ScanProgressTracker();
