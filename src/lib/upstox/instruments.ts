import { gunzipSync } from 'zlib';
import type { UpstoxInstrument } from './types';

const NSE_INSTRUMENTS_URL =
  'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';

/**
 * Fetch all NSE equity instruments from Upstox's public instrument master file.
 * Downloads the gzipped JSON, decompresses it, and filters for equity stocks only.
 *
 * @returns Array of UpstoxInstrument objects for NSE equities
 */
export async function fetchNSEEquityInstruments(): Promise<UpstoxInstrument[]> {
  console.log('Downloading NSE instrument master from Upstox...');

  const response = await fetch(NSE_INSTRUMENTS_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to download instrument file: ${response.status} ${response.statusText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const decompressed = gunzipSync(buffer);
  const instruments: UpstoxInstrument[] = JSON.parse(decompressed.toString());

  console.log(`Total NSE instruments downloaded: ${instruments.length}`);

  // Filter for equity segment only (excludes futures, options, index, etc.)
  const equityInstruments = instruments.filter(
    (inst) =>
      inst.segment === 'NSE_EQ' &&
      inst.instrument_type === 'EQ' &&
      inst.isin &&
      inst.trading_symbol
  );

  console.log(`NSE equity instruments: ${equityInstruments.length}`);

  return equityInstruments;
}
