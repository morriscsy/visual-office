import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { AGENTS, statusLabel, FLOOR_Y, deskSitOffset } from "./agents.js";
import { pickTopic, buildDialogue, buildPantryAside } from "./topics.js";

/* v0.7 — Claymation / plasticine cutaway office (Magnific clay-animation look) */

const C = {
  exterior: 0xf2c9a0,
  exteriorEdge: 0xe8b080,
  wall: 0xf6d4b0,
  wallInner: 0xf8dcc0,
  floor: 0xe8e4ef,
  floorEdge: 0xd4c8b0,
  slab: 0xefc9a5,
  desk: 0xe8c9a0,
  deskSide: 0xe09060,
  deskTop: 0xf0d5b0,
  chair: 0xb8c8d4,
  chairWood: 0xc4a070,
  shelf: 0xe2c090,
  monitor: 0xf2eee6,
  screen: 0x7eb8b0,
  plantPot: 0xc4785a,
  plant: 0x7a9e6e,
  tree: 0x5f8a58,
  glass: 0xf0e0d0,
  ambient: 0xfff0e0,
  sun: 0xffe8c8,
  void: 0xf5e6d4,
  softGlow: 0xffd9a8,
  warmLamp: 0xffc878,
  cafeSign: 0xe87860,
  server: 0xd8c8b8,
  fridge: 0xf0ebe4,
  sofa: 0xd4c0b0,
  receptionStripe: 0xe87860,
  claySkin: 0xf0c8a8,
  bookA: 0xe87860,
  bookB: 0x7eb8b0,
  bookC: 0xe8c050,
  bookD: 0x8bb88a
};

const FH = 3.55;
const WALL_H = 3.15;
const BW = 16;
const BD = 12;
const HALF_W = BW / 2;
const HALF_D = BD / 2;

function fy(floor) { return FLOOR_Y[floor] ?? 0; }

let CLAY_MAP = null;
let FLOOR_MAP = null;

function makeNoiseCanvas(size, paint) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  paint(ctx, size);
  return c;
}

function initTextures() {
  if (CLAY_MAP) return;
  const clay = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = "#f0d4b0";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2200; i++) {
      const v = 200 + (Math.random() * 40) | 0;
      ctx.fillStyle = `rgba(${v},${(v * 0.88) | 0},${(v * 0.72) | 0},${0.04 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, 0.6 + Math.random() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(180,120,80,${0.03 + Math.random() * 0.05})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, Math.random() * s);
      ctx.quadraticCurveTo(Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s);
      ctx.stroke();
    }
  });
  CLAY_MAP = new THREE.CanvasTexture(clay);
  CLAY_MAP.wrapS = CLAY_MAP.wrapT = THREE.RepeatWrapping;
  CLAY_MAP.repeat.set(2, 2);
  CLAY_MAP.colorSpace = THREE.SRGBColorSpace;

  const floor = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = "#e6e2ed";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 800; i++) {
      const v = 210 + (Math.random() * 30) | 0;
      ctx.fillStyle = `rgba(${v},${v - 4},${v + 6},${0.05 + Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 18, 1 + Math.random() * 3);
    }
  });
  FLOOR_MAP = new THREE.CanvasTexture(floor);
  FLOOR_MAP.wrapS = FLOOR_MAP.wrapT = THREE.RepeatWrapping;
  FLOOR_MAP.repeat.set(3, 2.5);
  FLOOR_MAP.colorSpace = THREE.SRGBColorSpace;
}

function matClay(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.92,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive != null ? opts.emissive : 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    map: opts.map || null,
    envMapIntensity: opts.envMapIntensity ?? 0.25,
    transparent: opts.opacity != null && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    flatShading: false
  });
}

function clayBox(w, h, d, color, opts = {}) {
  const r = opts.radius ?? Math.min(0.08, Math.min(w, h, d) * 0.22);
  const geo = opts.sphere
    ? new THREE.SphereGeometry(Math.min(w, h, d) / 2, opts.segments ?? 16, opts.segments ?? 12)
    : new RoundedBoxGeometry(w, h, d, opts.segments ?? 4, r);
  const m = new THREE.Mesh(geo, matClay(color, opts));
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = opts.receiveShadow !== false;
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.scale) m.scale.set(...opts.scale);
  return m;
}

function softGlowBlob(w, h, d, color, pos, intensity = 0.55) {
  return clayBox(w, h, d, color, {
    roughness: 0.88, metalness: 0,
    emissive: color, emissiveIntensity: intensity,
    castShadow: false, receiveShadow: false, pos,
    radius: Math.min(w, h, d) * 0.35
  });
}

function cssLabel(text, className, pos) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.set(...pos);
  return obj;
}

