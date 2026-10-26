# AI可視化辦公室 · Morris Desk (v0.2)

Real **Three.js** 3D office with 11 Grok Bot specialist avatars.

**Live:** https://morriscsy.github.io/visual-office/

## Controls
- **Drag** — orbit camera
- **Scroll / pinch** — zoom
- **Click avatar** — open desk panel (role, last note, Open in Grok Bot, copy id)

## Status
`office-status.json` drives idle / active / alert poses, paper bar, kill-switch pill, and the announcement feed. Specialists push updates by editing that file on `main`.

## Dev
```bash
npm install
npm run dev
npm run build   # → dist/ (Pages serves repo root)
```

Vite `base` is `/visual-office/` for GitHub Pages project site.

Public-macro / paper only — no secrets, no live brokerage.
