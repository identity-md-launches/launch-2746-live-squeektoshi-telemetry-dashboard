import { z } from 'zod';

export const API_BASE = 'https://api.squeekchain.com';
export const POLL_INTERVAL = 15_000;
export const BLOCK_UNITS = 1_000_000_000n;
export const REQUEST_TIMEOUT = 10_000;

const uint = z.string().regex(/^\d+$/);
const safeNumber = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid timestamp');
const blockSchema = z.object({
  blockHeight: uint,
  blockProgress: uint.refine((value) => BigInt(value) < BLOCK_UNITS),
  cumulativeWork: uint,
  workPerThousandBlocks: uint,
});
const measurementSchema = z.object({
  freshness: z.enum(['online', 'stale']),
  observedAt: timestamp,
  staleAfterSeconds: safeNumber,
  counterEpoch: z.string(),
  provenance: z.string(),
  coreStatus: z.string(),
  rpmMilli: safeNumber,
  speedMmPerSecond: safeNumber,
  distanceMm: safeNumber,
});

export const statusSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: timestamp,
  measurement: measurementSchema.nullish(),
  builder: z.object({
    status: z.string(),
    anchor: blockSchema.extend({ settledThroughRound: uint, confirmedAt: timestamp.nullish() }).nullish(),
    projected: blockSchema.extend({ lifecycle: z.string().optional() }).nullish(),
    reason: z.string().nullish(),
  }).nullish(),
  oracle: z.object({ state: z.string() }).nullish(),
  settlementQueue: z.object({
    status: z.string(),
    state: z.string().optional(),
    settlementEnabled: z.boolean().optional(),
    incidentOpen: z.boolean().optional(),
    blockedReason: z.string().nullish(),
    buffered: z.object({ roundCount: uint }).nullish(),
    latestSubmission: z.object({
      lifecycle: z.string(),
      settledThroughRound: uint,
      confirmedAt: timestamp.nullish(),
    }).nullish(),
  }).nullish(),
});

const availableEconomy = z.object({
  schemaVersion: z.literal(2),
  status: z.literal('available'),
  generatedAt: timestamp,
  chain: z.object({ target: z.string(), chainId: uint, safeThroughBlock: uint }),
  asset: z.object({ symbol: z.string(), decimals: z.number().int().min(0).max(36) }),
  lifecycle: z.object({ currentRound: uint, paused: z.boolean() }),
  supply: z.object({ capBaseUnits: uint, miningMintedBaseUnits: uint }),
  mining: z.object({ processedThroughRound: uint }),
});
const unavailableEconomy = z.object({
  status: z.literal('unavailable'),
  reason: z.string().nullish(),
  generatedAt: timestamp.optional(),
});
export const economySchema = z.discriminatedUnion('status', [availableEconomy, unavailableEconomy]);

export type StatusData = z.infer<typeof statusSchema>;
export type EconomyResponse = z.infer<typeof economySchema>;
export type EconomyData = z.infer<typeof availableEconomy>;
export type Measurement = z.infer<typeof measurementSchema>;
export type Resource<T> = { data: T | null; error: string | null; receivedAt: number | null };
export type Reading = { time: number; rpm: number; distance: number; epoch: string };

export async function readEndpoint<T>(path: string, schema: z.ZodType<T>, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { signal, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new Error(`API returned HTTP ${response.status}.`);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error('The API returned an unsupported data format.');
  return parsed.data;
}

export function formatInteger(value: string | bigint | null | undefined): string {
  return value == null ? '–' : new Intl.NumberFormat('en-US').format(BigInt(value));
}

/** Formats base units with integer arithmetic; onchain integers never pass through Number. */
export function formatToken(baseUnits: string, decimals: number, places = 2): string {
  const amount = BigInt(baseUnits);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  if (!places) return formatInteger(whole);
  const fraction = ((amount % scale) * 10n ** BigInt(places) / scale).toString().padStart(places, '0');
  return `${formatInteger(whole)}.${fraction}`;
}

export function compactToken(baseUnits: string, decimals: number): string {
  const whole = BigInt(baseUnits) / 10n ** BigInt(decimals);
  for (const [suffix, divisor] of [['B', 1_000_000_000n], ['M', 1_000_000n], ['K', 1_000n]] as const) {
    if (whole >= divisor) {
      const hundredths = (BigInt(baseUnits) * 100n) / (10n ** BigInt(decimals) * divisor);
      return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}${suffix}`;
    }
  }
  return formatToken(baseUnits, decimals);
}

export function percentOf(value: string, total: string | bigint): number | null {
  const denominator = BigInt(total);
  if (denominator <= 0n) return null;
  return Number(BigInt(value) * 1_000_000n / denominator) / 10_000;
}

export function measurementState(measurement: Measurement | null | undefined, now: number, failed = false) {
  if (!measurement) return { label: 'No reading', tone: 'neutral' as const, active: false };
  if (failed || measurement.freshness === 'stale' || now - Date.parse(measurement.observedAt) > measurement.staleAfterSeconds * 1000) {
    return { label: 'Stale reading', tone: 'warning' as const, active: false };
  }
  if (measurement.coreStatus === 'COUNTER_FAULT') return { label: 'Counter fault', tone: 'danger' as const, active: false };
  if (measurement.coreStatus === 'ACTIVE' || measurement.rpmMilli > 0 || measurement.speedMmPerSecond > 0) {
    return { label: 'Running', tone: 'good' as const, active: true };
  }
  if (measurement.coreStatus === 'IDLE') return { label: 'Resting', tone: 'good' as const, active: false };
  return { label: 'Unknown state', tone: 'neutral' as const, active: false };
}

export function relativeTime(time: number | null | undefined, now: number): string {
  if (time == null) return 'Not received';
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function addReading(readings: Reading[], measurement: Measurement | null | undefined, now: number): Reading[] {
  if (!measurement || measurementState(measurement, now).tone !== 'good') return readings;
  const time = Date.parse(measurement.observedAt);
  if (time > now + 30_000 || readings.some((reading) => reading.time === time && reading.epoch === measurement.counterEpoch)) return readings;
  return [...readings, { time, rpm: measurement.rpmMilli / 1000, distance: measurement.distanceMm / 1000, epoch: measurement.counterEpoch }]
    .filter((reading) => reading.time >= now - 3_600_000).sort((a, b) => a.time - b.time).slice(-300);
}
