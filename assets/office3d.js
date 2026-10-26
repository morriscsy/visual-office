import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { AGENTS, statusLabel, FLOOR_Y, deskSitOffset } from "./agents.js";
import { pickTopic, buildDialogue, buildPantryAside } from "./topics.js";

/* HackerNoon-style multi-floor cutaway + Morris walnut + subtle neon */
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

const FH = 3.55; // floor-to-floor
const WALL_H = 3.15;
const BW = 16; // building width (X)
const BD = 12; // building depth (Z)
const HALF_W = BW / 2;
const HALF_D = BD / 2;

function fy(floor) { return FLOOR_Y[floor] ?? 0; }

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
  return box(w, h, d, color, {
    roughness: 0.35, metalness: 0.2,
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

  const body = box(0.5, 0.75, 0.32, agent.color, { roughness: 0.55 });
  body.position.y = 0.78;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xf2d6c2, roughness: 0.65 })
  );
  head.position.y = 1.35;
  head.castShadow = true;
  g.add(head);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0x8a948c, emissive: 0x8a948c, emissiveIntensity: 0.6, opacity: 0.85, transparent: true
    })
  );
  glow.position.set(0, 1.72, 0);
  g.add(glow);
  g.userData.glow = glow;
  g.userData.body = body;

  const legL = box(0.12, 0.4, 0.16, 0x5a6a62, { roughness: 0.8 });
  legL.position.set(-0.12, 0.2, 0);
  const legR = box(0.12, 0.4, 0.16, 0x5a6a62, { roughness: 0.8 });
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
  scene.add(box(1.45, 0.09, 0.78, C.deskTop, { roughness: 0.48, pos: [x, y + 0.72, z] }));
  scene.add(box(1.25, 0.014, 0.045, C.deskGrain, {
    roughness: 0.55, castShadow: false, pos: [x, y + 0.775, z]
  }));
  [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]].forEach(([dx, dz]) => {
    scene.add(box(0.09, 0.68, 0.09, C.deskLeg, { roughness: 0.6, pos: [x + dx, y + 0.34, z + dz] }));
  });
  scene.add(box(0.62, 0.4, 0.05, C.monitor, { pos: [x, y + 1.05, z - 0.26] }));
  scene.add(box(0.52, 0.3, 0.02, C.screen, {
    roughness: 0.3, metalness: 0.2,
    emissive: C.neonCyan, emissiveIntensity: 0.28,
    pos: [x, y + 1.05, z - 0.22]
  }));
  scene.add(box(0.5, 0.07, 0.5, C.chair, { roughness: 0.65, pos: [x, y + 0.45, z + 0.62] }));
  scene.add(box(0.5, 0.48, 0.07, C.chairBack, { roughness: 0.65, pos: [x, y + 0.72, z + 0.85] }));
  scene.add(box(0.07, 0.4, 0.07, C.deskLeg, { pos: [x, y + 0.22, z + 0.62] }));
}

function walnutShelf(scene, x, y, z) {
  scene.add(box(1.2, 1.35, 0.26, C.shelf, { roughness: 0.55, pos: [x, y + 0.75, z] }));
  for (let i = 0; i < 3; i++) {
    scene.add(box(1.08, 0.035, 0.22, C.deskGrain, {
      roughness: 0.5, castShadow: false, pos: [x, y + 0.35 + i * 0.35, z + 0.02]
    }));
  }
}

function plantAt(scene, x, y, z, scale = 1) {
  scene.add(box(0.32 * scale, 0.28 * scale, 0.32 * scale, C.plantPot, { pos: [x, y + 0.14 * scale, z] }));
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(0.38 * scale, 0.85 * scale, 7),
    new THREE.MeshStandardMaterial({ color: C.plant, roughness: 0.85 })
  );
  foliage.position.set(x, y + 0.55 * scale, z);
  foliage.castShadow = true;
  scene.add(foliage);
}

