import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { AGENTS, statusLabel } from "./agents.js";

/* Swedish / Scandinavian palette */
const C = {
  floor: 0xd9c4a1,       // light oak
  floorEdge: 0xc4a574,
  wall: 0xf7f4ed,        // off-white
  wallAccent: 0xe8efe9,  // soft sage wash
  desk: 0xe8dcc8,
  deskLeg: 0xb89a6e,
  monitor: 0xdfe6e2,
  screen: 0x8bb8c9,
  plantPot: 0xc4a574,
  plant: 0x7d9b8a,
  toilet: 0xeef2f0,
  pantry: 0xf0ebe3,
  coffee: 0xa88455,
  carpet: 0xe5ddd0,
  glass: 0xd5e4e8,
  ambient: 0xfff6ea,
  sun: 0xfff2d6,
  sky: 0xd9e8ee
};

const WAYPOINTS = {
  toilet: new THREE.Vector3(-11, 0, -9),
  pantry: new THREE.Vector3(11, 0, -9),
  hallA: new THREE.Vector3(0, 0, 0),
  hallB: new THREE.Vector3(-4, 0, -4),
  hallC: new THREE.Vector3(4, 0, -4)
};

const CHAT_LINES = [
  "☕ 茶水間見？", "📊 看過 print 了嗎", "稍休息一下",
  "這個 setup 怎樣？", "回來再對一下", "OK 同步一下"
];

function box(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.05,
    transparent: !!opts.opacity,
    opacity: opts.opacity ?? 1
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (opts.pos) m.position.set(...opts.pos);
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

  // bob legs illusion
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

function buildRoom(scene) {
  // Floor — light oak
  const floor = box(28, 0.18, 26, C.floor, { roughness: 0.85 });
  floor.position.y = -0.09;
  scene.add(floor);

  // Subtle floor planks
  for (let i = -12; i <= 12; i += 2) {
    const plank = box(0.04, 0.02, 24, C.floorEdge, { roughness: 0.9 });
    plank.position.set(i, 0.01, 0);
    plank.castShadow = false;
    scene.add(plank);
  }

  // Outer walls (low so we see inside)
  const wallH = 3.2;
  const walls = [
    box(28, wallH, 0.2, C.wall, { pos: [0, wallH / 2, -13] }),
    box(28, wallH, 0.2, C.wallAccent, { pos: [0, wallH / 2, 13] }),
    box(0.2, wallH, 26, C.wall, { pos: [-14, wallH / 2, 0] }),
    box(0.2, wallH, 26, C.wallAccent, { pos: [14, wallH / 2, 0] })
  ];
  walls.forEach(w => scene.add(w));

  // Glass partitions (soft)
  const glassMat = { roughness: 0.2, metalness: 0.1, opacity: 0.28 };
  scene.add(box(0.12, 2.4, 8, C.glass, { ...glassMat, pos: [-5, 1.2, -6] }));
  scene.add(box(0.12, 2.4, 8, C.glass, { ...glassMat, pos: [5, 1.2, -6] }));
  scene.add(box(10, 2.4, 0.12, C.glass, { ...glassMat, pos: [0, 1.2, -2] }));

  // Boss meeting table
  scene.add(box(3.2, 0.12, 1.6, C.desk, { roughness: 0.55, pos: [0, 0.72, -10] }));
  [[-1.2, -10.5], [1.2, -10.5], [-1.2, -9.5], [1.2, -9.5]].forEach(([x, z]) => {
    scene.add(box(0.12, 0.7, 0.12, C.deskLeg, { pos: [x, 0.35, z] }));
  });

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
  // fixture
  scene.add(box(0.7, 0.55, 0.55, 0xffffff, { roughness: 0.35, pos: [-11, 0.3, -10.5] }));

  // Pantry (NE)
  scene.add(box(4.2, 2.6, 0.15, C.pantry, { pos: [11, 1.3, -11.5] }));
  scene.add(box(0.15, 2.6, 3.5, C.pantry, { pos: [9, 1.3, -10] }));
  scene.add(box(0.15, 2.6, 3.5, C.pantry, { pos: [13, 1.3, -10] }));
  const pantrySign = document.createElement("div");
  pantrySign.className = "label3d";
  pantrySign.textContent = "☕ 茶水間";
  const pantryLabel = new CSS2DObject(pantrySign);
  pantryLabel.position.set(11, 2.8, -10);
  scene.add(pantryLabel);
  scene.add(box(1.8, 0.9, 0.6, C.desk, { pos: [11, 0.45, -10.2] }));
  scene.add(box(0.35, 0.45, 0.35, C.coffee, { pos: [10.5, 1.05, -10.2] }));
  scene.add(box(0.25, 0.35, 0.25, 0x8bb8c9, { pos: [11.3, 1.0, -10.2] }));

  // Plants
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

  // Soft area carpet under charts wing
  scene.add(box(8, 0.04, 10, C.carpet, { roughness: 1, pos: [9, 0.02, 1] }));
}

function buildDesk(scene, agent) {
  const [x, , z] = agent.pos;
  const desk = box(1.6, 0.1, 0.85, C.desk, { roughness: 0.55, pos: [x, 0.72, z] });
  scene.add(desk);
  [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].forEach(([dx, dz]) => {
    scene.add(box(0.1, 0.7, 0.1, C.deskLeg, { pos: [x + dx, 0.35, z + dz] }));
  });
  scene.add(box(0.7, 0.45, 0.06, C.monitor, { pos: [x, 1.1, z - 0.28] }));
  scene.add(box(0.58, 0.34, 0.02, C.screen, { roughness: 0.3, metalness: 0.2, pos: [x, 1.1, z - 0.24] }));
  // chair
  scene.add(box(0.55, 0.08, 0.55, 0xd5cfc4, { pos: [x, 0.48, z + 0.7] }));
  scene.add(box(0.55, 0.55, 0.08, 0xcfc7ba, { pos: [x, 0.8, z + 0.95] }));
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
  if (roll < 0.34) return { type: "toilet", pos: WAYPOINTS.toilet.clone(), label: "away · 洗手間" };
  if (roll < 0.68) return { type: "pantry", pos: WAYPOINTS.pantry.clone(), label: "away · 茶水間" };
  // chat with another bot
  const others = AGENTS.filter(a => a.id !== selfId);
  const partner = others[Math.floor(Math.random() * others.length)];
  const partnerAv = avatars.get(partner.id);
  const meet = partnerAv.position.clone();
  // meet halfway toward partner's desk, offset so they don't overlap
  const selfDesk = new THREE.Vector3(...AGENTS.find(a => a.id === selfId).pos);
  const mid = selfDesk.clone().lerp(new THREE.Vector3(...partner.pos), 0.5);
  mid.x += (Math.random() - 0.5) * 1.2;
  mid.z += (Math.random() - 0.5) * 1.2;
  mid.y = 0;
  return {
    type: "chat",
    pos: mid,
    partnerId: partner.id,
    partnerPos: meet,
    label: "away · 聊天",
    line: CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]
  };
}