function hairColor(agent) {
  const palette = [0x3a2a22, 0x6b4423, 0xc4a060, 0x2c2c2c, 0x8b5a3c, 0xd4b896, 0x4a3728];
  let h = 0;
  for (let i = 0; i < agent.id.length; i++) h = (h * 31 + agent.id.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function makeAvatar(agent) {
  const g = new THREE.Group();
  g.userData.agentId = agent.id;

  // Small body — color-block clay outfit
  const body = clayBox(0.42, 0.55, 0.28, agent.color, {
    roughness: 0.95, radius: 0.1, segments: 4
  });
  body.position.y = 0.62;
  g.add(body);

  // Pants
  const pants = clayBox(0.4, 0.28, 0.26, 0x5a6a72, { roughness: 0.95, radius: 0.08 });
  pants.position.y = 0.28;
  g.add(pants);

  // Oversized clay head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 18),
    matClay(C.claySkin, { roughness: 0.96, envMapIntensity: 0.15 })
  );
  head.position.y = 1.12;
  head.scale.set(1.05, 1.0, 0.95);
  head.castShadow = true;
  g.add(head);

  // Sculpted clay hair blob
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 14, 12),
    matClay(hairColor(agent), { roughness: 0.98 })
  );
  hair.position.set(0, 1.32, -0.02);
  hair.scale.set(1.15, 0.55, 1.05);
  hair.castShadow = true;
  g.add(hair);

  // Big simple eyes
  const eyeGeo = new THREE.SphereGeometry(0.07, 12, 10);
  const eyeMat = matClay(0xffffff, { roughness: 0.7 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.11, 1.14, 0.28);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.11, 1.14, 0.28);
  g.add(eyeL, eyeR);
  const pupilMat = matClay(0x2a2218, { roughness: 0.6 });
  const pL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), pupilMat);
  pL.position.set(-0.11, 1.14, 0.34);
  const pR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), pupilMat);
  pR.position.set(0.11, 1.14, 0.34);
  g.add(pL, pR);

  // Blob nose
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 8),
    matClay(0xe8b090, { roughness: 0.95 })
  );
  nose.position.set(0, 1.06, 0.34);
  g.add(nose);

  // Status glow — soft clay bead (not neon)
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    matClay(0xc4b8a8, { emissive: 0xc4b8a8, emissiveIntensity: 0.35, roughness: 0.85 })
  );
  glow.position.set(0, 1.55, 0);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.body = body;

  const legL = clayBox(0.12, 0.32, 0.14, 0x5a6a72, { roughness: 0.95, radius: 0.05 });
  legL.position.set(-0.1, 0.16, 0);
  const legR = clayBox(0.12, 0.32, 0.14, 0x5a6a72, { roughness: 0.95, radius: 0.05 });
  legR.position.set(0.1, 0.16, 0);
  g.add(legL, legR);
  g.userData.legs = [legL, legR];

  const label = document.createElement("div");
  label.className = "label3d clay";
  label.innerHTML = `<span class="l3-name">${agent.name}</span><span class="l3-role">${agent.role}</span>`;
  const labelObj = new CSS2DObject(label);
  labelObj.position.set(0, 1.78, 0);
  g.add(labelObj);
  g.userData.labelEl = label;

  const bubble = document.createElement("div");
  bubble.className = "bubble3d clay";
  bubble.style.display = "none";
  const bubbleObj = new CSS2DObject(bubble);
  bubbleObj.position.set(0, 2.15, 0);
  g.add(bubbleObj);
  g.userData.bubbleEl = bubble;

  return g;
}

function clayDeskAt(scene, x, y, z) {
  initTextures();
  // Chunky peach/terracotta desk body
  scene.add(clayBox(1.5, 0.55, 0.82, C.deskSide, {
    roughness: 0.94, radius: 0.1, map: CLAY_MAP, pos: [x, y + 0.42, z]
  }));
  // Soft cream top
  scene.add(clayBox(1.55, 0.12, 0.86, C.deskTop, {
    roughness: 0.9, radius: 0.06, pos: [x, y + 0.74, z]
  }));
  // Blob drawer fronts
  scene.add(clayBox(0.5, 0.18, 0.06, C.desk, {
    roughness: 0.92, radius: 0.05, castShadow: false, pos: [x - 0.35, y + 0.4, z + 0.4]
  }));
  scene.add(clayBox(0.5, 0.18, 0.06, C.desk, {
    roughness: 0.92, radius: 0.05, castShadow: false, pos: [x + 0.35, y + 0.4, z + 0.4]
  }));
  // Soft cream CRT / rounded monitor
  scene.add(clayBox(0.7, 0.52, 0.18, C.monitor, {
    roughness: 0.88, radius: 0.08, pos: [x, y + 1.1, z - 0.22]
  }));
  scene.add(clayBox(0.55, 0.38, 0.04, C.screen, {
    roughness: 0.75, emissive: C.screen, emissiveIntensity: 0.18,
    castShadow: false, pos: [x, y + 1.12, z - 0.12]
  }));
  // Fat keyboard
  scene.add(clayBox(0.55, 0.06, 0.28, 0xd8d0c4, {
    roughness: 0.92, radius: 0.03, pos: [x, y + 0.84, z + 0.12]
  }));
  // Mug
  scene.add(clayBox(0.1, 0.12, 0.1, C.plantPot, {
    roughness: 0.95, radius: 0.04, castShadow: false, pos: [x + 0.48, y + 0.88, z + 0.05]
  }));
  // Dusty-blue rounded swivel chair
  scene.add(clayBox(0.52, 0.14, 0.52, C.chair, {
    roughness: 0.94, radius: 0.08, pos: [x, y + 0.42, z + 0.72]
  }));
  scene.add(clayBox(0.48, 0.55, 0.12, C.chair, {
    roughness: 0.94, radius: 0.07, pos: [x, y + 0.72, z + 0.92]
  }));
  scene.add(clayBox(0.12, 0.36, 0.12, C.chairWood, {
    roughness: 0.92, radius: 0.04, pos: [x, y + 0.2, z + 0.72]
  }));
  // Base star (simplified blob)
  scene.add(clayBox(0.45, 0.06, 0.45, C.chairWood, {
    roughness: 0.92, radius: 0.03, pos: [x, y + 0.04, z + 0.72]
  }));
}

function clayShelf(scene, x, y, z) {
  initTextures();
  scene.add(clayBox(1.15, 1.4, 0.32, C.shelf, {
    roughness: 0.93, radius: 0.08, map: CLAY_MAP, pos: [x, y + 0.75, z]
  }));
  const cols = [C.bookA, C.bookB, C.bookC, C.bookD, 0x9a7ab0];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      const bh = 0.18 + (i % 3) * 0.04;
      scene.add(clayBox(0.14, bh, 0.18, cols[(row + i) % cols.length], {
        roughness: 0.95, radius: 0.03, castShadow: false,
        pos: [x - 0.38 + i * 0.24, y + 0.28 + row * 0.38 + bh / 2, z + 0.02]
      }));
    }
  }
}