function treeAt(scene, x, z, h = 2.4) {
  scene.add(box(0.22, h * 0.35, 0.22, 0x5c4033, { pos: [x, h * 0.17, z] }));
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, h * 0.7, 6),
    new THREE.MeshStandardMaterial({ color: C.tree, roughness: 0.9 })
  );
  crown.position.set(x, h * 0.55, z);
  crown.castShadow = true;
  scene.add(crown);
}

function glassPanel(w, h, d, pos) {
  return box(w, h, d, C.glass, {
    roughness: 0.15, metalness: 0.15, opacity: 0.32,
    castShadow: false, pos
  });
}

function addFloorBadge(scene, floor, title) {
  const y = fy(floor) + WALL_H * 0.55;
  scene.add(cssLabel(`${floor}  ${title}`, "floor-badge", [-HALF_W - 0.15, y, 0]));
}

function buildExterior(scene) {
  // Soft ground plane (cream void feel)
  const ground = box(48, 0.08, 40, 0xeae3d6, { roughness: 1, castShadow: false, pos: [0, -0.12, 2] });
  scene.add(ground);

  // Road on the left
  scene.add(box(4.2, 0.06, 28, C.road, { roughness: 0.95, castShadow: false, pos: [-HALF_W - 4.5, -0.06, 1] }));
  for (let z = -10; z <= 12; z += 2.2) {
    scene.add(box(0.18, 0.02, 1.0, C.roadLine, { castShadow: false, receiveShadow: false, pos: [-HALF_W - 4.5, -0.02, z] }));
  }

  // Low-poly trees
  [[-HALF_W - 7, -6], [-HALF_W - 6.5, 2], [-HALF_W - 7.2, 8], [HALF_W + 3, -7], [HALF_W + 4, 6]].forEach(([x, z], i) => {
    treeAt(scene, x, z, 2.0 + (i % 3) * 0.35);
  });

  // Planter near entrance
  plantAt(scene, -1.5, 0, HALF_D + 1.2, 1.1);
  plantAt(scene, 1.5, 0, HALF_D + 1.2, 0.95);
}

function buildSlab(scene, floor) {
  const y = fy(floor);
  // Floor plate
  scene.add(box(BW, 0.16, BD, C.floor, { roughness: 0.88, pos: [0, y - 0.08, 0] }));
  // Subtle plank lines
  for (let i = -7; i <= 7; i += 2) {
    scene.add(box(0.03, 0.015, BD - 0.4, C.floorEdge, {
      roughness: 0.95, castShadow: false, pos: [i, y + 0.01, 0]
    }));
  }
  // Ceiling underside for floors above (cutaway slab edge)
  if (floor < 3) {
    scene.add(box(BW + 0.3, 0.18, BD + 0.3, C.slab, {
      roughness: 0.8, pos: [0, y + WALL_H + 0.09, 0]
    }));
  }
}

function buildShellWalls(scene) {
  // Only back (-Z) and left (-X) exterior walls — open front & right cutaway
  for (let f = 1; f <= 3; f++) {
    const y = fy(f);
    const midY = y + WALL_H / 2;
    // Back wall
    scene.add(box(BW, WALL_H, 0.18, C.exterior, { roughness: 0.82, pos: [0, midY, -HALF_D] }));
    // Left wall (with window cutouts feel via glass strips)
    scene.add(box(0.18, WALL_H, BD, C.exterior, { roughness: 0.82, pos: [-HALF_W, midY, 0] }));
    // Window bands on left
    scene.add(box(0.06, 1.1, BD - 1.5, C.glass, {
      roughness: 0.2, metalness: 0.1, opacity: 0.4, castShadow: false,
      pos: [-HALF_W + 0.08, y + 1.5, 0]
    }));
    // Thin front rail (cutaway edge)
    scene.add(box(BW, 0.12, 0.12, C.exteriorEdge, { pos: [0, y + 0.06, HALF_D] }));
    scene.add(box(0.12, 0.12, BD, C.exteriorEdge, { pos: [HALF_W, y + 0.06, 0] }));
    // Neon cove under each ceiling edge (open sides)
    scene.add(neonStrip(BW - 0.5, 0.04, 0.04, f === 3 ? C.neonCyan : (f === 2 ? C.neonAmber : C.neonMagenta),
      [0, y + WALL_H - 0.12, HALF_D - 0.15], 0.85));
  }
  // Exterior column accents
  for (let f = 1; f <= 3; f++) {
    const y = fy(f);
    scene.add(box(0.28, WALL_H, 0.28, C.exteriorEdge, { pos: [-HALF_W, y + WALL_H / 2, -HALF_D] }));
    scene.add(box(0.28, WALL_H, 0.28, C.exteriorEdge, { pos: [HALF_W, y + WALL_H / 2, -HALF_D] }));
  }
}

