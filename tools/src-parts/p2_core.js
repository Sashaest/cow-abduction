import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* =====================================================================
   1. CONFIG & DATI DI GIOCO
   ===================================================================== */
const CFG = {
  LANES: [-3, 0, 3],
  SPAWN_Z: -160,
  DESPAWN_Z: 18,
  UFO_Y_CRUISE: 3.6,     // in crociera: le auto passano sotto, i camion/rocce no
  UFO_Y_BEAM: 2.0,       // in picchiata (raggio attivo): tutto ciò che passa colpisce
  BASE_ABDUCT_TIME: 1.5, // secondi di raggio per rapire una mucca
  LOCK_SLOW: 0.4,        // velocità mondo durante l'aggancio (−60%)
  START_LIVES: 3,
  MAX_HEARTS: 5,
  HEART_RECHARGE_MS: 15 * 60 * 1000,
  HEARTS_ENABLED: false, // si riattiva insieme agli annunci reali (AdService)
  IAP_ENABLED: false,    // si riattiva con Play Billing
  GOLDEN_CHANCE: 0.10,
  PANIC_DURATION: 30,
  CLOSE_CALL_SLOWMO: 0.55,
  MAX_MULT: 5,
  LAB_RATE_PER_MIN: 10,  // monete/minuto per Mucca Dorata nel laboratorio
  CROSSBREED_COST: 150,
};

/* Settori della Mappa della Base Aliena: 5 livelli ciascuno */
const SECTORS = [
  { name: 'Praterie Terrestri',      icon: '🌾', skin: 'retro',  passive: '+10% Bio-Mucca Coins',      weather: ['clear', 'clear', 'fog'] },
  { name: 'Laboratorio Genetico',    icon: '🧬', skin: 'gold',   passive: 'Raggio +10% più veloce',     weather: ['clear', 'fog', 'storm'] },
  { name: 'Area Saggi',              icon: '📜', skin: 'cube',   passive: '+1 Scudo a inizio partita',  weather: ['fog', 'storm', 'meteor'] },
  { name: 'Sala Trono della Regina', icon: '👑', skin: 'queen',  passive: '+5% probabilità Mucca Dorata', weather: ['storm', 'meteor', 'fog'] },
  { name: 'Portale Dimensionale',    icon: '🌀', skin: 'prism',  passive: '+1 Vita iniziale',           weather: ['meteor', 'storm', 'fog', 'clear'] },
];
const LEVELS = [];
for (let s = 0; s < 5; s++) for (let l = 0; l < 5; l++) {
  const i = s * 5 + l;
  LEVELS.push({
    id: i, sector: s, n: l + 1,
    distance: 650 + i * 55,
    speed: 22 + i * 0.75,
    density: 0.85 + i * 0.05,
    target: 6 + Math.floor(i * 0.9),
    cyborg: 0.06 + i * 0.006,
    weather: SECTORS[s].weather[(l * 7 + s * 3) % SECTORS[s].weather.length],
  });
}

const UPGRADES = {
  beam:   { name: 'Velocità del Raggio', icon: '⚡', desc: 'Rapisci le mucche più in fretta (−12% tempo/livello)', costs: [80, 180, 350, 600, 1000] },
  shield: { name: 'Scudo Energetico',    icon: '🛡️', desc: 'Assorbe 1 collisione per livello, senza perdere vite', costs: [150, 450, 1000] },
  hold:   { name: 'Capienza Stiva',      icon: '📦', desc: '+15% monete a fine partita, +1 stalla e silo più grande nel Laboratorio', costs: [100, 250, 500, 900, 1500] },
};

const UFO_SKINS = {
  classic: { name: 'Predatore Notturno',  body: 0x8494aa, dome: 0x66e0ff, led: 0x00ff88, shape: 'disc',  how: 'Base' },
  retro:   { name: "UFO Retrò anni '50",  body: 0xc8ccd4, dome: 0xff4466, led: 0xff3355, shape: 'retro', how: 'Completa Praterie Terrestri' },
  gold:    { name: "Disco d'Oro",         body: 0xffc93a, dome: 0xfff2b0, led: 0xffffff, shape: 'disc',  how: 'Completa Laboratorio Genetico', metal: true },
  cube:    { name: 'Astronave Cubica',    body: 0x2a3240, dome: 0x22e6ff, led: 0x22e6ff, shape: 'cube',  how: 'Completa Area Saggi' },
  queen:   { name: 'Corona della Regina', body: 0x7a3cff, dome: 0xff9bf0, led: 0xff2bd6, shape: 'queen', how: 'Completa Sala Trono della Regina' },
  prism:   { name: 'Prisma Dimensionale', body: 0x2a2f3a, dome: 0xffffff, led: 0xffffff, shape: 'prism', how: 'Completa Portale Dimensionale', rainbow: true },
};