function plantAt(scene, x, y, z, scale = 1) {
  scene.add(clayBox(0.34 * scale, 0.3 * scale, 0.34 * scale, C.plantPot, {
    roughness: 0.95, radius: 0.08, pos: [x, y + 0.15 * scale, z]
  }));
  const foliage = new THREE.Mesh(
    new THREE.SphereGeometry(0.4 * scale, 14, 12),
    matClay(C.plant, { roughness: 0.98, envMapIntensity: 0.2 })
  );
  foliage.position.set(x, y + 0.55 * scale, z);
  foliage.scale.set(1, 1.2, 1);
  foliage.castShadow = true;
  scene.add(foliage);
  // Extra leaf blob
  const leaf2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.22 * scale, 10, 8),
    matClay(0x6a9060, { roughness: 0.98 })
  );
  leaf2.position.set(x + 0.18 * scale, y + 0.48 * scale, z - 0.1 * scale);
  scene.add(leaf2);
}

function treeAt(scene, x, z, h = 2.4) {
  scene.add(clayBox(0.28, h * 0.35, 0.28, 0xc4a070, {
    roughness: 0.96, radius: 0.08, pos: [x, h * 0.17, z]
  }));
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 14, 12),
    matClay(C.tree, { roughness: 0.98 })
  );
  crown.position.set(x, h * 0.55, z);
  crown.scale.set(1, h * 0.35, 1);
  crown.castShadow = true;
  scene.add(crown);
}

function clayPanel(w, h, d, pos) {
  // Matte frosted clay "glass" — no transmission cyber look
  return clayBox(w, h, d, C.glass, {
    roughness: 0.82, metalness: 0, opacity: 0.55,
    envMapIntensity: 0.2, castShadow: false, pos, radius: 0.04
  });
}

function addFloorBadge(scene, floor, title) {
  const y = fy(floor) + WALL_H * 0.55;
  scene.add(cssLabel(`${floor}  ${title}`, "floor-badge clay", [-HALF_W - 0.15, y, 0]));
}

function pendantAt(scene, x, y, z) {
  scene.add(clayBox(0.06, 0.35, 0.06, 0xd8c8b0, {
    roughness: 0.9, castShadow: false, radius: 0.02, pos: [x, y + 0.2, z]
  }));
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 12),
    matClay(C.warmLamp, { roughness: 0.7, emissive: C.warmLamp, emissiveIntensity: 0.65 })
  );
  bulb.position.set(x, y, z);
  bulb.castShadow = false;
  scene.add(bulb);
  const pl = new THREE.PointLight(C.warmLamp, 0.35, 6, 2);
  pl.position.set(x, y - 0.1, z);
  scene.add(pl);
}

function buildExterior(scene) {
  initTextures();
  // Soft gradient void platform under the diorama
  const ground = clayBox(52, 0.12, 44, C.void, {
    roughness: 0.98, castShadow: false, map: FLOOR_MAP, pos: [0, -0.2, 2], radius: 0.02
  });
  scene.add(ground);
  // Soft peach plinth ring
  scene.add(clayBox(BW + 2.5, 0.18, BD + 2.5, 0xf0d4b8, {
    roughness: 0.95, castShadow: false, pos: [0, -0.05, 0], radius: 0.08
  }));
  [[-HALF_W - 7, -6], [-HALF_W - 6.5, 2], [-HALF_W - 7.2, 8], [HALF_W + 3, -7], [HALF_W + 4, 6]].forEach(([x, z], i) => {
    treeAt(scene, x, z, 2.0 + (i % 3) * 0.35);
  });
  plantAt(scene, -1.5, 0, HALF_D + 1.2, 1.1);
  plantAt(scene, 1.5, 0, HALF_D + 1.2, 0.95);
}

function buildSlab(scene, floor) {
  initTextures();
  const y = fy(floor);
  scene.add(clayBox(BW, 0.2, BD, C.floor, {
    roughness: 0.94, map: FLOOR_MAP, envMapIntensity: 0.2, pos: [0, y - 0.1, 0], radius: 0.04
  }));
  // Soft orange trim like Magnific diorama
  scene.add(clayBox(BW + 0.15, 0.08, 0.12, C.exteriorEdge, {
    roughness: 0.92, castShadow: false, pos: [0, y + 0.02, HALF_D], radius: 0.03
  }));
  scene.add(clayBox(0.12, 0.08, BD + 0.15, C.exteriorEdge, {
    roughness: 0.92, castShadow: false, pos: [HALF_W, y + 0.02, 0], radius: 0.03
  }));
  if (floor < 3) {
    scene.add(clayBox(BW + 0.35, 0.22, BD + 0.35, C.slab, {
      roughness: 0.94, pos: [0, y + WALL_H + 0.1, 0], radius: 0.06
    }));
  }
}

function buildShellWalls(scene) {
  for (let f = 1; f <= 3; f++) {
    const y = fy(f);
    const midY = y + WALL_H / 2;
    // Mustard-peach clay walls
    scene.add(clayBox(BW, WALL_H, 0.28, C.exterior, {
      roughness: 0.95, map: CLAY_MAP, pos: [0, midY, -HALF_D], radius: 0.06
    }));
    scene.add(clayBox(0.28, WALL_H, BD, C.exterior, {
      roughness: 0.95, map: CLAY_MAP, pos: [-HALF_W, midY, 0], radius: 0.06
    }));
    // Soft window cutouts (recessed clay, warm gradient feel)
    scene.add(clayBox(0.08, 1.0, 2.2, 0xf8e8d0, {
      roughness: 0.7, emissive: 0xffe8c8, emissiveIntensity: 0.25,
      castShadow: false, pos: [-HALF_W + 0.12, y + 1.6, -2], radius: 0.04
    }));
    scene.add(clayBox(0.08, 1.0, 2.2, 0xf8e8d0, {
      roughness: 0.7, emissive: 0xffe8c8, emissiveIntensity: 0.25,
      castShadow: false, pos: [-HALF_W + 0.12, y + 1.6, 2], radius: 0.04
    }));
    // Soft warm accent line (not neon)
    scene.add(softGlowBlob(BW - 0.8, 0.06, 0.06, C.softGlow,
      [0, y + WALL_H - 0.18, HALF_D - 0.2], 0.4));
  }
  for (let f = 1; f <= 3; f++) {
    const y = fy(f);
    scene.add(clayBox(0.36, WALL_H, 0.36, C.exteriorEdge, {
      roughness: 0.94, radius: 0.1, pos: [-HALF_W, y + WALL_H / 2, -HALF_D]
    }));
    scene.add(clayBox(0.36, WALL_H, 0.36, C.exteriorEdge, {
      roughness: 0.94, radius: 0.1, pos: [HALF_W, y + WALL_H / 2, -HALF_D]
    }));
  }
}