function buildElevator(scene) {
  // Glass shaft on far left, spanning all floors
  const ex = -HALF_W + 1.35;
  const ez = -1.2;
  const totalH = fy(3) + WALL_H;
  // Shaft glass walls
  scene.add(glassPanel(0.08, totalH, 2.4, [ex - 0.85, totalH / 2, ez]));
  scene.add(glassPanel(0.08, totalH, 2.4, [ex + 0.85, totalH / 2, ez]));
  scene.add(glassPanel(1.7, totalH, 0.08, [ex, totalH / 2, ez - 1.15]));
  scene.add(glassPanel(1.7, totalH, 0.08, [ex, totalH / 2, ez + 1.15]));
  // Frame
  [[-0.85, -1.15], [0.85, -1.15], [-0.85, 1.15], [0.85, 1.15]].forEach(([dx, dz]) => {
    scene.add(box(0.1, totalH, 0.1, 0xc8c2b6, { roughness: 0.5, pos: [ex + dx, totalH / 2, ez + dz] }));
  });
  // Elevator cab (animated lightly via emissive)
  const cab = box(1.3, 2.0, 1.8, 0xdfe8ea, {
    roughness: 0.4, metalness: 0.15, opacity: 0.55,
    emissive: C.neonCyan, emissiveIntensity: 0.15,
    pos: [ex, fy(2) + 1.0, ez]
  });
  cab.userData.isElevatorCab = true;
  scene.add(cab);
  scene.userData.elevatorCab = cab;
  // Cyan neon rails
  scene.add(neonStrip(0.05, totalH - 0.4, 0.05, C.neonCyan, [ex - 0.85, totalH / 2, ez + 1.15], 1.0));
  scene.add(neonStrip(0.05, totalH - 0.4, 0.05, C.neonCyan, [ex + 0.85, totalH / 2, ez + 1.15], 1.0));
}

function buildStairs(scene) {
  // Stairs between floors near elevator (inner left)
  const sx = -HALF_W + 3.2;
  const sz = 3.2;
  for (let f = 1; f <= 2; f++) {
    const y0 = fy(f);
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      scene.add(box(1.4, 0.12, 0.42, C.deskGrain, {
        roughness: 0.55,
        pos: [sx, y0 + t * FH + 0.06, sz - i * 0.38]
      }));
    }
    // Rail
    scene.add(box(0.06, FH * 0.9, 0.06, 0xc8c2b6, {
      pos: [sx + 0.75, y0 + FH * 0.45, sz - 1.4]
    }));
  }
}

function buildServerRoom(scene) {
  const y = fy(3);
  const cx = 5.4, cz = -3.4;
  // Glass enclosure
  scene.add(glassPanel(4.2, 2.4, 0.08, [cx, y + 1.2, cz - 1.6]));
  scene.add(glassPanel(4.2, 2.4, 0.08, [cx, y + 1.2, cz + 1.6]));
  scene.add(glassPanel(0.08, 2.4, 3.2, [cx - 2.1, y + 1.2, cz]));
  scene.add(glassPanel(0.08, 2.4, 3.2, [cx + 2.1, y + 1.2, cz]));
  scene.add(neonStrip(4.0, 0.04, 0.04, C.neonRed, [cx, y + 2.45, cz - 1.6], 1.2));
  // Racks
  [-0.7, 0.7].forEach((dx) => {
    scene.add(box(0.7, 1.8, 0.55, C.server, { roughness: 0.4, metalness: 0.35, pos: [cx + dx, y + 0.95, cz] }));
    for (let i = 0; i < 5; i++) {
      const col = i % 2 === 0 ? 0x22c55e : 0x22d3ee;
      scene.add(box(0.5, 0.06, 0.04, col, {
        emissive: col, emissiveIntensity: 1.4, castShadow: false,
        pos: [cx + dx, y + 0.4 + i * 0.28, cz + 0.28]
      }));
    }
  });
  scene.add(cssLabel("SERVER ROOM", "room-badge", [cx, y + 2.7, cz]));
}

