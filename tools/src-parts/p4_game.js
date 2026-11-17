
/* =====================================================================
   6. LOOP DI GIOCO
   ===================================================================== */
let ufo = buildUFO(S.ufoSkin); scene.add(ufo.group);
function setUFOSkin(id) { scene.remove(ufo.group); ufo = buildUFO(id); scene.add(ufo.group); }

const cows = [], vehicles = [], hazards = [];
const G = { state: 'menu', mode: null, t: 0, ufoX: 0, ufoY: CFG.UFO_Y_CRUISE, lane: 1, shake: 0, panicMix: 0, timeScale: 1,
  fogNear: 30, fogFar: 170, fogCol: new THREE.Color(0x070a1c), skyCol: new THREE.Color(0x060818) };
const keysDown = { beam: false };

function clearEntities() {
  for (const c of cows) scene.remove(c.group);
  for (const v of vehicles) scene.remove(v.group);
  for (const h of hazards) { if (h.mesh) scene.remove(h.mesh); if (h.ring) scene.remove(h.ring); }
  cows.length = vehicles.length = hazards.length = 0;
}

/* ---------- Avvio partita ---------- */
function startRun(mode, opt = {}) {
  refreshHearts();
  if ((mode === 'level' || mode === 'daily') && heartsActive() && S.hearts <= 0) { showNoHearts(); return; }
  clearEntities();
  const lvl = mode === 'level' ? LEVELS[opt.level] : null;
  const ch = mode === 'daily' ? todayChallenge() : null;
  const mods = ch ? ch.mods : {};
  Object.assign(G, {
    mode, level: lvl, challenge: ch, mods, state: 'countdown', countdown: 3.2,
    lane: 1, ufoX: 0, ufoY: CFG.UFO_Y_CRUISE,
    lives: startLives(), shields: startShields(), score: 0, cows: 0, golden: 0, distance: 0, closeCalls: 0,
    baseSpeed: lvl ? lvl.speed : mode === 'daily' ? 26 : 22, worldSlow: 1, scrollSpeed: 0,
    density: lvl ? lvl.density : mode === 'daily' ? (mods.rush ? 1.9 : 1.2) : 0.9,
    cyborgChance: mods.cyborg ?? (lvl ? lvl.cyborg : 0.08), goldChance: (mods.gold ?? CFG.GOLDEN_CHANCE) + goldChanceBonus(),
    goalDist: lvl ? lvl.distance : mode === 'daily' ? 1300 : Infinity, target: lvl ? lvl.target : mode === 'daily' ? 15 : 0,
    nextVeh: 40, nextCow: 25, locked: null, mult: 1, multT: 0, slowmoT: 0, invulnT: 0, beamOn: false, beamDisabledT: 0,
    beamUses: mods.beamUses ?? Infinity, beamUseT: 0, beamWasHeld: false,
    panicT: 0, panicCD: rand(25, 40), panicRainT: 0, panicSurvived: false,
    lightT: rand(3, 5), meteorT: rand(2.5, 4), skyFlashT: rand(4, 9),
    power: null, powerT: 0, revived: false, doubled: false, damageTaken: false, endReason: null, weatherNext: 900,
  });
  keysDown.beam = false;
  setWeather(mods.weather || (lvl ? lvl.weather : 'clear'), true);
  setUFOSkin(S.ufoSkin);
  showScreen(null); $('hud').classList.remove('hidden'); $('touch').classList.add('on');
  $('beamUses').classList.toggle('hidden', !isFinite(G.beamUses));
  $('panicTint').style.opacity = 0;
  Audio.setPanicMusic(false);
  const title = lvl ? `${SECTORS[lvl.sector].icon} ${SECTORS[lvl.sector].name} ${lvl.n}/5` : ch ? `📅 ${ch.name}` : '∞ Modalità Infinita';
  showBanner(`${title}<br><small>${WEATHER[G.weather].icon} ${WEATHER[G.weather].name}${G.target ? ` · Obiettivo: ${G.target} 🐄` : ''}</small>`, 'info', 3);
  if (!S.tutorialDone) { setTimeout(() => G.state === 'playing' && showBanner(document.body.classList.contains('touch') ? 'Tieni premuto ABDUCT sopra una mucca 🐄' : 'Tieni premuto SPAZIO sopra una mucca 🐄', 'info', 4), 3500); S.tutorialDone = true; persist(); }
  S.runs++; questProgress('runs', 1);
  updateHUD(true);
}

