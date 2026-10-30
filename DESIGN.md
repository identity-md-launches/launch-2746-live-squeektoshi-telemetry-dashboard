# Implemented design: Squeektoshi live

## Overview

This is a public telemetry tool for people following Squeektoshi's wheel and Squeekchain's progress. A softly colored wheel illustration is the identifying visual; precise readings and ordinary controls carry the task. The page opens with the product, refresh/pause actions and feed state. It then presents wheel/block data, supply/settlement data, visit activity and source details in that order.

The shared system is deliberately light, quiet and flat: warm off-white canvas, white information panels, one pale green wheel panel, dark green primary action, natural case, and stable numeric alignment. Layout is built with CSS and semantic HTML, without a component framework. `src/styles.css` is the canonical token and component source. `src/App.tsx` owns the page arrangement.

## Colors

All colors are authored in hex. Primitives are named by hue/neutral level; components consume semantic role tokens. Only the light theme is implemented. Art-specific greens and earth tones in `WheelScene.tsx` are illustration colors, not extra UI status tokens.

| Semantic token | Implemented value | Use |
| --- | --- | --- |
| `--page` | `#f5f6f1` | Canvas |
| `--surface` | `#ffffff` | Header and data panels |
| `--surface-hover` | `#edf0e8` | Neutral control hover and segmented track |
| `--surface-wheel` | `#eef4e9` | Wheel panel |
| `--border` | `#dce2d7` | Panel structure and separators |
| `--text-primary` | `#253c30` | Headings, primary values |
| `--text-secondary` | `#596454` | Descriptions, labels and units |
| `--text-muted` | `#697367` | Chart axes and footer |
| `--accent-solid` | `#2e5c43` | Filled refresh action |
| `--accent-hover` | `#244b36` | Filled action hover |
| `--accent-soft` | `#d8edb4` | Text selection and brand asset background |
| `--accent-ink` | `#294d3e` | Brand palette reference |
| `--focus` | `#346cbd` | 3px focus perimeter, 4px offset |
| `--chart-line` | `#3d7758` | Observed series and progress fills |
| `--status-good-bg` / `--status-good-ink` | `#e5efdf` / `#3a633c` | Healthy response, resting/running status |
| `--status-neutral-bg` / `--status-neutral-ink` | `#edf0e8` / `#596454` | Connecting, missing and paused states |
| `--status-warning-bg` / `--status-warning-ink` | `#fbf0d8` / `#82510a` | Stale, offline and source failure |
| `--status-danger-bg` / `--status-danger-ink` | `#fae9e4` / `#9a382c` | Hardware fault and source error text |

Color never carries a state by itself: badges also have a status label and dot, and failures have text and an icon. The rendered taste@1 probe passed its text contrast checks. The lowest measured pair was footer muted text on the page at **4.55:1**; chart muted text on white measured **4.94:1**. These measurements apply to the inspected states, not to arbitrary future color combinations or SVG artwork. Forced-colors focus uses the system `Highlight` color.

## Typography

The family is **Manrope**, falling back to Arial and generic sans-serif. `public/fonts/manrope-latin.woff2` is the locally supplied variable font, declared for weights 200–800 with `font-display: swap`; the interface uses only **400, 600 and 700**. No italic styling is used. The font was confirmed loaded in both browser engines. Its OFL license is included beside it.

Six sizes are defined on `:root` in `src/styles.css`:

| Token | Default size | Role |
| --- | --- | --- |
| `--text-xs` | 12px / `.75rem` | Metadata, units, badges, chart labels |
| `--text-sm` | 14px / `.875rem` | Body, actions and source labels |
| `--text-base` | 16px / `1rem` | Section headings, brand, mobile range select |
| `--text-heading` | 20px / `1.25rem` | Supply cap, mobile wheel readings |
| `--text-title` | 32px / `2rem` | Page title, prominent data and rounds |
| `--text-display` | 48px / `3rem` | Next Squeek block |

Body line-height is 1.5; the page title is 1.15; section headings are 1.4; prominent values use 1.2–1.25. The page title and large values use `-.04em` tracking; section headings use `-.02em`; prose uses natural tracking. Headlines balance, short prose uses pretty wrapping, and long source text has a bounded measure. Changing figures use tabular numbers. Critical wheel numbers remain whole and their metric groups wrap when text is enlarged. Supply amounts also have full, selectable text beneath the compact display. There is no clipped or ellipsized data.

## Layout

`--space-1/2/3/4/5/6/8/10` define **4, 8, 12, 16, 20, 24, 32 and 40px**. The page/header share a 1264px maximum outer width and 32px desktop padding, giving a 1200px content grid at wide sizes. Major panels use 24px padding, the dashboard uses 20px gaps, controls use 8–12px gaps, and small icon/data pairs use 6–10px optical gaps.

`.dashboard-grid` is twelve equal tracks. Wheel and supply occupy seven tracks; block and settlement occupy five. The activity panel and source disclosure use all tracks. Main rows stretch to equal heights. `.wheel-metrics` uses flexible groups so enlarged data can wrap as a whole instead of splitting digits.