function buildCafe(scene) {
  const y = fy(3);
  const cx = 5.6, cz = 2.8;
  // Meeting table + chairs
  scene.add(box(1.6, 0.08, 1.0, C.deskTop, { roughness: 0.48, pos: [cx, y + 0.7, cz] }));
  [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]].forEach(([dx, dz]) => {
    scene.add(box(0.35, 0.45, 0.35, C.chair, { pos: [cx + dx, y + 0.28, cz + dz] }));
  });
  walnutShelf(scene, cx + 1.6, y, cz - 0.8);
  plantAt(scene, cx - 1.3, y, cz + 0.9, 0.85);
  // Red neon CAFE sign
  scene.add(neonStrip(1.8, 0.12, 0.06, C.neonRed, [cx, y + 2.35, cz - 1.5], 1.6));
  scene.add(cssLabel("CAFE", "room-badge neon-red", [cx, y + 2.55, cz - 1.5]));
  // Soft neon wall wash
  const pl = new THREE.PointLight(C.neonRed, 0.55, 8, 2);
  pl.position.set(cx, y + 2.2, cz);
  scene.add(pl);
}

function buildKitchen(scene) {
  const y = fy(2);
  const cx = 5.5, cz = -3.6;
  // Counter
  scene.add(box(3.4, 0.9, 0.7, C.deskTop, { roughness: 0.5, pos: [cx, y + 0.45, cz] }));
  scene.add(box(3.2, 0.03, 0.55, C.deskGrain, { castShadow: false, pos: [cx, y + 0.92, cz] }));
  // Sink
  scene.add(box(0.45, 0.08, 0.35, 0xc5cdd2, { metalness: 0.4, roughness: 0.35, pos: [cx - 0.9, y + 0.96, cz] }));
  // Coffee machine
  scene.add(box(0.4, 0.55, 0.35, C.desk, { pos: [cx + 0.2, y + 1.2, cz] }));
  scene.add(box(0.28, 0.12, 0.2, C.neonAmber, {
    emissive: C.neonAmber, emissiveIntensity: 0.5, castShadow: false, pos: [cx + 0.2, y + 1.45, cz + 0.05]
  }));
  // Fridge
  scene.add(box(0.85, 1.7, 0.7, C.fridge, { roughness: 0.45, metalness: 0.25, pos: [cx + 1.55, y + 0.9, cz + 0.1] }));
  scene.add(neonStrip(2.8, 0.04, 0.04, C.neonAmber, [cx, y + 1.55, cz - 0.4], 1.1));
  scene.add(cssLabel("KITCHEN", "room-badge", [cx, y + 2.5, cz]));
  const pl = new THREE.PointLight(C.neonAmber, 0.4, 7, 2);
  pl.position.set(cx, y + 2.0, cz);
  scene.add(pl);
}

function buildLounge(scene, floor, x, z) {
  const y = fy(floor);
  scene.add(box(2.0, 0.45, 0.85, C.sofa, { roughness: 0.7, pos: [x, y + 0.28, z] }));
  scene.add(box(2.0, 0.55, 0.18, C.sofa, { roughness: 0.7, pos: [x, y + 0.55, z - 0.35] }));
  scene.add(box(0.7, 0.08, 0.5, C.deskTop, { pos: [x, y + 0.35, z + 0.85] }));
  plantAt(scene, x + 1.3, y, z + 0.2, 0.8);
}

