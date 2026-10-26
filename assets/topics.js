/**
 * EconPulse-derived chat topics + persona dialogue (client-side templates).
 * Pool refreshes from topics.json / office-status.json.topics; FALLBACK always works offline.
 */

export const FALLBACK_TOPICS = [
  {
    id: "quiet-mon",
    kind: "calendar",
    title: "Mon quiet day — no high-impact prints",
    summary: "Mon 26 Oct 2026 ET: no high-impact cards. Next cluster Wed FOMC + BoC; Thu GDP/PCE."
  },
  {
    id: "fomc-oct",
    kind: "calendar",
    title: "Wed FOMC · 2:00pm ET (no SEP)",
    summary: "Oct 27–28 FOMC decision Wed 2pm. Street leans hold; Dec path language is the tape. Powell 2:30pm."
  },
  {
    id: "boc-oct",
    kind: "calendar",
    title: "Wed BoC + MPR · 9:45am ET",
    summary: "BoC overnight + MPR Wed 9:45am. Prior 2.25% hold; Reuters leans +25bp to 2.50%. Same day as FOMC."
  },
  {
    id: "gdp-pce-thu",
    kind: "calendar",
    title: "Thu GDP Q3 + PCE Sep · 8:30am ET",
    summary: "BEA Thu 8:30am: GDP advance Q3 + PCE. Preferred inflation gauge right after FOMC."
  },
  {
    id: "uk-pmi-flash",
    kind: "actual",
    title: "UK flash PMI Oct · 53.1 / 52.8",
    summary: "UK PMI flash Comp/Svc 53.1 · Mfg 52.8 — still expansion (fd18f58 backfill)."
  },
  {
    id: "umich-oct-final",
    kind: "actual",
    title: "UMich Oct final CSI 48.0",
    summary: "Soft consumer sentiment into FOMC week."
  },
  {
    id: "ca-cpi-sep",
    kind: "actual",
    title: "Canada CPI Sep +3.1% y/y",
    summary: "Gas-led headline; key input before BoC Oct 28."
  },
  {
    id: "wti-fade",
    kind: "news",
    title: "WTI under $101 after Fri spike",
    summary: "WTI 100.97 (−2.23%) under $101 · Sunday Globex fade."
  },
  {
    id: "nq-gap-fade",
    kind: "news",
    title: "NQ Sunday gap fully faded",
    summary: "Asia quiet · ES +0.08% · NQ +0.09% · gap fade done."
  },
  {
    id: "radio-fomc-week",
    kind: "radio",
    title: "Daily radio · FOMC week",
    summary: "Quiet Mon → Tue durables/conf → Wed BoC+FOMC → Thu GDP/PCE."
  }
];

let TOPIC_POOL = FALLBACK_TOPICS.slice();

export function getTopicPool() {
  return TOPIC_POOL.length ? TOPIC_POOL : FALLBACK_TOPICS;
}

export function setTopicPool(list) {
  if (Array.isArray(list) && list.length) TOPIC_POOL = list;
}

