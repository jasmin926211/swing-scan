export interface ScanProgress {
  sessionId: string;
  status: 'running' | 'completed' | 'failed';
  totalStocks: number;
  scannedCount: number;
  errorCount: number;
  patternsFound: number;
  currentStock?: string;
  startedAt: string;
  completedAt?: string;
}

export interface ScanResultItem {
  id: string;
  tradingSymbol: string;
  companyName: string;
  patternName: string;
  patternDisplayName: string;
  patternCategory: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  signalStrength: number;
  confidence: number;
  entryPrice: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  riskRewardRatio: number | null;
  currentPrice: number;
  rsiValue: number | null;
  volumeRatio: number | null;
}

export interface ScanSummary {
  sessionId: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  triggerType: string;
  totalStocks: number;
  scannedCount: number;
  patternsFound: number;
  topResults: ScanResultItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