/* ---------- Meteo ---------- */
function setWeather(w, instant = false) {
  G.weather = w;
  const cfg = { clear: [30, 170, 0x070a1c, 0x060818], fog: [5, 46, 0x1b2030, 0x151a26], storm: [18, 120, 0x05060e, 0x04050c], meteor: [30, 170, 0x150a10, 0x120610] }[w];
  G.fogNear = cfg[0]; G.fogFar = cfg[1]; G.fogCol.setHex(cfg[2]); G.skyCol.setHex(cfg[3]);
  if (instant) { scene.fog.near = G.fogNear; scene.fog.far = G.fogFar; }
  rain.visible = w === 'storm';
  moon.visible = moonGlow.visible = w !== 'fog' && w !== 'storm';
}

/* ---------- Spawn ---------- */
const laneX = (i) => CFG.LANES[i];
function relSpeed(v) { return G.scrollSpeed + v.dir * v.own * (G.panicT > 0 ? 2 : 1); }
function laneBlockedTimes(excludeTall = true) { // tempi di arrivo dei veicoli alti per corsia
  const res = [[], [], []];
  for (const v of vehicles) { if (!v.tall || v.z > 0) continue; const rs = Math.max(4, relSpeed(v)); res[v.lane].push(-v.z / rs); }
  return res;
}
function spawnVehicle() {
  if (G.weather === 'meteor') { spawnRoadMeteor(); return; }
  let kind;
  const r = Math.random();
  if (G.mods.rush) kind = r < 0.72 ? 'truck' : 'car';
  else kind = r < 0.58 ? 'car' : r < 0.83 ? 'truck' : 'tractor';
  let oncoming = kind === 'tractor' ? false : G.mods.rush ? Math.random() < 0.2 : Math.random() < 0.6;
  const own = kind === 'tractor' ? rand(2, 4) : G.mods.rush && !oncoming ? rand(2, 5) : oncoming ? (kind === 'car' ? rand(10, 18) : rand(7, 12)) : (kind === 'car' ? rand(4, 9) : rand(3, 6));
  const dir = oncoming ? 1 : -1;
  const tall = kind === 'truck';
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  let lane = -1;
  const times = laneBlockedTimes();
  const rs = Math.max(4, G.scrollSpeed + dir * own);
  const myT = -CFG.SPAWN_Z / rs;
  for (const L of lanes) {
    // niente sovrapposizioni con un veicolo appena generato nella stessa corsia
    if (vehicles.some(v => v.lane === L && v.z < CFG.SPAWN_Z + 22)) continue;
    if (tall) { // equità: non bloccare mai tutte e 3 le corsie nello stesso istante
      const blocked = [0, 1, 2].filter(k => k === L || times[k].some(t => Math.abs(t - myT) < 1.3));
      if (blocked.length >= 3) continue;
    }
    lane = L; break;
  }
  if (lane < 0) return;
  const b = buildVehicle(kind, oncoming);
  const v = { ...b, kind, lane, x: laneX(lane), z: CFG.SPAWN_Z, own, dir, tall, prevZ: CFG.SPAWN_Z, hit: false, t: Math.random() * 10 };
  v.group.position.set(v.x, 0, v.z); scene.add(v.group); vehicles.push(v);
}
function addRock(lane, z) {
  const b = buildRock();
  const v = { ...b, kind: 'rock', lane, x: laneX(lane), z, own: 0, dir: 0, tall: true, prevZ: z, hit: false, t: Math.random() * 10 };
  v.group.position.set(v.x, 0, z); scene.add(v.group); vehicles.push(v);
}
function spawnRoadMeteor() {
  const times = laneBlockedTimes(); const z = rand(-110, -80);
  const myT = -z / Math.max(4, G.scrollSpeed);
  const lanes = [0, 1, 2].filter(L => [0, 1, 2].filter(k => k === L || times[k].some(t => Math.abs(t - myT) < 1.3)).length < 3);
  if (!lanes.length) return;
  const lane = pick(lanes), m = buildMeteor();
  m.position.set(laneX(lane) + 14, 40, z - 30); scene.add(m);
  hazards.push({ type: 'roadMeteor', mesh: m, lane, z, t: 0, dur: 1.2, from: m.position.clone() });
}
function spawnCow(fromSky = false) {
  let type = 'std';
  const r = Math.random();
  if (G.mods.bulls && r < 0.5) type = 'bull';
  else if (r < G.goldChance) type = 'golden';
  else if (r < G.goldChance + G.cyborgChance) type = 'cyborg';
  const free = [0, 1, 2].filter(L => !vehicles.some(v => v.lane === L && v.z < CFG.SPAWN_Z + 25));
  const lane = pick(free.length ? free : [0, 1, 2]);
  const b = buildCow(type);
  const c = { ...b, type, lane, x: laneX(lane) + rand(-0.3, 0.3), z: fromSky ? rand(-75, -35) : CFG.SPAWN_Z, y: fromSky ? rand(18, 26) : 0, vy: 0,
    state: fromSky ? 'fall' : type === 'bull' ? 'charge' : 'idle', prog: 0, t: Math.random() * 10, rotY: type === 'bull' ? 0 : rand(-2.5, 2.5), scale: 0.92, hopX: 0 };
  c.group.rotation.y = c.rotY; c.group.position.set(c.x, c.y, c.z); scene.add(c.group); cows.push(c);
}

