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

/* v0.6 — HQ PBR + bloom "ray-traced look" + optional WebGL path tracer */

const C = {
  exterior: 0xe8dfd0,
  exteriorEdge: 0xd4c7b0,
  floor: 0xf0e8da,
  floorEdge: 0xd9cbb5,
  wall: 0xf7f4ed,
  wallAccent: 0xe8efe9,
  slab: 0xe5ddd0,
  desk: 0x5c4033,
  deskTop: 0x6b4423,
  deskGrain: 0x8a6239,
  deskLeg: 0x4a3224,
  chair: 0x6b5344,
  chairBack: 0x5a4436,
  shelf: 0x5c4033,
  monitor: 0xdfe6e2,
  screen: 0x8bb8c9,
  plantPot: 0x6b4423,
  plant: 0x5f7d4a,
  tree: 0x3d6b45,
  road: 0x9a9a9a,
  roadLine: 0xf5f5f5,
  glass: 0xb8d4dc,
  ambient: 0xfff6ea,
  sun: 0xfff2d6,
  void: 0xf3eee4,
  neonCyan: 0x22d3ee,
  neonMagenta: 0xe879f9,
  neonAmber: 0xfbbf24,
  neonRed: 0xef4444,
  server: 0x2a2f36,
  fridge: 0xd0d5da,
  sofa: 0xb8bdc4,
  receptionStripe: 0xd45a5a
};

const FH = 3.55;
const WALL_H = 3.15;
const BW = 16;
const BD = 12;
const HALF_W = BW / 2;
const HALF_D = BD / 2;

function fy(floor) { return FLOOR_Y[floor] ?? 0; }

let WOOD_MAP = null;
let WOOD_ROUGH = null;
let FLOOR_MAP = null;

function makeNoiseCanvas(size, paint) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  paint(ctx, size);
  return c;
}

function initTextures() {
  if (WOOD_MAP) return;
  const wood = makeNoiseCanvas(512, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, "#5a3824");
    g.addColorStop(0.35, "#7a4e2e");
    g.addColorStop(0.55, "#6b4423");
    g.addColorStop(0.8, "#8a6239");
    g.addColorStop(1, "#5c4033");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * s;
      ctx.strokeStyle = `rgba(40,22,12,${0.04 + Math.random() * 0.1})`;
      ctx.lineWidth = 0.6 + Math.random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      let yy = 0;
      while (yy < s) {
        const nx = x + Math.sin(yy * 0.04 + i) * (2 + Math.random() * 4);
        ctx.lineTo(nx, yy + 8);
        yy += 8;
      }
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,220,180,${0.015 + Math.random() * 0.03})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 40, 1);
    }
  });
  WOOD_MAP = new THREE.CanvasTexture(wood);
  WOOD_MAP.wrapS = WOOD_MAP.wrapT = THREE.RepeatWrapping;
  WOOD_MAP.repeat.set(1.6, 1.2);
  WOOD_MAP.colorSpace = THREE.SRGBColorSpace;
  WOOD_MAP.anisotropy = 8;

  const rough = makeNoiseCanvas(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 140 + (Math.random() * 80) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  WOOD_ROUGH = new THREE.CanvasTexture(rough);
  WOOD_ROUGH.wrapS = WOOD_ROUGH.wrapT = THREE.RepeatWrapping;

  const floor = makeNoiseCanvas(512, (ctx, s) => {
    ctx.fillStyle = "#efe6d6";
    ctx.fillRect(0, 0, s, s);
    const plank = s / 8;
    for (let x = 0; x < s; x += plank) {
      ctx.fillStyle = x / plank % 2 === 0 ? "#f3ebdc" : "#e8decc";
      ctx.fillRect(x, 0, plank - 2, s);
      ctx.strokeStyle = "rgba(180,160,130,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + plank - 1, 0);
      ctx.lineTo(x + plank - 1, s);
      ctx.stroke();
      for (let y = 0; y < s; y += plank * 2.2) {
        ctx.strokeStyle = "rgba(170,150,120,0.22)";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + plank - 2, y);
        ctx.stroke();
      }
    }
  });
  FLOOR_MAP = new THREE.CanvasTexture(floor);
  FLOOR_MAP.wrapS = FLOOR_MAP.wrapT = THREE.RepeatWrapping;
  FLOOR_MAP.repeat.set(4, 3);
  FLOOR_MAP.colorSpace = THREE.SRGBColorSpace;
  FLOOR_MAP.anisotropy = 8;
}

