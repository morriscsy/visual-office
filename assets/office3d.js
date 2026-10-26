import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { AGENTS, statusLabel } from "./agents.js";
import { pickTopic, buildDialogue, buildPantryAside } from "./topics.js";

/* Swedish light base + cozy walnut furniture + subtle neon accents */
const C = {
  floor: 0xd9c4a1,       // light oak (keep bright)
  floorEdge: 0xc4a574,
  wall: 0xf7f4ed,        // off-white
  wallAccent: 0xe8efe9,  // soft sage wash
  desk: 0x5c4033,        // walnut
  deskTop: 0x6b4423,     // warmer walnut top
  deskGrain: 0x8a6239,   // lighter grain highlight
  deskLeg: 0x4a3224,
  chair: 0x6b5344,
  chairBack: 0x5a4436,
  shelf: 0x5c4033,
  monitor: 0xdfe6e2,
  screen: 0x8bb8c9,
  plantPot: 0x6b4423,
  plant: 0x7d9b8a,
  toilet: 0xeef2f0,
  pantry: 0xf0ebe3,
  coffee: 0xa88455,
  carpet: 0xe5ddd0,
  glass: 0xd5e4e8,
  ambient: 0xfff6ea,
  sun: 0xfff2d6,
  sky: 0xd9e8ee,
  neonCyan: 0x22d3ee,
  neonMagenta: 0xe879f9,
  neonAmber: 0xfbbf24
};

const WAYPOINTS = {
  toilet: new THREE.Vector3(-11, 0, -9),
  pantry: new THREE.Vector3(11, 0, -9),
  hallA: new THREE.Vector3(0, 0, 0),
  hallB: new THREE.Vector3(-4, 0, -4),
  hallC: new THREE.Vector3(4, 0, -4)
};

function box(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive != null ? opts.emissive : 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.opacity != null && opts.opacity < 1,
    opacity: opts.opacity ?? 1
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = opts.receiveShadow !== false;
  if (opts.pos) m.position.set(...opts.pos);
  return m;
}

function neonStrip(w, h, d, color, pos, intensity = 1.1) {
  const m = box(w, h, d, color, {
    roughness: 0.35,
    metalness: 0.2,
    emissive: color,
    emissiveIntensity: intensity,
    castShadow: false,
    receiveShadow: false,
    pos
  });
  return m;
}

function makeAvatar(agent) {
  const g = new THREE.Group();
  g.userData.agentId = agent.id;

  const body = box(0.55, 0.85, 0.35, agent.color, { roughness: 0.55 });
  body.position.y = 0.85;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf2d6c2, roughness: 0.65 })
  );
  head.position.y = 1.5;
  head.castShadow = true;
  g.add(head);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x8a948c, emissive: 0x8a948c, emissiveIntensity: 0.6, roughness: 0.85, transparent: true
    })
  );
  glow.position.set(0, 1.95, 0);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.body = body;

  const legL = box(0.14, 0.45, 0.18, 0x5a6a62, { roughness: 0.8 });
  legL.position.set(-0.14, 0.22, 0);
  const legR = box(0.14, 0.45, 0.18, 0x5a6a62, { roughness: 0.8 });
  legR.position.set(0.14, 0.22, 0);
  g.add(legL, legR);
  g.userData.legs = [legL, legR];

  const label = document.createElement("div");
  label.className = "label3d";
  label.textContent = agent.name;
  const labelObj = new CSS2DObject(label);
  labelObj.position.set(0, 2.15, 0);
  g.add(labelObj);
  g.userData.labelEl = label;

  const bubble = document.createElement("div");
  bubble.className = "bubble3d";
  bubble.style.display = "none";
  const bubbleObj = new CSS2DObject(bubble);
  bubbleObj.position.set(0, 2.55, 0);
  g.add(bubbleObj);
  g.userData.bubbleEl = bubble;

  return g;
}

