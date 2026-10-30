import type { CSSProperties } from 'react';

export function WheelScene({ rpm, running }: { rpm: number; running: boolean }) {
  return (
    <svg className={`wheel-scene ${running && rpm > 0 ? 'is-running' : ''}`} style={{ '--wheel-duration': `${Math.max(0.6, 60 / (rpm || 1))}s` } as CSSProperties} viewBox="150 0 380 260" aria-hidden="true">
      <ellipse cx="330" cy="236" rx="205" ry="13" fill="#e0e9dc" />
      <circle cx="337" cy="126" r="115" fill="#e5eddf" />
      <path d="M176 236h327M297 231l40-101 43 101" fill="none" stroke="#76917a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M285 234h104" stroke="#3c6754" strokeWidth="9" strokeLinecap="round" />
      <g className="wheel-spokes" fill="none" stroke="#a6bea2" strokeWidth="2.5">
        {[0, 30, 60, 90, 120, 150].map((angle) => <path key={angle} d="M227 126h220" transform={`rotate(${angle} 337 126)`} />)}
        <circle cx="337" cy="126" r="94" strokeDasharray="3 8" />
      </g>
      <circle cx="337" cy="126" r="111" fill="none" stroke="#3c6754" strokeWidth="9" />
      <circle cx="337" cy="126" r="102" fill="none" stroke="#f7faf4" strokeWidth="3" />
      <circle cx="337" cy="126" r="12" fill="#f5f6f1" stroke="#3c6754" strokeWidth="5" />
      <circle cx="337" cy="126" r="3" fill="#3c6754" />
      <g stroke="#785838" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M300 200c-16-2-19-12-14-17" fill="none" />
        <path d="M303 210c-5 2-8 6-6 8h16M348 210c6 1 11 5 9 8h-14" fill="#e6b98d" />
        <path d="M300 192c0-19 8-30 25-30 16 0 26 12 29 28 7 4 7 13-1 18-13 11-41 10-50 0-5-5-6-10-3-16Z" fill="#cba275" />
        <ellipse cx="321" cy="197" rx="18" ry="16" fill="#f2debb" stroke="none" />
        <path d="M336 171c-3-12 0-22 7-21 9 1 10 14 5 23" fill="#cba275" />
        <path d="M340 166c0-6 1-10 4-9 3 1 4 6 2 10" fill="#e5b4a1" stroke="none" />
        <path d="M342 184c7-6 16-3 19 5l5 4-5 6c-6 5-15 3-19-2" fill="#e4c39c" />
        <path d="M315 206c4-1 7-4 7-7" fill="none" />
        <path d="M355 201l9 3m-9-7 12 1" fill="none" strokeWidth="1.2" />
        <circle cx="351" cy="186" r="2.5" fill="#352b23" stroke="none" />
        <circle cx="364" cy="192" r="2" fill="#785838" stroke="none" />
      </g>
      <g fill="none" stroke="#90a58b" strokeWidth="2.5" strokeLinecap="round">
        <path d="M181 233c1-13-5-22-11-25m11 25c0-10 7-15 12-17M467 233c-2-9 2-16 9-22m-9 22c2-6 9-8 13-7" />
      </g>
      <g fill="#aec4a4"><ellipse cx="166" cy="207" rx="4" ry="7" transform="rotate(-35 166 207)" /><ellipse cx="195" cy="215" rx="4" ry="7" transform="rotate(40 195 215)" /><ellipse cx="478" cy="208" rx="4" ry="7" transform="rotate(35 478 208)" /></g>
    </svg>
  );
}
