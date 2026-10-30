import { useId, useState } from 'react';
import { Activity, ChartNoAxesCombined } from 'lucide-react';
import type { Reading } from '../api';

export function ActivityChart({ readings, now }: { readings: Reading[]; now: number }) {
  const [metric, setMetric] = useState<'rpm' | 'distance'>('rpm');
  const [range, setRange] = useState<15 | 60>(15);
  const id = useId().replaceAll(':', '');
  const start = now - range * 60_000;
  const visible = readings.filter((point) => point.time >= start && point.time <= now);
  const maxValue = Math.max(metric === 'rpm' ? 10 : 1, ...visible.map((point) => point[metric])) * 1.2;
  const pointX = (point: Reading) => 52 + ((point.time - start) / (range * 60_000)) * 1040;
  const pointY = (point: Reading) => 132 - (point[metric] / maxValue) * 104;
  // A gap, or a counter reset, must not imply a continuous observation.
  const segments: Reading[][] = [];
  for (const point of visible) {
    const last = segments.at(-1)?.at(-1);
    if (!last || point.time - last.time > 45_000 || point.epoch !== last.epoch) segments.push([]);
    segments.at(-1)!.push(point);
  }
  const timestamp = (time: number) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const lastReading = visible.at(-1);

  return (
    <section className="panel activity-panel" id="activity" aria-labelledby="activity-title">
      <div className="panel-heading activity-heading">
        <div className="heading-with-icon"><Activity size={20} /><h2 id="activity-title">Wheel activity</h2></div>
        <div className="chart-controls">
          <div className="segmented" role="group" aria-label="Activity metric">
            <button type="button" aria-pressed={metric === 'rpm'} onClick={() => setMetric('rpm')}>RPM</button>
            <button type="button" aria-pressed={metric === 'distance'} onClick={() => setMetric('distance')}>Distance</button>
          </div>
          <label className="range-control"><span className="sr-only">Activity time range</span><select value={range} onChange={(event) => setRange(Number(event.target.value) as 15 | 60)}><option value={15}>Last 15 min</option><option value={60}>Last hour</option></select></label>
        </div>
      </div>
      <div className="chart-summary"><p>Readings from this visit</p><span>{visible.length} {visible.length === 1 ? 'reading' : 'readings'}<span className="summary-divider">·</span>{lastReading ? `${lastReading[metric].toLocaleString('en-US', { maximumFractionDigits: 2 })} ${metric === 'rpm' ? 'RPM' : 'm'} latest` : 'Waiting for data'}</span></div>
      <div className="chart-area">
        <div className="chart-y-labels" aria-hidden="true"><span>{Math.ceil(maxValue)} {metric === 'rpm' ? 'RPM' : 'm'}</span><span>{(maxValue / 2).toFixed(0)}</span><span>0</span></div>
        <svg className="activity-chart" viewBox="0 0 1120 160" preserveAspectRatio="none" role="img" aria-labelledby={`${id}-title ${id}-description`}>
          <title id={`${id}-title`}>{metric === 'rpm' ? 'Wheel RPM' : 'Wheel distance in metres'} over the last {range} minutes</title>
          <desc id={`${id}-description`}>{visible.length === 0 ? 'No readings collected yet. Readings are recorded every 15 seconds.' : `${visible.length} observed readings during this visit. Latest: ${lastReading![metric]} ${metric === 'rpm' ? 'RPM' : 'metres'}. Gaps represent missing observations.`}</desc>
          {[28, 80, 132].map((y) => <line key={y} x1="52" x2="1092" y1={y} y2={y} className="chart-grid" />)}
          {segments.map((segment, index) => <g key={index}>
            {segment.length > 1 && <polyline points={segment.map((point) => `${pointX(point)},${pointY(point)}`).join(' ')} className="chart-line" />}
            {segment.map((point) => <circle key={`${point.epoch}-${point.time}`} cx={pointX(point)} cy={pointY(point)} r="3.5" className="chart-dot" vectorEffect="non-scaling-stroke"><title>{timestamp(point.time)}: {point[metric]} {metric === 'rpm' ? 'RPM' : 'm'}</title></circle>)}
          </g>)}
        </svg>
        {visible.length < 2 && <div className="chart-empty"><ChartNoAxesCombined size={24} /><span>{visible.length === 0 ? 'Waiting for the first reading' : 'Collecting the next reading'}</span><p>A new reading every 15 seconds.</p></div>}
      </div>
      <div className="chart-x-labels" aria-hidden="true"><span>{timestamp(start)}</span><span>{timestamp(start + range * 30_000)}</span><span>Now</span></div>
      <details className="reading-details"><summary>View readings as a table</summary>
        {visible.length ? <div className="reading-table-wrap" tabIndex={0} role="region" aria-label="Scrollable observed readings"><table><caption className="sr-only">Observed readings in the selected time range</caption><thead><tr><th scope="col">Observed</th><th scope="col">RPM</th><th scope="col">Distance (m)</th></tr></thead><tbody>{visible.slice().reverse().map((point) => <tr key={`${point.epoch}-${point.time}`}><td><time dateTime={new Date(point.time).toISOString()}>{timestamp(point.time)}</time></td><td>{point.rpm.toLocaleString('en-US', { maximumFractionDigits: 3 })}</td><td>{point.distance.toLocaleString('en-US', { maximumFractionDigits: 3 })}</td></tr>)}</tbody></table></div> : <p>Readings will appear here after the public API responds.</p>}
      </details>
    </section>
  );
}