function matStandard(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive != null ? opts.emissive : 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    map: opts.map || null,
    roughnessMap: opts.roughnessMap || null,
    envMapIntensity: opts.envMapIntensity ?? 1,
    transparent: opts.opacity != null && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide
  });
}

function matPhysical(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.35,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive != null ? opts.emissive : 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    map: opts.map || null,
    roughnessMap: opts.roughnessMap || null,
    envMapIntensity: opts.envMapIntensity ?? 1.2,
    transparent: (opts.opacity != null && opts.opacity < 1) || (opts.transmission ?? 0) > 0,
    opacity: opts.opacity ?? 1,
    transmission: opts.transmission ?? 0,
    thickness: opts.thickness ?? 0.35,
    ior: opts.ior ?? 1.45,
    clearcoat: opts.clearcoat ?? 0,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.25,
    attenuationColor: opts.attenuationColor,
    attenuationDistance: opts.attenuationDistance,
    side: opts.side ?? THREE.FrontSide
  });
}

function box(w, h, d, color, opts = {}) {
  const geo = opts.rounded
    ? new RoundedBoxGeometry(w, h, d, opts.segments ?? 3, opts.radius ?? Math.min(0.05, Math.min(w, h, d) * 0.12))
    : new THREE.BoxGeometry(w, h, d);
  const usePhysical = !!opts.physical || !!opts.transmission || !!opts.clearcoat;
  const m = new THREE.Mesh(
    geo,
    usePhysical ? matPhysical(color, opts) : matStandard(color, opts)
  );
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = opts.receiveShadow !== false;
  if (opts.pos) m.position.set(...opts.pos);
  return m;
}

function neonStrip(w, h, d, color, pos, intensity = 1.1) {
  return box(w, h, d, color, {
    roughness: 0.25, metalness: 0.35,
    emissive: color, emissiveIntensity: intensity,
    castShadow: false, receiveShadow: false, pos
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

function makeAvatar(agent) {
  const g = new THREE.Group();
  g.userData.agentId = agent.id;

  const body = box(0.5, 0.75, 0.32, agent.color, {
    roughness: 0.45, clearcoat: 0.25, physical: true, rounded: true, radius: 0.06
  });
  body.position.y = 0.78;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 24, 24),
    matPhysical(0xf2d6c2, { roughness: 0.55, clearcoat: 0.15 })
  );
  head.position.y = 1.35;
  head.castShadow = true;
  g.add(head);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    matStandard(0x8a948c, {
      emissive: 0x8a948c, emissiveIntensity: 0.6, opacity: 0.85
    })
  );
  glow.position.set(0, 1.72, 0);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.body = body;

  const legL = box(0.12, 0.4, 0.16, 0x5a6a62, { roughness: 0.8, rounded: true, radius: 0.03 });
  legL.position.set(-0.12, 0.2, 0);
  const legR = box(0.12, 0.4, 0.16, 0x5a6a62, { roughness: 0.8, rounded: true, radius: 0.03 });
  legR.position.set(0.12, 0.2, 0);
  g.add(legL, legR);
  g.userData.legs = [legL, legR];

  const label = document.createElement("div");
  label.className = "label3d";
  label.innerHTML = `<span class="l3-name">${agent.name}</span><span class="l3-role">${agent.role}</span>`;
  const labelObj = new CSS2DObject(label);
  labelObj.position.set(0, 1.95, 0);
  g.add(labelObj);
  g.userData.labelEl = label;

  const bubble = document.createElement("div");
  bubble.className = "bubble3d";
  bubble.style.display = "none";
  const bubbleObj = new CSS2DObject(bubble);
  bubbleObj.position.set(0, 2.35, 0);
  g.add(bubbleObj);
  g.userData.bubbleEl = bubble;

  return g;
}

