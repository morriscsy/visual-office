/** Shared specialist roster — agentIds must stay unchanged. */
export const AGENTS = [
  // L1 Reception / Ops
  { id: "masterki", name: "MasterKi", role: "Boss / coordinator", zone: "L1 Reception", zoneKey: "meet", zoneLabel: "L1 · Reception / Boss", floor: 1, initials: "MK", colorClass: "c0", color: 0xd45a5a, pos: [0.2, 0, 1.6] },
  { id: "workfolio", name: "Workfolio", role: "Vault / Pages", zone: "L1 Ops", zoneKey: "strategy", zoneLabel: "L1 · Ops vault", floor: 1, initials: "WF", colorClass: "c3", color: 0xa88455, pos: [-3.2, 0, -2.2] },
  { id: "plaudlab", name: "PlaudLab", role: "Notes / transcripts", zone: "L1 Ops", zoneKey: "notes", zoneLabel: "L1 · Notes desk", floor: 1, initials: "PD", colorClass: "c4", color: 0x8bb8c9, pos: [2.8, 0, -2.0] },
  // L2 Markets / Trading
  { id: "econpulse", name: "EconPulse", role: "Macro / prints", zone: "L2 Markets", zoneKey: "macro", zoneLabel: "L2 · Macro desk", floor: 2, initials: "EP", colorClass: "c1", color: 0x5f92a8, pos: [-3.4, 0, -1.4] },
  { id: "marketwatch", name: "MarketWatch", role: "Tape / alerts", zone: "L2 Markets", zoneKey: "macro", zoneLabel: "L2 · Tape desk", floor: 2, initials: "MW", colorClass: "c2", color: 0xc9953a, pos: [-0.6, 0, -1.4] },
  { id: "stratlab", name: "StratLab", role: "Strategies", zone: "L2 Markets", zoneKey: "strategy", zoneLabel: "L2 · Strategy desk", floor: 2, initials: "SL", colorClass: "c3", color: 0x7d9b8a, pos: [2.2, 0, -1.4] },
  // L3 Engineering / Patterns
  { id: "patternlab", name: "PatternLab", role: "iH&S", zone: "L3 Engineering", zoneKey: "charts", zoneLabel: "L3 · iH&S", floor: 3, initials: "PL", colorClass: "c2", color: 0x3d9a6a, pos: [-3.6, 0, -1.2] },
  { id: "patternsight", name: "PatternSight", role: "Candles", zone: "L3 Engineering", zoneKey: "charts", zoneLabel: "L3 · Candles", floor: 3, initials: "PS", colorClass: "c2", color: 0x5f7d6c, pos: [-1.2, 0, -1.2] },
  { id: "pinbarlab", name: "PinBarLab", role: "Pin bars", zone: "L3 Engineering", zoneKey: "charts", zoneLabel: "L3 · Pinbar", floor: 3, initials: "PB", colorClass: "c5", color: 0xc97a9a, pos: [1.2, 0, -1.2] },
  { id: "shoulderlab", name: "ShoulderLab", role: "H&S", zone: "L3 Engineering", zoneKey: "charts", zoneLabel: "L3 · H&S", floor: 3, initials: "SH", colorClass: "c5", color: 0xb08a6a, pos: [3.4, 0, 0.8] },
  { id: "laoyulab", name: "撈魚Lab", role: "老余 · 破底翻", zone: "L3 Engineering", zoneKey: "charts", zoneLabel: "L3 · 老余", floor: 3, initials: "LY", colorClass: "c4", color: 0x3d9a6a, pos: [-2.4, 0, 1.6] }
];

export const AGENT_IDS = {
  masterki: "fe9d86ab-8678-4911-bab0-924452347903",
  econpulse: "8492cbad-dfe1-4269-adf8-399482e75e36",
  marketwatch: "30824dae-d27a-4d01-a183-8e7cc1ac5faf",
  stratlab: "bf845b56-5262-4dd4-9e8d-0a25c30ece60",
  workfolio: "8a4f7c29-bbce-428b-bdb1-2716d86faac5",
  patternlab: "f38c2c75-5a51-4c96-a48c-7d4caaf06346",
  patternsight: "4c10c83d-3503-40c7-b026-7cf6909dc126",
  pinbarlab: "60df8477-cce2-4ec4-aefa-cc80f2195ed2",
  shoulderlab: "1defe5ca-d4e3-4a9b-a369-6124e497868f",
  laoyulab: "4bf8abe0-9636-4e34-bee9-f625802c1e70",
  plaudlab: "c47b2949-b2ac-4a4f-8c5e-d4ba4a57076e"
};

AGENTS.forEach(a => { a.agentId = AGENT_IDS[a.id]; });

export function deepLink(agentId) {
  return "grokbot://app/v1/agent?id=" + encodeURIComponent(agentId);
}

export function fmtMoney(n) {
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(n) {
  const v = Number(n);
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

export function fmtWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-HK", {
      timeZone: "Asia/Hong_Kong", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    }) + " HKT";
  } catch { return iso; }
}

export function statusLabel(s) {
  if (s === "alert") return "alert";
  if (s === "working" || s === "active") return s === "active" ? "active" : "working";
  if (s === "away") return "away";
  return "idle";
}

/** Floor slab Y (avatar feet) for floors 1..3 */
export const FLOOR_Y = { 1: 0, 2: 3.55, 3: 7.1 };

export function deskSitOffset(agent) {
  const fy = FLOOR_Y[agent.floor] ?? 0;
  return [agent.pos[0], fy, agent.pos[2] + 0.55];
}
