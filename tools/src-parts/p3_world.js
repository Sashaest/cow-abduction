
/* =====================================================================
   4. THREE.JS SETUP & MONDO
   ===================================================================== */
const container = $('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);
function applyQuality() { renderer.setPixelRatio(S.settings.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : 1); }
applyQuality();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 420);
const SKY = new THREE.Color(0x060818);
scene.background = SKY.clone();
scene.fog = new THREE.Fog(0x070a1c, 30, 170);

/* --- Bloom selettivo (solo luci molto intense: neon, fari, raggio) --- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.4, 0.86);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
const bloomOn = () => S.settings.quality === 'high';
function doRender() { if (bloomOn()) composer.render(); else renderer.render(scene, camera); }
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h;
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  bloomPass.resolution.set(w / 2, h / 2);
  // In verticale allarghiamo il FOV per vedere tutte e 3 le corsie
  camera.fov = w / h < 0.8 ? 74 : 62;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

/* --- Environment map procedurale (riflessi sui metalli) --- */
(function buildEnv() {
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: 0x0b1030, side: THREE.BackSide })));
  const panel = (c, x, y, z, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  panel(0xaabbff, 0, 15, 0, 14); panel(0x00ff88, 15, 2, 0, 6); panel(0xff2bd6, -15, 2, 0, 6); panel(0xffd9a0, 0, 3, -15, 8); panel(0x22e6ff, 0, 3, 15, 6);
  scene.environment = pm.fromScene(es, 0.04).texture;
  pm.dispose();
})();

/* --- Luci: luna bluastra + emisferica --- */
const hemi = new THREE.HemisphereLight(0x4a5aa0, 0x0a0a14, 0.75);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0x9fb8ff, 1.1);
moonLight.position.set(-30, 50, -20); scene.add(moonLight);
const HEMI_SKY = new THREE.Color(0x4a5aa0), PANIC_RED = new THREE.Color(0xff1030);

/* --- Texture procedurali --- */
function canvasTex(w, h, draw, repeatY = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, repeatY);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;

/* --- Strada a 3 corsie con segnaletica riflettente --- */
const ROAD_W = 11, ROAD_L = 360, ROAD_TILE = 10;
const roadLines = (g, w, h, linesOnly) => {
  if (!linesOnly) {
    g.fillStyle = '#1a1c24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 20 + Math.random() * 30; g.fillStyle = `rgb(${v},${v},${v + 6})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#121318'; g.fillRect(0, 0, w * 0.045, h); g.fillRect(w * 0.955, 0, w * 0.045, h); // banchine
  } else { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
  const ux = (x) => (x + ROAD_W / 2) / ROAD_W * w;
  g.fillStyle = '#f2f2f2';
  [-1.5, 1.5].forEach(x => g.fillRect(ux(x) - 3, h * 0.1, 6, h * 0.42)); // tratteggio
  g.fillStyle = '#ffd23f';
  [-4.5, 4.5].forEach(x => g.fillRect(ux(x) - 3, 0, 6, h));             // bordi continui
};
const roadTex = canvasTex(256, 256, (g, w, h) => roadLines(g, w, h, false), ROAD_L / ROAD_TILE);
const roadEmi = canvasTex(256, 256, (g, w, h) => roadLines(g, w, h, true), ROAD_L / ROAD_TILE);
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, emissiveMap: roadEmi, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.55, metalness: 0.15 });
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_L), roadMat);
road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 20 - ROAD_L / 2); scene.add(road);

const grassTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#08140c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? '#0d2414' : '#0a1a10'; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
}, ROAD_L / 8);
grassTex.repeat.x = 25;
const grass = new THREE.Mesh(new THREE.PlaneGeometry(200, ROAD_L), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.03, 20 - ROAD_L / 2); scene.add(grass);