function walnutTable(scene, w, d, x, z, y = 0.72) {
  // top with subtle grain strip
  scene.add(box(w, 0.1, d, C.deskTop, { roughness: 0.45, pos: [x, y, z] }));
  scene.add(box(w * 0.92, 0.015, 0.04, C.deskGrain, {
    roughness: 0.55, castShadow: false, pos: [x, y + 0.055, z]
  }));
  const inset = Math.min(w, d) * 0.38;
  [[-inset, -d * 0.35], [inset, -d * 0.35], [-inset, d * 0.35], [inset, d * 0.35]].forEach(([dx, dz]) => {
    scene.add(box(0.1, y - 0.02, 0.1, C.deskLeg, { roughness: 0.6, pos: [x + dx, (y - 0.02) / 2, z + dz] }));
  });
}

function walnutShelf(scene, x, z) {
  scene.add(box(1.4, 1.6, 0.28, C.shelf, { roughness: 0.55, pos: [x, 0.9, z] }));
  for (let i = 0; i < 3; i++) {
    scene.add(box(1.28, 0.04, 0.24, C.deskGrain, {
      roughness: 0.5, castShadow: false, pos: [x, 0.4 + i * 0.4, z + 0.02]
    }));
  }
}

function buildRoom(scene) {
  // Floor — light oak (Swedish bright base)
  const floor = box(28, 0.18, 26, C.floor, { roughness: 0.85 });
  floor.position.y = -0.09;
  scene.add(floor);

  for (let i = -12; i <= 12; i += 2) {
    const plank = box(0.04, 0.02, 24, C.floorEdge, { roughness: 0.9, castShadow: false });
    plank.position.set(i, 0.01, 0);
    scene.add(plank);
  }

  const wallH = 3.2;
  [
    box(28, wallH, 0.2, C.wall, { pos: [0, wallH / 2, -13] }),
    box(28, wallH, 0.2, C.wallAccent, { pos: [0, wallH / 2, 13] }),
    box(0.2, wallH, 26, C.wall, { pos: [-14, wallH / 2, 0] }),
    box(0.2, wallH, 26, C.wallAccent, { pos: [14, wallH / 2, 0] })
  ].forEach(w => scene.add(w));

  // Neon cove strips along wall tops (cozy-modern, not cyberpunk)
  scene.add(neonStrip(26, 0.06, 0.06, C.neonCyan, [0, wallH - 0.15, -12.85], 1.25));
  scene.add(neonStrip(26, 0.06, 0.06, C.neonAmber, [0, wallH - 0.15, 12.85], 0.95));
  scene.add(neonStrip(0.06, 0.06, 24, C.neonMagenta, [-13.85, wallH - 0.15, 0], 0.85));
  scene.add(neonStrip(0.06, 0.06, 24, C.neonCyan, [13.85, wallH - 0.15, 0], 0.9));

  // Soft neon point lights
  const neonPts = [
    { c: C.neonCyan, p: [0, 2.8, -12], i: 0.55 },
    { c: C.neonAmber, p: [11, 2.4, -10], i: 0.45 },
    { c: C.neonMagenta, p: [9, 2.4, 1], i: 0.4 },
    { c: C.neonCyan, p: [-9, 2.4, 0], i: 0.35 }
  ];
  neonPts.forEach(({ c, p, i }) => {
    const pl = new THREE.PointLight(c, i, 10, 2);
    pl.position.set(...p);
    scene.add(pl);
  });

  const glassMat = { roughness: 0.2, metalness: 0.1, opacity: 0.28 };
  scene.add(box(0.12, 2.4, 8, C.glass, { ...glassMat, pos: [-5, 1.2, -6] }));
  scene.add(box(0.12, 2.4, 8, C.glass, { ...glassMat, pos: [5, 1.2, -6] }));
  scene.add(box(10, 2.4, 0.12, C.glass, { ...glassMat, pos: [0, 1.2, -2] }));
  // neon edge on glass rails
  scene.add(neonStrip(0.04, 0.04, 7.5, C.neonCyan, [-5, 2.45, -6], 0.7));
  scene.add(neonStrip(0.04, 0.04, 7.5, C.neonMagenta, [5, 2.45, -6], 0.65));

  // Boss walnut meeting table + neon logo strip
  walnutTable(scene, 3.2, 1.6, 0, -10);
  scene.add(neonStrip(1.2, 0.05, 0.05, C.neonAmber, [0, 0.82, -10], 1.4));
  const logo = document.createElement("div");
  logo.className = "label3d neon-logo";
  logo.textContent = "▣ Morris Desk";
  const logoObj = new CSS2DObject(logo);
  logoObj.position.set(0, 2.6, -12.2);
  scene.add(logoObj);

  // Walnut shelves near strategy / charts
  walnutShelf(scene, -1.5, 10.5);
  walnutShelf(scene, 11.5, 8);

  // Toilet room (NW)
  scene.add(box(4.2, 2.6, 0.15, C.toilet, { pos: [-11, 1.3, -11.5] }));
  scene.add(box(0.15, 2.6, 3.5, C.toilet, { pos: [-9, 1.3, -10] }));
  scene.add(box(0.15, 2.6, 3.5, C.toilet, { pos: [-13, 1.3, -10] }));
  const toiletSign = document.createElement("div");
  toiletSign.className = "label3d";
  toiletSign.textContent = "🚻 洗手間";
  const toiletLabel = new CSS2DObject(toiletSign);
  toiletLabel.position.set(-11, 2.8, -10);
  scene.add(toiletLabel);
  scene.add(box(0.7, 0.55, 0.55, 0xffffff, { roughness: 0.35, pos: [-11, 0.3, -10.5] }));

  // Pantry (NE) — walnut counter + amber neon
  scene.add(box(4.2, 2.6, 0.15, C.pantry, { pos: [11, 1.3, -11.5] }));
  scene.add(box(0.15, 2.6, 3.5, C.pantry, { pos: [9, 1.3, -10] }));
  scene.add(box(0.15, 2.6, 3.5, C.pantry, { pos: [13, 1.3, -10] }));
  const pantrySign = document.createElement("div");
  pantrySign.className = "label3d";
  pantrySign.textContent = "☕ 茶水間";
  const pantryLabel = new CSS2DObject(pantrySign);
  pantryLabel.position.set(11, 2.8, -10);
  scene.add(pantryLabel);
  scene.add(box(1.8, 0.9, 0.6, C.deskTop, { roughness: 0.5, pos: [11, 0.45, -10.2] }));
  scene.add(box(1.6, 0.03, 0.5, C.deskGrain, { castShadow: false, pos: [11, 0.92, -10.2] }));
  scene.add(box(0.35, 0.45, 0.35, C.coffee, { pos: [10.5, 1.05, -10.2] }));
  scene.add(box(0.25, 0.35, 0.25, 0x8bb8c9, { pos: [11.3, 1.0, -10.2] }));
  scene.add(neonStrip(1.6, 0.04, 0.04, C.neonAmber, [11, 1.35, -11.35], 1.15));

  // Plants in walnut pots
  [[-12, 10], [12, 10], [-6, -12], [6, -12]].forEach(([x, z]) => {
    scene.add(box(0.4, 0.35, 0.4, C.plantPot, { pos: [x, 0.18, z] }));
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 12),
      new THREE.MeshStandardMaterial({ color: C.plant, roughness: 0.8 })
    );
    foliage.position.set(x, 0.7, z);
    foliage.castShadow = true;
    scene.add(foliage);
  });

  scene.add(box(8, 0.04, 10, C.carpet, { roughness: 1, pos: [9, 0.02, 1] }));
  // charts-wing neon rail
  scene.add(neonStrip(7.5, 0.04, 0.04, C.neonMagenta, [9, 0.08, -4.2], 0.8));
}