function walnutDeskAt(scene, x, y, z) {
  initTextures();
  scene.add(box(1.45, 0.09, 0.78, C.deskTop, {
    roughness: 0.38, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.3,
    physical: true, rounded: true, radius: 0.035,
    map: WOOD_MAP, roughnessMap: WOOD_ROUGH, envMapIntensity: 0.85,
    pos: [x, y + 0.72, z]
  }));
  scene.add(box(1.25, 0.014, 0.045, C.deskGrain, {
    roughness: 0.5, castShadow: false, map: WOOD_MAP, pos: [x, y + 0.775, z]
  }));
  [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]].forEach(([dx, dz]) => {
    scene.add(box(0.09, 0.68, 0.09, C.deskLeg, {
      roughness: 0.55, rounded: true, radius: 0.02, map: WOOD_MAP, pos: [x + dx, y + 0.34, z + dz]
    }));
  });
  scene.add(box(0.62, 0.4, 0.05, C.monitor, {
    roughness: 0.35, metalness: 0.25, clearcoat: 0.4, physical: true, rounded: true, radius: 0.02,
    pos: [x, y + 1.05, z - 0.26]
  }));
  scene.add(box(0.52, 0.3, 0.02, C.screen, {
    roughness: 0.15, metalness: 0.4,
    emissive: C.neonCyan, emissiveIntensity: 0.45,
    physical: true, clearcoat: 0.6,
    pos: [x, y + 1.05, z - 0.22]
  }));
  scene.add(box(0.5, 0.07, 0.5, C.chair, {
    roughness: 0.55, rounded: true, radius: 0.04, map: WOOD_MAP, pos: [x, y + 0.45, z + 0.62]
  }));
  scene.add(box(0.5, 0.48, 0.07, C.chairBack, {
    roughness: 0.55, rounded: true, radius: 0.035, map: WOOD_MAP, pos: [x, y + 0.72, z + 0.85]
  }));
  scene.add(box(0.07, 0.4, 0.07, C.deskLeg, {
    roughness: 0.5, rounded: true, radius: 0.02, pos: [x, y + 0.22, z + 0.62]
  }));
}

function walnutShelf(scene, x, y, z) {
  initTextures();
  scene.add(box(1.2, 1.35, 0.26, C.shelf, {
    roughness: 0.48, rounded: true, radius: 0.03, map: WOOD_MAP, pos: [x, y + 0.75, z]
  }));
  for (let i = 0; i < 3; i++) {
    scene.add(box(1.08, 0.035, 0.22, C.deskGrain, {
      roughness: 0.45, castShadow: false, map: WOOD_MAP, pos: [x, y + 0.35 + i * 0.35, z + 0.02]
    }));
  }
}

function plantAt(scene, x, y, z, scale = 1) {
  scene.add(box(0.32 * scale, 0.28 * scale, 0.32 * scale, C.plantPot, {
    roughness: 0.7, rounded: true, radius: 0.04, pos: [x, y + 0.14 * scale, z]
  }));
  const foliage = new THREE.Mesh(
    new THREE.SphereGeometry(0.38 * scale, 16, 12),
    matStandard(C.plant, { roughness: 0.9, envMapIntensity: 0.4 })
  );
  foliage.position.set(x, y + 0.55 * scale, z);
  foliage.scale.set(1, 1.15, 1);
  foliage.castShadow = true;
  scene.add(foliage);
}