function buildReception(scene) {
  const y = fy(1);
  // Long reception desk with red accent stripe
  scene.add(box(3.6, 0.95, 0.85, 0xf5f0e8, { roughness: 0.55, pos: [0.3, y + 0.48, 2.4] }));
  scene.add(box(3.5, 0.08, 0.08, C.receptionStripe, {
    emissive: C.receptionStripe, emissiveIntensity: 0.45, castShadow: false,
    pos: [0.3, y + 0.85, 2.8]
  }));
  scene.add(box(3.4, 0.06, 0.7, C.deskTop, { pos: [0.3, y + 0.98, 2.4] }));
  // Waiting lounge
  buildLounge(scene, 1, -4.2, 3.2);
  scene.add(box(0.7, 0.55, 0.7, C.sofa, { pos: [-2.6, y + 0.3, 3.6] }));
  plantAt(scene, -5.4, y, 3.8, 1.0);
}

function buildConference(scene) {
  const y = fy(1);
  const cx = 5.2, cz = -2.8;
  scene.add(glassPanel(4.0, 2.5, 0.08, [cx, y + 1.25, cz - 1.7]));
  scene.add(glassPanel(4.0, 2.5, 0.08, [cx, y + 1.25, cz + 1.7]));
  scene.add(glassPanel(0.08, 2.5, 3.4, [cx - 2.0, y + 1.25, cz]));
  scene.add(glassPanel(0.08, 2.5, 3.4, [cx + 2.0, y + 1.25, cz]));
  scene.add(box(2.4, 0.08, 1.1, C.deskTop, { roughness: 0.48, pos: [cx, y + 0.72, cz] }));
  [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.7], [0.8, 0.7]].forEach(([dx, dz]) => {
    scene.add(box(0.4, 0.5, 0.4, C.chair, { pos: [cx + dx, y + 0.3, cz + dz] }));
  });
  scene.add(neonStrip(3.6, 0.04, 0.04, C.neonCyan, [cx, y + 2.55, cz - 1.7], 0.9));
  scene.add(cssLabel("CONFERENCE", "room-badge", [cx, y + 2.75, cz]));
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

  // Soft neon points
  [
    { c: C.neonCyan, p: [0, fy(3) + 2.5, 0], i: 0.35 },
    { c: C.neonAmber, p: [5, fy(2) + 2.2, -3], i: 0.4 },
    { c: C.neonMagenta, p: [-2, fy(1) + 2.2, 0], i: 0.28 },
    { c: C.neonRed, p: [5.5, fy(3) + 2.3, 2.5], i: 0.35 }
  ].forEach(({ c, p, i }) => {
    const pl = new THREE.PointLight(c, i, 12, 2);
    pl.position.set(...p);
    scene.add(pl);
  });
}

/* Waypoints — world space */
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

function nearestFloor(y) {
  let best = 1, bestD = Infinity;
  for (const f of [1, 2, 3]) {
    const d = Math.abs(y - fy(f));
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

function pickWanderTarget(selfId, avatars, deskStatus) {
  const self = AGENTS.find(a => a.id === selfId);
  const roll = Math.random();
  // Busy / working → bias toward coffee (kitchen / cafe)
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
  // Chat with another bot
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
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(C.void, 1);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(iw, ih);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  labelRenderer.domElement.style.zIndex = "2";
  host.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.void);
  scene.fog = new THREE.Fog(0xf3eee4, 45, 85);

  const camera = new THREE.PerspectiveCamera(36, iw / ih, 0.1, 160);
  // Near-isometric default framing of whole building
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

  scene.add(new THREE.AmbientLight(C.ambient, 0.92));
  const hemi = new THREE.HemisphereLight(0xfff8ef, 0xd9c4a1, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(C.sun, 1.2);
  sun.position.set(14, 28, 12);
  sun.castShadow = true;
  const shadowSize = mobile ? 512 : 1024;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe8f0f4, 0.35);
  fill.position.set(-12, 14, -6);
  scene.add(fill);
  const warm = new THREE.DirectionalLight(0xffe0c2, 0.25);
  warm.position.set(6, 10, -8);
  scene.add(warm);

  buildBuilding(scene);
  AGENTS.forEach(a => {
    const [x, y, z] = deskSitOffset(a);
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
    // Elevator cab bob between floors
    const cab = scene.userData.elevatorCab;
    if (cab) {
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