/* ---------- Danno e collisioni ---------- */
function releaseLock() { if (G.locked) { G.locked.state = 'fall'; G.locked.vy = 0; G.locked = null; } }
function damage(source) {
  if (G.invulnT > 0 || G.state !== 'playing') return;
  releaseLock();
  if (G.shields > 0) {
    G.shields--; G.invulnT = 1.2; shieldBubble.material.opacity = 0.7; Audio.shieldHit(); vibrate(40);
    popup('🛡️ SCUDO!', '#22e6ff', 40); updateHUD(true); return;
  }
  G.lives--; G.damageTaken = true; G.mult = 1; G.invulnT = 1.8; G.shake = 0.7;
  source === 'lightning' ? Audio.thunder() : source === 'meteor' ? Audio.impact() : Audio.crash();
  vibrate([60, 40, 120]); flashDOM('dmg', 1, 0.6);
  updateHUD(true);
  if (G.lives <= 0) gameOver();
}
function aabbHit(v) {
  const dx = Math.abs(v.x - G.ufoX), dz = Math.abs(v.z);
  const zOv = dz < v.len / 2 + 1.0;
  if (!zOv) return false;
  const bodyHit = dx < v.w / 2 + 1.1 && v.h > G.ufoY - 0.45;                 // scafo dell'UFO
  const beamHit = G.beamOn && dx < v.w / 2 + 0.75;                          // il raggio tocca il veicolo
  return bodyHit || beamHit;
}
function closeCall(v) {
  G.mult = Math.min(CFG.MAX_MULT, G.mult + 1); G.multT = 6; G.closeCalls++;
  G.slowmoT = CFG.CLOSE_CALL_SLOWMO; trail.material.opacity = 0.9;
  Audio.closeCall(); vibrate(25);
  popup(`CLOSE CALL! x${G.mult}`, '#ff2bd6', 46);
  $('vignette').style.opacity = 1; setTimeout(() => { $('vignette').style.opacity = 0; }, 450);
  questProgress('close', 1);
  if (G.mult >= 5) unlock('mult5');
  if (G.lives === 1) unlock('miracle');
}

/* ---------- Rapimento completato ---------- */
function collect(c) {
  const panic = G.panicT > 0 ? 2 : 1;
  let n = 0, pts = 0, label = '', color = '#00ff88';
  if (c.type === 'golden') {
    n = 5; pts = 500; G.golden++; S.goldenStock++; S.totalGolden++; questProgress('golden', 1); Audio.moo('gold'); label = '+5 🐄 DORATA!'; color = '#ffd23f';
    grantPower(); if (G.golden >= 5) unlock('gold5');
  } else if (c.type === 'cyborg') {
    G.cows = Math.max(0, G.cows - 3); G.score = Math.max(0, G.score - 300); G.mult = 1; G.beamDisabledT = 2.2;
    Audio.zap(); vibrate([30, 30, 30]); document.body.classList.add('glitch'); setTimeout(() => document.body.classList.remove('glitch'), 1500);
    popup('⚠ MUCCA CYBORG! −3 🐄', '#ff3355', 46); unlock('cyborg'); updateHUD(true); return;
  } else if (c.type === 'bull') { n = 2; pts = 200; Audio.moo('bull'); label = '+2 🐂 TORO!'; }
  else { n = 1; pts = 100; Audio.moo('std'); label = '+1 🐄'; }
  n *= panic; pts *= G.mult * panic;
  G.cows += n; G.score += pts; questProgress('cows', n);
  popup(`${label}${panic > 1 ? ' x2' : ''}`, color, 52);
  if (S.totalCows + G.cows >= 1) unlock('first');
  if (S.totalCows + G.cows >= 100) unlock('serial');
  if (S.totalCows + G.cows >= 1000) unlock('herd');
  updateHUD(true);
}
function grantPower() {
  const p = pick(['turbo', 'magnet', 'shield']);
  if (p === 'shield') { G.shields++; popup('BONUS: +1 SCUDO 🛡️', '#22e6ff', 36); }
  else { G.power = p; G.powerT = 8; popup(p === 'turbo' ? 'BONUS: SUPER RAGGIO ⚡' : 'BONUS: CALAMITA 🧲', '#ffd23f', 36); }
  Audio.powerup();
}