function buildDesk(scene, agent) {
  const [x, , z] = agent.pos;
  // walnut desk + grain highlight
  scene.add(box(1.6, 0.1, 0.85, C.deskTop, { roughness: 0.48, pos: [x, 0.72, z] }));
  scene.add(box(1.4, 0.015, 0.05, C.deskGrain, {
    roughness: 0.55, castShadow: false, pos: [x, 0.78, z]
  }));
  [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].forEach(([dx, dz]) => {
    scene.add(box(0.1, 0.7, 0.1, C.deskLeg, { roughness: 0.6, pos: [x + dx, 0.35, z + dz] }));
  });
  scene.add(box(0.7, 0.45, 0.06, C.monitor, { pos: [x, 1.1, z - 0.28] }));
  // soft neon screen glow
  scene.add(box(0.58, 0.34, 0.02, C.screen, {
    roughness: 0.3, metalness: 0.2,
    emissive: C.neonCyan, emissiveIntensity: 0.25,
    pos: [x, 1.1, z - 0.24]
  }));
  // walnut chair
  scene.add(box(0.55, 0.08, 0.55, C.chair, { roughness: 0.65, pos: [x, 0.48, z + 0.7] }));
  scene.add(box(0.55, 0.55, 0.08, C.chairBack, { roughness: 0.65, pos: [x, 0.8, z + 0.95] }));
  scene.add(box(0.08, 0.45, 0.08, C.deskLeg, { pos: [x, 0.25, z + 0.7] }));
}