export function createOffice3D({ canvas, container, onSelect, getStatus }) {
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
  renderer.toneMappingExposure = 1.2;
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
  // Slightly higher / closer for mobile portrait
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

  // Soft Nordic daylight
  scene.add(new THREE.AmbientLight(C.ambient, 0.9));
  const hemi = new THREE.HemisphereLight(0xeaf4f8, 0xd9c4a1, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(C.sun, 1.2);
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
  const fill = new THREE.DirectionalLight(0xcfe4ec, 0.4);
  fill.position.set(-10, 10, -8);
  scene.add(fill);

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
      deskStatus: "idle"
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

  // Robust size: ResizeObserver + visualViewport + delayed retries (iOS Safari)
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
  // Layout may not be ready on first paint
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
      el.classList.toggle("chat", state.mode === "linger" && state.trip?.type === "chat");
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

  function beginReturn(id, now) {
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

  function stepAI(dt, now) {
    avatars.forEach((av, id) => {
      const state = ai.get(id);
      if (state.mode === "desk" && now >= state.nextWanderAt) startWander(id, now);

      if (state.mode === "linger") {
        if (now >= state.lingerUntil) beginReturn(id, now);
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
              state.mode = "linger";
              state.lingerUntil = now + (state.trip?.type === "chat" ? 4500 + Math.random() * 2500 : 3500 + Math.random() * 3000);
              if (state.trip?.type === "chat") {
                av.userData.bubbleEl.textContent = state.trip.line;
                av.userData.bubbleEl.style.display = "block";
                const partnerState = ai.get(state.trip.partnerId);
                const partnerAv = avatars.get(state.trip.partnerId);
                if (partnerState && partnerState.mode === "desk") {
                  const meet = state.trip.pos.clone();
                  meet.x += 0.7;
                  partnerState.mode = "walk";
                  partnerState.path = [partnerAv.position.clone(), meet];
                  partnerState.pathIdx = 1;
                  partnerState.trip = { type: "chat", label: "away · 聊天", line: "👍", partnerId: id };
                  partnerState.nextWanderAt = now + 20000;
                }
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

  // Recover from WebGL context loss (common on iOS Safari)
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
      labelRenderer.domElement.remove();
      renderer.dispose();
    }
  };
}
