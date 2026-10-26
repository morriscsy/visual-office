# AI可視化辦公室 · Morris Desk

Standalone office floor for Morris Chow’s Grok Bot specialists — desks, status pills, announcement feed, and a paper-trading stub.

**Live:** https://morriscsy.github.io/visual-office/

## What’s here

| File | Role |
|------|------|
| `index.html` | Office UI (zones, desks, feed, paper bar) |
| `office-status.json` | Live-ish status: kill switch, desk last lines, feed, paper P&L |

## Desk → bot map

Click a desk to open that specialist (`grokbot://` deep link). Agent ids stay stable across MasterKi, EconPulse, MarketWatch, StratLab, Workfolio, PatternLab, PatternSight, PinBarLab, ShoulderLab, LaoYuLab, and PlaudLab.

Status and the announcement feed are driven by `office-status.json` (same origin). Push updates to that file to refresh the floor without rebuilding the HTML.

## Notes

- Public GitHub Pages site (branch `main`, `/`).
- Paper bar is stub ($10k / 0%) until wired to a ledger.
- Moved out of `morriscsy/workfolio` so the office can evolve on its own.
