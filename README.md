# AI可視化辦公室 · Morris Desk (v0.3)

Swedish-modern **Three.js** office + CSS **儀表板** dashboard, wired to 11 Grok Bot specialists.

**Live:** https://morriscsy.github.io/visual-office/

## Views
Use the top segmented control:
- **3D辦公室** — light oak / soft daylight scene; voxel staff walk to 洗手間 · 茶水間 · chat, then return to desks
- **儀表板 Dashboard** — v0.1 CSS floor-plan desks by zone (會議室 / 宏觀 / 策略 / 圖形 / 筆記)

Both views share `office-status.json` (idle / active / alert, paper bar, kill-switch, announcement feed) and the same `grokbot://` agent ids.

## Controls (3D)
- Drag — orbit · Scroll / pinch — zoom · Click avatar — desk panel

## Status
Specialists update desks / feed by editing `office-status.json` on `main`.

Public-macro / paper only — no secrets, no live brokerage.