function setGlow(avatar, status) {
  const g = avatar.userData.glow;
  if (!g) return;
  let color = 0x8a948c, intensity = 0.35;
  if (status === "alert") { color = 0xd45a5a; intensity = 1.4; }
  else if (status === "active" || status === "working") { color = 0x3d9a6a; intensity = 0.9; }
  else if (status === "away") { color = 0x8bb8c9; intensity = 0.55; }
  g.material.color.setHex(color);
  g.material.emissive.setHex(color);
  g.material.emissiveIntensity = intensity;
}

function pickWanderTarget(selfId, avatars) {
  const roll = Math.random();
  if (roll < 0.30) return { type: "toilet", pos: WAYPOINTS.toilet.clone(), label: "away · 洗手間" };
  if (roll < 0.58) return { type: "pantry", pos: WAYPOINTS.pantry.clone(), label: "away · 茶水間" };
  const others = AGENTS.filter(a => a.id !== selfId);
  const partner = others[Math.floor(Math.random() * others.length)];
  const partnerAv = avatars.get(partner.id);
  const meet = partnerAv.position.clone();
  const selfDesk = new THREE.Vector3(...AGENTS.find(a => a.id === selfId).pos);
  const mid = selfDesk.clone().lerp(new THREE.Vector3(...partner.pos), 0.5);
  mid.x += (Math.random() - 0.5) * 1.2;
  mid.z += (Math.random() - 0.5) * 1.2;
  mid.y = 0;
  const dialogue = buildDialogue(selfId, partner.id, pickTopic());
  return {
    type: "chat",
    pos: mid,
    partnerId: partner.id,
    partnerPos: meet,
    label: "away · 聊天",
    dialogue,
    line: dialogue.lines[0].text
  };
}

