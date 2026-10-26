# AI可視化辦公室 · visual-office

Swedish-modern 3D office + dashboard for Morris Desk Grok Bot specialists.

**Live:** https://morriscsy.github.io/visual-office/

## v0.3.1
- Flex layout (header in flow) — fixes iPhone Safari blank WebGL canvas + header overlap
- Announcement feed collapsed by default on mobile (chip → bottom sheet); remembered in localStorage
- Zone labels stay inside cards; paper bar respects safe-area
- Mobile: lower shadow maps, ResizeObserver + visualViewport resize, touch orbit

## Views
- **3D辦公室** — Three.js rooms, walking staff (toilet / pantry / chat)
- **儀表板** — CSS floor-plan desks with deep links

Status: `office-status.json` (public / paper only).