function treeAt(scene, x, z, h = 2.4) {
  scene.add(box(0.22, h * 0.35, 0.22, 0x5c4033, {
    roughness: 0.85, rounded: true, radius: 0.04, pos: [x, h * 0.17, z]
  }));
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 14, 12),
    matStandard(C.tree, { roughness: 0.92 })
  );
  crown.position.set(x, h * 0.55, z);
  crown.scale.set(1, h * 0.35, 1);
  crown.castShadow = true;
  scene.add(crown);
}

function glassPanel(w, h, d, pos, mobile) {
  if (mobile) {
    return box(w, h, d, C.glass, {
      roughness: 0.12, metalness: 0.15, opacity: 0.28,
      physical: true, clearcoat: 0.5, envMapIntensity: 1.6,
      castShadow: false, pos
    });
  }
  return box(w, h, d, 0xd7eef4, {
    roughness: 0.05, metalness: 0,
    transmission: 0.85, thickness: 0.4, ior: 1.5,
    opacity: 1, physical: true, clearcoat: 1, clearcoatRoughness: 0.05,
    envMapIntensity: 1.4, castShadow: false, pos,
    attenuationColor: new THREE.Color(0xc5e4ec), attenuationDistance: 2.5
  });
}

function addFloorBadge(scene, floor, title) {
  const y = fy(floor) + WALL_H * 0.55;
  scene.add(cssLabel(`${floor}  ${title}`, "floor-badge", [-HALF_W - 0.15, y, 0]));
}

function buildExterior(scene) {
  initTextures();
  const ground = box(48, 0.08, 40, 0xeae3d6, {
    roughness: 0.95, castShadow: false, map: FLOOR_MAP, pos: [0, -0.12, 2]
  });
  scene.add(ground);
  scene.add(box(4.2, 0.06, 28, C.road, { roughness: 0.95, castShadow: false, pos: [-HALF_W - 4.5, -0.06, 1] }));
  for (let z = -10; z <= 12; z += 2.2) {
    scene.add(box(0.18, 0.02, 1.0, C.roadLine, { castShadow: false, receiveShadow: false, pos: [-HALF_W - 4.5, -0.02, z] }));
  }
  [[-HALF_W - 7, -6], [-HALF_W - 6.5, 2], [-HALF_W - 7.2, 8], [HALF_W + 3, -7], [HALF_W + 4, 6]].forEach(([x, z], i) => {
    treeAt(scene, x, z, 2.0 + (i % 3) * 0.35);
  });
  plantAt(scene, -1.5, 0, HALF_D + 1.2, 1.1);
  plantAt(scene, 1.5, 0, HALF_D + 1.2, 0.95);
}

function buildSlab(scene, floor) {
  initTextures();
  const y = fy(floor);
  scene.add(box(BW, 0.16, BD, C.floor, {
    roughness: 0.55, metalness: 0.02, clearcoat: 0.2, physical: true,
    map: FLOOR_MAP, envMapIntensity: 0.55, pos: [0, y - 0.08, 0]
  }));
  for (let i = -7; i <= 7; i += 2) {
    scene.add(box(0.03, 0.015, BD - 0.4, C.floorEdge, {
      roughness: 0.9, castShadow: false, pos: [i, y + 0.01, 0]
    }));
  }
  if (floor < 3) {
    scene.add(box(BW + 0.3, 0.18, BD + 0.3, C.slab, {
      roughness: 0.7, pos: [0, y + WALL_H + 0.09, 0]
    }));
  }
}