/* --- Luna e stelle --- */
const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0x9aa6c4, fog: false }));
moon.position.set(-60, 70, -300); scene.add(moon);
const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8fb0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
moonGlow.scale.set(60, 60, 1); moonGlow.position.copy(moon.position); scene.add(moonGlow);
{
  const N = 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45; const r = 380; pos.set([Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r * 0.6 + 10, Math.sin(th) * Math.sin(ph) * r - 120], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
}

/* --- Elementi a bordo strada che scorrono (lampioni, alberi, recinzione) --- */
const SPAN = 360; // lunghezza del ciclo di riciclo
const recycle = (z) => (z > 22 ? z - SPAN : z);
const LAMP_COLOR = new THREE.Color(0xffc97a);
const lampMats = {
  head: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: LAMP_COLOR.clone(), emissiveIntensity: 1.5 }),
  cone: new THREE.MeshBasicMaterial({ color: LAMP_COLOR.clone(), transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  pool: new THREE.MeshBasicMaterial({ color: LAMP_COLOR.clone(), map: glowTex, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
  pole: new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.7, roughness: 0.4 }),
};
const lamps = [];
{
  const poleG = new THREE.CylinderGeometry(0.09, 0.12, 7, 8), armG = new THREE.BoxGeometry(2.2, 0.1, 0.1), headG = new THREE.BoxGeometry(0.7, 0.18, 0.35);
  const coneG = new THREE.ConeGeometry(2.8, 6.8, 20, 1, true), poolG = new THREE.PlaneGeometry(7, 7);
  for (let i = 0; i < 20; i++) {
    const side = i % 2 ? 1 : -1, g = new THREE.Group();
    const pole = new THREE.Mesh(poleG, lampMats.pole); pole.position.set(side * 6.2, 3.5, 0);
    const arm = new THREE.Mesh(armG, lampMats.pole); arm.position.set(side * 5.2, 6.95, 0);
    const head = new THREE.Mesh(headG, lampMats.head); head.position.set(side * 4.3, 6.85, 0);
    const cone = new THREE.Mesh(coneG, lampMats.cone); cone.position.set(side * 4.3, 3.45, 0);
    const pool = new THREE.Mesh(poolG, lampMats.pool); pool.rotation.x = -Math.PI / 2; pool.position.set(side * 4.0, 0.03, 0);
    g.add(pole, arm, head, cone, pool);
    g.position.z = 20 - Math.floor(i / 2) * 36 - (side > 0 ? 18 : 0);
    scene.add(g); lamps.push(g);
  }
}
const TREE_N = 110;
const treeFol = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 4.2, 6), new THREE.MeshStandardMaterial({ color: 0x0f3a24, flatShading: true, roughness: 0.9 }), TREE_N);
const treeFol2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 3, 6), new THREE.MeshStandardMaterial({ color: 0x15502f, flatShading: true, roughness: 0.9 }), TREE_N);
const treeTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 5), new THREE.MeshStandardMaterial({ color: 0x3a2516 }), TREE_N);
scene.add(treeFol, treeFol2, treeTrunk);
const trees = [];
for (let i = 0; i < TREE_N; i++) { const side = i % 2 ? 1 : -1; trees.push({ x: side * rand(8.5, 40), z: 20 - Math.random() * SPAN, s: rand(0.8, 1.6), r: Math.random() * 6 }); }
const FENCE_N = 240;
const fencePosts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }), FENCE_N);
scene.add(fencePosts);
const fenceZ = []; for (let i = 0; i < FENCE_N; i++) fenceZ.push(20 - Math.floor(i / 2) * 3);
{ // traverse (uniformi lungo Z: statiche)
  const railM = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  [-7.2, 7.2].forEach(x => [0.5, 0.95].forEach(y => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, SPAN), railM); r.position.set(x, y, 20 - SPAN / 2); scene.add(r); }));
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function updateInstances() {
  for (let i = 0; i < TREE_N; i++) {
    const t = trees[i]; _e.set(0, t.r, 0); _q.setFromEuler(_e);
    _s.set(t.s, t.s, t.s); _v.set(t.x, 1.6 * t.s + 2.1 * t.s, t.z); _m4.compose(_v, _q, _s); treeFol.setMatrixAt(i, _m4);
    _v.set(t.x, 1.6 * t.s + 3.6 * t.s, t.z); _m4.compose(_v, _q, _s); treeFol2.setMatrixAt(i, _m4);
    _v.set(t.x, 0.8 * t.s, t.z); _m4.compose(_v, _q, _s); treeTrunk.setMatrixAt(i, _m4);
  }
  treeFol.instanceMatrix.needsUpdate = treeFol2.instanceMatrix.needsUpdate = treeTrunk.instanceMatrix.needsUpdate = true;
  _q.identity(); _s.set(1, 1, 1);
  for (let i = 0; i < FENCE_N; i++) { _v.set(i % 2 ? 7.2 : -7.2, 0.55, fenceZ[i]); _m4.compose(_v, _q, _s); fencePosts.setMatrixAt(i, _m4); }
  fencePosts.instanceMatrix.needsUpdate = true;
}
/* Scorrimento dell'ambiente: dz = metri percorsi in questo frame */
function scrollWorld(dz) {
  roadTex.offset.y += dz / ROAD_TILE; roadEmi.offset.y = roadTex.offset.y;
  grassTex.offset.y += dz / 8;
  for (const l of lamps) { l.position.z += dz; if (l.position.z > 22) l.position.z -= SPAN; l.children[3].visible = l.position.z < -3; }
  for (const t of trees) { t.z = recycle(t.z + dz); }
  for (let i = 0; i < FENCE_N; i++) fenceZ[i] = recycle(fenceZ[i] + dz);
  updateInstances();
}
updateInstances();

