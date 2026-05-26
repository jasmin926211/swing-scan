export interface UpstoxCandle {
  // Upstox returns candles as arrays: [timestamp, open, high, low, close, volume, oi]
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
}

export interface UpstoxHistoricalResponse {
  status: string;
  data: {
    candles: [string, number, number, number, number, number, number][];
  };
}

export interface UpstoxTokenResponse {
  email: string;
  exchanges: string[];
  products: string[];
  broker: string;
  user_id: string;
  user_name: string;
  order_types: string[];
  user_type: string;
  poa: boolean;
  is_active: boolean;
  access_token: string;
}

export interface UpstoxInstrument {
  segment: string;
  name: string;
  exchange: string;
  isin?: string;
  instrument_type: string;
  instrument_key: string;
  lot_size: number;
  freeze_quantity: number;
  exchange_token: string;
  tick_size: number;
  trading_symbol: string;
  short_name?: string;
  qty_multiplier: number;
  security_type?: string;
}