function buildShellWalls(scene, mobile) {
  for (let f = 1; f <= 3; f++) {
    const y = fy(f);
    const midY = y + WALL_H / 2;
    scene.add(box(BW, WALL_H, 0.18, C.exterior, { roughness: 0.78, pos: [0, midY, -HALF_D] }));
    scene.add(box(0.18, WALL_H, BD, C.exterior, { roughness: 0.78, pos: [-HALF_W, midY, 0] }));
    scene.add(glassPanel(0.06, 1.1, BD - 1.5, [-HALF_W + 0.08, y + 1.5, 0], mobile));
    scene.add(box(BW, 0.12, 0.12, C.exteriorEdge, { pos: [0, y + 0.06, HALF_D] }));
    scene.add(box(0.12, 0.12, BD, C.exteriorEdge, { pos: [HALF_W, y + 0.06, 0] }));
    scene.add(neonStrip(BW - 0.5, 0.04, 0.04, f === 3 ? C.neonCyan : (f === 2 ? C.neonAmber : C.neonMagenta),
      [0, y + WALL_H - 0.12, HALF_D - 0.15], 1.15));
  }
  for (let f = 1; f <= 3; f++) {
    const y = fy(f);
    scene.add(box(0.28, WALL_H, 0.28, C.exteriorEdge, { roughness: 0.55, rounded: true, radius: 0.04, pos: [-HALF_W, y + WALL_H / 2, -HALF_D] }));
    scene.add(box(0.28, WALL_H, 0.28, C.exteriorEdge, { roughness: 0.55, rounded: true, radius: 0.04, pos: [HALF_W, y + WALL_H / 2, -HALF_D] }));
  }
}

function buildElevator(scene, mobile) {
  const ex = -HALF_W + 1.35;
  const ez = -1.2;
  const totalH = fy(3) + WALL_H;
  scene.add(glassPanel(0.08, totalH, 2.4, [ex - 0.85, totalH / 2, ez], mobile));
  scene.add(glassPanel(0.08, totalH, 2.4, [ex + 0.85, totalH / 2, ez], mobile));
  scene.add(glassPanel(1.7, totalH, 0.08, [ex, totalH / 2, ez - 1.15], mobile));
  scene.add(glassPanel(1.7, totalH, 0.08, [ex, totalH / 2, ez + 1.15], mobile));
  [[-0.85, -1.15], [0.85, -1.15], [-0.85, 1.15], [0.85, 1.15]].forEach(([dx, dz]) => {
    scene.add(box(0.1, totalH, 0.1, 0xc8c2b6, { roughness: 0.4, metalness: 0.35, pos: [ex + dx, totalH / 2, ez + dz] }));
  });
  const cab = box(1.3, 2.0, 1.8, 0xdfe8ea, {
    roughness: 0.25, metalness: 0.2, opacity: 0.45,
    physical: true, clearcoat: 0.5,
    emissive: C.neonCyan, emissiveIntensity: 0.2,
    pos: [ex, fy(2) + 1.0, ez]
  });
  cab.userData.isElevatorCab = true;
  scene.add(cab);
  scene.userData.elevatorCab = cab;
  scene.add(neonStrip(0.05, totalH - 0.4, 0.05, C.neonCyan, [ex - 0.85, totalH / 2, ez + 1.15], 1.25));
  scene.add(neonStrip(0.05, totalH - 0.4, 0.05, C.neonCyan, [ex + 0.85, totalH / 2, ez + 1.15], 1.25));
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
      scene.add(box(1.4, 0.12, 0.42, C.deskGrain, {
        roughness: 0.45, rounded: true, radius: 0.02, map: WOOD_MAP,
        pos: [sx, y0 + t * FH + 0.06, sz - i * 0.38]
      }));
    }
    scene.add(box(0.06, FH * 0.9, 0.06, 0xc8c2b6, {
      metalness: 0.4, roughness: 0.35, pos: [sx + 0.75, y0 + FH * 0.45, sz - 1.4]
    }));
  }
}