/* --- Meteo: pioggia (LineSegments), fulmini, nebbia --- */
const RAIN_N = 700;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6);
for (let i = 0; i < RAIN_N; i++) { const x = rand(-30, 30), y = rand(0, 30), z = rand(-90, 15); rainPos.set([x, y, z, x + 0.1, y + 1.2, z - 0.3], i * 6); }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.35 }));
rain.visible = false; scene.add(rain);
function updateRain(dt, dz) {
  const p = rainPos;
  for (let i = 0; i < RAIN_N; i++) {
    const o = i * 6; const dy = 38 * dt;
    p[o + 1] -= dy; p[o + 4] -= dy; p[o + 2] += dz; p[o + 5] += dz;
    if (p[o + 1] < 0 || p[o + 2] > 15) { const x = rand(-30, 30), y = rand(18, 30), z = rand(-90, 10); p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x + 0.1; p[o + 4] = y + 1.2; p[o + 5] = z - 0.3; }
  }
  rainGeo.attributes.position.needsUpdate = true;
}
const boltMat = new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 1 });
const bolt = new THREE.Line(new THREE.BufferGeometry(), boltMat); bolt.visible = false; scene.add(bolt);
const flashLight = new THREE.PointLight(0xcfe0ff, 0, 80, 1); flashLight.position.set(0, 25, -10); scene.add(flashLight);
function makeBolt(x, z) {
  const pts = []; let px = x + rand(-6, 6), py = 45, pz = z - 20;
  pts.push(new THREE.Vector3(px, py, pz));
  for (let i = 1; i <= 14; i++) { const t = i / 14; px = lerp(px, x, 0.3) + rand(-1.2, 1.2) * (1 - t); py = lerp(45, 0, t); pz = lerp(z - 20, z, t) + rand(-0.8, 0.8); pts.push(new THREE.Vector3(px, py, pz)); }
  pts[pts.length - 1].set(x, 0, z);
  bolt.geometry.dispose(); bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts); bolt.visible = true; boltMat.opacity = 1;
}
/* Anelli di avviso a terra (fulmini e meteore) */
const warnGeo = new THREE.RingGeometry(1.1, 1.6, 32);
function makeWarning(color) {
  const m = new THREE.Mesh(warnGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05; scene.add(m); return m;
}

/* =====================================================================
   5. MODELLI 3D
   ===================================================================== */
const M = { // materiali condivisi
  glass: new THREE.MeshStandardMaterial({ color: 0x0a1018, metalness: 0.9, roughness: 0.1 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.9 }),
  headlight: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffbe8, emissiveIntensity: 4 }),
  taillight: new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff1020, emissiveIntensity: 4 }),
  beamCone: new THREE.MeshBasicMaterial({ color: 0xfff6dd, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  headPool: new THREE.MeshBasicMaterial({ color: 0xfff6dd, map: glowTex, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
  pink: new THREE.MeshStandardMaterial({ color: 0xff9db0, roughness: 0.7 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.7 }),
  horn: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc933, metalness: 1, roughness: 0.22, emissive: 0x6a4500, emissiveIntensity: 0.6 }),
  cyborg: new THREE.MeshStandardMaterial({ color: 0x8a93a3, metalness: 0.85, roughness: 0.3 }),
  cyborgPanel: new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.7, roughness: 0.4 }),
  laser: new THREE.MeshStandardMaterial({ color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 5 }),
  laserBeam: new THREE.MeshBasicMaterial({ color: 0xff1040, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
  bull: new THREE.MeshStandardMaterial({ color: 0x5a3218, roughness: 0.8 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.9, flatShading: true, emissive: 0xff4400, emissiveIntensity: 0.6 }),
  fire: new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 3, flatShading: true }),
};
const G_ = { // geometrie condivise
  box: new THREE.BoxGeometry(1, 1, 1),
  wheel: new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2),
  cone: new THREE.ConeGeometry(1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  headCone: new THREE.ConeGeometry(1.5, 10, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 5),
  pool: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};
function bx(mat, w, h, d, x, y, z, parent) { const m = new THREE.Mesh(G_.box, mat); m.scale.set(w, h, d); m.position.set(x, y, z); parent && parent.add(m); return m; }
function glowSprite(color, size, opacity = 0.8) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; }