function buildElevator(scene) {
  const ex = -HALF_W + 1.35;
  const ez = -1.2;
  const totalH = fy(3) + WALL_H;
  // Matte clay shaft (frosted panels, no glass transmission)
  scene.add(clayPanel(0.1, totalH, 2.5, [ex - 0.9, totalH / 2, ez]));
  scene.add(clayPanel(0.1, totalH, 2.5, [ex + 0.9, totalH / 2, ez]));
  scene.add(clayPanel(1.8, totalH, 0.1, [ex, totalH / 2, ez - 1.2]));
  scene.add(clayPanel(1.8, totalH, 0.1, [ex, totalH / 2, ez + 1.2]));
  [[-0.9, -1.2], [0.9, -1.2], [-0.9, 1.2], [0.9, 1.2]].forEach(([dx, dz]) => {
    scene.add(clayBox(0.14, totalH, 0.14, C.exteriorEdge, {
      roughness: 0.92, radius: 0.05, pos: [ex + dx, totalH / 2, ez + dz]
    }));
  });
  const cab = clayBox(1.35, 2.0, 1.85, 0xf0e4d4, {
    roughness: 0.88, opacity: 0.7, emissive: C.softGlow, emissiveIntensity: 0.15,
    pos: [ex, fy(2) + 1.0, ez], radius: 0.1
  });
  cab.userData.isElevatorCab = true;
  scene.add(cab);
  scene.userData.elevatorCab = cab;
  // Soft warm shaft glow (replaces cyan neon)
  scene.add(softGlowBlob(0.08, totalH - 0.5, 0.08, C.warmLamp, [ex - 0.9, totalH / 2, ez + 1.2], 0.45));
  scene.add(softGlowBlob(0.08, totalH - 0.5, 0.08, C.warmLamp, [ex + 0.9, totalH / 2, ez + 1.2], 0.45));
}

function buildStairs(scene) {
  initTextures();
  const sx = -HALF_W + 3.2;
  const sz = 3.2;
  for (let f = 1; f <= 2; f++) {
    const y0 = fy(f);
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      scene.add(clayBox(1.45, 0.14, 0.45, C.desk, {
        roughness: 0.93, radius: 0.05, map: CLAY_MAP,
        pos: [sx, y0 + t * FH + 0.07, sz - i * 0.38]
      }));
    }
    scene.add(clayBox(0.1, FH * 0.9, 0.1, C.exteriorEdge, {
      roughness: 0.92, radius: 0.04, pos: [sx + 0.78, y0 + FH * 0.45, sz - 1.4]
    }));
  }
}

function buildServerRoom(scene) {
  const y = fy(3);
  const cx = 5.4, cz = -3.4;
  scene.add(clayPanel(4.2, 2.4, 0.1, [cx, y + 1.2, cz - 1.6]));
  scene.add(clayPanel(4.2, 2.4, 0.1, [cx, y + 1.2, cz + 1.6]));
  scene.add(clayPanel(0.1, 2.4, 3.2, [cx - 2.1, y + 1.2, cz]));
  scene.add(clayPanel(0.1, 2.4, 3.2, [cx + 2.1, y + 1.2, cz]));
  [-0.7, 0.7].forEach((dx) => {
    scene.add(clayBox(0.75, 1.85, 0.6, C.server, {
      roughness: 0.9, radius: 0.08, pos: [cx + dx, y + 0.95, cz]
    }));
    for (let i = 0; i < 5; i++) {
      const col = i % 2 === 0 ? 0x7eb88a : 0x7eb8b0;
      scene.add(clayBox(0.5, 0.08, 0.05, col, {
        emissive: col, emissiveIntensity: 0.55, castShadow: false, roughness: 0.85,
        pos: [cx + dx, y + 0.4 + i * 0.28, cz + 0.3], radius: 0.02
      }));
    }
  });
  scene.add(cssLabel("SERVER ROOM", "room-badge clay", [cx, y + 2.7, cz]));
}

function buildCafe(scene) {
  initTextures();
  const y = fy(3);
  const cx = 5.6, cz = 2.8;
  scene.add(clayBox(1.7, 0.55, 1.05, C.deskSide, {
    roughness: 0.93, radius: 0.1, map: CLAY_MAP, pos: [cx, y + 0.4, cz]
  }));
  scene.add(clayBox(1.75, 0.12, 1.1, C.deskTop, {
    roughness: 0.9, radius: 0.06, pos: [cx, y + 0.72, cz]
  }));
  [[-0.55, -0.6], [0.55, -0.6], [-0.55, 0.6], [0.55, 0.6]].forEach(([dx, dz]) => {
    scene.add(clayBox(0.4, 0.42, 0.4, C.chair, {
      roughness: 0.94, radius: 0.1, pos: [cx + dx, y + 0.26, cz + dz]
    }));
  });
  clayShelf(scene, cx + 1.6, y, cz - 0.8);
  plantAt(scene, cx - 1.3, y, cz + 0.9, 0.85);
  // Soft clay cafe sign (replaces neon strip)
  scene.add(clayBox(1.6, 0.35, 0.12, C.cafeSign, {
    roughness: 0.9, emissive: C.cafeSign, emissiveIntensity: 0.35,
    radius: 0.08, pos: [cx, y + 2.35, cz - 1.5]
  }));
  scene.add(cssLabel("CAFE", "room-badge clay-warm", [cx, y + 2.55, cz - 1.5]));
  pendantAt(scene, cx, y + 2.5, cz);
}