/* ---------- Panic Fever ---------- */
function startPanic() {
  G.panicT = CFG.PANIC_DURATION; G.panicRainT = 0; G.panicSurvived = true;
  Audio.alarm(); Audio.setPanicMusic(true); vibrate([80, 60, 80]);
  $('panicTint').style.opacity = 1;
}
function endPanic() {
  Audio.setPanicMusic(false); $('panicTint').style.opacity = 0; hideBanner();
  if (G.lives > 0) { unlock('panic'); questProgress('panic', 1); popup('PANIC FEVER SUPERATA!', '#ffd23f', 40); }
  G.panicCD = rand(40, 70);
}

/* ---------- Update principale ---------- */
const _col = new THREE.Color();
function updateGame(dtReal) {
  const playing = G.state === 'playing';
  // Bullet-time per le Close Call (in tempo reale)
  if (G.slowmoT > 0) G.slowmoT -= dtReal;
  G.timeScale = lerp(G.timeScale, G.slowmoT > 0 ? 0.33 : 1, 1 - Math.exp(-dtReal * 14));
  const dt = dtReal * G.timeScale;
  G.t += dt;

  // --- Movimento laterale fluido (lerp) ---
  const tx = laneX(G.lane);
  G.ufoX += (tx - G.ufoX) * (1 - Math.exp(-dtReal * Math.max(G.timeScale, 0.6) * 11));

  // --- Raggio ---
  let held = playing && keysDown.beam;
  if (held && !G.beamWasHeld && isFinite(G.beamUses)) { // modalità energia: consuma un utilizzo
    if (G.beamUses > 0) { G.beamUses--; G.beamUseT = 3.5; } else { popup('ENERGIA ESAURITA', '#ff3355', 60); }
  }
  G.beamWasHeld = held;
  if (isFinite(G.beamUses)) { if (G.beamUseT > 0) G.beamUseT -= dt; else held = false; }
  if (G.beamDisabledT > 0) { G.beamDisabledT -= dt; held = false; }
  G.beamOn = held;
  G.ufoY = lerp(G.ufoY, G.beamOn ? CFG.UFO_Y_BEAM : CFG.UFO_Y_CRUISE, 1 - Math.exp(-dt * 7));

  // --- Velocità del mondo ---
  const ramp = G.mode === 'endless' ? Math.min(14, G.distance / 260) : 0;
  const panicBoost = G.panicT > 0 ? 1.15 : 1;
  G.worldSlow = lerp(G.worldSlow, G.locked ? CFG.LOCK_SLOW : 1, 1 - Math.exp(-dt * 5));
  const speed = G.state === 'countdown' ? 10 : (G.baseSpeed + ramp) * panicBoost;
  G.scrollSpeed = speed * G.worldSlow;
  const dz = G.scrollSpeed * dt;
  if (playing) { G.distance += dz; G.score += dz * G.mult * (G.panicT > 0 ? 2 : 1); questProgress('dist', dz); }
  scrollWorld(dz);
  if (rain.visible) updateRain(dt, dz);

  if (G.state === 'countdown') {
    G.countdown -= dtReal;
    const n = Math.ceil(G.countdown - 0.2);
    const cd = $('countdown'); cd.classList.remove('hidden'); cd.textContent = n > 0 ? n : 'VIA!';
    if (G.countdown <= 0) { cd.classList.add('hidden'); G.state = 'playing'; }
  }

  if (playing) {
    // --- Spawn basati sulla distanza ---
    while (G.distance >= G.nextVeh) { spawnVehicle(); G.nextVeh += rand(16, 32) / (G.density * (G.panicT > 0 ? 1.3 : 1)) * (G.weather === 'meteor' ? 1.6 : 1); }
    while (G.distance >= G.nextCow) { spawnCow(); G.nextCow += rand(18, 32); }
    // --- Panic Fever ---
    if (G.panicT > 0) {
      G.panicT -= dt; G.panicRainT -= dt;
      if (G.panicRainT <= 0) { spawnCow(true); G.panicRainT = 0.38; }
      showBanner(`🔥 PANIC FEVER 🔥 ${Math.ceil(G.panicT)}s<br><small>auto x2 · bonus x2</small>`, 'panic', 0.3);
      if (G.panicT <= 0) endPanic();
    } else if (G.distance > 300 && !G.challenge) {
      G.panicCD -= dt; if (G.panicCD <= 0) startPanic();
    }
    // --- Meteo dinamico (modalità infinita) ---
    if (G.mode === 'endless' && G.distance > G.weatherNext) {
      G.weatherNext += 900; setWeather(pick(['clear', 'fog', 'storm', 'meteor'].filter(w => w !== G.weather)));
      showBanner(`${WEATHER[G.weather].icon} ${WEATHER[G.weather].name}`, 'info', 2.5);
    }
    if (G.weather === 'storm') updateLightning(dt);
    if (G.weather === 'meteor') { G.meteorT -= dt; if (G.meteorT <= 0) { spawnDirectMeteor(); G.meteorT = rand(2.6, 4.6); } }
    // --- Timer vari ---
    if (G.invulnT > 0) G.invulnT -= dt;
    if (G.powerT > 0) { G.powerT -= dt; if (G.powerT <= 0) G.power = null; }
    if (G.mult > 1) { G.multT -= dt; if (G.multT <= 0) { G.mult--; G.multT = 4; } }
    // --- Fine livello ---
    if (G.distance >= G.goalDist) endLevel();
  }
  updateHazards(dt);
  updateVehicles(dt, playing);
  updateCows(dt, playing);
  updateUFOVisual(dt, dtReal);
  updateAtmosphere(dtReal);
  updateCamera(dtReal);
  if (playing) updateHUD();
}