/* ---------- UFO del giocatore (con skin) ---------- */
const saucerProfile = (k = 1) => [[0, -0.38], [0.9, -0.34], [1.6, -0.12], [1.85 * k, 0.02], [1.65, 0.16], [1.05, 0.32], [0, 0.38]].map(p => new THREE.Vector2(p[0], p[1]));
function buildUFOProc(skinId) {
  const sk = UFO_SKINS[skinId] || UFO_SKINS.classic;
  const g = new THREE.Group(); const leds = [];
  const bodyMat = new THREE.MeshStandardMaterial({ color: sk.body, metalness: sk.metal ? 1 : 0.85, roughness: sk.metal ? 0.18 : 0.28 });
  const domeMat = new THREE.MeshStandardMaterial({ color: sk.dome, transparent: true, opacity: 0.55, metalness: 0.2, roughness: 0.05, emissive: sk.dome, emissiveIntensity: 0.25 });
  let ledR = 1.82, ledY = 0.02, ledCount = 22;
  if (sk.shape === 'cube') {
    const body = bx(bodyMat, 2.3, 0.8, 2.3, 0, 0, 0, g); body.rotation.y = Math.PI / 4;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.3, 0.8, 2.3)), new THREE.LineBasicMaterial({ color: sk.led }));
    edges.rotation.y = Math.PI / 4; g.add(edges);
    const top = bx(domeMat, 1.1, 0.7, 1.1, 0, 0.75, 0, g); top.rotation.y = Math.PI / 4;
    ledR = 1.65; ledCount = 16; ledY = -0.42;
  } else {
    const body = new THREE.Mesh(new THREE.LatheGeometry(saucerProfile(sk.shape === 'retro' ? 1.08 : 1), 48), bodyMat); g.add(body);
    const dome = new THREE.Mesh(sk.shape === 'prism' ? new THREE.IcosahedronGeometry(0.9, 0) : new THREE.SphereGeometry(0.88, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.34; g.add(dome);
    // Pilota alieno nella cupola
    const alien = new THREE.Mesh(G_.sphere, new THREE.MeshStandardMaterial({ color: 0x6dff7a, roughness: 0.5, emissive: 0x0a3a10 })); alien.scale.setScalar(0.3); alien.position.y = 0.58; g.add(alien);
    [-0.11, 0.11].forEach(x => { const e = new THREE.Mesh(G_.sphere, M.black); e.scale.set(0.07, 0.1, 0.05); e.position.set(x, 0.62, 0.26); g.add(e); });
    if (sk.shape === 'retro') {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 8, 48), new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff1133, emissiveIntensity: 1 })); stripe.rotation.x = Math.PI / 2; stripe.position.y = 0.12; g.add(stripe);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7), bodyMat); ant.position.y = 1.5; g.add(ant);
      const ball = new THREE.Mesh(G_.sphere, M.laser); ball.scale.setScalar(0.09); ball.position.y = 1.88; g.add(ball);
      [0, 2.09, 4.18].forEach(a => { const leg = new THREE.Mesh(G_.sphere, bodyMat); leg.scale.setScalar(0.18); leg.position.set(Math.cos(a) * 0.9, -0.42, Math.sin(a) * 0.9); g.add(leg); });
    }
    if (sk.shape === 'queen') {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const c = new THREE.Mesh(G_.cone, M.gold); c.scale.set(0.12, 0.45, 0.12); c.position.set(Math.cos(a) * 0.8, 0.55, Math.sin(a) * 0.8); g.add(c); }
    }
  }
  const ledGeo = new THREE.SphereGeometry(0.085, 8, 6);
  for (let i = 0; i < ledCount; i++) {
    const a = i / ledCount * Math.PI * 2;
    const m = new THREE.Mesh(ledGeo, new THREE.MeshStandardMaterial({ color: sk.led, emissive: sk.led, emissiveIntensity: 3 }));
    m.position.set(Math.cos(a) * ledR, ledY, Math.sin(a) * ledR); g.add(m); leds.push(m);
  }
  const under = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 40), new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 2.5 }));
  under.rotation.x = Math.PI / 2; under.position.y = -0.36; g.add(under);
  const halo = glowSprite(sk.led, 5, 0.25); halo.position.y = -0.3; g.add(halo);
  return { group: g, leds, sk, under };
}

/* ---------- Raggio rapitore: shader additivo verde neon #00FF88 ---------- */
const beamMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x00ff88) }, uI: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uI; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ float fres=1.0-abs(dot(vN,vV)); float bands=0.55+0.45*sin(vUv.y*34.0+uTime*10.0);
      float fade=smoothstep(0.0,0.15,vUv.y)*smoothstep(1.0,0.75,vUv.y)*0.6+0.4*smoothstep(0.0,0.1,vUv.y);
      float a=(0.07+0.5*pow(fres,1.6))*bands*fade*uI; gl_FragColor=vec4(uColor*(1.2+fres),a); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const beamGeo = new THREE.CylinderGeometry(0.8, 1.7, 1, 36, 1, true).translate(0, -0.5, 0);
const beam = new THREE.Mesh(beamGeo, beamMat); beam.visible = false; scene.add(beam);
const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 1, 16, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: 0x9fffd0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
beam.add(beamCore);
const beamPool = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00ff88, map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
beamPool.position.y = 0.04; scene.add(beamPool);
const beamLight = new THREE.PointLight(0x00ff88, 0, 9, 1); scene.add(beamLight);