function buildServerRoom(scene, mobile) {
  const y = fy(3);
  const cx = 5.4, cz = -3.4;
  scene.add(glassPanel(4.2, 2.4, 0.08, [cx, y + 1.2, cz - 1.6], mobile));
  scene.add(glassPanel(4.2, 2.4, 0.08, [cx, y + 1.2, cz + 1.6], mobile));
  scene.add(glassPanel(0.08, 2.4, 3.2, [cx - 2.1, y + 1.2, cz], mobile));
  scene.add(glassPanel(0.08, 2.4, 3.2, [cx + 2.1, y + 1.2, cz], mobile));
  scene.add(neonStrip(4.0, 0.04, 0.04, C.neonRed, [cx, y + 2.45, cz - 1.6], 1.4));
  [-0.7, 0.7].forEach((dx) => {
    scene.add(box(0.7, 1.8, 0.55, C.server, {
      roughness: 0.28, metalness: 0.65, clearcoat: 0.3, physical: true, rounded: true, radius: 0.03,
      pos: [cx + dx, y + 0.95, cz]
    }));
    for (let i = 0; i < 5; i++) {
      const col = i % 2 === 0 ? 0x22c55e : 0x22d3ee;
      scene.add(box(0.5, 0.06, 0.04, col, {
        emissive: col, emissiveIntensity: 1.8, castShadow: false,
        pos: [cx + dx, y + 0.4 + i * 0.28, cz + 0.28]
      }));
    }
  });
  scene.add(cssLabel("SERVER ROOM", "room-badge", [cx, y + 2.7, cz]));
}

function buildCafe(scene) {
  initTextures();
  const y = fy(3);
  const cx = 5.6, cz = 2.8;
  scene.add(box(1.6, 0.08, 1.0, C.deskTop, {
    roughness: 0.35, clearcoat: 0.4, physical: true, rounded: true, map: WOOD_MAP, pos: [cx, y + 0.7, cz]
  }));
  [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]].forEach(([dx, dz]) => {
    scene.add(box(0.35, 0.45, 0.35, C.chair, {
      roughness: 0.55, rounded: true, radius: 0.04, map: WOOD_MAP, pos: [cx + dx, y + 0.28, cz + dz]
    }));
  });
  walnutShelf(scene, cx + 1.6, y, cz - 0.8);
  plantAt(scene, cx - 1.3, y, cz + 0.9, 0.85);
  scene.add(neonStrip(1.8, 0.12, 0.06, C.neonRed, [cx, y + 2.35, cz - 1.5], 1.8));
  scene.add(cssLabel("CAFE", "room-badge neon-red", [cx, y + 2.55, cz - 1.5]));
  const pl = new THREE.PointLight(C.neonRed, 0.7, 9, 2);
  pl.position.set(cx, y + 2.2, cz);
  scene.add(pl);
}

function buildKitchen(scene) {
  initTextures();
  const y = fy(2);
  const cx = 5.5, cz = -3.6;
  scene.add(box(3.4, 0.9, 0.7, C.deskTop, {
    roughness: 0.42, clearcoat: 0.25, physical: true, rounded: true, map: WOOD_MAP, pos: [cx, y + 0.45, cz]
  }));
  scene.add(box(3.2, 0.03, 0.55, C.deskGrain, { castShadow: false, map: WOOD_MAP, pos: [cx, y + 0.92, cz] }));
  scene.add(box(0.45, 0.08, 0.35, 0xc5cdd2, {
    metalness: 0.55, roughness: 0.25, clearcoat: 0.5, physical: true, pos: [cx - 0.9, y + 0.96, cz]
  }));
  scene.add(box(0.4, 0.55, 0.35, C.desk, { roughness: 0.4, rounded: true, pos: [cx + 0.2, y + 1.2, cz] }));
  scene.add(box(0.28, 0.12, 0.2, C.neonAmber, {
    emissive: C.neonAmber, emissiveIntensity: 0.7, castShadow: false, pos: [cx + 0.2, y + 1.45, cz + 0.05]
  }));
  scene.add(box(0.85, 1.7, 0.7, C.fridge, {
    roughness: 0.28, metalness: 0.45, clearcoat: 0.55, physical: true, rounded: true, radius: 0.04,
    pos: [cx + 1.55, y + 0.9, cz + 0.1]
  }));
  scene.add(neonStrip(2.8, 0.04, 0.04, C.neonAmber, [cx, y + 1.55, cz - 0.4], 1.3));
  scene.add(cssLabel("KITCHEN", "room-badge", [cx, y + 2.5, cz]));
  const pl = new THREE.PointLight(C.neonAmber, 0.55, 8, 2);
  pl.position.set(cx, y + 2.0, cz);
  scene.add(pl);
}

