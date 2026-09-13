import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS, STREETS, CHECKPOINTS, seededRandom } from './simulation.js';

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, ...options });
const lightMat = (color, intensity = 1.5) => mat(color, { emissive: color, emissiveIntensity: intensity });
function box(parent, x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(boxGeometry, material);
  mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh); return mesh;
}
function texture(path, repeat = 1) {
  const t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/${path}.webp`);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat); t.anisotropy = 4; return t;
}
function labelTexture(text, color = '#67f4df', bg = '#102326') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = color; ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64); const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const key = mesh.material.uuid;
    if (!batches.has(key)) batches.set(key, { material: mesh.material, geometries: [] });
    batches.get(key).geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
  });
  group.clear();
  for (const { material, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries);
    group.add(new THREE.Mesh(merged, material)); geometries.forEach(g => g.dispose());
  }
}
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#142636');
  scene.fog = new THREE.FogExp2('#193440', .0042);
  const camera = new THREE.PerspectiveCamera(59, innerWidth / innerHeight, .1, 900);
  scene.add(new THREE.HemisphereLight('#b9dafa', '#303a42', 2.1));
  const sun = new THREE.DirectionalLight('#ffd7a0', 2.1); sun.position.set(-70, 110, -90); scene.add(sun);
  const fill = new THREE.DirectionalLight('#72c8ed', 1.1); fill.position.set(80, 40, 80); scene.add(fill);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(750, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vPos; void main(){float h=normalize(vPos).y;vec3 c=mix(vec3(.26,.34,.37),vec3(.025,.065,.14),smoothstep(-.03,.65,h));gl_FragColor=vec4(c,1.0);}'
  })); scene.add(sky);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 24), new THREE.MeshBasicMaterial({ color: '#e7e7d1', fog: false }));
  moon.position.set(-280, 210, -520); scene.add(moon);
  const city = new THREE.Group(); scene.add(city);
  const asphalt = mat('#9fabb5', { map: texture('asphalt', 70), roughness: .96 });
  box(city, 0, -.18, 0, 445, .3, 445, asphalt);
  const water = mat('#12333d', { roughness: .3, metalness: .65 });
  box(city, 0, -1.6, 0, 1800, .2, 1800, water);
  const curb = mat('#687781'), sidewalk = mat('#3e505b'), line = mat('#e1c98a'), white = mat('#c2c9c0');
  const dark = mat('#18252d'), warm = lightMat('#ffc178'), teal = lightMat('#68dfd7'), red = lightMat('#ff6254');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = -135 + i * 90, z = -135 + j * 90;
    box(city, x, .13, z, 65, .4, 65, curb); box(city, x, .37, z, 63, .1, 63, sidewalk);
  }
  // Road paint is geometry so it remains crisp against the generated asphalt material.
  for (const s of STREETS) {
    for (let v = -210; v <= 210; v += 12) {
      if (Math.abs(v - STREETS.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a)) < 15) continue;
      box(city, s - .25, .01, v, .15, .025, 5, line); box(city, s + .25, .01, v, .15, .025, 5, line);
      box(city, v, .01, s - .25, 5, .025, .15, line); box(city, v, .01, s + .25, 5, .025, .15, line);
      for (const side of [-1, 1]) {
        box(city, s + side * 11.1, .02, v, .16, .025, 10, white);
        box(city, v, .02, s + side * 11.1, 10, .025, .16, white);
      }
    }
    for (const cross of STREETS) for (let stripe = -8; stripe <= 8; stripe += 2.4) {
      box(city, s + stripe, .035, cross + 10, 1.1, .03, 3, white);
      box(city, s + 10, .035, cross + stripe, 3, .03, 1.1, white);
    }
  }
  const facade = texture('facade');
  const palette = ['#8c9ea3', '#758d9b', '#b0a698', '#688e95', '#8c8893'];
  const facades = palette.map(c => mat(c, { map: facade, emissiveMap: facade, emissive: '#88a9b8', emissiveIntensity: .35, roughness: .55 }));
  const rand = seededRandom(17);
  const signNames = ['NIGHT OWL', 'KOPI 24', 'NORTH QUAY', 'MOTEL', 'ARCADE', 'ASTRA', 'AFTER HOURS', 'PORT 09'];
  BUILDINGS.forEach((b, i) => {
    box(city, b.x, b.h / 2 + .45, b.z, b.w, b.h, b.d, facades[b.color]);
    box(city, b.x, b.h + .65, b.z, b.w + .5, .55, b.d + .5, dark);
    box(city, b.x, b.h + 2, b.z, b.w * .3, 3, b.d * .35, sidewalk);
    box(city, b.x, 1.8, b.z, b.w + .4, 2.8, b.d + .4, dark);
    if (i % 3 === 0) {
      box(city, b.x, b.h * .75, b.z + b.d / 2 + .04, b.w * .83, .19, .1, i % 2 ? teal : warm);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), new THREE.MeshBasicMaterial({ map: labelTexture(signNames[i % 8], i % 2 ? '#78f8e2' : '#ffd49b') }));
      sign.position.set(b.x, 5.4, b.z + b.d / 2 + .3); city.add(sign);
    }
    if (b.h > 48) { box(city, b.x, b.h + 6, b.z, .3, 10, .3, dark); box(city, b.x, b.h + 11, b.z, .6, .7, .6, red); }
  });
  // A distant skyline makes the playable district feel like part of a larger city.
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, r = 320 + rand() * 160, h = 25 + rand() * 115;
    box(city, Math.sin(a) * r, h / 2 - 1, Math.cos(a) * r, 16 + rand() * 22, h, 20, facades[i % 5]);
  }
  // Lamps, low planters, and palm silhouettes along each boulevard.
  const trunk = mat('#6c6960'), leaf = mat('#255c52'), planter = mat('#75827c');
  const leafGeom = new THREE.BufferGeometry();
  const leafVertices = [], leafIndices = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6, w = Math.sin(t * Math.PI) * .8;
    leafVertices.push(-w, Math.sin(t * Math.PI) * .9 - t * 1.25, t * 5,
      w, Math.sin(t * Math.PI) * .9 - t * 1.25, t * 5);
    if (i < 6) { const n = i * 2; leafIndices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  leafGeom.setAttribute('position', new THREE.Float32BufferAttribute(leafVertices, 3)); leafGeom.setIndex(leafIndices); leafGeom.computeVertexNormals();
  leaf.side = THREE.DoubleSide;
  for (const s of STREETS) for (let v = -165; v <= 170; v += 30) {
    if (Math.abs(v - Math.round(v / 90) * 90) < 15) continue;
    for (const side of [-1, 1]) {
      const x = s + side * 13.4;
      box(city, x, 4.5, v, .22, 9, .22, dark);
      box(city, x - side * 1.1, 8.9, v, 2.4, .2, .3, dark);
      box(city, x - side * 2.1, 8.8, v, .9, .15, .6, warm);
      const palmX = s + side * 15.3, palmZ = v + 10;
      box(city, palmX, .7, palmZ, 2.6, 1.2, 2.6, planter);
      box(city, palmX, 4.2, palmZ, .5, 7.8, .5, trunk);
      for (let l = 0; l < 6; l++) {
        const a = l * Math.PI / 3;
        const mesh = new THREE.Mesh(leafGeom, leaf); mesh.position.set(palmX, 8.3, palmZ);
        mesh.rotation.y = a; city.add(mesh);
      }
    }
  }
  for (const side of [-1, 1]) {
    box(city, side * 222, .6, 0, 1, 1.5, 446, curb); box(city, 0, .6, side * 222, 446, 1.5, 1, curb);
    for (let v = -216; v <= 216; v += 12) {
      box(city, side * 222, 1.45, v, .5, .18, 4, teal); box(city, v, 1.45, side * 222, 4, .18, .5, teal);
    }
  }
  mergeStatic(city);
  const gate = new THREE.Group(); scene.add(gate);
  box(gate, -11, 4.5, 0, .38, 9, .38, teal); box(gate, 11, 4.5, 0, .38, 9, .38, teal);
  box(gate, 0, 9, 0, 22, .3, .3, teal);
  box(gate, 0, .09, 0, 22, .08, 2.8, new THREE.MeshBasicMaterial({ color: '#64ebd2', transparent: true, opacity: .35 }));
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75), new THREE.MeshBasicMaterial({ map: labelTexture('CHECKPOINT'), side: THREE.DoubleSide }));
  gateSign.position.y = 8.1; gate.add(gateSign);
  const pillarMat = new THREE.MeshBasicMaterial({ color: '#6ef7d9', transparent: true, opacity: .045, depthWrite: false });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 90, 24, 1, true), pillarMat); pillar.position.y = 45; gate.add(pillar);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,.6)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); const glowMap = new THREE.CanvasTexture(glowCanvas);
  const paintMap = texture('vehicle');
  function makeCar(color = '#e8e6d6', police = false, player = false) {
    const car = new THREE.Group();
    const paint = mat(color, { map: paintMap, roughness: .36, metalness: .30 });
    const glass = mat('#0e2835', { roughness: .2, metalness: .55 });
    const rubber = mat('#10191e'), chrome = mat('#8ea9ae', { metalness: .8, roughness: .25 });
    box(car, 0, .66, 0, 2.25, .62, 4.75, police ? dark : paint);
    box(car, 0, .91, -.1, 2.22, .28, 4.55, paint);
    const cabin = new THREE.BoxGeometry(1, 1, 1);
    const positions = cabin.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const top = positions.getY(i) > 0;
      positions.setXYZ(i, positions.getX(i) * (top ? 1.68 : 1.94), top ? 1.57 : 1.04,
        positions.getZ(i) * (top ? 1.44 : 2.74) + .2);
    }
    cabin.computeVertexNormals(); car.add(new THREE.Mesh(cabin, glass));
    box(car, 0, 1.6, .2, 1.73, .09, 1.48, paint);
    for (const side of [-1, 1]) {
      const pillar = box(car, side * .90, 1.29, .20, .065, .58, .075, paint); pillar.rotation.z = side * .22;
    }
    box(car, 0, 1.02, -1.65, 2.12, .14, 1.25, paint);
    box(car, 0, .49, -2.40, 2.15, .19, .10, dark); box(car, 0, .50, 2.4, 2.15, .23, .13, dark);
    for (const side of [-1, 1]) {
      box(car, side * .79, .81, -2.37, .51, .18, .06, lightMat('#f9edc0', 2.5));
      box(car, side * .76, .86, 2.37, .63, .17, .06, red);
      box(car, side * 1.21, 1.18, -.65, .27, .15, .34, paint);
      box(car, side * 1.126, .75, .1, .02, .035, 3.9, dark);
      for (const z of [-1.42, 1.46]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, .3, 12), rubber);
        wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 1.11, .43, z); car.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .32, 8), chrome);
        hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); car.add(hub);
      }
    }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(.62, .16), new THREE.MeshBasicMaterial({ map: labelTexture(police ? 'POLICE' : 'MIDNIGHT', '#14222c', '#d5d5bf') }));
    plate.rotation.y = Math.PI; plate.position.set(0, .71, 2.46); car.add(plate);
    box(car, 0, 1.14, 2.04, 2.35, .08, .37, police ? dark : paint);
    // Batch each vehicle's fixed pieces; lights and boost flames stay independently animated.
    mergeStatic(car);
    const lights = [];
    if (police) {
      box(car, 0, 1.77, .28, 1.5, .12, .35, dark);
      for (const side of [-1, 1]) {
        const m = lightMat(side === 1 ? '#3b91ff' : '#ff314d', 4);
        lights.push(box(car, side * .46, 1.88, .28, .65, .15, .32, m));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: side === 1 ? '#278bff' : '#ff1749', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.position.set(side * .46, 1.91, .28); glow.scale.set(3.2, 3.2, 1); car.add(glow); lights.push(glow);
      }
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 6.1), new THREE.MeshBasicMaterial({ map: glowMap, color: '#000000', transparent: true, opacity: .85, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .055; car.add(shadow);
    const underglow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.5), new THREE.MeshBasicMaterial({ map: glowMap, color: player ? '#4de8dc' : '#e8c89e', transparent: true, opacity: player ? .65 : .15, blending: THREE.AdditiveBlending, depthWrite: false }));
    underglow.rotation.x = -Math.PI / 2; underglow.position.y = .065; car.add(underglow);
    const flames = [];
    if (player) for (const x of [-.75, .75]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(.17, 1.6, 6), lightMat('#68dfff', 4));
      flame.rotation.x = Math.PI / 2; flame.position.set(x, .5, 3.05); flame.visible = false; car.add(flame); flames.push(flame);
    }
    scene.add(car); return { mesh: car, lights, flames };
  }
  const playerCar = makeCar('#efead5', false, true);
  const policeCars = Array.from({ length: 3 }, () => makeCar('#e2e6df', true));
  const trafficCars = [];
  const colors = ['#d27b58', '#77a6b2', '#b8b9ac', '#b6a068', '#527f78', '#958796'];
  let cameraInitialized = false;
  const goalPos = new THREE.Vector3(), look = new THREE.Vector3(), currentLook = new THREE.Vector3();
  function update(g, dt, time, view = 0) {
    while (trafficCars.length < g.traffic.length) trafficCars.push(makeCar(colors[trafficCars.length % colors.length]));
    function sync(model, body) {
      model.mesh.position.set(body.x, .015, body.z); model.mesh.rotation.y = -body.heading;
      model.mesh.rotation.z = -(body.steer || 0) * Math.min(Math.abs(body.speed) / 35, 1) * .035;
    }
    sync(playerCar, g.player); g.police.forEach((c, i) => sync(policeCars[i], c)); g.traffic.forEach((t, i) => sync(trafficCars[i], t));
    policeCars.forEach((c, i) => c.lights.forEach((l, j) => { l.visible = Math.sin(time * 15 + i + (j < 2 ? 0 : Math.PI)) > 0; }));
    playerCar.flames.forEach(f => { f.visible = g.boosting; f.scale.y = 1 + Math.sin(time * 50) * .2; });
    const cp = CHECKPOINTS[g.checkpoint]; gate.visible = !!cp;
    if (cp) { gate.position.set(cp.x, 0, cp.z); gate.rotation.y = cp.axis === 'x' ? Math.PI / 2 : 0; pillarMat.opacity = .04 + Math.sin(time * 2) * .015; }
    const p = g.player, fx = Math.sin(p.heading), fz = -Math.cos(p.heading);
    if (g.status === 'ready') {
      goalPos.set(p.x + 10 + Math.sin(time * .13) * 1.5, 5.3, p.z + 11);
      look.set(p.x - 3, 1.3, p.z - 12);
    } else {
      const back = view === 1 ? 19 : 11.5, height = view === 1 ? 12 : 6.1;
      goalPos.set(p.x - fx * (back + Math.abs(p.speed) * .035), height, p.z - fz * (back + Math.abs(p.speed) * .035));
      look.set(p.x + fx * 7, 1.2, p.z + fz * 7);
      // Avoid a follow camera hiding inside buildings after a tight corner.
      for (const b of BUILDINGS) if (Math.abs(goalPos.x - b.x) < b.w / 2 + 1 && Math.abs(goalPos.z - b.z) < b.d / 2 + 1) {
        goalPos.x = p.x - fx * 4; goalPos.z = p.z - fz * 4; goalPos.y = 9;
      }
    }
    if (!cameraInitialized) { camera.position.copy(goalPos); currentLook.copy(look); cameraInitialized = true; }
    camera.position.lerp(goalPos, 1 - Math.exp(-6 * dt)); currentLook.lerp(look, 1 - Math.exp(-9 * dt));
    camera.lookAt(currentLook); camera.fov += ((g.boosting ? 67 : 59) - camera.fov) * (1 - Math.exp(-3 * dt)); camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize);
  return { update, renderer, camera, scene, resetCamera: () => { cameraInitialized = false; } };
}
