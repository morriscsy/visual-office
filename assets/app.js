import { AGENTS, deepLink, fmtMoney, fmtPct, fmtWhen, statusLabel } from "./agents.js";
import { createOffice3D } from "./office3d.js";
import { loadTopics } from "./topics.js";

const ZONE_DEFS = [
  { id: "meet", title: "L1 · Reception / Boss" },
  { id: "macro", title: "L2 · Markets / Macro" },
  { id: "strategy", title: "L1–L2 · Strategy / Vault" },
  { id: "charts", title: "L3 · Engineering / Patterns" },
  { id: "notes", title: "L1 · Notes" }
];

const LS_VIEW = "visual-office-view";
const LS_FEED = "visual-office-feed-open";
const MAX_LIVE_CHAT = 12;

const DEFAULT_STATUS = {
  updatedAt: "2026-10-26T18:20:33+08:00",
  killSwitch: "inactive",
  paper: { balance: 10000, pnlPct: 0, currency: "USD", label: "模擬 / PAPER" },
  tickers: [
    { sym: "ES", px: 7665.75, chg: 0.08, note: "Asia open" },
    { sym: "NQ", px: 29144, chg: 0.09, note: "gap faded" },
    { sym: "WTI", px: 100.97, chg: -2.23, note: "under 101" }
  ],
  tickerAsOf: "2026-10-26 ~08:06–11:36 HKT · not live",
  desks: AGENTS.map(d => ({
    id: d.id,
    agentId: d.agentId,
    status: d.id === "marketwatch" ? "alert" : (d.id === "masterki" ? "active" : "idle"),
    last: d.id === "marketwatch" ? "WTI under 101" : (d.id === "econpulse" ? "Backfill done fd18f58" : "Standby"),
    at: "2026-10-26T00:04:00+08:00"
  })),
  feed: [
    { from: "MarketWatch", zone: "交易監控部", text: "ALERT · WTI 100.97 (−2.23%) under $101 · Sunday Globex fade", at: "2026-10-26T11:36:00+08:00", level: "alert" },
    { from: "MarketWatch", zone: "交易監控部", text: "ALERT · NQ +0.57% vs Fri Globex · ±0.5% trigger", at: "2026-10-26T06:11:00+08:00", level: "alert" },
    { from: "EconPulse", zone: "宏觀研究部", text: "Freeze-gap backfill DONE · UK PMI flash + UMich Oct final · fd18f58", at: "2026-10-26T00:20:00+08:00", level: "ok" },
    { from: "MasterKi", zone: "會議室", text: "Kill switch LIFTED ~00:04 HKT · specialists cleared", at: "2026-10-26T00:04:00+08:00", level: "ok" }
  ]
};

let STATE = JSON.parse(JSON.stringify(DEFAULT_STATUS));
let selected = null;
let mode = "3d";
let office3d = null;
let feedOpen = false;
let liveChats = [];

function isNarrow() {
  return window.matchMedia("(max-width: 899px)").matches;
}

function deskStatusMap() {
  const m = {};
  (STATE.desks || []).forEach(d => { m[d.id] = d; });
  return m;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1400);
}

function openDesk(id) {
  const meta = AGENTS.find(d => d.id === id);
  if (!meta) return;
  selected = meta;
  const st = deskStatusMap()[id] || {};
  const status = statusLabel(st.status || "idle");
  document.getElementById("modal-name").textContent = meta.name;
  document.getElementById("modal-role").textContent = meta.role;
  document.getElementById("modal-zone").textContent = meta.zoneLabel || meta.zone;
  const ms = document.getElementById("modal-status");
  ms.textContent = status;
  ms.className = "modal-status " + status;
  document.getElementById("modal-last").textContent = st.last || "—";
  document.getElementById("modal-at").textContent = st.at ? fmtWhen(st.at) : "";
  document.getElementById("modal-id").textContent = meta.agentId;
  document.getElementById("modal-swatch").style.background =
    `linear-gradient(145deg, #${meta.color.toString(16).padStart(6, "0")}, #5f7d6c)`;
  document.getElementById("modal-open").href = deepLink(meta.agentId);
  const modal = document.getElementById("modal");
  modal.hidden = false;
  modal.classList.add("open");
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.hidden = true;
  modal.classList.remove("open");
  selected = null;
}

function renderPaper(prefix) {
  const p = STATE.paper || {};
  const label = document.getElementById(`paper-label-${prefix}`);
  const bal = document.getElementById(`paper-bal-${prefix}`);
  const pnl = document.getElementById(`paper-pnl-${prefix}`);
  const ticks = document.getElementById(`tickers-${prefix}`);
  if (!bal) return;
  if (label) label.textContent = p.label || "模擬 / PAPER";
  bal.textContent = fmtMoney(p.balance != null ? p.balance : 10000);
  const pct = p.pnlPct != null ? p.pnlPct : 0;
  pnl.textContent = fmtPct(pct);
  pnl.className = "paper-pnl " + (pct < 0 ? "neg" : "pos");
  ticks.innerHTML = (STATE.tickers || []).map(t => {
    const chg = Number(t.chg || 0);
    const cls = chg < 0 ? "dn" : "up";
    const sign = chg >= 0 ? "+" : "";
    return `<span class="tick"><b>${t.sym}</b> ${Number(t.px).toLocaleString()} <span class="${cls}">${sign}${chg.toFixed(2)}%</span></span>`;
  }).join("");
}

