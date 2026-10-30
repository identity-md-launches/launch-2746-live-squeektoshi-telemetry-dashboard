// Deterministic test fixtures only. The production application never imports this file.
export function statusFixture(now, options = {}) {
  const block = { blockHeight: '4135', blockProgress: '35822082', cumulativeWork: '45957', workPerThousandBlocks: '11801' };
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    measurement: {
      freshness: 'online', observedAt: new Date(now - 4000).toISOString(), staleAfterSeconds: 120,
      counterEpoch: 'interaction-test-epoch', provenance: 'hardware', coreStatus: options.active ? 'ACTIVE' : 'IDLE',
      rpmMilli: options.active ? 12345 : 0, speedMmPerSecond: options.active ? 1250 : 0,
      distanceMm: options.active ? 123456 : 0,
      ...(options.measurement || {}),
    },
    builder: { status: 'available', anchor: { ...block, settledThroughRound: '609', confirmedAt: new Date(now - 600000).toISOString() }, projected: { ...block, lifecycle: 'optimistic' } },
    oracle: { state: 'accepted' },
    settlementQueue: { status: 'available', state: 'empty', settlementEnabled: true, incidentOpen: false, blockedReason: null, buffered: { roundCount: '0' }, latestSubmission: { lifecycle: 'confirmed', settledThroughRound: '609', confirmedAt: new Date(now - 600000).toISOString() } },
  };
}

export function economyFixture(now, round = '610') {
  return {
    schemaVersion: 2, status: 'available', generatedAt: new Date(now).toISOString(),
    chain: { target: 'sepolia', chainId: '11155111', safeThroughBlock: '12028756' },
    asset: { symbol: 'SQK', decimals: 18 }, lifecycle: { currentRound: round, paused: false },
    supply: { capBaseUnits: '2100000000000000000000000000', miningMintedBaseUnits: '16455437093891105632782688' },
    mining: { processedThroughRound: '609' },
  };
}