function updateVehicles(dt, playing) {
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    v.prevZ = v.z; v.z += relSpeed(v) * dt; v.t += dt;
    v.group.position.set(v.x, 0, v.z);
    if (v.group.userData.beacon) v.group.userData.beacon.material.opacity = (Math.sin(v.t * 10) > 0) ? 0.9 : 0.1;
    if (v.group.userData.glow) v.group.userData.glow.material.opacity = 0.6 + Math.sin(v.t * 13) * 0.25;
    if (playing && !v.hit && aabbHit(v)) { v.hit = true; damage(v.kind === 'rock' ? 'meteor' : 'car'); }
    // Close Call: il veicolo supera l'UFO senza colpirlo, passandoci accanto
    if (playing && !v.hit && v.prevZ < 0 && v.z >= 0) {
      const dx = Math.abs(v.x - G.ufoX);
      if (dx > 1.2 && dx < 4.3 && (G.beamOn || v.tall)) closeCall(v);
    }
    // Le mucche si scansano dai veicoli
    for (const c of cows) if (c.state === 'idle' && Math.abs(c.x - v.x) < 1.6 && Math.abs(c.z - v.z) < v.len / 2 + 1.4) { c.state = 'hop'; c.hopX = c.x < 0 ? -5.6 : c.x > 0 ? 5.6 : pick([-5.6, 5.6]); c.vy = 6; }
    if (v.z > CFG.DESPAWN_Z + v.len || v.z < CFG.SPAWN_Z - 60) { scene.remove(v.group); vehicles.splice(i, 1); }
  }
}