function mergedFeed() {
  return liveChats.concat(STATE.feed || []);
}

function feedHtml() {
  const feed = mergedFeed();
  return feed.map(f => {
    const lvl = f.level || "info";
    return `<article class="feed-item ${lvl}">
      <div class="feed-meta">
        <span class="feed-from">${f.from || "?"}</span>
        <span>${f.zone || ""}</span>
        <span class="feed-at">${fmtWhen(f.at)}</span>
      </div>
      <div class="feed-text">${f.text || ""}</div>
    </article>`;
  }).join("") || '<p style="padding:10px;color:var(--dim);font-size:12px">No announcements</p>';
}

function syncFeedUi() {
  const n = mergedFeed().length;
  const chip = document.getElementById("feed-chip");
  const chipDash = document.getElementById("feed-chip-dash");
  const countEls = [
    document.getElementById("feed-chip-count"),
    document.getElementById("feed-chip-count-dash"),
    document.getElementById("feedCount")
  ];
  countEls.forEach(el => { if (el) el.textContent = String(n); });
  if (document.getElementById("feedCount")) {
    document.getElementById("feedCount").textContent = n + " items";
  }

  const sheet = document.getElementById("feed-sheet");
  const dashFeed = document.getElementById("dash-feed");
  const narrow = isNarrow();

  if (sheet) {
    if (narrow) {
      sheet.hidden = !feedOpen;
      sheet.classList.remove("is-collapsed");
      if (chip) {
        chip.setAttribute("aria-expanded", feedOpen ? "true" : "false");
        chip.classList.toggle("desktop-show", false);
      }
    } else {
      sheet.hidden = false;
      sheet.classList.toggle("is-collapsed", !feedOpen);
      if (chip) {
        chip.classList.toggle("desktop-show", !feedOpen);
        chip.setAttribute("aria-expanded", feedOpen ? "true" : "false");
      }
    }
  }

  if (dashFeed) {
    if (narrow) {
      dashFeed.classList.toggle("is-open", feedOpen);
      dashFeed.classList.remove("is-collapsed");
      if (chipDash) {
        chipDash.setAttribute("aria-expanded", feedOpen ? "true" : "false");
        chipDash.classList.remove("desktop-show");
      }
    } else {
      dashFeed.classList.add("is-open");
      dashFeed.classList.toggle("is-collapsed", !feedOpen);
      if (chipDash) {
        chipDash.classList.toggle("desktop-show", !feedOpen);
        chipDash.setAttribute("aria-expanded", feedOpen ? "true" : "false");
      }
    }
  }

  requestAnimationFrame(updatePaperOffset);
}

function updatePaperOffset() {
  const bar = mode === "3d"
    ? document.getElementById("paper-bar-3d")
    : document.getElementById("paper-bar-dash");
  if (!bar) return;
  const h = Math.ceil(bar.getBoundingClientRect().height) || 56;
  document.documentElement.style.setProperty("--paper-h", h + "px");
}

function setFeedOpen(open) {
  feedOpen = !!open;
  try { localStorage.setItem(LS_FEED, feedOpen ? "1" : "0"); } catch {}
  syncFeedUi();
}

function renderFeed() {
  const body = document.getElementById("feed-body");
  const list = document.getElementById("feedList");
  const html = feedHtml();
  if (body) body.innerHTML = html;
  if (list) list.innerHTML = html;
  syncFeedUi();
}

function pushLiveChat(entry) {
  if (!entry?.text) return;
  liveChats.unshift(entry);
  if (liveChats.length > MAX_LIVE_CHAT) liveChats.length = MAX_LIVE_CHAT;
  renderFeed();
}

function renderHeader() {
  const ks = (STATE.killSwitch || "inactive").toLowerCase();
  const pill = document.getElementById("kill-pill");
  if (ks === "active" || ks === "on") {
    pill.className = "pill alert";
    pill.innerHTML = '<span class="dot"></span> KILL · ON';
  } else {
    pill.className = "pill ok";
    pill.innerHTML = '<span class="dot"></span> KILL · inactive';
  }
  document.getElementById("clock-pill").textContent = "updated " + fmtWhen(STATE.updatedAt);
}

