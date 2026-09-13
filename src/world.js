import {createRearView} from './rear-view.js';
import {createPatrolVisuals} from "./wobble/patrol-visuals.js";
import {GunEffects,ShotAudio} from "./wobble/original/gun-effects.js";
import {dressPolice,updatePoliceAccessories} from "./wobble/police-accessories.js";
import {poseAim} from "./wobble/original/characters.js";
import {BloodEffects} from "./wobble/blood-effects.js";
import {createPoliceSportsCar} from "./wobble/police-car.js";
import {createCrowdPerson, animateCrowdPerson} from "./wobble/crowd.js";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  box,
  mat,
  texture,
  labelTexture,
  mergeStatic,
} from "./render-utils.js";
import { vehicleFactory } from "./vehicles.js";
import { addLandmarks } from "./landmarks.js";
import {
  roads,
  circuit,
  garages,
  gems,
  buildings,
  barriers,
  garageWalls,
  turns,
  WATER,
  WORLD_BOUNDS,
  MERLION,
  closestRoad,
  vehicleSurfaceHeight,
  connections,
  atCircuit,
  CIRCUIT_LENGTH,
  inWater,
} from "./district.js";
import { seededRandom, distance } from "./physics.js";
import { segmentBlocked } from "./collision-world.js";
import { addEnvironmentAssets, naturalSurfaces } from "./environment-assets.js";
import { addCityDetails } from "./city-details.js";
import {
  createWobbleCharacter,
  animateCharacter,
  detachWobbleHead,
  restoreWobbleHead,
  createHeroVehicle,
  setVehicleDoor,
} from "./wobble/models.js";