/* ---------- Particelle di energia a spirale (THREE.Points) ---------- */
const PART_N = 280;
const partGeo = new THREE.BufferGeometry();
const partPos = new Float32Array(PART_N * 3);
const partData = []; for (let i = 0; i < PART_N; i++) partData.push({ a: Math.random() * 6.28, h: Math.random(), sp: rand(0.35, 0.8), r: rand(0.6, 1.6) });
partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
const particles = new THREE.Points(partGeo, new THREE.PointsMaterial({ color: 0x7dffc0, size: 0.22, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
particles.visible = false; scene.add(particles);
function updateParticles(dt, height, boost) {
  for (let i = 0; i < PART_N; i++) {
    const p = partData[i];
    p.h += p.sp * dt * (1 + boost * 1.5); p.a += dt * (2.5 + p.h * 4) * (1 + boost);
    if (p.h > 1) { p.h = 0; p.r = rand(0.7, 1.7); }
    const r = p.r * (1 - p.h * 0.75);
    partPos[i * 3] = Math.cos(p.a) * r; partPos[i * 3 + 1] = p.h * height; partPos[i * 3 + 2] = Math.sin(p.a) * r;
  }
  partGeo.attributes.position.needsUpdate = true;
}

/* Scia luminosa (Close Call) */
const trail = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 14).rotateX(-Math.PI / 2).translate(0, 0, 7), new THREE.MeshBasicMaterial({ color: 0x22e6ff, map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scene.add(trail);
/* Bolla scudo */
const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 16), new THREE.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(shieldBubble);

/* ---------- Mucche ---------- */
const cowMatCache = {};
function cowMat(color, metal = false, emissive = 0x000000) {
  const k = `${color}_${metal}_${emissive}`;
  return cowMatCache[k] || (cowMatCache[k] = new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.25 : 0.75, metalness: metal ? 0.9 : 0, emissive, emissiveIntensity: emissive ? 1.2 : 0 }));
}
function buildCowProc(type) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  let bodyMat, spotMat, acc = null;
  if (type === 'golden') { bodyMat = M.gold; spotMat = cowMat(0xfff3b0, true); }
  else if (type === 'cyborg') { bodyMat = M.cyborg; spotMat = M.cyborgPanel; }
  else if (type === 'bull') { bodyMat = M.bull; spotMat = cowMat(0x2a160a); }
  else { const sk = COW_SKINS[S.cowSkin] || COW_SKINS.standard; bodyMat = cowMat(sk.body, !!sk.metal); spotMat = cowMat(sk.spot, false, sk.glow || 0); acc = sk.acc; }
  bx(bodyMat, 1.0, 0.8, 1.6, 0, 1.0, 0, body);
  const legs = [];
  [[-0.33, 0.58], [0.33, 0.58], [-0.33, -0.58], [0.33, -0.58]].forEach(([x, z]) => legs.push(bx(bodyMat, 0.2, 0.7, 0.2, x, 0.35, z, body)));
  [[0.505, 1.05, 0.2, 0.02, 0.4, 0.5], [-0.505, 0.95, -0.3, 0.02, 0.35, 0.45], [0.2, 1.405, -0.3, 0.4, 0.02, 0.5], [-0.505, 1.15, 0.45, 0.02, 0.3, 0.3]]
    .forEach(([x, y, z, w, h, d]) => bx(spotMat, w, h, d, x, y, z, body));
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.85); body.add(head);
  bx(bodyMat, 0.62, 0.58, 0.62, 0, 0.05, 0.1, head);
  bx(type === 'cyborg' ? M.cyborgPanel : M.pink, 0.52, 0.3, 0.22, 0, -0.08, 0.48, head);
  const hornMat = type === 'golden' ? M.gold : M.horn;
  const hornS = type === 'bull' ? [0.09, 0.55] : [0.06, 0.22];
  [-1, 1].forEach(s => { const h = new THREE.Mesh(G_.cone, hornMat); h.scale.set(hornS[0], hornS[1], hornS[0]); h.position.set(s * 0.24, 0.42, 0.05); h.rotation.z = -s * (type === 'bull' ? 1.1 : 0.4); head.add(h); bx(bodyMat, 0.22, 0.1, 0.12, s * 0.38, 0.18, 0.02, head); });
  if (type !== 'cyborg') [-1, 1].forEach(s => bx(type === 'bull' ? M.laser : M.black, 0.08, 0.1, 0.04, s * 0.17, 0.16, 0.42, head));
  bx(M.pink, 0.45, 0.18, 0.4, 0, 0.55, -0.35, body); // mammella
  const tail = bx(bodyMat, 0.07, 0.6, 0.07, 0, 0.95, -0.82, body); tail.rotation.x = 0.3;
  const parts = { body, head, legs, tail, extra: [] };
  if (type === 'golden') { const h = glowSprite(0xffd23f, 4.2, 0.55); h.position.y = 1.1; g.add(h); parts.extra.push(h); }
  if (type === 'cyborg') {
    bx(M.laser, 0.66, 0.13, 0.1, 0, 0.16, 0.42, head);
    const ant = bx(M.cyborgPanel, 0.04, 0.4, 0.04, 0.2, 0.5, -0.1, head); ant.rotation.z = 0.3;
    const bulb = new THREE.Mesh(G_.sphere, M.laser); bulb.scale.setScalar(0.06); bulb.position.set(0.26, 0.72, -0.1); head.add(bulb);
    [-0.17, 0.17].forEach(x => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 5).rotateX(Math.PI / 2).translate(0, 0, 1.6), M.laserBeam); l.position.set(x, 0.16, 0.45); head.add(l); parts.extra.push(l); });
    const red = glowSprite(0xff0033, 2.2, 0.5); red.position.set(0, 1.4, 1); g.add(red);
  }
  if (type === 'bull') { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), M.gold); ring.position.set(0, -0.2, 0.6); head.add(ring); }
  // Accessori delle skin (incroci genetici)
  if (acc === 'tophat') { bx(M.black, 0.42, 0.04, 0.42, 0, 0.36, 0.08, head); bx(M.black, 0.28, 0.38, 0.28, 0, 0.56, 0.08, head); const mono = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 16), M.gold); mono.position.set(0.17, 0.16, 0.44); head.add(mono); }
  if (acc === 'visor') bx(cowMat(0x22e6ff, false, 0x22e6ff), 0.66, 0.12, 0.1, 0, 0.16, 0.42, head);
  if (acc === 'bandage') { bx(M.white, 1.04, 0.12, 1.64, 0, 1.15, 0, body); bx(M.white, 1.04, 0.1, 1.64, 0, 0.85, 0, body); bx(M.white, 0.66, 0.1, 0.66, 0, 0.25, 0.1, head); }
  if (acc === 'afro') { const a = new THREE.Mesh(G_.sphere, cowMat(0x8a2be2, true)); a.scale.setScalar(0.42); a.position.set(0, 0.45, 0); head.add(a); }
  if (acc === 'helmet') { const h = new THREE.Mesh(G_.sphere, new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.35, roughness: 0.05 })); h.scale.setScalar(0.55); h.position.set(0, 0.05, 0.12); head.add(h); }
  if (acc === 'pirate') { bx(M.black, 0.66, 0.16, 0.5, 0, 0.42, 0.05, head); bx(M.black, 0.12, 0.12, 0.04, 0.17, 0.16, 0.45, head); }
  if (acc === 'horn') { const h = new THREE.Mesh(G_.cone, M.gold); h.scale.set(0.07, 0.45, 0.07); h.position.set(0, 0.5, 0.3); h.rotation.x = 0.4; head.add(h); }
  g.scale.setScalar(0.92);
  return { group: g, parts };
}