/* Skin delle mucche ottenibili con gli incroci genetici (personaggi originali) */
const COW_SKINS = {
  standard:    { name: 'Frisona Classica', body: 0xf4f4f0, spot: 0x111111, acc: null },
  millionaire: { name: 'Mucca Milionaria', body: 0xf4f4f0, spot: 0x1d6b3a, acc: 'tophat' },
  cyber:       { name: 'Mucca Cyberpunk',  body: 0x1a1030, spot: 0xff2bd6, acc: 'visor', glow: 0x22e6ff },
  zombie:      { name: 'Mucca Zombie',     body: 0x86a86a, spot: 0x3c4a2c, acc: 'bandage' },
  disco:       { name: 'Mucca Disco',      body: 0xd8dde8, spot: 0x8a8fff, acc: 'afro', metal: true },
  astro:       { name: 'Mucca Astronauta', body: 0xffffff, spot: 0x4466aa, acc: 'helmet' },
  pirate:      { name: 'Mucca Pirata',     body: 0xe8dcc8, spot: 0x5a3218, acc: 'pirate' },
  unicorn:     { name: 'Mucca Unicorno',   body: 0xfff4ff, spot: 0xffa6e8, acc: 'horn' },
  mummy:       { name: 'Mucca Mummia',     body: 0xd8cfa8, spot: 0xa89c70, acc: 'bandage' },
};

const ACHIEVEMENTS = [
  { id: 'first',     name: 'Primo Contatto',              desc: 'Rapisci la tua prima mucca',                    reward: 25 },
  { id: 'serial',    name: 'Rapitore Seriale di Mucche',  desc: 'Rapisci 100 mucche in totale',                  reward: 150 },
  { id: 'herd',      name: 'Mandriano Galattico',         desc: 'Rapisci 1000 mucche in totale',                 reward: 600 },
  { id: 'miracle',   name: 'Schivata Miracolosa',         desc: 'Fai una Close Call con una sola vita rimasta',  reward: 100 },
  { id: 'mult5',     name: 'Adrenalina Pura',             desc: 'Raggiungi il moltiplicatore x5',                reward: 120 },
  { id: 'panic',     name: 'Febbre da Panico',            desc: 'Sopravvivi a una Panic Fever',                  reward: 100 },
  { id: 'gold5',     name: 'Corsa all\'Oro',              desc: 'Rapisci 5 Mucche Dorate in una partita',         reward: 200 },
  { id: 'cyborg',    name: 'Errore di Sistema',           desc: 'Rapisci per sbaglio una Mucca Cyborg',          reward: 20 },
  { id: 'untouch',   name: 'Intoccabile',                 desc: 'Completa un livello senza danni',               reward: 150 },
  { id: 'storm',     name: 'Cavalca la Tempesta',         desc: 'Completa un livello sotto la tempesta',         reward: 120 },
  { id: 'fog',       name: 'Nebbia della Padania',        desc: 'Completa un livello nella nebbia',              reward: 120 },
  { id: 'meteor',    name: 'Cacciatore di Stelle',        desc: 'Completa un livello con la pioggia di meteore', reward: 150 },
  { id: 'marathon',  name: 'Autostrada Infinita',         desc: 'Percorri 5000 m in modalità Infinita',          reward: 300 },
  { id: 'genetist',  name: 'Genetista Pazzo',             desc: 'Fai il tuo primo incrocio genetico',            reward: 50 },
  { id: 'collector', name: 'Zoo Interstellare',           desc: 'Sblocca tutte le skin delle mucche',            reward: 800 },
  { id: 'sector',    name: 'Colonizzatore',               desc: 'Completa un settore della mappa',               reward: 200 },
  { id: 'conqueror', name: 'Signore della Base',          desc: 'Completa tutti i 5 settori',                    reward: 1500 },
  { id: 'daily3',    name: 'Abitudine Aliena',            desc: 'Completa la Sfida del Giorno 3 giorni di fila', reward: 300 },
];