function updateCows(dt, playing) {
  const need = G.power === 'turbo' ? 0.3 : abductTime() * (G.panicT > 0 ? 0.6 : 1);
  const lockR = G.power === 'magnet' ? 4.6 : 1.35;
  // Aggancio di una nuova mucca
  if (playing && G.beamOn && !G.locked) {
    let best = null;
    for (const c of cows) {
      if (!(c.state === 'idle' || c.state === 'charge' || (c.state === 'fall' && c.y < 3))) continue;
      if (Math.abs(c.x - G.ufoX) < lockR && c.z > -2.8 && c.z < 1.8 && (!best || c.z > best.z)) best = c;
    }
    if (best) { G.locked = best; best.state = 'locked'; Audio.whoosh(); }
  }
  if (G.locked && (!G.beamOn || !playing)) releaseLock();
  let progress = 0;
  for (let i = cows.length - 1; i >= 0; i--) {
    const c = cows[i]; c.t += dt;
    const p = c.parts;
    switch (c.state) {
      case 'idle':
        c.z += G.scrollSpeed * dt;
        p.head.rotation.x = Math.sin(c.t * 2.2) * 0.25 + 0.25; // bruca
        p.tail.rotation.z = Math.sin(c.t * 5) * 0.4;
        break;
      case 'charge': // toro che corre contromano e salta
        c.z += (G.scrollSpeed + 9) * dt; c.y = Math.abs(Math.sin(c.t * 5)) * 1.8;
        p.legs.forEach((l, k) => l.rotation.x = Math.sin(c.t * 18 + k * 1.6) * 0.6);
        if (playing && Math.abs(c.z) < 1.2 && Math.abs(c.x - G.ufoX) < 1.6 && (c.y > 1.0 || G.beamOn) && !c.hitDone) { c.hitDone = true; damage('bull'); }
        break;
      case 'hop':
        c.z += G.scrollSpeed * dt; c.x = lerp(c.x, c.hopX, 1 - Math.exp(-dt * 6)); c.vy -= 22 * dt; c.y = Math.max(0, c.y + c.vy * dt);
        if (c.y === 0 && Math.abs(c.x - c.hopX) < 0.1) c.state = 'shoulder';
        break;
      case 'shoulder': c.z += G.scrollSpeed * dt; p.head.rotation.x = Math.sin(c.t * 2.2) * 0.25 + 0.25; break;
      case 'fall':
        c.z += G.scrollSpeed * dt; c.vy -= 20 * dt; c.y = Math.max(0, c.y + c.vy * dt);
        c.group.rotation.x *= 0.9;
        if (c.y === 0) { c.state = c.type === 'bull' ? 'charge' : 'idle'; c.prog = Math.max(0, c.prog - 0.3); }
        break;
      case 'locked':
        c.x = lerp(c.x, G.ufoX, 1 - Math.exp(-dt * 6)); c.z = lerp(c.z, 0, 1 - Math.exp(-dt * 5));
        c.prog += dt / need; progress = c.prog;
        c.y = lerp(c.y, 0.3 + c.prog * 1.5, 1 - Math.exp(-dt * 8));
        c.rotY += dt * 2.5; c.group.rotation.x = Math.sin(c.t * 7) * 0.12;
        p.legs.forEach((l, k) => l.rotation.x = Math.sin(c.t * 14 + k) * 0.5); // scalcia
        if (c.prog >= 1) { c.state = 'lifting'; c.lift = 0; G.locked = null; }
        break;
      case 'lifting': // risucchio finale: rotazione + rimpicciolimento
        c.lift += dt / 0.55; c.x = lerp(c.x, G.ufoX, 0.3);
        c.y = lerp(1.8, G.ufoY - 0.2, c.lift); c.rotY += dt * 16; c.scale = 0.92 * (1 - c.lift * 0.95);
        if (c.lift >= 1) { collect(c); scene.remove(c.group); cows.splice(i, 1); continue; }
        break;
    }
    c.group.position.set(c.x, c.y, c.z); c.group.rotation.y = c.rotY; c.group.scale.setScalar(Math.max(0.01, c.scale));
    if (c.type === 'cyborg') p.extra.forEach(l => { if (l.material) l.material.opacity = Math.random() < 0.15 ? 0.1 : 0.6; });
    if (c.z > CFG.DESPAWN_Z) { scene.remove(c.group); cows.splice(i, 1); }
  }
  G.lockProgress = G.locked ? clamp(progress, 0, 1) : 0;
}

/* ---------- Fulmini e meteore ---------- */
function updateLightning(dt) {
  G.lightT -= dt; G.skyFlashT -= dt;
  if (G.skyFlashT <= 0) { flashDOM('flash', 0.35, 0.25); flashLight.intensity = 3; G.skyFlashT = rand(4, 9); }
  if (G.lightT <= 0) {
    const lane = Math.random() < 0.6 ? G.lane : (Math.random() * 3) | 0;
    const ring = makeWarning(0xfff066); ring.position.x = laneX(lane);
    hazards.push({ type: 'bolt', lane, t: 1.15, ring }); Audio.crackle();
    G.lightT = G.challenge ? rand(2.4, 4.2) : rand(3.6, 6.2);
  }
}
function spawnDirectMeteor() {
  const lane = Math.random() < 0.55 ? G.lane : (Math.random() * 3) | 0;
  const ring = makeWarning(0xff7a1a); ring.position.x = laneX(lane);
  const m = buildMeteor(); const from = new THREE.Vector3(laneX(lane) + 12, 38, -26); m.position.copy(from); scene.add(m);
  hazards.push({ type: 'meteor', lane, ring, mesh: m, from, t: 0, dur: 1.35 });
}
const _dir = new THREE.Vector3();
function updateHazards(dt) {
  if (bolt.visible) { boltMat.opacity -= dt * 5; if (boltMat.opacity <= 0) bolt.visible = false; }
  flashLight.intensity = Math.max(0, flashLight.intensity - dt * 18);
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (h.type === 'bolt') {
      h.t -= dt; h.ring.material.opacity = 0.4 + Math.abs(Math.sin(h.t * 18)) * 0.6; h.ring.scale.setScalar(1 + (1.15 - h.t) * 0.3);
      if (h.t <= 0) {
        makeBolt(laneX(h.lane), 0); flashDOM('flash', 0.95, 0.5); flashLight.intensity = 10; Audio.thunder(); G.shake = Math.max(G.shake, 0.3);
        if (G.state === 'playing' && Math.abs(G.ufoX - laneX(h.lane)) < 1.6) damage('lightning');
        scene.remove(h.ring); hazards.splice(i, 1);
      }
    } else if (h.type === 'meteor' || h.type === 'roadMeteor') {
      h.t += dt / h.dur; const k = Math.min(1, h.t);
      const target = h.type === 'meteor' ? _dir.set(laneX(h.lane), 0, 0) : _dir.set(laneX(h.lane), 0, h.z);
      if (h.type === 'roadMeteor') h.z += G.scrollSpeed * dt;
      h.mesh.position.lerpVectors(h.from, target, k * k);
      h.mesh.lookAt(h.from); h.mesh.rotateX(Math.PI / 2);
      if (h.ring) h.ring.material.opacity = 0.4 + Math.abs(Math.sin(h.t * 30)) * 0.6;
      if (k >= 1) {
        scene.remove(h.mesh); if (h.ring) scene.remove(h.ring);
        if (h.type === 'meteor') { Audio.impact(); G.shake = Math.max(G.shake, 0.35); flashDOM('flash', 0.4, 0.3); if (G.state === 'playing' && Math.abs(G.ufoX - laneX(h.lane)) < 1.6) damage('meteor'); }
        else addRock(h.lane, h.z);
        hazards.splice(i, 1);
      }
    }
  }
}

/* ---------- Visual dell'UFO, raggio, atmosfera, camera ---------- */
function updateUFOVisual(dt, dtReal) {
  const g = ufo.group;
  const hover = Math.sin(G.t * 2.2) * 0.12;
  g.position.set(G.ufoX, G.ufoY + hover, 0);
  g.rotation.z = (G.ufoX - laneX(G.lane)) * 0.12;
  g.rotation.y += dt * (G.beamOn ? 2.4 : 0.8);
  g.visible = !(G.invulnT > 0 && G.state === 'playing' && Math.floor(G.invulnT * 12) % 2 === 0);
  ufo.leds.forEach((l, i) => {
    const on = Math.sin(G.t * 9 - i * 0.7) > 0.3;
    l.material.emissiveIntensity = on ? 4 : 0.6;
    if (ufo.sk.rainbow) l.material.emissive.setHSL((G.t * 0.3 + i / ufo.leds.length) % 1, 1, 0.55);
  });
  // Raggio
  const bi = beamMat.uniforms.uI.value = lerp(beamMat.uniforms.uI.value, G.beamOn ? 1 : 0, 1 - Math.exp(-dt * 14));
  beamMat.uniforms.uTime.value = G.t;
  beamMat.uniforms.uColor.value.setHex(G.beamDisabledT > 0 ? 0xff3355 : 0x00ff88);
  const bh = Math.max(0.1, G.ufoY - 0.35 + hover);
  beam.visible = bi > 0.02; beam.position.set(G.ufoX, G.ufoY - 0.35 + hover, 0); beam.scale.set(1, bh, 1);
  beamPool.position.x = G.ufoX; beamPool.material.opacity = bi * (0.5 + 0.2 * Math.sin(G.t * 12));
  beamLight.position.set(G.ufoX, 1.2, 0); beamLight.intensity = bi * 9;
  particles.visible = bi > 0.05; particles.position.set(G.ufoX, 0, 0);
  if (particles.visible) updateParticles(dt, bh, G.locked ? 1 : 0);
  Audio.beam(G.beamOn, G.lockProgress || 0);
  // Scia e scudo
  trail.position.set(G.ufoX, G.ufoY, 0); trail.material.opacity = Math.max(0, trail.material.opacity - dtReal * 1.6);
  shieldBubble.position.copy(g.position); shieldBubble.material.opacity = Math.max(0, shieldBubble.material.opacity - dtReal * 1.5);
}
function updateAtmosphere(dtReal) {
  G.panicMix = lerp(G.panicMix, G.panicT > 0 ? 1 : 0, 1 - Math.exp(-dtReal * 3));
  const pm = G.panicMix, k = 1 - Math.exp(-dtReal * 2);
  scene.fog.near = lerp(scene.fog.near, G.fogNear, k); scene.fog.far = lerp(scene.fog.far, G.fogFar, k);
  _col.copy(G.fogCol).lerp(PANIC_RED, pm * 0.35); scene.fog.color.lerp(_col, k * 2);
  _col.copy(G.skyCol).lerp(PANIC_RED, pm * 0.25); scene.background.lerp(_col, k * 2);
  hemi.color.copy(HEMI_SKY).lerp(PANIC_RED, pm * 0.8);
  roadMat.emissive.setRGB(1, 1 - pm * 0.8, 1 - pm * 0.8);
  _col.copy(LAMP_COLOR).lerp(PANIC_RED, pm);
  lampMats.head.emissive.copy(_col); lampMats.cone.color.copy(_col); lampMats.pool.color.copy(_col);
}
function updateCamera(dtReal) {
  const portrait = window.innerWidth / window.innerHeight < 0.8;
  const tx = G.ufoX * (portrait ? 0.35 : 0.55);
  camera.position.x = lerp(camera.position.x, tx, 1 - Math.exp(-dtReal * 6));
  camera.position.y = portrait ? 9.2 : 7.4; camera.position.z = portrait ? 13.5 : 11.5;
  if (G.shake > 0) { camera.position.x += rand(-1, 1) * G.shake; camera.position.y += rand(-1, 1) * G.shake * 0.6; G.shake = Math.max(0, G.shake - dtReal * 1.6); }
  camera.lookAt(G.ufoX * 0.45, 1.0, -14);
}