/* ---------- Veicoli: auto, camion, trattori ---------- */
const CAR_COLORS = [0xc0392b, 0x2e86de, 0xf1c40f, 0xecf0f1, 0x27ae60, 0x8e44ad, 0xe67e22, 0x34495e, 0x16a085];
const vMatCache = {};
const vMat = (c) => vMatCache[c] || (vMatCache[c] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.35 }));
function addLights(g, w, front, back, hy, withBeams, boxes = true) {
  if (boxes) [-1, 1].forEach(s => { bx(M.headlight, 0.36, 0.18, 0.06, s * (w / 2 - 0.3), hy, front, g); bx(M.taillight, 0.36, 0.16, 0.06, s * (w / 2 - 0.3), hy, back, g); });
  const tg = glowSprite(0xff1020, 1.6, 0.7); tg.position.set(0, hy, back - 0.1); g.add(tg);
  const hg = glowSprite(0xfff6dd, 2.2, 0.6); hg.position.set(0, hy, front + 0.15); g.add(hg);
  if (withBeams) {
    const cone = new THREE.Mesh(G_.headCone, M.beamCone); cone.position.set(0, hy, front); g.add(cone);
    const pool = new THREE.Mesh(G_.pool, M.headPool); pool.scale.set(4, 1, 9); pool.position.set(0, 0.04 - 0, front + 5); g.add(pool);
  }
}
function buildVehicleProc(kind, oncoming) {
  const g = new THREE.Group(); let len, w, h;
  if (kind === 'car') {
    const col = vMat(pick(CAR_COLORS)); len = 3.8; w = 1.8; h = 1.5;
    bx(col, w, 0.65, len, 0, 0.6, 0, g); bx(M.glass, 1.55, 0.55, 1.9, 0, 1.2, -0.2, g); bx(col, 1.6, 0.06, 1.7, 0, 1.49, -0.2, g);
    [[-0.9, 1.2], [0.9, 1.2], [-0.9, -1.2], [0.9, -1.2]].forEach(([x, z]) => { const wh = new THREE.Mesh(G_.wheel, M.tire); wh.scale.set(0.3, 0.36, 0.36); wh.position.set(x, 0.36, z); g.add(wh); });
    addLights(g, w, len / 2 + 0.01, -len / 2 - 0.01, 0.7, true);
  } else if (kind === 'truck') {
    const cab = vMat(pick([0xd35400, 0x2c3e50, 0xc0392b, 0x1e6091])); const box = vMat(pick([0xdfe6e9, 0xb2bec3, 0x6c5ce7, 0xfdcb6e])); len = 9.5; w = 2.4; h = 4.1;
    bx(cab, 2.3, 2.3, 2.1, 0, 1.55, len / 2 - 1.05, g); bx(M.glass, 2.1, 0.9, 0.06, 0, 2.1, len / 2 + 0.02, g);
    bx(box, 2.4, 3.4, 7.2, 0, 2.35, -1.1, g);
    for (let i = 0; i < 3; i++) [-1, 1].forEach(s => { const wh = new THREE.Mesh(G_.wheel, M.tire); wh.scale.set(0.35, 0.5, 0.5); wh.position.set(s * 1.1, 0.5, len / 2 - 1.2 - i * 3.2); g.add(wh); });
    // luci di ingombro arancioni sul rimorchio
    for (let i = 0; i < 4; i++) [-1, 1].forEach(s => bx(cowMat(0xff8c00, false, 0xff8c00), 0.05, 0.12, 0.12, s * 1.21, 3.9, 2.2 - i * 2.2, g));
    addLights(g, 2.3, len / 2 + 0.01, -len / 2 - 0.01 + 0.0, 0.9, true);
  } else { // trattore
    const col = vMat(0x2d8a34); len = 3.4; w = 1.9; h = 2.7;
    bx(col, 1.3, 1.0, 2.4, 0, 1.0, 0.3, g); bx(M.glass, 1.4, 1.1, 1.1, 0, 2.05, -0.5, g); bx(col, 1.5, 0.08, 1.3, 0, 2.62, -0.5, g);
    [[-0.95, -0.7, 0.78], [0.95, -0.7, 0.78], [-0.8, 1.1, 0.42], [0.8, 1.1, 0.42]].forEach(([x, z, r]) => { const wh = new THREE.Mesh(G_.wheel, M.tire); wh.scale.set(0.4, r, r); wh.position.set(x, r, z); g.add(wh); });
    const beacon = new THREE.Mesh(G_.sphere, cowMat(0xff8c00, false, 0xff8c00)); beacon.scale.setScalar(0.14); beacon.position.set(0, 2.78, -0.5); g.add(beacon);
    const bg = glowSprite(0xff8c00, 2.5, 0.7); bg.position.copy(beacon.position); g.add(bg); g.userData.beacon = bg;
    addLights(g, 1.5, len / 2 - 0.2, -len / 2 + 0.6, 1.0, true);
  }
  g.rotation.y = oncoming ? 0 : Math.PI;
  return { group: g, len, w, h };
}
/* Roccia infuocata (meteorite caduto) */
function buildRock() {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), M.rock); r.scale.set(1.1, 1.6, 1.1); r.position.y = 1.7; g.add(r);
  const f = glowSprite(0xff6a00, 4.5, 0.8); f.position.y = 2; g.add(f); g.userData.glow = f;
  return { group: g, len: 2.6, w: 2.6, h: 3.8 };
}
function buildMeteor() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), M.fire); g.add(core);
  const gl = glowSprite(0xffa040, 6, 0.9); g.add(gl);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 7, 10, 1, true).translate(0, 3.5, 0), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(tail); g.userData.tail = tail;
  return g;
}

/* =====================================================================
   5b. MODELLI GLB (Blender) — con fallback procedurale se non caricabili
   ===================================================================== */
const MODELS = await (async () => {
  const loader = new GLTFLoader(), names = ['ufo', 'cow', 'car', 'truck', 'tractor'], out = {};
  try {
    const res = await Promise.all(names.map(n => loader.loadAsync(`./models/${n}.glb`)));
    names.forEach((n, i) => {
      const sc = res[i].scene;
      sc.traverse(o => { if (o.isMesh) { o.frustumCulled = true; const m = o.material; if (m && m.emissiveIntensity > 3) m.emissiveIntensity = /LED/.test(m.name) ? 3 : /Neon|Laser/.test(m.name) ? 2.4 : /Headlight/.test(m.name) ? 3 : /Taillight|Amber/.test(m.name) ? 2.5 : 2; } });
      out[n] = sc;
    });
    return out;
  } catch (e) { console.warn('Modelli GLB non caricati, uso i modelli procedurali', e); return null; }
})();
const nodeByName = (root, name) => { let r = null; root.traverse(o => { if (!r && o.name === name) r = o; }); return r; };
const matVariant = {};
function variantMat(base, key, props) {
  const k = base.name + '|' + key;
  if (!matVariant[k]) { const m = base.clone(); Object.entries(props).forEach(([p, v]) => { if (m[p] && m[p].isColor) m[p].setHex(v); else m[p] = v; }); matVariant[k] = m; }
  return matVariant[k];
}

function buildUFO(skinId) {
  const sk = UFO_SKINS[skinId] || UFO_SKINS.classic;
  if (!MODELS || sk.shape === 'cube') return buildUFOProc(skinId);
  const g = MODELS.ufo.clone(true); const leds = [];
  g.traverse(o => {
    if (!o.isMesh) return; const n = o.material.name;
    if (n === 'Hull') o.material = variantMat(o.material, skinId, { color: sk.body, metalness: sk.metal ? 1 : 0.55, roughness: sk.metal ? 0.18 : 0.32, envMapIntensity: 1.6 });
    else if (n === 'Dome') o.material = variantMat(o.material, skinId, { envMapIntensity: 2.2, roughness: 0.05 });
    else if (n === 'Neon') o.material = variantMat(o.material, skinId, { color: sk.led, emissive: sk.led });
    else if (n === 'LED') { o.material = o.material.clone(); o.material.color.setHex(sk.led); o.material.emissive.setHex(sk.led); leds.push(o); }
  });
  leds.sort((a, b) => a.name.localeCompare(b.name));
  g.scale.setScalar(0.85);
  const wrap = new THREE.Group(); wrap.add(g);
  return { group: wrap, leds, sk, under: null };
}