function renderFloor() {
  const floor = document.getElementById("floor");
  const sm = deskStatusMap();
  floor.innerHTML = ZONE_DEFS.map(z => {
    const desks = AGENTS.filter(d => d.zoneKey === z.id).map(d => {
      const st = sm[d.id] || {};
      const status = statusLabel(st.status || "idle");
      const cls = ["desk", status === "alert" ? "alert" : "", (status === "active" || status === "working") ? "active-status" : ""].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-id="${d.id}" aria-label="${d.name}">
        <div class="desk-top">
          <div style="display:flex;gap:8px;min-width:0">
            <div class="avatar ${d.colorClass}">${d.initials}</div>
            <div style="min-width:0">
              <p class="desk-name">${d.name}</p>
              <p class="desk-role">${d.role}</p>
            </div>
          </div>
        </div>
        <span class="status-pill ${status}"><span class="sdot"></span>${status}</span>
        <p class="desk-last">${st.last || "—"}</p>
      </button>`;
    }).join("");
    return `<div class="zone ${z.id}" data-zone="${z.id}">
      <div class="zone-label">${z.title}</div>
      <div class="desks">${desks}</div>
    </div>`;
  }).join("");
  floor.querySelectorAll(".desk").forEach(btn => {
    btn.addEventListener("click", () => openDesk(btn.dataset.id));
  });
}

function renderAll() {
  renderHeader();
  renderPaper("3d");
  renderPaper("dash");
  renderFeed();
  renderFloor();
  const asOf = document.getElementById("tickerAsOf");
  if (asOf) asOf.textContent = STATE.tickerAsOf || "";
  updatePaperOffset();
}

function setMode(next) {
  mode = next;
  document.getElementById("view-3d").classList.toggle("active", mode === "3d");
  document.getElementById("view-dash").classList.toggle("active", mode === "dash");
  document.getElementById("btn-3d").classList.toggle("active", mode === "3d");
  document.getElementById("btn-dash").classList.toggle("active", mode === "dash");
  if (office3d) {
    office3d.setVisible(mode === "3d");
    if (mode === "3d") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => office3d.resize());
      });
    }
  }
  syncFeedUi();
  try { localStorage.setItem(LS_VIEW, mode); } catch {}
}

async function loadStatus() {
  try {
    const res = await fetch("office-status.json?ts=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      STATE = Object.assign({}, DEFAULT_STATUS, data);
      if (!STATE.desks?.length) STATE.desks = DEFAULT_STATUS.desks;
      if (!STATE.feed?.length) STATE.feed = DEFAULT_STATUS.feed;
      await loadTopics(STATE.topics);
    }
  } catch {
    STATE = JSON.parse(JSON.stringify(DEFAULT_STATUS));
    await loadTopics();
  }
  renderAll();
}

function initFeedPreference() {
  let saved = null;
  try { saved = localStorage.getItem(LS_FEED); } catch {}
  if (saved === "1") feedOpen = true;
  else if (saved === "0") feedOpen = false;
  else feedOpen = !isNarrow();
}

function init() {
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  document.getElementById("modal-copy").addEventListener("click", async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.agentId);
      toast("Agent id copied");
    } catch {
      toast(selected.agentId);
    }
  });

  const openFeed = () => setFeedOpen(true);
  const closeFeed = () => setFeedOpen(false);
  document.getElementById("feed-chip")?.addEventListener("click", openFeed);
  document.getElementById("feed-chip-dash")?.addEventListener("click", openFeed);
  document.getElementById("feed-close")?.addEventListener("click", closeFeed);
  document.getElementById("feed-min-dash")?.addEventListener("click", closeFeed);

  document.getElementById("btn-3d").addEventListener("click", () => setMode("3d"));
  document.getElementById("btn-dash").addEventListener("click", () => setMode("dash"));
  document.querySelectorAll(".zone-filter button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".zone-filter button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const v = btn.dataset.view;
      document.querySelectorAll("#floor .zone").forEach(z => {
        if (v === "all") z.classList.remove("hidden");
        else z.classList.toggle("hidden", z.dataset.zone !== v);
      });
    });
  });

  initFeedPreference();

  const canvas = document.getElementById("office-canvas");
  const stage = document.getElementById("stage-3d");
  const fallback = document.getElementById("webgl-fallback");

  try {
    office3d = createOffice3D({
      canvas,
      container: stage,
      onSelect: openDesk,
      getStatus: () => STATE,
      onChat: pushLiveChat
    });
  } catch (err) {
    console.error("WebGL init failed", err);
    if (fallback) fallback.hidden = false;
    office3d = null;
  }

  let saved = "3d";
  try { saved = localStorage.getItem(LS_VIEW) || "3d"; } catch {}
  setMode(saved === "dash" ? "dash" : "3d");

  loadTopics().then(() => loadStatus());
  setInterval(loadStatus, 60000);

  window.addEventListener("resize", () => {
    syncFeedUi();
    if (office3d && mode === "3d") office3d.resize();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      updatePaperOffset();
      if (office3d && mode === "3d") office3d.resize();
    });
  }
  window.matchMedia("(max-width: 899px)").addEventListener("change", () => {
    syncFeedUi();
  });
}

init();
