import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Blocks, Check, CheckCheck, CircleHelp, Coins, Database, ExternalLink, HeartPulse, Pause, Play, Radio, RefreshCw, ShieldCheck, Sprout, Timer, TriangleAlert, WifiOff, X } from 'lucide-react';
import { API_BASE, BLOCK_UNITS, compactToken, formatInteger, formatToken, measurementState, percentOf, relativeTime, type Resource } from './api';
import { useTelemetry } from './useTelemetry';
import { WheelScene } from './components/WheelScene';
import { ActivityChart } from './components/ActivityChart';

function StatusBadge({ label, tone = 'good' }: { label: string; tone?: 'good' | 'neutral' | 'warning' | 'danger' }) {
  return <span className={`status-badge tone-${tone}`}><span className="status-dot" />{label}</span>;
}

function SourceRow({ label, path, resource, unavailable }: { label: string; path: string; resource: Resource<{ generatedAt?: string }>; unavailable?: boolean }) {
  const generated = resource.data?.generatedAt;
  return <div className="source-row"><div><h3>{label}</h3><a href={`${API_BASE}${path}`} target="_blank" rel="noreferrer">{path}<ArrowUpRight size={16} /><span className="sr-only"> (opens in a new tab)</span></a></div><div className="source-state"><StatusBadge label={resource.error ? 'Refresh failed' : unavailable ? 'Unavailable' : resource.data ? 'Responding' : 'Connecting'} tone={resource.error || unavailable ? 'warning' : resource.data ? 'good' : 'neutral'} /><p>{generated ? <time dateTime={generated}>Generated {new Date(generated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time> : 'No response yet'}</p>{resource.error && <p className="source-error">{resource.error}</p>}</div></div>;
}

export function App() {
  const { status, economy, readings, now, pending, online, autoRefresh, refresh, toggleAutoRefresh, announcement, nextIn } = useTelemetry();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(location.hash || '#overview');
  useEffect(() => {
    const updateLocation = () => setActiveNav(location.hash || '#overview');
    window.addEventListener('hashchange', updateLocation);
    return () => window.removeEventListener('hashchange', updateLocation);
  }, []);
  const data = status.data;
  const chain = economy.data?.status === 'available' ? economy.data : null;
  const measurement = data?.measurement;
  const wheel = measurementState(measurement, now, !!status.error || !online);
  const projected = data?.builder?.status === 'available' ? data.builder.projected : null;
  const anchor = data?.builder?.status === 'available' ? data.builder.anchor : null;
  const blockPercent = projected ? percentOf(projected.blockProgress, BLOCK_UNITS) : null;
  const supplyPercent = chain ? percentOf(chain.supply.miningMintedBaseUnits, chain.supply.capBaseUnits) : null;
  const queue = data?.settlementQueue;
  const sourceOld = (generatedAt?: string) => generatedAt ? now - Date.parse(generatedAt) > 120_000 : false;
  const statusOld = sourceOld(data?.generatedAt);
  const economyOld = sourceOld(chain?.generatedAt);
  const unavailable = economy.data?.status === 'unavailable';
  const failed = !!status.error || !!economy.error || unavailable;
  const feedLabel = !online ? 'Offline' : failed ? 'Connection issue' : !autoRefresh ? 'Updates paused' : statusOld || economyOld || wheel.tone === 'warning' ? 'Stale data' : status.data && economy.data ? 'Live feed' : 'Connecting';
  const feedTone = !online || failed || statusOld || economyOld || wheel.tone === 'warning' ? 'warning' : !autoRefresh || !status.data || !economy.data ? 'neutral' : 'good';
  const updatedAt = Math.max(status.receivedAt || 0, economy.receivedAt || 0) || null;
  const settledRound = anchor?.settledThroughRound;
  const queueProblem = queue?.incidentOpen || !!queue?.blockedReason || queue?.settlementEnabled === false;
  const queueLabel = !queue || queue.status !== 'available' ? 'Queue unavailable' : queueProblem ? 'Settlement needs attention' : queue.state === 'empty' ? 'Queue clear' : 'Settlement pending';
  const provenance = measurement?.provenance;
  const rpm = measurement ? measurement.rpmMilli / 1000 : null;
  const distance = measurement ? measurement.distanceMm / 1000 : null;
  const speed = measurement ? measurement.speedMmPerSecond / 1000 : null;
  const number = (value: number | null, digits = 2) => value == null ? '–' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return <>
    <a className="skip-link" href="#main">Skip to dashboard</a>
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#overview" aria-label="Squeekchain dashboard home"><img src="./favicon.svg" width="38" height="38" alt="" /><span>Squeekchain<span className="brand-divider">/</span><span className="brand-detail">Observatory</span></span></a>
        <nav aria-label="Dashboard sections">{[['#overview', 'Overview'], ['#activity', 'Activity'], ['#data-sources', 'Data sources']].map(([href, label]) => <a key={href} href={href} className={activeNav === href ? 'nav-active' : ''} onClick={() => setActiveNav(href)} aria-current={activeNav === href ? 'location' : undefined}>{label}</a>)}</nav>
        <a className="header-external" href="https://squeekchain.com" target="_blank" rel="noreferrer">Meet Squeekchain<ArrowUpRight size={16} /><span className="sr-only"> (opens in a new tab)</span></a>
      </div>
    </header>
    <main id="main" className="page-shell" tabIndex={-1}>
      <div className="page-heading" id="overview">
        <div className="page-title"><h1>Squeektoshi live<span className="title-dot">.</span></h1><p>A little wheel. A live view of Squeekchain.</p></div>
        <div className="refresh-controls"><button className="button button-secondary pause-button" type="button" onClick={toggleAutoRefresh} aria-label={autoRefresh ? 'Pause updates' : 'Resume updates'}>{autoRefresh ? <Pause size={16} /> : <Play size={16} />}<span className="pause-label">{autoRefresh ? 'Pause updates' : 'Resume updates'}</span></button><button className="button button-primary" type="button" onClick={() => void refresh(true)} disabled={pending}><RefreshCw size={16} className={pending ? 'refreshing' : ''} />{pending ? 'Refreshing…' : 'Refresh now'}</button></div>
      </div>
      <div className="feed-strip"><div className="feed-state"><StatusBadge label={feedLabel} tone={feedTone} /><span className="feed-updated">Updated {relativeTime(updatedAt, now)}</span></div><span className="poll-note"><Timer size={14} />{autoRefresh ? `Every 15s · Next in ${nextIn}s` : 'Automatic updates paused'}</span></div>
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      {(!online || failed || statusOld || economyOld) && <div className="connection-notice" role="status">{!online ? <WifiOff size={18} /> : <TriangleAlert size={18} />}<div><strong>{!online ? 'You’re offline.' : failed ? 'Some data could not refresh.' : 'The API is returning older data.'}</strong><p>{updatedAt ? 'Last available readings are shown. Check the source times below.' : 'Readings will appear when the public API is available.'} {autoRefresh ? 'Retrying every 15 seconds.' : 'Use Refresh now to try again.'}</p></div></div>}

      <div className="dashboard-grid">
        <section className="panel wheel-panel" aria-labelledby="wheel-title">
          <div className="panel-heading"><div className="heading-with-icon"><HeartPulse size={20} /><h2 id="wheel-title">Inside the wheel</h2></div><StatusBadge label={wheel.label} tone={wheel.tone} /></div>
          <div className="wheel-visual"><WheelScene rpm={rpm || 0} running={wheel.active && autoRefresh} /><div className="wheel-caption"><span className="caption-line" /><span>{provenance === 'hardware' ? 'Hardware wheel telemetry' : provenance ? `Source: ${provenance}` : 'Waiting for wheel telemetry'}</span></div></div>
          <dl className="wheel-metrics"><div><dt>Wheel speed</dt><dd><span data-testid="rpm">{number(rpm, rpm != null && rpm % 1 ? 2 : 0)}</span><span className="metric-unit">RPM</span></dd></div><div><dt>Ground speed</dt><dd><span data-testid="speed">{number(speed)}</span><span className="metric-unit">m/s</span></dd></div><div><dt>Distance<span className="distance-help"> · counter</span></dt><dd><span data-testid="distance">{number(distance)}</span><span className="metric-unit">m</span></dd></div></dl>
        </section>

        <section className={`panel block-panel ${status.error || statusOld ? 'data-stale' : ''}`} aria-labelledby="block-title">
          <div className="panel-heading"><div className="heading-with-icon"><Blocks size={20} /><h2 id="block-title">Next Squeek block</h2></div><button className="icon-button" type="button" aria-label={aboutOpen ? 'Hide block explanation' : 'Explain Squeek blocks'} aria-expanded={aboutOpen} aria-controls="block-explanation" onClick={() => setAboutOpen((value) => !value)}>{aboutOpen ? <X size={18} /> : <CircleHelp size={18} />}</button></div>
          <div className="block-number" data-testid="next-block">{projected ? `#${formatInteger(BigInt(projected.blockHeight) + 1n)}` : '–'}</div>
          <p className="block-description">{data && !projected ? 'Block builder is unavailable.' : 'Built one wheel turn at a time.'}</p>
          <div className="block-progress-label"><span>Block progress</span><strong data-testid="block-percent">{blockPercent == null ? '–' : `${blockPercent.toFixed(2)}%`}</strong></div>
          <progress className="progress-track block-progress" max={100} value={blockPercent ?? 0} aria-label="Progress toward the next Squeek block" aria-valuetext={blockPercent == null ? 'Unavailable' : `${blockPercent.toFixed(2)}%`} />
          <dl className="block-facts"><div><dt>Completed blocks</dt><dd>{formatInteger(projected?.blockHeight)}</dd></div><div><dt>Confirmed blocks</dt><dd>{formatInteger(anchor?.blockHeight)}</dd></div></dl>
          <div className="block-note"><ShieldCheck size={16} /><p>{status.error || statusOld ? 'Last available block snapshot.' : 'Progress is projected until settlement.'}</p></div>
          {aboutOpen && <div id="block-explanation" className="block-explanation"><p>Squeek blocks measure wheel work, separately from Ethereum blocks. Progress uses 1 billion units per block. Settlement confirms the projected work onchain.</p><p>Work per 1,000 blocks: <strong>{formatInteger(projected?.workPerThousandBlocks)}</strong>.</p></div>}
        </section>

        <section className={`panel supply-panel ${economy.error || economyOld || unavailable ? 'data-stale' : ''}`} aria-labelledby="supply-title">
          <div className="panel-heading"><div className="heading-with-icon"><Coins size={20} /><h2 id="supply-title">SQK supply</h2></div><span className="quiet-label">{chain?.lifecycle.paused ? 'Economy paused' : 'Mining issuance'}</span></div>
          <div className="supply-amount"><div><span className="large-number" data-testid="mined">{chain ? compactToken(chain.supply.miningMintedBaseUnits, chain.asset.decimals) : '–'}</span><span className="amount-label">SQK mined</span></div><div className="cap-amount"><span>{chain ? compactToken(chain.supply.capBaseUnits, chain.asset.decimals) : '–'}</span><span className="amount-label">SQK cap</span></div></div>
          <progress className="progress-track supply-progress" max={100} value={supplyPercent == null ? 0 : Math.min(100, supplyPercent)} aria-label="SQK mined as a percentage of the supply cap" aria-valuetext={supplyPercent == null ? 'Unavailable' : `${supplyPercent.toFixed(2)}%`} />
          <div className="supply-foot"><span>{supplyPercent == null ? 'Waiting for economy data' : `${supplyPercent.toFixed(2)}% of supply cap mined`}</span><span><Sprout size={14} />{economy.error || economyOld ? 'Last snapshot' : chain ? 'Onchain supply' : 'Not available'}</span></div>
          {chain && <p className="exact-supply">{formatToken(chain.supply.miningMintedBaseUnits, chain.asset.decimals)} of {formatToken(chain.supply.capBaseUnits, chain.asset.decimals, 0)} SQK</p>}
        </section>

        <section className={`panel settlement-panel ${economy.error || economyOld ? 'data-stale' : ''}`} aria-labelledby="settlement-title">
          <div className="panel-heading"><div className="heading-with-icon"><CheckCheck size={20} /><h2 id="settlement-title">Settlement</h2></div><span className="quiet-label">{chain ? `${chain.chain.target[0].toUpperCase()}${chain.chain.target.slice(1)}` : 'Network unavailable'}</span></div>
          <dl className="settlement-values"><div><dt>Current round</dt><dd data-testid="round">{formatInteger(chain?.lifecycle.currentRound)}</dd></div><div><dt>Last settled round</dt><dd data-testid="settled">{formatInteger(settledRound)}</dd></div></dl>
          <div className={`settlement-footer ${queueProblem ? 'queue-warning' : ''}`}>{queueProblem ? <TriangleAlert size={16} /> : <Check size={16} />}<span>{status.error || statusOld ? 'Last known settlement state' : queueLabel}</span><span className="queue-count">{queue?.buffered ? `${formatInteger(queue.buffered.roundCount)} buffered` : ''}</span></div>
          {queueProblem && <p className="queue-reason">{queue?.blockedReason?.replaceAll('_', ' ') || (queue?.settlementEnabled === false ? 'Settlement is disabled by the API.' : 'The API reports an open settlement incident.')}</p>}
        </section>

        <ActivityChart readings={readings} now={now} />

        <section className="sources-section" id="data-sources" aria-labelledby="sources-title"><details><summary><span className="heading-with-icon"><Database size={18} /><h2 id="sources-title">Behind the readings</h2></span><span className="source-summary"><span className="source-summary-label">2 public API sources</span><span className="disclosure-arrow"><ArrowDownLeft size={16} /></span></span></summary><div className="source-content"><p>Direct from the public Squeekchain API. Readings refresh every 15 seconds; no account or wallet is needed. Timestamps use your device’s local timezone.</p><SourceRow label="Wheel, blocks & settlement" path="/v1/status" resource={status} /><SourceRow label="Economy & SQK supply" path="/v1/economy/state" resource={economy} unavailable={unavailable} /><dl className="source-metadata"><div><dt>Wheel observed</dt><dd>{measurement ? <time dateTime={measurement.observedAt}>{new Date(measurement.observedAt).toLocaleString()}</time> : 'No measurement received'}</dd></div><div><dt>Wheel work</dt><dd>{formatInteger(projected?.cumulativeWork)} units</dd></div><div><dt>Economy processed</dt><dd>{chain ? `Through round ${formatInteger(chain.mining.processedThroughRound)}` : 'Unavailable'}</dd></div><div><dt>Network</dt><dd>{chain ? `${chain.chain.target} · Chain ${chain.chain.chainId}` : 'Unavailable'}</dd></div></dl><p className="source-explanation">Distance is the hardware counter reading and may reset with a new counter epoch. The chart keeps up to one hour of observed readings in memory; reloading clears it. SQK values are truncated to two decimal places. Confirmed and projected blocks may differ while settlement is pending.</p>{unavailable && <p className="source-error">Economy is unavailable: {economy.data?.status === 'unavailable' ? economy.data.reason?.replaceAll('_', ' ') || 'No reason provided by the API.' : ''}</p>}</div></details></section>
      </div>
      <div className="dashboard-footnote"><Radio size={15} /><p>Small turns, real telemetry. This dashboard reads public data only.</p><a href="https://squeekchain.com" target="_blank" rel="noreferrer">Explore Squeekchain<ExternalLink size={14} /><span className="sr-only"> (opens in a new tab)</span></a></div>
    </main>
    <footer className="site-footer"><div><span className="footer-brand"><img src="./favicon.svg" alt="" width="24" height="24" />Squeektoshi live</span><span>Made for the curious.</span></div><span><span className="footer-dot" />Public API. No wallet required.</span></footer>
  </>;
}