function stripGeometry(points, width, closed = false, lateral = 0) {
  const vertices = [],
    uvs = [],
    indices = [];
  let along = 0;
  for (let i = 0; i < points.length + (closed ? 1 : 0); i++) {
    const p = points[i % points.length],
      previous = points[(i - 1 + points.length) % points.length],
      next = points[(i + 1) % points.length];
    let dx, dz;
    if (!closed && i === 0) {
      dx = next.x - p.x;
      dz = next.z - p.z;
    } else if (!closed && i === points.length - 1) {
      dx = p.x - previous.x;
      dz = p.z - previous.z;
    } else {
      dx = next.x - previous.x;
      dz = next.z - previous.z;
    }
    const length = Math.hypot(dx, dz) || 1,
      nx = dz / length,
      nz = -dx / length;
    if (i > 0) along += distance(p, points[(i - 1) % points.length]);
    for (const side of [-1, 1]) {
      vertices.push(
        p.x + nx * (lateral + (side * width) / 2),
        (p.y || 0) + 0.035,
        p.z + nz * (lateral + (side * width) / 2),
      );
      uvs.push((side + 1) / 2, along / 20);
    }
    if (i > 0) {
      const n = i * 2;
      indices.push(n - 2, n, n - 1, n - 1, n, n + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function segment(parent, a, b, width, height, material, yOffset = 0) {
  const d = distance(a, b),
    mesh = box(
      parent,
      (a.x + b.x) / 2,
      ((a.y || 0) + (b.y || 0)) / 2 + yOffset,
      (a.z + b.z) / 2,
      width,
      height,
      d + 0.04,
      material,
    );
  mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  return mesh;
}
function facadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  c.fillStyle = "#b0c9cf";
  c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32)
    for (let x = 0; x < 256; x += 24) {
      c.fillStyle = (x + y) % 3 === 0 ? "#7d9eab" : "#8aa8b4";
      c.fillRect(x + 2, y + 2, 20, 27);
      c.fillStyle = "#d6e1dc";
      c.fillRect(x, y, 2, 32);
      c.fillRect(x, y + 30, 24, 2);
    }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#b8d9ec");
  scene.fog = new THREE.FogExp2("#bdd9e0", 0.00072);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
  scene.add(new THREE.HemisphereLight("#d5ecff", "#899786", 1.5));
  const sun = new THREE.DirectionalLight("#fff0d4", 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -68,
    right: 68,
    top: 68,
    bottom: -68,
    near: 1,
    far: 360,
  });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.07;
  scene.add(sun, sun.target);
  const rearView=createRearView(renderer,scene);
  const camera = new THREE.PerspectiveCamera(
    59,
    innerWidth / innerHeight,
    0.15,
    3000,
  );
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2800, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader:
        "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec3 p;void main(){float h=normalize(p).y;gl_FragColor=vec4(mix(vec3(.77,.88,.9),vec3(.29,.60,.83),smoothstep(-.05,.75,h)),1.);}",
    }),
  );
  scene.add(sky);
  const staticRoot = new THREE.Group();
  scene.add(staticRoot);
  const stone = mat("#d3d3c4"),
    sidewalk = mat("#bfc2b7"),
    white = mat("#edeedf"),
    yellow = mat("#d8b34f"),
    rail = mat("#a9b9bc", { metalness: 0.35, roughness: 0.55 }),
    green = mat("#68954b"),
    dark = mat("#344e53");
  const surfaces = naturalSurfaces(renderer);
  const roadMat = mat("#b9bfbe", {
    map: texture("asphalt"),
    bumpMap: surfaces.asphalt,
    bumpScale: 0.025,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  // Cut the actual bay and river out of the land. Bridges are continuous road strips over the hole.
  const landShape = new THREE.Shape();
  landShape.moveTo(-2000,-700);
  landShape.lineTo(400,-700);
  landShape.lineTo(400,1250);
  landShape.lineTo(-2000,1250);
  landShape.closePath();
  const hole = new THREE.Path();
  WATER.forEach((p, i) => (i ? hole.lineTo(p.x, p.z) : hole.moveTo(p.x, p.z)));
  hole.closePath();
  landShape.holes.push(hole);
  const terrain = new THREE.Mesh(
    new THREE.ShapeGeometry(landShape),
    mat("#ffffff", {
      map: surfaces.grass,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  terrain.rotation.x = Math.PI / 2;
  terrain.position.y = -0.11;
  staticRoot.add(terrain);
  const waterShape = new THREE.Shape();
  WATER.forEach((p, i) =>
    i ? waterShape.lineTo(p.x, p.z) : waterShape.moveTo(p.x, p.z),
  );
  waterShape.closePath();
  const water = new THREE.Mesh(
    new THREE.ShapeGeometry(waterShape),
    new THREE.MeshStandardMaterial({
      color: "#539caa",
      roughness: 0.38,
      metalness: 0.18,
      side: THREE.DoubleSide,
    }),
  );
  water.rotation.x = Math.PI / 2;
  water.position.y = -1.1;
  scene.add(water);
  const promenade = new THREE.Mesh(
    stripGeometry([...WATER, WATER[0]], 7, false, -4),
    sidewalk,
  );
  promenade.receiveShadow = true;
  staticRoot.add(promenade);
  for (let i = 0; i < WATER.length; i++) {
    const a = WATER[i],
      b = WATER[(i + 1) % WATER.length],
      length = distance(a, b),
      n = Math.ceil(length / 10);
    for (let j = 0; j < n; j++) {
      const p = {
          x: a.x + ((b.x - a.x) * j) / n,
          z: a.z + ((b.z - a.z) * j) / n,
        },
        q = {
          x: a.x + ((b.x - a.x) * (j + 1)) / n,
          z: a.z + ((b.z - a.z) * (j + 1)) / n,
        };
      if (closestRoad(p).distance < 25) continue;
      segment(staticRoot, p, q, 0.15, 0.14, rail, 1.2);
      box(staticRoot, p.x, 0.6, p.z, 0.13, 1.2, 0.13, rail);
    }
  }
  for (const road of roads) {
    const margin = new THREE.Mesh(
      stripGeometry(road.points, road.width + 8, road.closed),
      sidewalk,
    );
    margin.position.y = -0.04;
    margin.receiveShadow = true;
    staticRoot.add(margin);
    const mesh = new THREE.Mesh(
      stripGeometry(road.points, road.width, road.closed),
      roadMat,
    );
    mesh.receiveShadow = true;
    staticRoot.add(mesh);
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(
        stripGeometry(
          road.points,
          0.15,
          road.closed,
          side * (road.width / 2 - 0.5),
        ),
        white,
      );
      edge.position.y = 0.025;
      staticRoot.add(edge);
      if (road.kind === "public")
        for (const offset of [road.width / 2 - 0.95, road.width / 2 - 1.25]) {
          const line = new THREE.Mesh(
            stripGeometry(road.points, 0.1, road.closed, side * offset),
            yellow,
          );
          line.position.y = 0.03;
          staticRoot.add(line);
        }
    }
    for (let i = 1; i < road.points.length - 1; i += 2) {
      const a = road.points[i],
        b = road.points[i + 1],
        dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz);
      if (d < 1) continue;
      const p = { x: a.x, z: a.z, y: a.y + 0.02 },
        q = { x: a.x + (dx / d) * 4, z: a.z + (dz / d) * 4, y: a.y + 0.02 };
      segment(staticRoot, p, q, 0.17, 0.025, white, 0.04);
    }
  }
  for (const b of barriers) {
    const m = box(staticRoot, b.x, b.y + b.h / 2, b.z, b.w, b.h, b.d, stone);
    m.rotation.y = b.yaw;
    const panel = box(
      staticRoot,
      b.x,
      b.y + 0.53,
      b.z,
      0.53,
      0.72,
      b.d * 0.93,
      matCache(b.x < -900 ? "#698fa0" : "#517c96"),
    );
    panel.rotation.y = b.yaw;
    if (Math.round(b.x + b.z) % 3 === 0) {
      const fence = box(staticRoot, b.x, b.y + 2, b.z, 0.08, 2.8, 0.08, rail);
      fence.rotation.y = b.yaw;
    }
  }
  const glassTexture = facadeTexture(),
    glass = ["#b4c7cd", "#8faebe", "#b5c7c4", "#91b1b5", "#c3c7bd"].map(
      (color) =>
        mat(color, { map: glassTexture, roughness: 0.32, metalness: 0.28 }),
    );
  for (const b of buildings) {
    box(staticRoot, b.x, b.h / 2, b.z, b.w, b.h, b.d, glass[b.color]);
    box(staticRoot, b.x, 2, b.z, b.w + 1.2, 4, b.d + 1.2, stone);
    box(staticRoot, b.x, b.h + 0.5, b.z, b.w + 1, 1, b.d + 1, white);
    for (let y = 8; y < b.h; y += 7)
      box(staticRoot, b.x, y, b.z + b.d / 2 + 0.06, b.w, 0.22, 0.13, white);
    if (b.h > 90)
      box(staticRoot, b.x, b.h + 3, b.z, b.w * 0.3, 5, b.d * 0.45, stone);
  }
  const landmarkAssets = addLandmarks(scene, glass, stone);
  const cityDetails = addCityDetails(scene);
  // A two-level pit building beside the start/finish straight, with garage bays and an open pit lane.
  const pit = new THREE.Group();
  pit.position.set(59, 0, -66);
  pit.rotation.y = -0.149;
  staticRoot.add(pit);
  box(pit, 0, 6, 0, 20, 12, 180, white);
  box(pit, -10.15, 7, 0, 0.2, 5, 178, glass[1]);
  for (let z = -80; z <= 80; z += 12) {
    box(pit, -10.15, 2.4, z, 0.3, 4.8, 9, dark);
    box(pit, -11, 5.1, z, 2, 0.25, 10, stone);
  }
  box(pit, 0, 12.5, 0, 25, 1, 186, stone);
  // Garage walls are drawn directly from the collision objects. Open front, offset opaque sight screen.
  for (const wall of garageWalls) {
    const m = box(
      staticRoot,
      wall.x,
      wall.h / 2,
      wall.z,
      wall.w,
      wall.h,
      wall.d,
      stone,
    );
    m.rotation.y = wall.yaw;
  }
  const garageMarkers = [];
  for (const g of garages) {
    const group = new THREE.Group();
    group.position.set(g.x, 0, g.z);
    group.rotation.y = Math.atan2(g.outward.x, g.outward.z);
    staticRoot.add(group);
    box(group, 0, 0.04, 0, 34, 0.08, 44, sidewalk);
    box(group, 0, 6.7, 0, 36, 0.4, 46, white);
    for (let x = -13; x <= 13; x += 8)
      box(group, x, 0.105, -11, 0.1, 0.03, 16, yellow);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(21, 2.3),
      new THREE.MeshBasicMaterial({
        map: labelTexture("COOLDOWN  ◇", "#fff7e2", "#ae691e"),
        side: THREE.DoubleSide,
      }),
    );
    board.position.set(0, 5, 22.7);
    group.add(board);
    const entrance = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.16, 6, 32),
      mat("#bd761e", { emissive: "#ad6800", emissiveIntensity: 0.2 }),
    );
    entrance.position.set(g.entrance.x, 3.5, g.entrance.z);
    entrance.rotation.y = Math.atan2(g.outward.x, g.outward.z);
    scene.add(entrance);
    garageMarkers.push({ g, mesh: entrance });
    const boundary = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        [
          g.local(-15, -20),
          g.local(15, -20),
          g.local(15, 20),
          g.local(-15, 20),
        ].map((p) => new THREE.Vector3(p.x, 0.15, p.z)),
      ),
      new THREE.LineBasicMaterial({ color: "#c4760b" }),
    );
    scene.add(boundary);
    const safe = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 40),
      new THREE.MeshBasicMaterial({
        color: "#d99927",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    safe.rotation.x = -Math.PI / 2;
    safe.position.set(g.inside.x, 0.13, g.inside.z);
    scene.add(safe);
  }
  const random = seededRandom(77),
    leafMat = mat("#3d7e45"),
    trunk = mat("#817b63");
  // Instanced rain-tree crowns and trunks limit draw calls across the full 5 km district.
  const treePositions = [];
  for (let s = 20; s < CIRCUIT_LENGTH; s += 48)
    for (const side of [-1, 1]) {
      const p = atCircuit(s, 18 * side);
      if (
        garages.some((g) => distance(g, p) < 48) ||
        connections.some((c) => distance(c, p) < 28) ||
        inWater(p)
      )
        continue;
      treePositions.push(p);
    }
  const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.24, 0.44, 5.5, 6),
      trunk,
      treePositions.length,
    ),
    crowns = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 9, 6),
      leafMat,
      treePositions.length * 3,
    ),
    dummy = new THREE.Object3D();
  treePositions.forEach((p, i) => {
    dummy.position.set(p.x, p.y + 2.6, p.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 3; k++) {
      dummy.position.set(
        p.x + (k - 1) * 2.2,
        p.y + 6 + random(),
        p.z + (k % 2) * 1.7,
      );
      dummy.scale.set(3.5, 1.8, 3.2);
      dummy.updateMatrix();
      crowns.setMatrixAt(i * 3 + k, dummy.matrix);
    }
  });
  trunks.castShadow = crowns.castShadow = true;
  scene.add(trunks, crowns);
  const environmentAssets = addEnvironmentAssets(scene, [trunks, crowns]);
  // Sheltered walkways, bus stops, crossings, and green Singapore-style direction boards.
  for (const road of roads.filter((r) => r.kind === "public"))
    for (let i = 3; i < road.points.length - 3; i += 9) {
      const p = road.points[i],
        q = road.points[i + 1],
        yaw = Math.atan2(q.x - p.x, q.z - p.z),
        group = new THREE.Group();
      group.position.set(p.x, 0, p.z);
      group.rotation.y = yaw;
      staticRoot.add(group);
      box(group, road.width / 2 + 3, 3.5, 0, 5, 0.25, 24, white);
      for (const z of [-10, 0, 10])
        box(group, road.width / 2 + 5, 1.7, z, 0.15, 3.4, 0.15, rail);
      box(group, road.width / 2 + 3, 0.5, 0, 1, 0.8, 5, stone);
      const busSign = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 1.5),
        new THREE.MeshBasicMaterial({
          map: labelTexture("BUS  36", "#f5faed", "#3c745a"),
          side: THREE.DoubleSide,
        }),
      );
      busSign.position.set(road.width / 2 + 3, 2.4, 7);
      group.add(busSign);
      for (let x = -road.width / 2 + 1; x < road.width / 2 - 1; x += 2)
        box(group, x, 0.11, 9, 1, 0.02, 3, white);
    }
  const clouds = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 6),
    new THREE.MeshBasicMaterial({
      color: "#f4f8f6",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
    60,
  );
  for (let i = 0; i < 60; i++) {
    dummy.position.set(
      -1600 + random() * 2600,
      360 + random() * 160,
      -1100 + random() * 2200,
    );
    dummy.scale.set(40 + random() * 85, 9 + random() * 14, 25 + random() * 45);
    dummy.updateMatrix();
    clouds.setMatrixAt(i, dummy.matrix);
  }
  scene.add(clouds);
  // Low perimeter hedges make the playable downtown edge visible on land.
  const edgeGreen=mat("#416657");
  for(let x=WORLD_BOUNDS.minX;x<WORLD_BOUNDS.maxX;x+=20)for(const z of [WORLD_BOUNDS.minZ,WORLD_BOUNDS.maxZ])if(!inWater({x,z}))box(staticRoot,x,1,z,20,2,1.5,edgeGreen);
  for(let z=WORLD_BOUNDS.minZ;z<WORLD_BOUNDS.maxZ;z+=20)for(const x of [WORLD_BOUNDS.minX,WORLD_BOUNDS.maxX])if(!inWater({x,z}))box(staticRoot,x,1,z,1.5,2,20,edgeGreen);
  // Merge static meshes by material, preserving the dynamic cars, landmarks, water and route overlay.
  mergeStatic(staticRoot);
  staticRoot.traverse((o) => {
    if (o.isMesh) {
      o.receiveShadow = true;
      o.castShadow = true;
    }
  });
  const makeCar = vehicleFactory(scene),
    playerCar = makeCar("#eae5d5", false, true),
    policeCars = Array.from({ length: 3 }, () => createPoliceSportsCar(scene)),
    trafficCars = [];
  // The procedural hero fleet and big-head actors come from the wobble-head yard.
  // They remain local, editable geometry and keep articulated driver doors.
  const heroCars = new Map(),
    actors = {
      kai: createWobbleCharacter("kai"),
      rae: createWobbleCharacter("rae"),
    };
  scene.add(actors.kai, actors.rae);
  actors.kai.visible = actors.rae.visible = false;
  playerCar.mesh.visible = false;
  const explosionBits = [];
  let detachedHead = null,
    lastExplosion = null,
    explosionFx = null;
  const colors = [
    "#9db6ba",
    "#a9b9b4",
    "#dbdfdb",
    "#848e99",
    "#7ea693",
    "#c99374",
  ];
  const gemMaterial = mat("#7142cd", {
      emissive: "#6946bc",
      emissiveIntensity: 0.25,
      roughness: 0.25,
      metalness: 0.35,
    }),
    gemModels = gems.map((g) => {
      const group = new THREE.Group();
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.15, 0),
        gemMaterial,
      );
      gem.position.y = 2.6;
      group.add(gem);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.13, 6, 32),
        gemMaterial,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      group.add(ring);
      group.position.set(g.x, g.y, g.z);
      scene.add(group);
      return group;
    });
  const routeMaterial = new THREE.MeshBasicMaterial({
    color: "#7544c7",
    transparent: true,
    opacity: 0.57,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const routeMesh = new THREE.Mesh(new THREE.BufferGeometry(), routeMaterial);
  routeMesh.renderOrder = 2;
  scene.add(routeMesh);
  const arrowGeometry = new THREE.BufferGeometry();
  arrowGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-0.85, 0, 0.9, 0, 0, -1.6, 0.85, 0, 0.9],
      3,
    ),
  );
  const arrows = new THREE.InstancedMesh(
    arrowGeometry,
    new THREE.MeshBasicMaterial({
      color: "#4a207b",
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    40,
  );
  scene.add(arrows);
  // Each persistent NPC owns its model; distance only changes visibility.
  const patrolVisuals=createPatrolVisuals(scene);
  const officers=Array.from({length:3},()=>{const model=createWobbleCharacter("officer");model.visible=false;model.userData.officer=true;scene.add(model);return model;});
  const gunEffects=new GunEffects(scene),shotAudio=new ShotAudio();
  let shownShots=new WeakSet();
  const personModels = new Map();
  const blood = new BloodEffects(scene);
  let bloodGame = null, shownImpacts = new WeakSet();
  let initialized = false,
    lastGuidance = null;
  let punchCameraGame = null, lastPunch = null, punchViewUntil = 0,
    punchViewHeading = 0, punchViewSide = 1;
  const goal = new THREE.Vector3(),
    look = new THREE.Vector3(),
    currentLook = new THREE.Vector3();
  let perf = [];
  function update(g, dt, time, view = 0) {
    environmentAssets.update(g.player, time);
    cityDetails.update(time);
    if (bloodGame !== g) { blood.clear(); shownImpacts = new WeakSet(); bloodGame = g;gunEffects.clear();shownShots=new WeakSet(); }
    for (const impact of g.pedestrianImpacts || []) {
      if (shownImpacts.has(impact)) continue;
      shownImpacts.add(impact);
      const plaza = Math.abs(impact.x + 1120) < 39 && Math.abs(impact.z - 600) < 19;
      const groundY = Math.max(impact.y, plaza ? .25 : 0);
      if (g.elapsed-impact.time<8) blood.burst(impact.x,groundY+.8,impact.z,impact.dx,impact.dz,groundY);
    }
    blood.update(g.status === "running" ? Math.min(dt,.05) : 0);
    while (trafficCars.length < g.traffic.length) {
      const t = g.traffic[trafficCars.length];
      const model = createHeroVehicle(t.type, colors[t.color]);
      model.userData.traffic = true;
      scene.add(model);
      trafficCars.push(model);
    }
    function sync(model, body) {
      model.mesh.position.set(body.x, vehicleSurfaceHeight(body) + 0.025, body.z);
      model.mesh.rotation.y = -body.heading;
      model.mesh.rotation.z =
        -(body.steer || 0) * Math.min(Math.abs(body.speed) / 35, 1) * 0.035;
      model.mesh.visible = body.visible !== false;
    }
    sync(playerCar, g.player);
    playerCar.mesh.visible = false;
    g.traffic.forEach((t, i) => {
      const model = trafficCars[i];
      model.position.set(t.x, vehicleSurfaceHeight(t) + 0.025, t.z);
      model.rotation.y = Math.PI - t.heading;
      model.visible = distance(t, g.player) < 350;
      model.userData.vehicle.animateWheels(Math.hypot(t.vx, t.vz) * dt, -(t.steer || 0) * 0.38);
    });
    g.police.forEach((c, i) => {
      const model=policeCars[i];sync(model,c);model.mesh.rotation.y=Math.PI-c.heading;
      model.mesh.userData.vehicle.animateWheels(Math.hypot(c.vx,c.vz)*dt,-(c.steer||0)*.38);
    });
    const vehicleStates = g.vehicles?.length
      ? g.vehicles
      : [{ id: "player", type: "sports", name: "Veloce", ...g.player }];
    for (const state of vehicleStates) {
      let visual = heroCars.get(state.id);
      if (!visual) {
        visual = createHeroVehicle(state.type || "sports");
        scene.add(visual);
        heroCars.set(state.id, visual);
      }
      visual.visible = state.visible !== false && distance(state,g.player) < 350;
      visual.position.set(state.x, vehicleSurfaceHeight(state) + 0.02, state.z);
      visual.rotation.y = Math.PI - state.heading;
      if (visual.userData.vehicle)
        visual.userData.vehicle.heading = visual.rotation.y;
      const transitionVehicle = g.transition?.vehicleId === state.id,
        gMode = g.mode || "driving";
      let door = 0;
      if (transitionVehicle) {
        const p = Math.max(0, Math.min(1, g.transition.progress || 0));
        door = Math.sin(p * Math.PI);
      }
      setVehicleDoor(visual, door);
      visual.userData.active = state.id === (g.activeVehicleId || "player");
      visual.userData.vehicle?.animateWheels(
        (state.speed || 0) * dt,
        -(state.steeringAngle ?? (state.steer || 0) * 0.38),
      );
      if ((g.mode === "exploding" || g.explosion) && visual.userData.active)
        visual.visible = false;
    }
    const characterId = g.character === "rae" ? "rae" : "kai",
      actor = actors[characterId],
      other = actors[characterId === "kai" ? "rae" : "kai"];
    other.visible = false;
    const mode = g.mode === "encounter" ? "driving" : g.mode || "driving",
      activeVehicle = heroCars.get(g.activeVehicleId || "player");
    actor.visible = mode !== "exploding";
    if (actor.visible) {
      if (
        (mode === "driving" || (mode === "boarding" && g.transition?.phase === "motion") || mode === "exiting") &&
        activeVehicle
      ) {
        const p = Math.max(0, Math.min(1, g.transition?.progress ?? 1)),
          boarding = mode === "boarding",
          exiting = mode === "exiting";
        const seat = activeVehicle.localToWorld(
            activeVehicle.userData.driverAnchor.position.clone(),
          ),
          board = activeVehicle.localToWorld(
            activeVehicle.userData.boardAnchor.position.clone(),
          );
        const t = boarding ? p : exiting ? 1 - p : 1;
        actor.position.copy(board).lerp(seat, t);
        actor.rotation.y = activeVehicle.rotation.y;
        animateCharacter(actor, dt, time, {
          mode,
          heading: g.player.heading || 0,
          speed: 0,
          vehicle: activeVehicle,
          transition: p,
        });
      } else {
        actor.position.set(g.player.x, (g.player.y || 0) + 0.02, g.player.z);
        animateCharacter(actor, dt, time, {
          mode,
          speed: Math.hypot(g.player.vx || 0, g.player.vz || 0),
          heading: g.player.heading,
          reaction: g.player.reaction,
          attack: g.player.attack,
          hurt: g.player.hurt,
        });
      }
    }
    patrolVisuals.update(g,dt,time);
    officers.forEach((model,i)=>{
      const c=g.police[i],rig=model.userData.rig;
      model.visible=!!rig&&c.visible&&c.officerActive;
      if(!model.visible)return;
      if(!rig.police)dressPolice(rig);
      const p=c.officerPosition||c;model.position.set(p.x,(p.y||0)+.02,p.z);
      const heading=Math.atan2(g.player.x-p.x,-(g.player.z-p.z));
      animateCharacter(model,dt,time,{heading,speed:c.officerSpeed||0,reaction:c.reaction,hurt:c.hurt,attack:c.attack});
      if(c.reaction||c.hurt||g.meleeAlert){rig.aiming=false;rig.flashTime=0;updatePoliceAccessories(rig);return;}
      rig.aiming=true;rig.aimTarget=new THREE.Vector3(g.player.x,(g.player.y||0)+1.12,g.player.z);
      rig.recoil=c.recoil||0;rig.flashTime=c.flashTime||0;
      poseAim(rig,rig.aimTarget,{recoil:rig.recoil});updatePoliceAccessories(rig);
      c.muzzleOrigin=rig.muzzle.getWorldPosition(new THREE.Vector3());c.muzzleDirection=rig.muzzle.getWorldDirection(new THREE.Vector3());
    });
    for(const shot of g.shots||[]) {
      if(shownShots.has(shot))continue;shownShots.add(shot);
      if(g.elapsed-shot.time>.2)continue;
      const i=g.police.findIndex(c=>c.id===shot.copId),muzzle=(officers[i]||patrolVisuals.models.get(shot.copId))?.userData.rig?.muzzle;
      gunEffects.shot(muzzle?muzzle.getWorldPosition(new THREE.Vector3()):shot.from,shot.to,!shot.hit);
      shotAudio.play(distance(shot.from,g.player));
    }
    gunEffects.update(g.status==="running"?Math.min(dt,.05):0);
    const explosion = g.explosion;
    if (explosion && explosion !== lastExplosion) {
      lastExplosion = explosion;
      detachedHead = detachWobbleHead(
        actor,
        scene,
        explosion,
        explosion.heading || 0,
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.16, 8, 48),
        new THREE.MeshBasicMaterial({
          color: "#ffd27a",
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(explosion.x, (explosion.y || 0) + 0.22, explosion.z);
      const flash = new THREE.PointLight("#ff8a37", 55, 45);
      flash.position.set(explosion.x, (explosion.y || 0) + 2, explosion.z);
      scene.add(ring, flash);
      explosionFx = { ring, flash, elapsed: 0 };
      for (let i = 0; i < 18; i++) {
        const bit = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.18 + random() * 0.5,
            0.12 + random() * 0.35,
            0.2 + random() * 0.65,
          ),
          mat(i % 3 ? "#e55c35" : "#18272d", {
            emissive: i % 4 === 0 ? "#ff6a20" : "#000",
            emissiveIntensity: i % 4 === 0 ? 2 : 0,
          }),
        );
        bit.position.set(explosion.x, (explosion.y || 0) + 0.8, explosion.z);
        bit.userData.velocity = new THREE.Vector3(
          (random() - 0.5) * 14,
          4 + random() * 9,
          (random() - 0.5) * 14,
        );
        bit.userData.spin = new THREE.Vector3(
          random() * 7,
          random() * 7,
          random() * 7,
        );
        scene.add(bit);
        explosionBits.push(bit);
      }
    }
    if (explosionFx) {
      explosionFx.elapsed += dt;
      const s = 1 + explosionFx.elapsed * 12;
      explosionFx.ring.scale.setScalar(s);
      explosionFx.ring.material.opacity = Math.max(
        0,
        1 - explosionFx.elapsed * 0.85,
      );
      explosionFx.flash.intensity = 55 * Math.exp(-explosionFx.elapsed * 4);
    }
    if (!explosion && lastExplosion) {
      lastExplosion = null;
      restoreWobbleHead(actor);
      if (detachedHead) {
        detachedHead.removeFromParent();
        detachedHead.traverse((o) => {
          if (o.isMesh) o.geometry.dispose();
        });
        detachedHead = null;
      }
      if (explosionFx) {
        explosionFx.ring.removeFromParent();
        explosionFx.ring.geometry.dispose();
        explosionFx.ring.material.dispose();
        explosionFx.flash.removeFromParent();
        explosionFx = null;
      }
      while (explosionBits.length) {
        const bit = explosionBits.pop();
        bit.removeFromParent();
        bit.geometry.dispose();
        bit.material.dispose();
      }
    }
    for (const bit of explosionBits) {
      bit.userData.velocity.y -= 18 * dt;
      bit.position.addScaledVector(bit.userData.velocity, dt);
      bit.rotation.x += bit.userData.spin.x * dt;
      bit.rotation.y += bit.userData.spin.y * dt;
      bit.rotation.z += bit.userData.spin.z * dt;
      if (bit.position.y < 0.08) {
        bit.position.y = 0.08;
        bit.userData.velocity.multiplyScalar(0.72);
        bit.userData.velocity.y = Math.abs(bit.userData.velocity.y) * 0.36;
      }
    }
    if (detachedHead) {
      detachedHead.userData.velocity.y -= 14 * dt;
      detachedHead.position.addScaledVector(detachedHead.userData.velocity, dt);
      detachedHead.rotation.x += detachedHead.userData.spin.x * dt;
      detachedHead.rotation.y += detachedHead.userData.spin.y * dt;
      if (detachedHead.position.y < 0.35) {
        detachedHead.position.y = 0.35;
        detachedHead.userData.velocity.y =
          Math.abs(detachedHead.userData.velocity.y) * 0.55;
        detachedHead.userData.velocity.multiplyScalar(0.83);
      }
    }
    policeCars.forEach((c, i) =>
      c.lights.forEach((l, j) => {
        l.visible = Math.sin(time * 15 + i + (j < 2 ? 0 : Math.PI)) > 0;
      }),
    );
    playerCar.flames.forEach((f) => (f.visible = g.boosting));
    for (const p of g.pedestrians) {
      let model = personModels.get(p.id);
      const nearby = distance(p, g.player) < 140;
      if (!model && nearby) {
        model = createCrowdPerson(p); personModels.set(p.id, model); scene.add(model);
      }
      if (!model) continue;
      model.visible = nearby && !p.hit;
      if (nearby) animateCrowdPerson(model, p, g.status === "running" ? Math.min(dt, 0.05) : 0);
    }
    gemModels.forEach((m, i) => {
      m.visible =
        g.mission === "active" &&
        !g.collected.includes(gems[i].id) &&
        distance(gems[i], g.player) < 450;
      m.children[0].rotation.y = time;
      m.children[0].position.y = 2.6 + Math.sin(time * 2 + i) * 0.2;
    });
    garageMarkers.forEach(({ mesh, g: area }) => {
      mesh.visible = distance(area, g.player) < 500;
      mesh.scale.setScalar(
        g.guidance?.destination?.id === area.id
          ? 1.1 + Math.sin(time * 2) * 0.05
          : 1,
      );
    });
    routeMesh.visible = arrows.visible = g.phase !== "free" || g.mission === "active";
    if (lastGuidance !== g.guidance) {
      lastGuidance = g.guidance;
      const path = g.guidance?.points || [];
      let d = 0;
      const visible = [];
      for (let i = 0; i < path.length; i++) {
        if (i) d += distance(path[i - 1], path[i]);
        visible.push({ ...path[i], y: (path[i].y || 0) + 0.1 });
        if (d > 260) break;
      }
      routeMesh.geometry.dispose();
      routeMesh.geometry =
        visible.length > 1
          ? stripGeometry(visible, 2)
          : new THREE.BufferGeometry();
      routeMaterial.color.set(g.phase === "free" ? "#8044c7" : "#d08715");
      arrows.material.color.set(g.phase === "free" ? "#643194" : "#a85e08");
      let count = 0,
        run = 0;
      for (let i = 0; i < visible.length - 1 && count < 40; i++) {
        const a = visible[i],
          b = visible[i + 1],
          len = distance(a, b);
        run += len;
        if (run < 13) continue;
        run = 0;
        dummy.position.set(a.x, a.y + 0.09, a.z);
        dummy.rotation.set(0, -Math.atan2(b.x - a.x, -(b.z - a.z)), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        arrows.setMatrixAt(count++, dummy.matrix);
      }
      arrows.count = count;
      arrows.instanceMatrix.needsUpdate = true;
    }
    const p = g.player,
      fx = Math.sin(p.heading),
      fz = -Math.cos(p.heading),
      base = p.y || 0;
    if (g.status === "ready") {
      goal.set(p.x + 11, base + 6.1, p.z + 13);
      look.set(p.x - 1, base + 2, p.z - 15);
    } else if (
      g.mode === "foot" ||
      g.mode === "boarding" ||
      g.mode === "exiting"
    ) {
      goal.set(p.x - fx * 5, base + 3.1, p.z - fz * 5);
      look.set(p.x + fx * 2, base + 1.4, p.z + fz * 2);
    } else if (g.mode === "exploding" || g.explosion) {
      goal.set(p.x - fx * 10, base + 7.2, p.z - fz * 10);
      look.set(p.x, base + 3.4, p.z);
    } else {
      const back = view ? 14 : 6.7;
      goal.set(
        p.x - fx * (back + Math.abs(p.speed) * 0.012),
        base + (view ? 8 : 3.0),
        p.z - fz * (back + Math.abs(p.speed) * 0.012),
      );
      look.set(p.x + fx * 8, base + 1.25, p.z + fz * 8);
    }
    const garage = garages.find((a) => a.contains(p));
    if (garage) {
      goal.set(p.x - fx * 6, base + 3.8, p.z - fz * 6);
      look.set(p.x + fx * 5, base + 1.2, p.z + fz * 5);
    }
    if (punchCameraGame !== g) {
      punchCameraGame = g; lastPunch = null; punchViewUntil = 0;
    }
    const canShowPunch = g.mode === "foot" && !p.reaction &&
      (g.status === "running" || g.status === "paused");
    if (!canShowPunch) punchViewUntil = 0;
    if (canShowPunch && p.attack) {
      if (p.attack !== lastPunch) {
        // Keep the side stable through a combo, with the player and target in profile.
        if (g.elapsed >= punchViewUntil) {
          punchViewHeading = Math.PI - p.attack.heading;
          const right = {x: Math.cos(punchViewHeading), z: Math.sin(punchViewHeading)};
          punchViewSide = segmentBlocked(p, {x:p.x+right.x*4.8,z:p.z+right.z*4.8}, .3, true) ? -1 : 1;
        }
        lastPunch = p.attack;
      }
      punchViewUntil = g.elapsed + .55;
    }
    const punchView = canShowPunch && g.elapsed < punchViewUntil;
    if (punchView) {
      const forwardX = Math.sin(punchViewHeading), forwardZ = -Math.cos(punchViewHeading);
      look.set(p.x + forwardX*.7, base + 1.35, p.z + forwardZ*.7);
      goal.set(look.x + Math.cos(punchViewHeading)*4.8*punchViewSide,
        base + 2.2, look.z + Math.sin(punchViewHeading)*4.8*punchViewSide);
    }
    if (
      g.status !== "ready" && g.status !== "intro" &&
      segmentBlocked(p, { x: goal.x, z: goal.z }, 0.3, true)
    ) {
      for (let t = 0.8; t >= 0.1; t -= 0.1) {
        const x = p.x + (goal.x - p.x) * t,
          z = p.z + (goal.z - p.z) * t;
        if (!segmentBlocked(p, { x, z }, 0.3, true)) {
          goal.set(x, base + 3.5, z);
          break;
        }
      }
    }
    if (g.status === "intro") {
      const ease = t => t*t*t*(t*(t*6-15)+10);
      const orbitT = ease(Math.min(1,g.introElapsed/3.3));
      const angle = orbitT*Math.PI*.9;
      const orbit = new THREE.Vector3(MERLION.x+Math.cos(angle)*20,8.5,MERLION.z+Math.sin(angle)*20);
      const focus = new THREE.Vector3(MERLION.x,4.4,MERLION.z);
      const travel = ease(Math.max(0,Math.min(1,(g.introElapsed-3.3)/3.2)));
      const end = new THREE.Vector3(p.x-fx*5,base+3.1,p.z-fz*5);
      const endLook = new THREE.Vector3(p.x+fx*2,base+1.4,p.z+fz*2);
      goal.copy(orbit).lerp(end,travel);look.copy(focus).lerp(endLook,travel);
      camera.position.copy(goal);currentLook.copy(look);initialized=true;
    }
    patrolVisuals.camera(g,officers,goal,look);
    if (!initialized) {
      camera.position.copy(goal);
      currentLook.copy(look);
      initialized = true;
    }
    camera.position.lerp(goal, 1 - Math.exp(-(punchView ? 22 : g.mode === "driving" ? 9 : 6) * dt));
    currentLook.lerp(look, 1 - Math.exp(-(punchView ? 18 : 9) * dt));
    camera.lookAt(currentLook);
    camera.fov +=
      ((g.mode === "driving" ? (g.boosting ? 74 : 63 + Math.min(6, Math.abs(p.speed) * .12)) : 59) - camera.fov) * (1 - Math.exp(-3 * dt));
    camera.updateProjectionMatrix();
    sun.position.set(p.x - 75, 140, p.z - 60);
    sun.target.position.set(p.x, 0, p.z);
    sun.target.updateMatrixWorld();
    renderer.render(scene, camera);
    rearView.update(g,time);
    if (dt > 0) {
      perf.push(dt);
      if (perf.length > 180) perf.shift();
    }
  }
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
  return {
    update,
    async prepare(g) {
      update(g,0,0);
      await Promise.all([landmarkAssets.ready,cityDetails.ready,environmentAssets.ready,...[...Object.values(actors),...officers,...patrolVisuals.models.values()].map(a=>a.userData.readyPromise),...Array.from(personModels.values()).map(p=>p.userData.readyPromise)]);
      if(environmentAssets.state.error)throw new Error(environmentAssets.state.error);
      if(Array.from(personModels.values()).some(p=>p.userData.loadError))throw new Error("Pedestrians could not load");
      await renderer.compileAsync(scene,camera);
      update(g,0,0);
    },
    renderer,
    camera,
    scene,
    assets: environmentAssets,
    rearView,
    shotAudio,
    resetCamera: () => {
      initialized = false;
    },
    performance: () => ({
      fps: perf.length / perf.reduce((a, b) => a + b, 0),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }),
  };
}
const materials = new Map();
function matCache(color) {
  if (!materials.has(color)) materials.set(color, mat(color));
  return materials.get(color);
}