/* Sfide giornaliere ("Missioni Assurde") — una al giorno, scelta col seed della data */
const DAILY_CHALLENGES = [
  { id: 'bull',   name: 'La Vendetta del Toro',      desc: 'I tori corrono contromano e saltano addosso all\'UFO. Rapiscili per +2!', mods: { bulls: true } },
  { id: 'energy', name: 'Risparmio Energetico',      desc: 'Il raggio si può attivare solo 6 volte in tutto il livello.',            mods: { beamUses: 6 } },
  { id: 'rush',   name: 'Traffico Ora di Punta',     desc: 'Corsie intasate da camion lentissimi. Pazienza e nervi saldi.',          mods: { rush: true } },
  { id: 'goldf',  name: 'Febbre dell\'Oro',          desc: 'Tantissime Mucche Dorate… ma anche tante Cyborg travestite.',           mods: { gold: 0.35, cyborg: 0.3 } },
  { id: 'fog',    name: 'Nebbia della Padania',      desc: 'Visibilità ridottissima per tutto il livello.',                          mods: { weather: 'fog' } },
  { id: 'storm',  name: 'Notte di Tempesta',         desc: 'Fulmini continui: guarda gli avvisi a terra e spostati!',                 mods: { weather: 'storm' } },
  { id: 'meteor', name: 'Pioggia di Stelle Cadenti', desc: 'Niente auto: solo meteore da schivare.',                                 mods: { weather: 'meteor' } },
];

/* Missioni quotidiane (3 al giorno) */
const QUEST_POOL = [
  { id: 'cows',   text: 'Rapisci 30 mucche',             goal: 30,   reward: 80 },
  { id: 'close',  text: 'Fai 5 Close Call',              goal: 5,    reward: 100 },
  { id: 'golden', text: 'Rapisci 3 Mucche Dorate',       goal: 3,    reward: 120 },
  { id: 'panic',  text: 'Sopravvivi a una Panic Fever',  goal: 1,    reward: 120 },
  { id: 'dist',   text: 'Percorri 3000 m in totale',     goal: 3000, reward: 90 },
  { id: 'runs',   text: 'Gioca 3 partite',               goal: 3,    reward: 60 },
  { id: 'nohit',  text: 'Completa un livello senza danni', goal: 1,  reward: 150 },
];

const WEATHER = {
  clear:  { name: 'Notte Serena',              icon: '🌙' },
  fog:    { name: 'Nebbia della Padania',      icon: '🌫️' },
  storm:  { name: 'Notte di Tempesta',         icon: '⛈️' },
  meteor: { name: 'Pioggia di Stelle Cadenti', icon: '☄️' },
};

/* ---------- Utility ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dateKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const fmt = (n) => Math.floor(n).toLocaleString('it-IT');
const $ = (id) => document.getElementById(id);

/* =====================================================================
   2. SALVATAGGIO (localStorage)
   ===================================================================== */
const SAVE_KEY = 'cowAbduction.save.v1';
function defaultSave() {
  return {
    v: 1, pilot: 'PILOTA', coins: 0, totalCows: 0, totalGolden: 0, highScore: 0, bestDistance: 0, runs: 0,
    hearts: CFG.MAX_HEARTS, heartsTs: Date.now(), unlimited: false,
    upgrades: { beam: 0, shield: 0, hold: 0 },
    levels: {},                       // id livello -> mucche raccolte (completato)
    sectorsDone: [],
    ufoSkins: ['classic'], ufoSkin: 'classic',
    cowSkins: ['standard'], cowSkin: 'standard',
    goldenStock: 0, lab: { lastTs: Date.now(), silo: 0 },
    achievements: {},
    leaderboard: [],
    daily: { lastDone: null, streak: 0 },
    quests: { date: null, ids: [], progress: {}, claimed: {} },
    settings: { music: true, sfx: true, vibration: true, quality: 'high' },
    tutorialDone: false,
  };
}
function deepMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(over)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && typeof over[k] === 'object' && !Array.isArray(over[k])) deepMerge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}
function loadSave() {
  try { return deepMerge(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); }
  catch (e) { return defaultSave(); }
}
let S = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage pieno o bloccato */ } }