function buildLounge(scene, floor, x, z) {
  const y = fy(floor);
  scene.add(box(2.0, 0.45, 0.85, C.sofa, { roughness: 0.72, rounded: true, radius: 0.06, pos: [x, y + 0.28, z] }));
  scene.add(box(2.0, 0.55, 0.18, C.sofa, { roughness: 0.72, rounded: true, radius: 0.05, pos: [x, y + 0.55, z - 0.35] }));
  scene.add(box(0.7, 0.08, 0.5, C.deskTop, {
    roughness: 0.4, clearcoat: 0.3, physical: true, rounded: true, map: WOOD_MAP, pos: [x, y + 0.35, z + 0.85]
  }));
  plantAt(scene, x + 1.3, y, z + 0.2, 0.8);
}

function buildReception(scene) {
  initTextures();
  const y = fy(1);
  scene.add(box(3.6, 0.95, 0.85, 0xf5f0e8, {
    roughness: 0.45, clearcoat: 0.2, physical: true, rounded: true, radius: 0.05, pos: [0.3, y + 0.48, 2.4]
  }));
  scene.add(box(3.5, 0.08, 0.08, C.receptionStripe, {
    emissive: C.receptionStripe, emissiveIntensity: 0.55, castShadow: false,
    pos: [0.3, y + 0.85, 2.8]
  }));
  scene.add(box(3.4, 0.06, 0.7, C.deskTop, {
    roughness: 0.38, clearcoat: 0.35, physical: true, map: WOOD_MAP, pos: [0.3, y + 0.98, 2.4]
  }));
  buildLounge(scene, 1, -4.2, 3.2);
  scene.add(box(0.7, 0.55, 0.7, C.sofa, { roughness: 0.7, rounded: true, pos: [-2.6, y + 0.3, 3.6] }));
  plantAt(scene, -5.4, y, 3.8, 1.0);
}

function buildConference(scene, mobile) {
  initTextures();
  const y = fy(1);
  const cx = 5.2, cz = -2.8;
  scene.add(glassPanel(4.0, 2.5, 0.08, [cx, y + 1.25, cz - 1.7], mobile));
  scene.add(glassPanel(4.0, 2.5, 0.08, [cx, y + 1.25, cz + 1.7], mobile));
  scene.add(glassPanel(0.08, 2.5, 3.4, [cx - 2.0, y + 1.25, cz], mobile));
  scene.add(glassPanel(0.08, 2.5, 3.4, [cx + 2.0, y + 1.25, cz], mobile));
  scene.add(box(2.4, 0.08, 1.1, C.deskTop, {
    roughness: 0.35, clearcoat: 0.45, physical: true, rounded: true, map: WOOD_MAP, pos: [cx, y + 0.72, cz]
  }));
  [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.7], [0.8, 0.7]].forEach(([dx, dz]) => {
    scene.add(box(0.4, 0.5, 0.4, C.chair, {
      roughness: 0.55, rounded: true, map: WOOD_MAP, pos: [cx + dx, y + 0.3, cz + dz]
    }));
  });
  scene.add(neonStrip(3.6, 0.04, 0.04, C.neonCyan, [cx, y + 2.55, cz - 1.7], 1.1));
  scene.add(cssLabel("CONFERENCE", "room-badge", [cx, y + 2.75, cz]));
}