Implemented breakpoints:

| Maximum width | Changes |
| --- | --- |
| `66rem` / 1056px | Compact panel padding; hide brand suffix and some secondary detail |
| `51rem` / 816px | Two equal dashboard columns; 24px page padding; icon-only pause action retains its accessible name; remove external header link |
| `38rem` / 608px | Single-column dashboard; 20px gutters and 16px panel gaps; title/actions stack; restore pause label; chart controls wrap; range select is 16px; source details adapt |
| `22rem` / 352px | 16px page gutters and tighter controls/metric spacing for 320px reflow |

At phone widths the header keeps the brand and Overview/Activity anchors; source details remain reachable in the page. The first 390px screen contains the title, both main controls, live state, wheel graphic and wheel metrics. There is no fixed chrome covering content. The readings table has a bounded vertical scroll region with keyboard focus; the document itself does not scroll horizontally at the five tested widths.

Rendered checks covered 320, 390, 768, 1024 and 1440px in Chromium and WebKit, plus 200% root text enlargement at 1440px. Native browser zoom, physical devices and RTL/localization variants were not tested. English is the implemented language.

## Elevation & Depth

Panels use a structural 1px border and tonal background. There are no shadows, overlays, gradient text or raised cards inside cards. The sources disclosure is a flat row with separators. Block help expands inline, so it needs no modal layer or focus trap. The skip link alone uses an elevated stacking order while focused.

## Shapes

`--radius-panel` is **16px** and `--radius-control` is **8px**. Status badges use 6px, segmented selections 5px, and progress tracks 3px. Tiny status dots and the disclosure-arrow background are circular. Decorative wheel artwork can be clipped to its SVG viewport; text and data are not clipped. Focus outlines remain outside controls.

## Components

| Pattern/component | Source | Behavior and reuse |
| --- | --- | --- |
| Primary/secondary buttons | `src/App.tsx`, `.button*` | One filled primary refresh action. Neutral pause/resume peer. Native buttons, explicit names, hover, focus, pressed and disabled/loading states |
| Section navigation | `src/App.tsx`, `nav` | Native hash anchors, visible current location, home/back/hash synchronization; no server routes |
| `StatusBadge` pattern | `src/App.tsx` | `label` and `tone` (`good`, `neutral`, `warning`, `danger`); text plus dot and semantic color pair |
| `WheelScene` | `src/components/WheelScene.tsx` | `rpm`, `running`; decorative original SVG. Spokes animate only for positive RPM with live active data and automatic updates enabled |
| Telemetry panel | `src/App.tsx`, `.panel` | Shared heading/icon alignment, padding, border and radius; labels/values use `dl`, `dt`, `dd` |
| Block explanation | `src/App.tsx` | Named 44px button with `aria-expanded`; inline explanation and actual work difficulty |
| Progress bars | `src/App.tsx`, `.progress-track` | Native `progress`, meaningful labels and explicit unavailable value text; percentage remains visible |
| `ActivityChart` | `src/components/ActivityChart.tsx` | `readings`, `now`; metric buttons, native time select, named SVG, empty state, gap/epoch breaks and matching accessible table |
| Sources disclosure / `SourceRow` | `src/App.tsx` | Native details/summary; real endpoint links, generated times, response status and errors; source metadata explains precision/history limits |
| Connection notice | `src/App.tsx` | Retained, recoverable status with icon and plain text; the main refresh control remains reachable |

Native controls supply keyboard behavior. All interactive elements have explicit focus styles. Manual refresh uses a stable polite status region. In forced colors the focus perimeter uses `Highlight`. Pointer hover effects are gated by `(hover: hover)`. With reduced motion, wheel/spinner animations and press scaling do not run; state is still visible in text.

## Do's and Don'ts

- Start an added section with `.panel`, `.panel-heading`, existing spacing and the same alignment edges. Use the existing grid and phone stacking behavior.
- Choose sizes from the six tokens and weights from 400/600/700. Keep numbers selectable and stable. Let a whole metric wrap before breaking a quantity.
- Use semantic text/status tokens on their intended backgrounds; measure a changed pair in the browser. Reserve the filled action for the primary task.
- Keep source availability, measurement freshness, projected work and confirmed settlement distinct. Chart only observations actually received during this visit.
- Keep new static navigation in hash anchors unless additional HTML pages are explicitly exported. Bundle every required runtime asset locally.
- Recheck narrow widths, accessible names, keyboard paths and reduced motion after component changes. A new section should reuse these patterns rather than introduce a second visual system.

This document describes the final implementation. The review and its remaining verification limits are in `artifacts/validation.md`. Design knowledge is adapted from Jakub Krehel's Better Interface (MIT); documentation method from Paul Bakaus's Impeccable (Apache-2.0). Pinned attribution and full notices are retained in `THIRD_PARTY_NOTICES.md` and `artifacts/licenses/design-guides-LICENSE.txt`.