export function createOffice3D({ canvas, container, onSelect, getStatus, onChat }) {
  const host = container || canvas.parentElement;

  function measure() {
    const w = Math.max(1, Math.floor(host.clientWidth || canvas.clientWidth || window.innerWidth || 1));
    const h = Math.max(1, Math.floor(host.clientHeight || canvas.clientHeight || Math.floor(window.innerHeight * 0.5) || 1));
    return { w, h };
  }

  const mobile = (typeof window !== "undefined") && (
    window.matchMedia("(max-width: 900px)").matches ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "")
  );

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: false,
      powerPreference: mobile ? "low-power" : "high-performance",
      failIfMajorPerformanceCaveat: false
    });
  } catch (err) {
    throw err;
  }

  const { w: iw, h: ih } = measure();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setSize(iw, ih, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(C.sky, 1);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(iw, ih);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  labelRenderer.domElement.style.zIndex = "2";
  host.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.sky);
  scene.fog = new THREE.Fog(0xd9e8ee, 30, 60);

  const camera = new THREE.PerspectiveCamera(42, iw / ih, 0.1, 120);
  if (mobile) camera.position.set(14, 16, 16);
  else camera.position.set(16, 14, 18);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 8;
  controls.maxDistance = 40;
  controls.enablePan = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  // Soft Nordic daylight (keep bright) + warm fill for walnut
  scene.add(new THREE.AmbientLight(C.ambient, 0.88));
  const hemi = new THREE.HemisphereLight(0xeaf4f8, 0xd9c4a1, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(C.sun, 1.15);
  sun.position.set(12, 22, 8);
  sun.castShadow = true;
  const shadowSize = mobile ? 512 : 1024;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe4ec, 0.38);
  fill.position.set(-10, 10, -8);
  scene.add(fill);
  const warm = new THREE.DirectionalLight(0xffe0c2, 0.22);
  warm.position.set(4, 8, -6);
  scene.add(warm);

  buildRoom(scene);
  AGENTS.forEach(a => buildDesk(scene, a));

  const avatars = new Map();
  const ai = new Map();

  AGENTS.forEach((agent, i) => {
    const av = makeAvatar(agent);
    av.position.set(agent.pos[0], 0, agent.pos[2] + 0.55);
    scene.add(av);
    avatars.set(agent.id, av);
    ai.set(agent.id, {
      mode: "desk",
      path: [],
      pathIdx: 0,
      speed: 1.55 + Math.random() * 0.4,
      nextWanderAt: performance.now() + 4000 + i * 2200 + Math.random() * 8000,
      lingerUntil: 0,
      trip: null,
      deskStatus: "idle",
      bubbleTimer: null
    });
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function resize() {
    const { w, h } = measure();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
  }

  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => resize());
    ro.observe(host);
  }
  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
    window.visualViewport.addEventListener("scroll", resize);
  }
  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(resize);
  });
  setTimeout(resize, 100);
  setTimeout(resize, 400);

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = [];
    avatars.forEach(av => av.traverse(o => { if (o.isMesh) meshes.push(o); }));
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && !obj.userData.agentId) obj = obj.parent;
    if (obj?.userData.agentId) onSelect?.(obj.userData.agentId);
  });

  function clearBubbleTimer(state) {
    if (state.bubbleTimer) {
      clearTimeout(state.bubbleTimer);
      state.bubbleTimer = null;
    }
  }

  function showBubble(av, text, ms = 4200) {
    const el = av.userData.bubbleEl;
    if (!el) return;
    el.textContent = text;
    el.style.display = "block";
    const state = ai.get(av.userData.agentId);
    if (state) {
      clearBubbleTimer(state);
      state.bubbleTimer = setTimeout(() => {
        el.style.display = "none";
        state.bubbleTimer = null;
      }, ms);
    }
  }

  function emitChat(dialogue, zoneLabel) {
    if (!dialogue?.lines?.length) return;
    const topic = dialogue.topic;
    const text = dialogue.lines.map(l => {
      const name = AGENTS.find(a => a.id === l.id)?.name || l.id;
      return `${name}: ${l.text}`;
    }).join(" · ");
    onChat?.({
      from: "茶水間對話",
      zone: zoneLabel || "聊天區",
      text: `💬 ${topic?.title || "Topic"} — ${text}`,
      at: new Date().toISOString(),
      level: "chat",
      topicId: topic?.id
    });
  }

  function startTopicChat(idA, idB, zoneLabel) {
    const dialogue = buildDialogue(idA, idB, pickTopic());
    const avA = avatars.get(idA);
    const avB = avatars.get(idB);
    if (avA && dialogue.lines[0]) showBubble(avA, dialogue.lines[0].text, 5000);
    if (avB && dialogue.lines[1]) {
      const stB = ai.get(idB);
      if (stB) {
        clearBubbleTimer(stB);
        stB.bubbleTimer = setTimeout(() => {
          showBubble(avB, dialogue.lines[1].text, 5000);
        }, 1600);
      }
    }
    emitChat(dialogue, zoneLabel);
    return dialogue;
  }

  function updateStatusVisuals() {
    const st = getStatus?.() || {};
    const byId = {};
    (st.desks || []).forEach(d => { byId[d.id] = d; });
    avatars.forEach((av, id) => {
      const state = ai.get(id);
      const deskSt = statusLabel(byId[id]?.status || "idle");
      state.deskStatus = deskSt;
      const visual = state.mode === "desk" ? deskSt : "away";
      setGlow(av, visual);
      const el = av.userData.labelEl;
      if (!el) return;
      el.classList.toggle("away", state.mode !== "desk");
      el.classList.toggle("chat", state.mode === "linger" && (state.trip?.type === "chat" || state.trip?.type === "pantry"));
      if (state.mode === "desk") el.textContent = AGENTS.find(a => a.id === id).name;
      else if (state.trip?.label) el.textContent = `${AGENTS.find(a => a.id === id).name} · ${state.trip.label.replace("away · ", "")}`;
    });
  }

  function startWander(id, now) {
    const state = ai.get(id);
    const av = avatars.get(id);
    let away = 0;
    ai.forEach(s => { if (s.mode !== "desk") away++; });
    if (away >= 4) {
      state.nextWanderAt = now + 5000 + Math.random() * 5000;
      return;
    }
    const trip = pickWanderTarget(id, avatars);
    const from = av.position.clone();
    const halls = [WAYPOINTS.hallA, WAYPOINTS.hallB, WAYPOINTS.hallC];
    halls.sort((a, b) => a.distanceTo(from) - b.distanceTo(from));
    const path = [from.clone(), halls[0].clone(), trip.pos.clone()];
    state.mode = "walk";
    state.path = path;
    state.pathIdx = 1;
    state.trip = trip;
    state.nextWanderAt = now + 28000 + Math.random() * 25000;
    av.userData.bubbleEl.style.display = "none";
  }

  function beginReturn(id) {
    const state = ai.get(id);
    const av = avatars.get(id);
    const agent = AGENTS.find(a => a.id === id);
    const desk = new THREE.Vector3(agent.pos[0], 0, agent.pos[2] + 0.55);
    const halls = [WAYPOINTS.hallA, WAYPOINTS.hallB, WAYPOINTS.hallC];
    halls.sort((a, b) => a.distanceTo(av.position) - b.distanceTo(av.position));
    state.mode = "return";
    state.path = [av.position.clone(), halls[0].clone(), desk];
    state.pathIdx = 1;
    av.userData.bubbleEl.style.display = "none";
  }

  function onArriveLinger(id, now) {
    const state = ai.get(id);
    const av = avatars.get(id);
    state.mode = "linger";
    const isChat = state.trip?.type === "chat";
    const isPantry = state.trip?.type === "pantry";
    state.lingerUntil = now + (isChat ? 6500 + Math.random() * 2500 : 3500 + Math.random() * 3000);

    if (isChat && state.trip.dialogue) {
      const d = state.trip.dialogue;
      showBubble(av, d.lines[0]?.text || state.trip.line, 5200);
      emitChat(d, "聊天區");
      const partnerState = ai.get(state.trip.partnerId);
      const partnerAv = avatars.get(state.trip.partnerId);
      if (partnerState && partnerState.mode === "desk" && partnerAv) {
        const meet = state.trip.pos.clone();
        meet.x += 0.7;
        partnerState.mode = "walk";
        partnerState.path = [partnerAv.position.clone(), meet];
        partnerState.pathIdx = 1;
        partnerState.trip = {
          type: "chat",
          label: "away · 聊天",
          partnerId: id,
          dialogue: d,
          line: d.lines[1]?.text || "👍",
          isPartner: true
        };
        partnerState.nextWanderAt = now + 20000;
      } else if (partnerAv && d.lines[1]) {
        setTimeout(() => showBubble(partnerAv, d.lines[1].text, 5000), 1500);
      }
    } else if (isPantry) {
      // Chat with whoever else is already lingering at pantry
      let partnerId = null;
      ai.forEach((s, oid) => {
        if (oid !== id && s.mode === "linger" && s.trip?.type === "pantry") partnerId = oid;
      });
      if (partnerId) {
        startTopicChat(id, partnerId, "茶水間");
      } else {
        const topic = pickTopic();
        const line = buildPantryAside(id, topic);
        showBubble(av, line, 4500);
        onChat?.({
          from: AGENTS.find(a => a.id === id)?.name || id,
          zone: "茶水間",
          text: `☕ ${topic.title} — ${line}`,
          at: new Date().toISOString(),
          level: "chat",
          topicId: topic.id
        });
      }
    }
  }

  function stepAI(dt, now) {
    avatars.forEach((av, id) => {
      const state = ai.get(id);
      if (state.mode === "desk" && now >= state.nextWanderAt) startWander(id, now);

      if (state.mode === "linger") {
        if (now >= state.lingerUntil) beginReturn(id);
        return;
      }

      if (state.mode === "walk" || state.mode === "return") {
        const target = state.path[state.pathIdx];
        if (!target) return;
        const pos = av.position;
        const dist = pos.distanceTo(target);
        const step = state.speed * dt;
        if (dist <= step) {
          pos.copy(target);
          state.pathIdx++;
          if (state.pathIdx >= state.path.length) {
            if (state.mode === "walk") {
              if (state.trip?.isPartner && state.trip?.dialogue?.lines?.[1]) {
                state.mode = "linger";
                state.lingerUntil = now + 5000 + Math.random() * 2000;
                showBubble(av, state.trip.dialogue.lines[1].text, 5000);
              } else {
                onArriveLinger(id, now);
              }
            } else {
              state.mode = "desk";
              state.trip = null;
              av.rotation.y = 0;
              av.userData.bubbleEl.style.display = "none";
            }
          }
        } else {
          const dir = target.clone().sub(pos).normalize();
          pos.addScaledVector(dir, step);
          av.rotation.y = Math.atan2(dir.x, dir.z);
          const t = now * 0.012;
          const [l, r] = av.userData.legs || [];
          if (l && r) {
            l.rotation.x = Math.sin(t) * 0.45;
            r.rotation.x = Math.sin(t + Math.PI) * 0.45;
          }
        }
      } else {
        const [l, r] = av.userData.legs || [];
        if (l && r) { l.rotation.x = 0; r.rotation.x = 0; }
        av.position.y = Math.sin(now * 0.002 + id.length) * 0.015;
      }
    });
  }

  let last = performance.now();
  let running = true;
  let visible = true;

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    console.warn("WebGL context lost");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    console.warn("WebGL context restored — resizing");
    resize();
  });

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepAI(dt, now);
    updateStatusVisuals();
    avatars.forEach((av, id) => {
      const st = ai.get(id);
      if (st.mode === "desk" && st.deskStatus === "alert" && av.userData.glow) {
        av.userData.glow.material.emissiveIntensity = 0.8 + Math.sin(now * 0.008) * 0.7;
      }
    });
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    resize,
    setVisible(v) {
      visible = v;
      labelRenderer.domElement.style.display = v ? "block" : "none";
      if (v) {
        resize();
        requestAnimationFrame(() => requestAnimationFrame(resize));
        last = performance.now();
      }
    },
    dispose() {
      running = false;
      if (ro) ro.disconnect();
      ai.forEach(s => clearBubbleTimer(s));
      labelRenderer.domElement.remove();
      renderer.dispose();
    }
  };
}