function buildKitchen(scene) {
  initTextures();
  const y = fy(2);
  const cx = 5.5, cz = -3.6;
  scene.add(clayBox(3.5, 0.95, 0.75, C.deskSide, {
    roughness: 0.93, radius: 0.1, map: CLAY_MAP, pos: [cx, y + 0.48, cz]
  }));
  scene.add(clayBox(3.4, 0.12, 0.7, C.deskTop, {
    roughness: 0.9, radius: 0.05, pos: [cx, y + 0.98, cz]
  }));
  scene.add(clayBox(0.5, 0.12, 0.4, 0xe0d8d0, {
    roughness: 0.85, radius: 0.05, pos: [cx - 0.9, y + 1.08, cz]
  }));
  // Coffee machine blob
  scene.add(clayBox(0.42, 0.55, 0.38, C.monitor, {
    roughness: 0.9, radius: 0.08, pos: [cx + 0.2, y + 1.28, cz]
  }));
  scene.add(clayBox(0.28, 0.1, 0.2, C.warmLamp, {
    emissive: C.warmLamp, emissiveIntensity: 0.4, castShadow: false,
    radius: 0.04, pos: [cx + 0.2, y + 1.52, cz + 0.05]
  }));
  scene.add(clayBox(0.9, 1.75, 0.75, C.fridge, {
    roughness: 0.88, radius: 0.1, pos: [cx + 1.55, y + 0.92, cz + 0.1]
  }));
  pendantAt(scene, cx - 0.5, y + 2.4, cz);
  pendantAt(scene, cx + 0.8, y + 2.4, cz);
  scene.add(cssLabel("KITCHEN", "room-badge clay", [cx, y + 2.5, cz]));
}

function buildLounge(scene, floor, x, z) {
  const y = fy(floor);
  scene.add(clayBox(2.1, 0.5, 0.9, C.sofa, { roughness: 0.96, radius: 0.12, pos: [x, y + 0.3, z] }));
  scene.add(clayBox(2.1, 0.55, 0.22, C.sofa, { roughness: 0.96, radius: 0.1, pos: [x, y + 0.58, z - 0.38] }));
  scene.add(clayBox(0.75, 0.12, 0.55, C.deskTop, {
    roughness: 0.9, radius: 0.06, pos: [x, y + 0.38, z + 0.9]
  }));
  plantAt(scene, x + 1.3, y, z + 0.2, 0.8);
}

function buildReception(scene) {
  initTextures();
  const y = fy(1);
  scene.add(clayBox(3.7, 1.0, 0.9, 0xf5e8d8, {
    roughness: 0.92, radius: 0.12, pos: [0.3, y + 0.5, 2.4]
  }));
  scene.add(clayBox(3.5, 0.12, 0.12, C.receptionStripe, {
    roughness: 0.9, emissive: C.receptionStripe, emissiveIntensity: 0.25,
    castShadow: false, radius: 0.04, pos: [0.3, y + 0.9, 2.85]
  }));
  scene.add(clayBox(3.5, 0.1, 0.75, C.deskTop, {
    roughness: 0.9, radius: 0.05, pos: [0.3, y + 1.02, 2.4]
  }));
  buildLounge(scene, 1, -4.2, 3.2);
  scene.add(clayBox(0.75, 0.55, 0.75, C.sofa, { roughness: 0.95, radius: 0.12, pos: [-2.6, y + 0.32, 3.6] }));
  plantAt(scene, -5.4, y, 3.8, 1.0);
  // Wall art blobs
  scene.add(clayBox(0.55, 0.4, 0.06, 0xe87860, {
    roughness: 0.92, castShadow: false, radius: 0.04, pos: [-2, y + 2.0, -HALF_D + 0.2]
  }));
  scene.add(clayBox(0.4, 0.5, 0.06, 0x7eb8b0, {
    roughness: 0.92, castShadow: false, radius: 0.04, pos: [-1.2, y + 2.05, -HALF_D + 0.2]
  }));
  pendantAt(scene, 0.3, y + 2.6, 1.5);
}

function buildConference(scene) {
  initTextures();
  const y = fy(1);
  const cx = 5.2, cz = -2.8;
  scene.add(clayPanel(4.0, 2.5, 0.1, [cx, y + 1.25, cz - 1.7]));
  scene.add(clayPanel(4.0, 2.5, 0.1, [cx, y + 1.25, cz + 1.7]));
  scene.add(clayPanel(0.1, 2.5, 3.4, [cx - 2.0, y + 1.25, cz]));
  scene.add(clayPanel(0.1, 2.5, 3.4, [cx + 2.0, y + 1.25, cz]));
  scene.add(clayBox(2.5, 0.55, 1.2, C.deskSide, {
    roughness: 0.93, radius: 0.1, map: CLAY_MAP, pos: [cx, y + 0.4, cz]
  }));
  scene.add(clayBox(2.55, 0.12, 1.25, C.deskTop, {
    roughness: 0.9, radius: 0.06, pos: [cx, y + 0.72, cz]
  }));
  [[-0.85, -0.75], [0.85, -0.75], [-0.85, 0.75], [0.85, 0.75]].forEach(([dx, dz]) => {
    scene.add(clayBox(0.42, 0.48, 0.42, C.chair, {
      roughness: 0.94, radius: 0.1, pos: [cx + dx, y + 0.28, cz + dz]
    }));
  });
  pendantAt(scene, cx, y + 2.5, cz);
  scene.add(cssLabel("CONFERENCE", "room-badge clay", [cx, y + 2.75, cz]));
}