function buildBuilding(scene, mobile) {
  buildExterior(scene);
  for (let f = 1; f <= 3; f++) buildSlab(scene, f);
  buildShellWalls(scene, mobile);
  buildElevator(scene, mobile);
  buildStairs(scene);
  buildReception(scene);
  buildConference(scene, mobile);
  buildKitchen(scene);
  buildLounge(scene, 2, 5.2, 2.6);
  buildServerRoom(scene, mobile);
  buildCafe(scene);

  addFloorBadge(scene, 3, "Engineering");
  addFloorBadge(scene, 2, "Markets");
  addFloorBadge(scene, 1, "Reception");

  [
    { c: C.neonCyan, p: [0, fy(3) + 2.5, 0], i: 0.45 },
    { c: C.neonAmber, p: [5, fy(2) + 2.2, -3], i: 0.5 },
    { c: C.neonMagenta, p: [-2, fy(1) + 2.2, 0], i: 0.35 },
    { c: C.neonRed, p: [5.5, fy(3) + 2.3, 2.5], i: 0.45 }
  ].forEach(({ c, p, i }) => {
    const pl = new THREE.PointLight(c, i, 14, 2);
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
  let color = 0x8a948c, intensity = 0.35;
  if (status === "alert") { color = 0xd45a5a; intensity = 1.4; }
  else if (status === "active" || status === "working") { color = 0x3d9a6a; intensity = 0.9; }
  else if (status === "away") { color = 0x8bb8c9; intensity = 0.55; }
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
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(C.void, 1);
  if (renderer.capabilities.getMaxAnisotropy) {
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (WOOD_MAP) WOOD_MAP.anisotropy = aniso;
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
  scene.fog = new THREE.Fog(0xf3eee4, 52, 95);

  // PMREM studio environment for glass / wood reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envTex = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = mobile ? 0.55 : 0.85;
  envScene.dispose?.();

  const camera = new THREE.PerspectiveCamera(36, iw / ih, 0.1, 160);
  if (mobile) camera.position.set(20, 18, 22);
  else camera.position.set(24, 20, 26);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, fy(2) + 0.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.minDistance = 14;
  controls.maxDistance = 48;
  controls.enablePan = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  scene.add(new THREE.AmbientLight(C.ambient, 0.55));
  const hemi = new THREE.HemisphereLight(0xfff8ef, 0xd9c4a1, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(C.sun, 1.45);
  sun.position.set(14, 28, 12);
  sun.castShadow = true;
  const shadowSize = mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = mobile ? 2 : 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe8f0f4, 0.4);
  fill.position.set(-12, 14, -6);
  scene.add(fill);
  const warm = new THREE.DirectionalLight(0xffe0c2, 0.32);
  warm.position.set(6, 10, -8);
  scene.add(warm);

  buildBuilding(scene, mobile);
  AGENTS.forEach(a => {
    walnutDeskAt(scene, a.pos[0], fy(a.floor), a.pos[2]);
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

  // Post stack — bloom + SMAA (ray-traced look without path tracer)
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(iw, ih),
    mobile ? 0.22 : 0.38,
    0.55,
    0.72
  );
  composer.addPass(bloom);
  const smaa = new SMAAPass(iw * renderer.getPixelRatio(), ih * renderer.getPixelRatio());
  composer.addPass(smaa);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // Optional path tracer (desktop)
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
      pathTracer.bounces = 6;
      pathTracer.transmissiveBounces = 4;
      pathTracer.filterGlossyFactor = 0.5;
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
      mode: pathTraceEnabled ? (pathTracerReady ? "pathtrace" : "loading") : "pbr"
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
      renderer.toneMappingExposure = 1.05;
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
      // Soft fallback: boost bloom / env as "HQ glow" so toggle still feels better
      bloom.strength = 0.55;
      scene.environmentIntensity = 1.1;
      renderer.toneMappingExposure = 1.12;
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
        av.userData.glow.material.emissiveIntensity = 0.8 + Math.sin(now * 0.008) * 0.7;
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
