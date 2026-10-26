/** Shared specialist roster — agentIds must stay unchanged. */
export const AGENTS = [
  { id: "masterki", name: "MasterKi", role: "Boss / coordinator", zone: "會議室", zoneKey: "meet", zoneLabel: "會議室 · Boss", initials: "MK", colorClass: "c0", color: 0xd45a5a, pos: [0, 0, -10] },
  { id: "econpulse", name: "EconPulse", role: "Macro / prints", zone: "宏觀研究部", zoneKey: "macro", zoneLabel: "宏觀研究部", initials: "EP", colorClass: "c1", color: 0x5f92a8, pos: [-9, 0, -2] },
  { id: "marketwatch", name: "MarketWatch", role: "Tape / alerts", zone: "交易監控部", zoneKey: "macro", zoneLabel: "交易監控部", initials: "MW", colorClass: "c2", color: 0xc9953a, pos: [-9, 0, 3] },
  { id: "stratlab", name: "StratLab", role: "Strategies", zone: "策略部", zoneKey: "strategy", zoneLabel: "策略研究室", initials: "SL", colorClass: "c3", color: 0x7d9b8a, pos: [-3, 0, 8] },
  { id: "workfolio", name: "Workfolio", role: "Vault / Pages", zone: "資料庫", zoneKey: "strategy", zoneLabel: "作品檔案室", initials: "WF", colorClass: "c3", color: 0xa88455, pos: [3, 0, 8] },
  { id: "patternlab", name: "PatternLab", role: "iH&S", zone: "圖表實驗室", zoneKey: "charts", zoneLabel: "圖形辨識", initials: "PL", colorClass: "c2", color: 0x3d9a6a, pos: [9, 0, -4] },
  { id: "patternsight", name: "PatternSight", role: "Candles", zone: "圖表實驗室", zoneKey: "charts", zoneLabel: "K線形態", initials: "PS", colorClass: "c2", color: 0x5f7d6c, pos: [9, 0, -1] },
  { id: "pinbarlab", name: "PinBarLab", role: "Pin bars", zone: "圖表實驗室", zoneKey: "charts", zoneLabel: "Pinbar 戰法", initials: "PB", colorClass: "c5", color: 0xc97a9a, pos: [9, 0, 2] },
  { id: "shoulderlab", name: "ShoulderLab", role: "H&S", zone: "圖表實驗室", zoneKey: "charts", zoneLabel: "頭肩形態", initials: "SH", colorClass: "c5", color: 0xb08a6a, pos: [9, 0, 5] },
  { id: "laoyulab", name: "撈魚Lab", role: "老余 · 破底翻", zone: "圖表實驗室", zoneKey: "charts", zoneLabel: "老余戰法", initials: "LY", colorClass: "c4", color: 0x3d9a6a, pos: [6, 0, 8] },
  { id: "plaudlab", name: "PlaudLab", role: "Notes / transcripts", zone: "筆記室", zoneKey: "notes", zoneLabel: "會議筆記室", initials: "PD", colorClass: "c4", color: 0x8bb8c9, pos: [0, 0, 3] }
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