function buildBuilding(scene) {
  buildExterior(scene);
  for (let f = 1; f <= 3; f++) buildSlab(scene, f);
  buildShellWalls(scene);
  buildElevator(scene);
  buildStairs(scene);
  buildReception(scene);
  buildConference(scene);
  buildKitchen(scene);
  buildLounge(scene, 2, 5.2, 2.6);
  buildServerRoom(scene);
  buildCafe(scene);

  addFloorBadge(scene, 3, "Engineering");
  addFloorBadge(scene, 2, "Markets");
  addFloorBadge(scene, 1, "Reception");

  // Soft warm interior fills (no cyber neon point lights)
  [
    { c: C.warmLamp, p: [0, fy(3) + 2.4, 0], i: 0.28 },
    { c: C.softGlow, p: [5, fy(2) + 2.1, -3], i: 0.3 },
    { c: 0xffd0b0, p: [-2, fy(1) + 2.1, 0], i: 0.25 },
    { c: C.cafeSign, p: [5.5, fy(3) + 2.2, 2.5], i: 0.22 }
  ].forEach(({ c, p, i }) => {
    const pl = new THREE.PointLight(c, i, 12, 2);
    pl.position.set(...p);
    scene.add(pl);
  });
}

function wp(floor, x, z) {
  return new THREE.Vector3(x, fy(floor), z);
}

const WAYPOINTS = {
  elevator: {
    1: wp(1, -HALF_W + 1.35, -1.2),
    2: wp(2, -HALF_W + 1.35, -1.2),
    3: wp(3, -HALF_W + 1.35, -1.2)
  },
  kitchen: wp(2, 4.5, -2.8),
  cafe: wp(3, 5.0, 2.2),
  conference: wp(1, 4.5, -2.5),
  hall: {
    1: wp(1, 0, 0),
    2: wp(2, 0, 0.5),
    3: wp(3, 0, 0.5)
  }
};

function setGlow(avatar, status) {
  const g = avatar.userData.glow;
  if (!g) return;
  let color = 0xc4b8a8, intensity = 0.3;
  if (status === "alert") { color = 0xe87860; intensity = 0.85; }
  else if (status === "active" || status === "working") { color = 0x7a9e6e; intensity = 0.55; }
  else if (status === "away") { color = 0x7eb8b0; intensity = 0.4; }
  g.material.color.setHex(color);
  g.material.emissive.setHex(color);
  g.material.emissiveIntensity = intensity;
}