export function pickTopic() {
  const pool = getTopicPool();
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Persona one-liners keyed by agent id — specialty voice on a topic. */
const PERSONA = {
  masterki: (t) => ([
    `協調：${short(t.title)} — 大家對齊風險，勿搶跑。`,
    `Boss note：這週主線是 FOMC/BoC/GDP — 先聽 radio 再動手。`,
    `Kill 已關；專員跟 calendar，別自己發明 actuals。`
  ]),
  econpulse: (t) => ([
    `Calendar：${short(t.title)}。${t.kind === "actual" ? "Actual 已記入。" : "ET 時鐘 · 勿提前填。"}`,
    `宏觀：${clip(t.summary, 72)}`,
    `Print desk：下一個高影響簇是 Wed FOMC+BoC → Thu GDP/PCE。`
  ]),
  marketwatch: (t) => ([
    `Tape：${short(t.title)} — 看開盤反應，±0.5% 才喊。`,
    `價格面：${t.id.includes("wti") || (t.tags || []).includes("oil") ? "WTI 跌破 101，能源波動還沒完。" : "等 event 前後的 ES/NQ 跳動。"}`,
    `Alert 待命：event 窗口前後我會盯 gap / fade。`
  ]),
  stratlab: (t) => ([
    `策略：${short(t.title)} — 先定 bias，再定 size。`,
    `Playbook：FOMC 週偏好事件前減倉、決議後再加 setup。`,
    `Strat：把 ${t.kind} 當 regime filter，不是單邊信號。`
  ]),
  workfolio: (t) => ([
    `Vault：${short(t.title)} 會進 Pages / 狀態快照。`,
    `作品檔：calendar 與 Actuals 公開頁已對齊 e438280。`,
    `Portfolio note：紙上帳不動，只記公開宏觀。`
  ]),
  patternlab: (t) => ([
    `iH&S：${short(t.title)} 前後看頸線有無被砸穿。`,
    `形態：事件週 inverted H&S 要等 reclaim 才談 ENTRY。`,
    `PatternLab：宏觀噪音大時，頸線失效率會升。`
  ]),
  patternsight: (t) => ([
    `K線：${short(t.title)} — 盯 engulf / doji 在 key level。`,
    `Candle：event 前後常出長影；先標結構再喊形態。`,
    `Sight：週線收法比盤中噪音重要。`
  ]),
  pinbarlab: (t) => ([
    `Pinbar：${short(t.title)} 附近找 下影線 / 上影線 反轉。`,
    `戰法：FOMC 當日假突破 pin 很多 — 等收穩。`,
    `Pin：油價急殺時 WTI 上常出長下影，先量再跟。`
  ]),
  shoulderlab: (t) => ([
    `頭肩：${short(t.title)} — 看右肩是否對齊左肩高點。`,
    `H&S：決議後若破頸線，量能要跟上才算。`,
    `Shoulder：宏觀日形態容易假，先畫好再評。`
  ]),
  laoyulab: (t) => ([
    `老余：${short(t.title)} — 破底翻要等坐穩下沿。`,
    `互換：事件週先標 標準圖，勿急著 ENTRY。`,
    `撈魚：FOMC 前後假破多，等 reclaim 再說。`
  ]),
  plaudlab: (t) => ([
    `筆記：已標 ${short(t.title)} 進會議摘要草稿。`,
    `Plaud：radio / calendar 要點會滾進 digest。`,
    `Transcript tip：Wed 雙央行日，錄音分段標 FOMC vs BoC。`
  ])
};

function short(s) {
  const t = String(s || "").trim();
  return t.length > 42 ? t.slice(0, 40) + "…" : t;
}

function clip(s, n) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function pickLine(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Build a 2-speaker dialogue (1 line each) on a topic. */
export function buildDialogue(idA, idB, topic) {
  const t = topic || pickTopic();
  const linesA = PERSONA[idA] || ((x) => [`${idA}：留意 ${short(x.title)}`]);
  const linesB = PERSONA[idB] || ((x) => [`${idB}：收到 ${short(x.title)}`]);
  return {
    topic: t,
    lines: [
      { id: idA, text: pickLine(linesA(t)) },
      { id: idB, text: pickLine(linesB(t)) }
    ]
  };
}

/** Optional third voice when a third bot is at pantry. */
export function buildPantryAside(id, topic) {
  const lines = PERSONA[id] || ((x) => [`☕ ${short(x.title)}`]);
  return pickLine(lines(topic));
}

/**
 * Load topics from topics.json, then merge office-status.topics if present.
 * Never throws — falls back to FALLBACK_TOPICS.
 */
export async function loadTopics(statusTopics) {
  let list = null;
  try {
    const res = await fetch("topics.json?ts=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.topics) && data.topics.length) list = data.topics;
    }
  } catch { /* offline */ }
  if (Array.isArray(statusTopics) && statusTopics.length) {
    list = (list || []).concat(statusTopics);
  }
  if (list && list.length) setTopicPool(list);
  else setTopicPool(FALLBACK_TOPICS);
  return getTopicPool();
}