/* --- Cuori (tentativi globali) --- */
function heartsActive() { return CFG.HEARTS_ENABLED && !S.unlimited; }
function refreshHearts() {
  if (!heartsActive()) return;
  const now = Date.now();
  while (S.hearts < CFG.MAX_HEARTS && now - S.heartsTs >= CFG.HEART_RECHARGE_MS) { S.hearts++; S.heartsTs += CFG.HEART_RECHARGE_MS; }
  if (S.hearts >= CFG.MAX_HEARTS) S.heartsTs = now;
}
function consumeHeart() {
  if (!heartsActive()) return;
  refreshHearts();
  if (S.hearts >= CFG.MAX_HEARTS) S.heartsTs = Date.now();
  S.hearts = Math.max(0, S.hearts - 1); persist();
}
function nextHeartMs() { return Math.max(0, CFG.HEART_RECHARGE_MS - (Date.now() - S.heartsTs)); }

/* --- Bonus passivi (upgrade + settori completati) --- */
const sectorDone = (i) => S.sectorsDone.includes(i);
function abductTime() { return CFG.BASE_ABDUCT_TIME * (1 - 0.12 * S.upgrades.beam) * (sectorDone(1) ? 0.9 : 1); }
function startShields() { return S.upgrades.shield + (sectorDone(2) ? 1 : 0); }
function startLives() { return CFG.START_LIVES + (sectorDone(4) ? 1 : 0); }
function coinBonus() { return 1 + 0.15 * S.upgrades.hold + (sectorDone(0) ? 0.10 : 0); }
function goldChanceBonus() { return sectorDone(3) ? 0.05 : 0; }
function labSlots() { return 2 + S.upgrades.hold; }
function siloCap() { return 300 + 200 * S.upgrades.hold; }

/* --- Laboratorio idle: le Mucche Dorate producono monete anche ad app chiusa --- */
function tickLab() {
  const now = Date.now();
  const mins = (now - S.lab.lastTs) / 60000;
  const producers = Math.min(S.goldenStock, labSlots());
  if (producers > 0 && mins > 0) S.lab.silo = Math.min(siloCap(), S.lab.silo + mins * producers * CFG.LAB_RATE_PER_MIN);
  S.lab.lastTs = now;
}

/* --- Missioni giornaliere --- */
function ensureQuests() {
  const dk = dateKey();
  if (S.quests.date === dk) return;
  const r = mulberry32(hashStr('q' + dk));
  const pool = QUEST_POOL.slice(); const ids = [];
  while (ids.length < 3) ids.push(pool.splice((r() * pool.length) | 0, 1)[0].id);
  S.quests = { date: dk, ids, progress: {}, claimed: {} }; persist();
}
function questProgress(id, amount) {
  ensureQuests();
  if (!S.quests.ids.includes(id)) return;
  const q = QUEST_POOL.find(x => x.id === id);
  const before = S.quests.progress[id] || 0;
  S.quests.progress[id] = Math.min(q.goal, before + amount);
  if (before < q.goal && S.quests.progress[id] >= q.goal) toast(`✅ Missione completata: ${q.text} — riscuoti nel menu`);
}
function todayChallenge() { const r = mulberry32(hashStr('d' + dateKey())); return DAILY_CHALLENGES[(r() * DAILY_CHALLENGES.length) | 0]; }

/* --- Trofei --- */
function unlock(id) {
  if (S.achievements[id]) return;
  const a = ACHIEVEMENTS.find(x => x.id === id); if (!a) return;
  S.achievements[id] = Date.now(); S.coins += a.reward; persist();
  toast(`🏆 <b>${a.name}</b> — +${a.reward} 🪙`); Audio.powerup();
}

/* --- AdService: unico punto da collegare ad AdMob (rewarded) in futuro ---
   Oggi: nessun annuncio, la ricompensa viene concessa subito (bonus gratuito). */
const AdService = {
  enabled: false,
  showRewarded(placement, onReward) { onReward(); },
};

/* =====================================================================
   3. AUDIO PROCEDURALE (Web Audio API)
   ===================================================================== */