function nearestFloor(y) {
  let best = 1, bestD = Infinity;
  for (const f of [1, 2, 3]) {
    const d = Math.abs(y - fy(f));
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

function pathViaElevator(from, toFloor, dest) {
  const fromFloor = nearestFloor(from.y);
  const path = [from.clone()];
  if (fromFloor !== toFloor) {
    path.push(WAYPOINTS.elevator[fromFloor].clone());
    path.push(WAYPOINTS.elevator[toFloor].clone());
  }
  path.push(WAYPOINTS.hall[toFloor].clone());
  path.push(dest.clone());
  return path;
}

function pickWanderTarget(selfId, avatars, deskStatus) {
  const self = AGENTS.find(a => a.id === selfId);
  const roll = Math.random();
  const busy = deskStatus === "working" || deskStatus === "active" || deskStatus === "alert";
  if (busy && roll < 0.55) {
    const dest = self.floor === 3 ? WAYPOINTS.cafe.clone() : WAYPOINTS.kitchen.clone();
    const destFloor = self.floor === 3 ? 3 : 2;
    return {
      type: "pantry",
      pos: dest,
      destFloor,
      label: destFloor === 3 ? "away · cafe" : "away · kitchen"
    };
  }
  if (roll < 0.28) {
    return { type: "pantry", pos: WAYPOINTS.kitchen.clone(), destFloor: 2, label: "away · kitchen" };
  }
  if (roll < 0.42) {
    return { type: "pantry", pos: WAYPOINTS.cafe.clone(), destFloor: 3, label: "away · cafe" };
  }
  if (roll < 0.52 && self.floor === 1) {
    return { type: "pantry", pos: WAYPOINTS.conference.clone(), destFloor: 1, label: "away · conference" };
  }
  const others = AGENTS.filter(a => a.id !== selfId);
  const partner = others[Math.floor(Math.random() * others.length)];
  const meetFloor = partner.floor;
  const mid = new THREE.Vector3(...deskSitOffset(partner));
  mid.x += (Math.random() - 0.5) * 1.4;
  mid.z += 1.0 + Math.random() * 0.6;
  mid.y = fy(meetFloor);
  const dialogue = buildDialogue(selfId, partner.id, pickTopic());
  return {
    type: "chat",
    pos: mid,
    destFloor: meetFloor,
    partnerId: partner.id,
    label: "away · chat",
    dialogue,
    line: dialogue.lines[0].text
  };
}

export function createOffice3D({ canvas, container, onSelect, getStatus, onChat }) {
  const host = container || canvas.parentElement;
  initTextures();

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
      antialias: true,
      alpha: false,
      powerPreference: mobile ? "low-power" : "high-performance",
      failIfMajorPerformanceCaveat: false,
      stencil: false,
      depth: true
    });
  } catch (err) {
    throw err;
  }

  const { w: iw, h: ih } = measure();
  const maxPR = mobile ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
  renderer.setSize(iw, ih, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(C.void, 1);
  if (renderer.capabilities.getMaxAnisotropy) {
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (CLAY_MAP) CLAY_MAP.anisotropy = aniso;
    if (FLOOR_MAP) FLOOR_MAP.anisotropy = aniso;
  }

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(iw, ih);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  labelRenderer.domElement.style.zIndex = "2";
  host.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.void);
  scene.fog = new THREE.Fog(0xf5e6d4, 48, 90);

  // Soft studio env — low intensity so clay stays matte
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envTex = pmrem.fromScene(envScene, 0.06).texture;
  scene.environment = envTex;
  scene.environmentIntensity = mobile ? 0.22 : 0.32;
  envScene.dispose?.();

  const camera = new THREE.PerspectiveCamera(34, iw / ih, 0.1, 160);
  if (mobile) camera.position.set(19, 17, 21);
  else camera.position.set(22, 19, 24);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, fy(2) + 0.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.minDistance = 14;
  controls.maxDistance = 48;
  controls.enablePan = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  // Warm soft studio key + fill (no hard sun)
  scene.add(new THREE.AmbientLight(C.ambient, 0.72));
  const hemi = new THREE.HemisphereLight(0xfff4e8, 0xe8c8a0, 0.65);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(C.sun, 0.95);
  sun.position.set(10, 22, 14);
  sun.castShadow = true;
  const shadowSize = mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = mobile ? 3.5 : 6;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe8d4, 0.45);
  fill.position.set(-10, 12, -4);
  scene.add(fill);
  const warm = new THREE.DirectionalLight(0xffd8b0, 0.35);
  warm.position.set(4, 8, -10);
  scene.add(warm);

  buildBuilding(scene);
  AGENTS.forEach(a => {
    clayDeskAt(scene, a.pos[0], fy(a.floor), a.pos[2]);
  });

  const avatars = new Map();
  const ai = new Map();

  AGENTS.forEach((agent, i) => {
    const av = makeAvatar(agent);
    const sit = deskSitOffset(agent);
    av.position.set(sit[0], sit[1], sit[2]);
    scene.add(av);
    avatars.set(agent.id, av);
    ai.set(agent.id, {
      mode: "desk",
      path: [],
      pathIdx: 0,
      speed: 1.45 + Math.random() * 0.35,
      nextWanderAt: performance.now() + 5000 + i * 2400 + Math.random() * 9000,
      lingerUntil: 0,
      trip: null,
      deskStatus: "idle",
      bubbleTimer: null,
      homeFloor: agent.floor
    });
  });

  // Mild bloom only (warm lamps) — not cyber neon bloom
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(iw, ih),
    mobile ? 0.1 : 0.16,
    0.7,
    0.82
  );
  composer.addPass(bloom);
  const smaa = new SMAAPass(iw * renderer.getPixelRatio(), ih * renderer.getPixelRatio());
  composer.addPass(smaa);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  let pathTracer = null;
  let pathTracerReady = false;
  let pathTraceEnabled = false;
  let pathTraceLoading = false;
  let pathTraceError = null;
  let freezeMotion = false;
  let samplesCap = 96;
  let lastCamKey = "";
  const rtListeners = new Set();

  function notifyRt() {
    const info = getRayTraceInfo();
    rtListeners.forEach(fn => {
      try { fn(info); } catch {}
    });
  }

  function camKey() {
    return [
      camera.position.x.toFixed(3), camera.position.y.toFixed(3), camera.position.z.toFixed(3),
      controls.target.x.toFixed(3), controls.target.y.toFixed(3), controls.target.z.toFixed(3)
    ].join("|");
  }

  async function ensurePathTracer() {
    if (pathTracerReady && pathTracer) return pathTracer;
    if (pathTraceLoading) {
      while (pathTraceLoading) await new Promise(r => setTimeout(r, 50));
      if (pathTracerReady) return pathTracer;
      throw pathTraceError || new Error("Path tracer failed");
    }
    pathTraceLoading = true;
    pathTraceError = null;
    notifyRt();
    try {
      const mod = await import("three-gpu-pathtracer");
      const { WebGLPathTracer } = mod;
      pathTracer = new WebGLPathTracer(renderer);
      pathTracer.bounces = 5;
      pathTracer.transmissiveBounces = 2;
      pathTracer.filterGlossyFactor = 0.65;
      pathTracer.renderDelay = 40;
      pathTracer.minSamples = 1;
      pathTracer.fadeDuration = 200;
      pathTracer.rasterizeScene = true;
      pathTracer.renderToCanvas = true;
      pathTracer.dynamicLowRes = true;
      pathTracer.lowResScale = 0.35;
      pathTracer.tiles.set(mobile ? 2 : 3, mobile ? 2 : 3);
      await pathTracer.setSceneAsync(scene, camera);
      pathTracerReady = true;
      lastCamKey = camKey();
      return pathTracer;
    } catch (err) {
      pathTraceError = err;
      pathTracer = null;
      pathTracerReady = false;
      console.warn("Path tracer unavailable", err);
      throw err;
    } finally {
      pathTraceLoading = false;
      notifyRt();
    }
  }

  function getRayTraceInfo() {
    return {
      enabled: pathTraceEnabled,
      supported: !mobile,
      loading: pathTraceLoading,
      ready: pathTracerReady,
      error: pathTraceError ? String(pathTraceError.message || pathTraceError) : null,
      samples: pathTracer?.samples ?? 0,
      mode: pathTraceEnabled ? (pathTracerReady ? "pathtrace" : "loading") : "clay"
    };
  }

  async function setRayTrace(on) {
    if (on && mobile) {
      pathTraceError = new Error("Ray Trace is desktop-only on this device");
      pathTraceEnabled = false;
      freezeMotion = false;
      notifyRt();
      return getRayTraceInfo();
    }
    if (!on) {
      pathTraceEnabled = false;
      freezeMotion = false;
      renderer.toneMappingExposure = 1.12;
      bloom.strength = mobile ? 0.1 : 0.16;
      scene.environmentIntensity = mobile ? 0.22 : 0.32;
      notifyRt();
      return getRayTraceInfo();
    }
    pathTraceEnabled = true;
    freezeMotion = true;
    notifyRt();
    try {
      await ensurePathTracer();
      pathTracer.updateCamera();
      pathTracer.reset();
      lastCamKey = camKey();
    } catch (err) {
      pathTraceEnabled = false;
      freezeMotion = false;
      bloom.strength = 0.28;
      scene.environmentIntensity = 0.45;
      renderer.toneMappingExposure = 1.15;
      pathTraceError = err;
    }
    notifyRt();
    return getRayTraceInfo();
  }

  controls.addEventListener("change", () => {
    if (pathTraceEnabled && pathTracerReady && pathTracer) {
      const k = camKey();
      if (k !== lastCamKey) {
        lastCamKey = k;
        pathTracer.updateCamera();
      }
    }
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function resize() {
    const { w, h } = measure();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    smaa.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    if (pathTracerReady && pathTracer) {
      try { pathTracer.updateCamera(); } catch {}
    }
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
      from: "Office chat",
      zone: zoneLabel || "chat",
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
      const agent = AGENTS.find(a => a.id === id);
      el.classList.toggle("away", state.mode !== "desk");
      el.classList.toggle("chat", state.mode === "linger" && (state.trip?.type === "chat" || state.trip?.type === "pantry"));
      if (state.mode === "desk") {
        el.innerHTML = `<span class="l3-name">${agent.name}</span><span class="l3-role">${agent.role}</span>`;
      } else if (state.trip?.label) {
        el.innerHTML = `<span class="l3-name">${agent.name}</span><span class="l3-role">${state.trip.label.replace("away · ", "")}</span>`;
      }
    });
  }

  function startWander(id, now) {
    if (freezeMotion) return;
    const state = ai.get(id);
    const av = avatars.get(id);
    let away = 0;
    ai.forEach(s => { if (s.mode !== "desk") away++; });
    if (away >= 4) {
      state.nextWanderAt = now + 6000 + Math.random() * 5000;
      return;
    }
    const trip = pickWanderTarget(id, avatars, state.deskStatus);
    const from = av.position.clone();
    const path = pathViaElevator(from, trip.destFloor, trip.pos);
    state.mode = "walk";
    state.path = path;
    state.pathIdx = 1;
    state.trip = trip;
    state.nextWanderAt = now + 30000 + Math.random() * 28000;
    av.userData.bubbleEl.style.display = "none";
  }

  function beginReturn(id) {
    const state = ai.get(id);
    const av = avatars.get(id);
    const agent = AGENTS.find(a => a.id === id);
    const desk = new THREE.Vector3(...deskSitOffset(agent));
    const path = pathViaElevator(av.position.clone(), agent.floor, desk);
    state.mode = "return";
    state.path = path;
    state.pathIdx = 1;
    av.userData.bubbleEl.style.display = "none";
  }

  function onArriveLinger(id, now) {
    const state = ai.get(id);
    const av = avatars.get(id);
    state.mode = "linger";
    const isChat = state.trip?.type === "chat";
    const isPantry = state.trip?.type === "pantry";
    state.lingerUntil = now + (isChat ? 6500 + Math.random() * 2500 : 3800 + Math.random() * 3000);

    if (isChat && state.trip.dialogue) {
      const d = state.trip.dialogue;
      showBubble(av, d.lines[0]?.text || state.trip.line, 5200);
      emitChat(d, state.trip.label || "chat");
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
          label: "away · chat",
          partnerId: id,
          destFloor: state.trip.destFloor,
          dialogue: d,
          line: d.lines[1]?.text || "👍",
          isPartner: true
        };
        partnerState.nextWanderAt = now + 22000;
      } else if (partnerAv && d.lines[1]) {
        setTimeout(() => showBubble(partnerAv, d.lines[1].text, 5000), 1500);
      }
    } else if (isPantry) {
      let partnerId = null;
      ai.forEach((s, oid) => {
        if (oid !== id && s.mode === "linger" && s.trip?.type === "pantry") partnerId = oid;
      });
      const zone = state.trip?.label?.includes("cafe") ? "Cafe" :
        (state.trip?.label?.includes("kitchen") ? "Kitchen" : "Pantry");
      if (partnerId) {
        startTopicChat(id, partnerId, zone);
      } else {
        const topic = pickTopic();
        const line = buildPantryAside(id, topic);
        showBubble(av, line, 4500);
        onChat?.({
          from: AGENTS.find(a => a.id === id)?.name || id,
          zone,
          text: `☕ ${topic.title} — ${line}`,
          at: new Date().toISOString(),
          level: "chat",
          topicId: topic.id
        });
      }
    }
  }

  function stepAI(dt, now) {
    if (freezeMotion) return;
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
          if (Math.abs(dir.x) + Math.abs(dir.z) > 0.001) {
            av.rotation.y = Math.atan2(dir.x, dir.z);
          }
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
        const baseY = fy(AGENTS.find(a => a.id === id).floor);
        av.position.y = baseY + Math.sin(now * 0.002 + id.length) * 0.015;
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
    const cab = scene.userData.elevatorCab;
    if (cab && !freezeMotion) {
      const t = (Math.sin(now * 0.00035) + 1) / 2;
      cab.position.y = fy(1) + 1.0 + t * (fy(3) - fy(1));
    }
    avatars.forEach((av, id) => {
      const st = ai.get(id);
      if (st.mode === "desk" && st.deskStatus === "alert" && av.userData.glow) {
        av.userData.glow.material.emissiveIntensity = 0.55 + Math.sin(now * 0.008) * 0.35;
      }
    });
    controls.update();

    if (pathTraceEnabled && pathTracerReady && pathTracer) {
      if ((pathTracer.samples || 0) < samplesCap) {
        pathTracer.renderSample();
      }
      if (now % 500 < 20) notifyRt();
    } else {
      composer.render();
    }
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
        if (pathTraceEnabled && pathTracerReady && pathTracer) {
          try { pathTracer.updateCamera(); pathTracer.reset(); } catch {}
        }
      }
    },
    setRayTrace,
    getRayTraceInfo,
    onRayTraceChange(fn) {
      rtListeners.add(fn);
      return () => rtListeners.delete(fn);
    },
    isMobile: mobile,
    dispose() {
      running = false;
      if (ro) ro.disconnect();
      ai.forEach(s => clearBubbleTimer(s));
      labelRenderer.domElement.remove();
      composer.dispose();
      envTex.dispose?.();
      pmrem.dispose();
      renderer.dispose();
    }
  };
}