/* ---------- Fine partita ---------- */
function gameOver() {
  G.state = 'over'; G.endReason = 'dead'; releaseLock(); keysDown.beam = false; hideBanner();
  if (G.panicT > 0) { G.panicT = 0; Audio.setPanicMusic(false); $('panicTint').style.opacity = 0; }
  setTimeout(() => renderOver(), 700);
}
function endLevel() {
  G.state = 'over'; releaseLock(); keysDown.beam = false; hideBanner();
  const ok = G.cows >= G.target;
  G.endReason = ok ? 'complete' : 'missed';
  if (G.panicT > 0) { G.panicT = 0; Audio.setPanicMusic(false); $('panicTint').style.opacity = 0; }
  if (ok) { Audio.powerup(); vibrate([40, 40, 40]); }
  renderOver();
}
function revive() {
  G.revived = true; G.lives = 1; G.invulnT = 2.5; G.state = 'countdown'; G.countdown = 2.2;
  for (const v of vehicles) if (v.z > -40) { scene.remove(v.group); v.dead = true; }
  for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].dead) vehicles.splice(i, 1);
  showScreen(null); updateHUD(true);
}
/* Applica i risultati: monete, record, classifica, mappa, trofei */
function finalizeRun() {
  const success = G.endReason === 'complete';
  const coins = Math.round(G.cows * coinBonus() * (G.doubled ? 2 : 1)) + (success ? 20 + (G.level ? G.level.id * 3 : 60) : 0);
  S.coins += coins; S.totalCows += G.cows;
  S.highScore = Math.max(S.highScore, Math.floor(G.score)); S.bestDistance = Math.max(S.bestDistance, Math.floor(G.distance));
  S.leaderboard.push({ name: S.pilot, score: Math.floor(G.score), cows: G.cows, dist: Math.floor(G.distance), mode: G.mode, date: Date.now() });
  S.leaderboard.sort((a, b) => b.score - a.score); S.leaderboard = S.leaderboard.slice(0, 10);
  if (G.mode === 'endless' && G.distance >= 5000) unlock('marathon');
  if (success) {
    if (!G.damageTaken) { unlock('untouch'); questProgress('nohit', 1); }
    if (G.weather === 'storm') unlock('storm'); if (G.weather === 'fog') unlock('fog'); if (G.weather === 'meteor') unlock('meteor');
    if (G.mode === 'level') {
      const id = G.level.id; S.levels[id] = Math.max(S.levels[id] || 0, G.cows);
      const s = G.level.sector;
      const all = [0, 1, 2, 3, 4].every(l => S.levels[s * 5 + l] !== undefined);
      if (all && !S.sectorsDone.includes(s)) {
        S.sectorsDone.push(s); const sk = SECTORS[s].skin; if (!S.ufoSkins.includes(sk)) S.ufoSkins.push(sk);
        unlock('sector'); if (S.sectorsDone.length >= 5) unlock('conqueror');
        G.sectorUnlocked = s;
      }
    }
    if (G.mode === 'daily') {
      const dk = dateKey(); if (S.daily.lastDone !== dk) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        S.daily.streak = S.daily.lastDone === dateKey(y) ? S.daily.streak + 1 : 1; S.daily.lastDone = dk;
        S.coins += 150 + 50 * Math.min(S.daily.streak, 5); if (S.daily.streak >= 3) unlock('daily3');
      }
    }
  } else if (G.mode !== 'endless') consumeHeart();
  persist(); return coins;
}