function buildCow(type) {
  if (!MODELS) return buildCowProc(type);
  const g = MODELS.cow.clone(true);
  const head = nodeByName(g, 'Head'), tail = nodeByName(g, 'Tail');
  const legs = ['LegFL', 'LegFR', 'LegBL', 'LegBR'].map(n => nodeByName(g, n));
  nodeByName(g, 'Acc_Cyborg').visible = type === 'cyborg';
  nodeByName(g, 'Acc_Bull').visible = type === 'bull';
  const bell = nodeByName(g, 'Bell'); if (bell) bell.visible = type === 'std' || type === 'golden';
  const sk = COW_SKINS[S.cowSkin] || COW_SKINS.standard;
  const look = type === 'golden' ? { Body: { color: 0xffc933, metalness: 1, roughness: 0.22, emissive: 0x8a5a00, emissiveIntensity: 0.9 }, Spots: { color: 0xffe9a0, metalness: 1, roughness: 0.18, emissive: 0x8a6a10, emissiveIntensity: 0.7 }, Horn: { color: 0xfff1b0, metalness: 1, roughness: 0.2 } }
    : type === 'cyborg' ? { Body: { color: 0x8a93a3, metalness: 0.85, roughness: 0.3 }, Spots: { color: 0x2a2f3a, metalness: 0.7, roughness: 0.4 }, Pink: { color: 0x3a3f4a, metalness: 0.6, roughness: 0.4 } }
    : type === 'bull' ? { Body: { color: 0x6a3a1c, emissive: 0x6a3a1c, emissiveIntensity: 0.12 }, Spots: { color: 0x24130a }, Pink: { color: 0x8a5a50 } }
    : { Body: { color: sk.body, metalness: sk.metal ? 0.9 : 0, roughness: sk.metal ? 0.25 : 0.7, emissive: sk.body, emissiveIntensity: 0.14 }, Spots: { color: sk.spot, emissive: sk.glow || 0x000000, emissiveIntensity: sk.glow ? 1.4 : 0 }, Pink: { emissive: 0xf58fa8, emissiveIntensity: 0.12 } };
  const key = type === 'std' ? 'std_' + S.cowSkin : type;
  g.traverse(o => { if (o.isMesh && look[o.material.name]) o.material = variantMat(o.material, key, look[o.material.name]); });
  const parts = { body: g, head, legs, tail, extra: [] };
  const acc = type === 'std' ? sk.acc : null;
  // Accessori delle skin, posizionati rispetto al perno della testa
  if (acc === 'tophat') { bx(M.black, 0.5, 0.04, 0.5, 0, 0.38, 0.28, head); bx(M.black, 0.32, 0.4, 0.32, 0, 0.6, 0.28, head); const mono = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 16), M.gold); mono.position.set(0.29, 0.08, 0.48); mono.rotation.y = Math.PI / 2; head.add(mono); }
  if (acc === 'visor') bx(cowMat(0x22e6ff, false, 0x22e6ff), 0.62, 0.1, 0.1, 0, 0.08, 0.52, head);
  if (acc === 'bandage') { bx(M.white, 1.24, 0.12, 0.45, 0, 1.15, 0.25, g); bx(M.white, 1.24, 0.12, 0.45, 0, 1.0, -0.45, g); bx(M.white, 0.66, 0.1, 0.62, 0, 0.18, 0.4, head); }
  if (acc === 'afro') { const a = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cowMat(0x8a2be2, true)); a.scale.setScalar(0.4); a.position.set(0, 0.42, 0.25); head.add(a); }
  if (acc === 'helmet') { const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.3, roughness: 0.05 })); h.scale.setScalar(0.62); h.position.set(0, 0.06, 0.42); head.add(h); }
  if (acc === 'pirate') { bx(M.black, 0.7, 0.16, 0.5, 0, 0.4, 0.28, head); bx(M.black, 0.04, 0.14, 0.14, 0.29, 0.08, 0.48, head); }
  if (acc === 'horn') { const h = new THREE.Mesh(G_.cone, M.gold); h.scale.set(0.07, 0.45, 0.07); h.position.set(0, 0.45, 0.5); h.rotation.x = 0.5; head.add(h); }
  if (type === 'golden') { const h = glowSprite(0xffd23f, 4.2, 0.45); h.position.y = 1.1; g.add(h); parts.extra.push(h); }
  if (type === 'cyborg') {
    [-0.2, 0.2].forEach(x => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 5).rotateX(Math.PI / 2).translate(0, 0, 1.6), M.laserBeam); l.position.set(x, 0.08, 0.55); head.add(l); parts.extra.push(l); });
    const red = glowSprite(0xff0033, 2.2, 0.45); red.position.set(0, 1.4, 1); g.add(red);
  }
  const wrap = new THREE.Group(); wrap.add(g); g.scale.setScalar(0.92);
  return { group: wrap, parts };
}

function buildVehicle(kind, oncoming) {
  if (!MODELS) return buildVehicleProc(kind, oncoming);
  const g = MODELS[kind].clone(true);
  const paint = kind === 'tractor' ? null : pick(kind === 'car' ? CAR_COLORS : [0xd35400, 0x2c3e50, 0xc0392b, 0x1e6091]);
  const cargo = pick([0xdfe6e9, 0xb2bec3, 0x6c5ce7, 0xfdcb6e]);
  g.traverse(o => { if (!o.isMesh) return; if (paint && o.material.name === 'Paint') o.material = variantMat(o.material, paint, { color: paint }); if (o.material.name === 'Cargo') o.material = variantMat(o.material, cargo, { color: cargo }); });
  let len, w, h;
  if (kind === 'car') { len = 3.9; w = 1.8; h = 1.45; addLights(g, w, 1.96, -1.96, 0.7, true, false); }
  else if (kind === 'truck') { len = 9.55; w = 2.4; h = 4.0; addLights(g, 2.3, 4.8, -4.8, 0.9, true, false); }
  else {
    len = 3.2; w = 2.0; h = 2.95; addLights(g, 1.0, 1.6, -1.28, 1.05, true, false);
    const bg = glowSprite(0xff8c00, 2.5, 0.7); bg.position.set(0, 2.86, -0.6); g.add(bg); g.userData.beacon = bg;
  }
  const wrap = new THREE.Group(); wrap.add(g);
  if (g.userData.beacon) wrap.userData.beacon = g.userData.beacon;
  wrap.rotation.y = oncoming ? 0 : Math.PI;
  return { group: wrap, len, w, h };
}