const Audio = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  let beamNodes = null;
  const mus = { on: false, step: 0, next: 0, timer: null, bpm: 112, panic: false };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildBeam(); apply(); startMusic();
  }
  function apply() { if (!ctx) return; musicBus.gain.value = S.settings.music ? 0.3 : 0; sfxBus.gain.value = S.settings.sfx ? 0.9 : 0; }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
  function tone(type, f, dur, vol = 0.2, dest = sfxBus, t = ctx.currentTime, glideTo = null) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  /* Ronzio del raggio: oscillatori persistenti con frequenza variabile in base al progresso */
  function buildBeam() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
    const f = ctx.createBiquadFilter(), g = ctx.createGain(), lg = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'sine'; o1.frequency.value = 70; o2.frequency.value = 140;
    f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 8;
    lfo.frequency.value = 7; lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency);
    g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus);
    o1.start(); o2.start(); lfo.start();
    beamNodes = { o1, o2, f, g, lfo };
  }
  function beam(active, progress) {
    if (!ctx || !beamNodes) return;
    const t = ctx.currentTime, b = beamNodes;
    b.g.gain.setTargetAtTime(active ? 0.13 : 0, t, 0.05);
    b.o1.frequency.setTargetAtTime(70 + progress * 170, t, 0.06);
    b.o2.frequency.setTargetAtTime(140 + progress * 340, t, 0.06);
    b.f.frequency.setTargetAtTime(500 + progress * 2200, t, 0.06);
    b.lfo.frequency.setTargetAtTime(6 + progress * 12, t, 0.1);
  }
  /* "Moo" acuto: dente di sega con glide + filtro formante + vibrato */
  function moo(kind = 'std') {
    if (!ctx) return; const t = ctx.currentTime;
    const base = kind === 'gold' ? 520 : kind === 'bull' ? 180 : 360;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), v = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(base * 1.25, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.6);
    v.frequency.value = 9; vg.gain.value = 12; v.connect(vg); vg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.setValueAtTime(800, t); f.frequency.linearRampToValueAtTime(1300, t + 0.6); f.Q.value = 3;
    env(g, t, 0.04, 0.35, 0.65); o.connect(f); f.connect(g); g.connect(sfxBus);
    o.start(t); v.start(t); o.stop(t + 0.8); v.stop(t + 0.8);
    if (kind === 'gold') { [0, 0.08, 0.16].forEach((d, i) => tone('triangle', 1046 * Math.pow(1.26, i), 0.15, 0.12, sfxBus, t + 0.3 + d)); }
  }
  /* Frenata + impatto */
  function crash() {
    if (!ctx) return; const t = ctx.currentTime;
    const n = noiseSrc(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.setValueAtTime(3200, t); bp.frequency.exponentialRampToValueAtTime(700, t + 0.35);
    env(g, t, 0.01, 0.35, 0.35); n.connect(bp); bp.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + 0.4);
    const n2 = noiseSrc(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 900; env(g2, t + 0.3, 0.005, 0.9, 0.6);
    n2.connect(lp); lp.connect(g2); g2.connect(sfxBus); n2.start(t + 0.3); n2.stop(t + 1);
    tone('sine', 110, 0.5, 0.7, sfxBus, t + 0.3, 35);
  }
  function shieldHit() { if (!ctx) return; const t = ctx.currentTime; tone('square', 880, 0.25, 0.15, sfxBus, t, 220); tone('sine', 1320, 0.3, 0.1, sfxBus, t + 0.03, 330); }
  function closeCall() {
    if (!ctx) return; const t = ctx.currentTime;
    const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(4000, t + 0.3);
    env(g, t, 0.05, 0.3, 0.3); n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + 0.4);
    [0, 4, 7, 12].forEach((s, i) => tone('square', mtof(76 + s), 0.12, 0.08, sfxBus, t + 0.05 + i * 0.05));
  }
  function coin() { if (!ctx) return; const t = ctx.currentTime; tone('square', 988, 0.07, 0.1, sfxBus, t); tone('square', 1319, 0.15, 0.1, sfxBus, t + 0.07); }
  function click() { if (!ctx) return; tone('triangle', 660, 0.06, 0.08); }
  function zap() { if (!ctx) return; const t = ctx.currentTime; tone('sawtooth', 1200, 0.4, 0.2, sfxBus, t, 60); tone('square', 90, 0.4, 0.15, sfxBus, t); }
  function powerup() { if (!ctx) return; const t = ctx.currentTime; [0, 4, 7, 12, 16].forEach((s, i) => tone('triangle', mtof(72 + s), 0.18, 0.1, sfxBus, t + i * 0.06)); }
  function alarm() { if (!ctx) return; const t = ctx.currentTime; for (let i = 0; i < 4; i++) { tone('square', 880, 0.12, 0.12, sfxBus, t + i * 0.25); tone('square', 660, 0.12, 0.12, sfxBus, t + i * 0.25 + 0.12); } }
  function thunder() {
    if (!ctx) return; const t = ctx.currentTime;
    const n = noiseSrc(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.8);
    env(g, t, 0.01, 0.9, 1.8); n.connect(lp); lp.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + 2);
  }
  function crackle() { if (!ctx) return; const t = ctx.currentTime; for (let i = 0; i < 5; i++) tone('square', rand(2000, 5000), 0.03, 0.05, sfxBus, t + i * 0.09); }
  function impact() { if (!ctx) return; const t = ctx.currentTime; tone('sine', 140, 0.6, 0.6, sfxBus, t, 30); const n = noiseSrc(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1400; env(g, t, 0.005, 0.5, 0.5); n.connect(lp); lp.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + 0.6); }
  function whoosh() { if (!ctx) return; const t = ctx.currentTime; const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.25); env(g, t, 0.02, 0.12, 0.25); n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + 0.3); }

  /* --- Musica synthwave 8-bit: sequencer a 16 step con lookahead --- */
  const PROG = [ // accordi (midi) e basso: Am - F - C - G
    { bass: 45, chord: [57, 60, 64] }, { bass: 41, chord: [53, 57, 60] },
    { bass: 48, chord: [55, 60, 64] }, { bass: 43, chord: [55, 59, 62] },
  ];
  const LEAD = [76, null, 72, null, 74, 76, null, 79, null, 76, null, 74, 72, null, 69, null];
  function startMusic() {
    if (mus.on) return; mus.on = true; mus.next = ctx.currentTime + 0.1; mus.step = 0;
    mus.timer = setInterval(schedule, 25);
  }
  function setPanicMusic(p) { mus.panic = p; mus.bpm = p ? 142 : 112; }
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const stepDur = 60 / mus.bpm / 4;
    while (mus.next < ctx.currentTime + 0.12) { playStep(mus.step, mus.next, stepDur); mus.next += stepDur; mus.step = (mus.step + 1) % 256; }
  }
  function playStep(step, t, sd) {
    const bar = Math.floor(step / 16) % 4, s = step % 16, ch = PROG[bar];
    const dest = musicBus;
    // Cassa / rullante / charleston
    if (s % 4 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); env(g, t, 0.002, 0.9, 0.18); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.25); }
    if (s === 4 || s === 12) { const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 1500; env(g, t, 0.002, 0.35, 0.13); n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.16); }
    if (s % 2 === 1 || mus.panic) { const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 7000; env(g, t, 0.001, 0.1, 0.03); n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.05); }
    // Basso in ottavi
    if (s % 2 === 0) { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(ch.bass + (s % 4 === 2 ? 12 : 0)); f.type = 'lowpass'; f.frequency.value = 700; env(g, t, 0.005, 0.32, sd * 1.6); o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + sd * 2); }
    // Arpeggio 8-bit
    { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = mtof(ch.chord[s % 3] + 12); env(g, t, 0.003, 0.045, sd * 0.8); o.connect(g); g.connect(dest); o.start(t); o.stop(t + sd); }
    // Pad a inizio battuta
    if (s === 0) ch.chord.forEach(m => { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.detune.value = rand(-8, 8); o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.value = 1100; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + sd * 4); g.gain.linearRampToValueAtTime(0.0001, t + sd * 16); o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + sd * 16 + 0.05); });
    // Lead (ogni 2 giri)
    if (Math.floor(step / 64) % 2 === 1 && LEAD[s]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = mtof(LEAD[s] + (bar === 1 ? -4 : bar === 3 ? -2 : 0)); env(g, t, 0.005, 0.07, sd * 1.8); o.connect(g); g.connect(dest); o.start(t); o.stop(t + sd * 2); }
  }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  return { init, apply, beam, moo, crash, shieldHit, closeCall, coin, click, zap, powerup, alarm, thunder, crackle, impact, whoosh, setPanicMusic, suspend, resume };
})();

function vibrate(ms) { if (S.settings.vibration && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }
