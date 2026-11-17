
/* =====================================================================
   7. UI / SCHERMATE
   ===================================================================== */
let currentScreen = 'menu', labTab = 'upg';
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  currentScreen = name;
  if (!name) return;
  const renderers = { menu: renderMenu, map: renderMap, lab: renderLab, trophies: renderTrophies, leader: renderLeader, daily: renderDaily, settings: renderSettings, pause: renderPause };
  renderers[name] && renderers[name]();
  $('scr-' + name).classList.add('active');
}
function goMenu() {
  G.state = 'menu'; clearEntities(); releaseLock(); G.panicT = 0; G.slowmoT = 0; G.locked = null;
  $('hud').classList.add('hidden'); $('touch').classList.remove('on'); $('beamUses').classList.add('hidden'); $('countdown').classList.add('hidden');
  $('panicTint').style.opacity = 0; hideBanner(); Audio.setPanicMusic(false);
  setWeather('clear'); showScreen('menu');
}
function toast(html) { const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = html; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3300); }
function popup(text, color, topPct = 45) { const d = document.createElement('div'); d.className = 'pop'; d.style.top = topPct + '%'; d.style.color = color; d.style.fontSize = text.length > 16 ? '22px' : '30px'; d.textContent = text; $('popups').appendChild(d); setTimeout(() => d.remove(), 1150); }
let bannerTimer = null, bannerHTML = '';
function showBanner(html, cls, dur) {
  const b = $('banner'); if (html !== bannerHTML) { b.innerHTML = html; bannerHTML = html; }
  b.className = 'show ' + cls; clearTimeout(bannerTimer); bannerTimer = setTimeout(hideBanner, dur * 1000);
}
function hideBanner() { $('banner').className = ''; bannerHTML = ''; }
function flashDOM(id, op, dur) { const el = $(id); el.style.transition = 'none'; el.style.opacity = op; void el.offsetWidth; el.style.transition = `opacity ${dur}s ease-out`; el.style.opacity = 0; }

let hudLast = 0;
function updateHUD(force = false) {
  const now = performance.now(); if (!force && now - hudLast < 90) return; hudLast = now;
  $('hudScore').textContent = fmt(G.score);
  $('hudCows').textContent = `🐄 ${G.cows}${G.target ? ' / ' + G.target : ''}`;
  const m = $('hudMult'); m.classList.toggle('hidden', G.mult <= 1); m.textContent = 'x' + G.mult;
  $('hudLives').textContent = '♥'.repeat(Math.max(0, G.lives)) + '♡'.repeat(Math.max(0, startLives() - G.lives));
  $('hudShields').textContent = G.shields > 0 ? '🛡️'.repeat(G.shields) : '';
  const fin = isFinite(G.goalDist);
  $('progressBar').style.width = (fin ? clamp(G.distance / G.goalDist, 0, 1) * 100 : (G.distance % 900) / 9) + '%';
  $('hudGoal').textContent = fin ? `${fmt(G.distance)} / ${fmt(G.goalDist)} m` : `${fmt(G.distance)} m · record ${fmt(S.bestDistance)} m`;
  const bu = $('beamUI'); bu.classList.toggle('show', !!G.locked || G.beamDisabledT > 0);
  $('beamBar').style.width = (G.lockProgress || 0) * 100 + '%';
  $('beamLabel').textContent = G.beamDisabledT > 0 ? 'RAGGIO IN TILT' : G.power ? (G.power === 'turbo' ? 'SUPER RAGGIO' : 'CALAMITA') : 'ABDUCTION';
  if (isFinite(G.beamUses)) $('beamUses').textContent = `⚡ ${G.beamUses}`;
}

/* --- Menu principale --- */
function heartsHTML() {
  if (!heartsActive()) return '';
  refreshHearts(); const ms = nextHeartMs();
  const t = S.hearts < CFG.MAX_HEARTS ? ` <span class="muted">+1 in ${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}</span>` : '';
  return `<span style="color:var(--red)">${'❤'.repeat(S.hearts)}${'♡'.repeat(CFG.MAX_HEARTS - S.hearts)}</span>${t}`;
}
function questsHTML() {
  ensureQuests();
  return S.quests.ids.map(id => {
    const q = QUEST_POOL.find(x => x.id === id), p = Math.floor(S.quests.progress[id] || 0), done = p >= q.goal, claimed = S.quests.claimed[id];
    return `<div class="card ${done ? 'done' : ''}"><div class="row"><div><b>${q.text}</b><div class="muted">${fmt(p)} / ${fmt(q.goal)} · ${q.reward} 🪙</div></div>
      ${claimed ? '<span class="badge ok">✓</span>' : done ? `<button class="btn sm gold" data-act="claim:${id}">Riscuoti</button>` : ''}</div></div>`;
  }).join('');
}
function renderMenu() {
  tickLab();
  const silo = Math.floor(S.lab.silo);
  $('pnl-menu').innerHTML = `
    <div id="topbar"><span>🪙 ${fmt(S.coins)}</span><span>${heartsHTML()}</span></div>
    <div class="logo title-font">COW ABDUCTION<small>NIGHT HIGHWAY</small></div>
    <div class="stats"><span class="stat">Record <b>${fmt(S.highScore)}</b></span><span class="stat">Mucche totali <b>${fmt(S.totalCows)}</b></span></div>
    <button class="btn" data-act="open:map">🛸 CAMPAGNA</button>
    <div class="grid2">
      <button class="btn alt" data-act="play:endless">∞ INFINITA</button>
      <button class="btn pink" data-act="open:daily">📅 SFIDA DEL GIORNO</button>
      <button class="btn alt" data-act="open:lab">🧪 LABORATORIO${silo > 0 ? ` <span class="badge gold">${silo}</span>` : ''}</button>
      <button class="btn alt" data-act="open:trophies">🏆 TROFEI</button>
      <button class="btn alt" data-act="open:leader">📊 CLASSIFICA</button>
      <button class="btn ghost" data-act="open:settings">⚙️ OPZIONI</button>
    </div>
    <h2 style="font-size:16px;margin-top:10px">Missioni di oggi</h2>${questsHTML()}
    <p class="muted" style="text-align:center">Desktop: ←/→ o A/D · SPAZIO = raggio · P = pausa<br>Mobile: frecce o swipe · tieni premuto ABDUCT</p>`;
}

/* --- Mappa della Base Aliena --- */
function renderMap() {
  let html = `<div id="topbar"><button class="btn sm ghost" data-act="open:menu">← Menu</button><span>🪙 ${fmt(S.coins)}</span></div><h2>🗺️ Mappa della Base Aliena</h2>`;
  SECTORS.forEach((s, si) => {
    const done = sectorDone(si);
    const pens = [0, 1, 2, 3, 4].map(l => { const c = S.levels[si * 5 + l]; return `<div class="pen ${c !== undefined ? 'full' : ''}">${c !== undefined ? '🐄'.repeat(Math.min(3, Math.ceil(c / 6))) + `<small>${c}</small>` : ''}</div>`; }).join('');
    const lv = [0, 1, 2, 3, 4].map(l => { const id = si * 5 + l; const unlockedL = id === 0 || S.levels[id - 1] !== undefined; return `<button class="lvl ${S.levels[id] !== undefined ? 'done' : ''}" data-act="level:${id}" ${unlockedL ? '' : 'disabled'}>${l + 1}</button>`; }).join('');
    const sk = UFO_SKINS[s.skin];
    html += `<div class="card ${done ? 'done' : ''}"><div class="row"><h3>${s.icon} Settore ${si + 1}: ${s.name}</h3>${done ? '<span class="badge ok">COMPLETATO</span>' : ''}</div>
      <div class="muted">Recinto spaziale</div><div class="fence">${pens}</div><div class="lvls">${lv}</div>
      <div class="muted" style="margin-top:6px">Premio: skin <b>${sk.name}</b> + <b>${s.passive}</b></div></div>`;
  });
  $('pnl-map').innerHTML = html;
}

/* --- Laboratorio Alieno (shop, mutazioni idle, hangar skin) --- */
function renderLab() {
  tickLab();
  let html = `<div id="topbar"><button class="btn sm ghost" data-act="open:menu">← Menu</button><span>🪙 ${fmt(S.coins)}</span></div><h2>🧪 Laboratorio Alieno</h2>
    <div class="tabs"><button class="tab ${labTab === 'upg' ? 'on' : ''}" data-act="labtab:upg">Upgrade</button><button class="tab ${labTab === 'mut' ? 'on' : ''}" data-act="labtab:mut">Mutazioni</button><button class="tab ${labTab === 'hangar' ? 'on' : ''}" data-act="labtab:hangar">Hangar</button></div>`;
  if (labTab === 'upg') {
    for (const [k, u] of Object.entries(UPGRADES)) {
      const lvl = S.upgrades[k], max = u.costs.length, cost = u.costs[lvl];
      html += `<div class="card"><div class="row"><div><h3>${u.icon} ${u.name}</h3><div class="muted">${u.desc}</div>
        <div class="pips">${u.costs.map((_, i) => `<span class="pip ${i < lvl ? 'on' : ''}"></span>`).join('')}</div></div>
        ${lvl >= max ? '<span class="badge ok">MAX</span>' : `<button class="btn sm gold" data-act="buy:${k}" ${S.coins < cost ? 'disabled' : ''}>${cost} 🪙</button>`}</div></div>`;
    }
    html += `<p class="muted">Tempo di rapimento attuale: <b>${abductTime().toFixed(2)}s</b> · Scudi: <b>${startShields()}</b> · Bonus monete: <b>+${Math.round((coinBonus() - 1) * 100)}%</b></p>`;
  } else if (labTab === 'mut') {
    const prod = Math.min(S.goldenStock, labSlots()), silo = Math.floor(S.lab.silo);
    html += `<div class="card"><h3>🏭 Stalle di ricerca</h3><div class="muted">Le Mucche Dorate rapite lavorano per te, anche ad app chiusa: ${CFG.LAB_RATE_PER_MIN} 🪙/min ciascuna.</div>
      <p>Dorate in stiva: <b>${S.goldenStock}</b> · al lavoro: <b>${prod}/${labSlots()}</b><br>Silo: <b>${silo} / ${siloCap()}</b> 🪙</p>
      <button class="btn gold" data-act="collect" ${silo < 1 ? 'disabled' : ''}>Raccogli ${silo} 🪙</button></div>
      <div class="card"><h3>🧬 Incrocio genetico</h3><div class="muted">Costa ${CFG.CROSSBREED_COST} 🪙 + 1 Mucca Dorata. Genera una nuova razza casuale (duplicato = rimborso 60 🪙).</div>
      <button class="btn pink" data-act="breed" ${S.coins < CFG.CROSSBREED_COST || S.goldenStock < 1 ? 'disabled' : ''}>Avvia incrocio</button></div>
      <h3>Razze sbloccate (${S.cowSkins.length}/${Object.keys(COW_SKINS).length})</h3>`;
    for (const [k, c] of Object.entries(COW_SKINS)) {
      const own = S.cowSkins.includes(k);
      html += `<div class="card ${own ? '' : 'locked'}"><div class="row"><div><b>${own ? c.name : '???'}</b></div>
        ${own ? (S.cowSkin === k ? '<span class="badge ok">IN USO</span>' : `<button class="btn sm alt" data-act="cowskin:${k}">Usa</button>`) : '<span class="badge">🔒</span>'}</div></div>`;
    }
  } else {
    for (const [k, s] of Object.entries(UFO_SKINS)) {
      const own = S.ufoSkins.includes(k);
      html += `<div class="card ${own ? '' : 'locked'}"><div class="row"><div><b>${s.name}</b><div class="muted">${own ? 'Sbloccata' : s.how}</div></div>
        ${own ? (S.ufoSkin === k ? '<span class="badge ok">IN USO</span>' : `<button class="btn sm alt" data-act="ufoskin:${k}">Equipaggia</button>`) : '<span class="badge">🔒</span>'}</div></div>`;
    }
  }
  $('pnl-lab').innerHTML = html;
}
function renderTrophies() {
  const n = Object.keys(S.achievements).length;
  $('pnl-trophies').innerHTML = `<div id="topbar"><button class="btn sm ghost" data-act="open:menu">← Menu</button><span>${n}/${ACHIEVEMENTS.length}</span></div><h2>🏆 Trofei</h2>` +
    ACHIEVEMENTS.map(a => `<div class="card ${S.achievements[a.id] ? 'done' : 'locked'}"><div class="row"><div><b>${S.achievements[a.id] ? '🏆' : '🔒'} ${a.name}</b><div class="muted">${a.desc}</div></div><span class="badge gold">${a.reward} 🪙</span></div></div>`).join('');
}
function renderLeader() {
  const rows = S.leaderboard.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHTML(r.name)}</td><td>${fmt(r.score)}</td><td>${r.cows}</td><td>${fmt(r.dist)}m</td><td>${r.mode === 'endless' ? '∞' : r.mode === 'daily' ? '📅' : '🗺️'}</td></tr>`).join('');
  $('pnl-leader').innerHTML = `<div id="topbar"><button class="btn sm ghost" data-act="open:menu">← Menu</button><span></span></div><h2>📊 Classifica</h2>
    <div class="stats"><span class="stat">High Score <b>${fmt(S.highScore)}</b></span><span class="stat">Mucche totali <b>${fmt(S.totalCows)}</b></span><span class="stat">Distanza max <b>${fmt(S.bestDistance)}m</b></span></div>
    <label class="muted">Nome pilota</label><input type="text" id="pilotName" maxlength="14" value="${escapeHTML(S.pilot)}">
    <table style="margin-top:10px"><tr><th>#</th><th>Pilota</th><th>Punti</th><th>🐄</th><th>Dist.</th><th></th></tr>${rows || '<tr><td colspan="6" class="muted">Nessuna partita ancora. Vai a rapire!</td></tr>'}</table>
    <button class="btn" data-act="play:endless" style="margin-top:12px">Ancora una partita!</button>`;
  $('pilotName').addEventListener('input', (e) => { S.pilot = e.target.value.trim().slice(0, 14) || 'PILOTA'; persist(); });
}
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function renderDaily() {
  const ch = todayChallenge(), done = S.daily.lastDone === dateKey();
  $('pnl-daily').innerHTML = `<div id="topbar"><button class="btn sm ghost" data-act="open:menu">← Menu</button><span>🔥 Serie: ${S.daily.streak}</span></div><h2>📅 Sfida del Giorno</h2>
    <div class="card ${done ? 'done' : ''}"><h3>${ch.name}</h3><p>${ch.desc}</p><p class="muted">Obiettivo: 15 🐄 in 1.300 m · Premio: ${150 + 50 * Math.min(S.daily.streak + 1, 5)} 🪙 (cresce con la serie)</p>
    ${done ? '<span class="badge ok">COMPLETATA OGGI — torna domani!</span>' : ''}</div>
    <button class="btn pink" data-act="play:daily">${done ? 'Rigioca (senza premio)' : 'Accetta la sfida'}</button>
    <h2 style="font-size:16px">Missioni di oggi</h2>${questsHTML()}`;
}
function renderSettings() {
  const t = (k, label) => `<div class="toggle"><span>${label}</span><button class="btn sm ${S.settings[k] ? '' : 'ghost'}" data-act="toggle:${k}">${S.settings[k] ? 'ON' : 'OFF'}</button></div>`;
  $('pnl-settings').innerHTML = `<div id="topbar"><button class="btn sm ghost" data-act="open:menu">← Menu</button><span></span></div><h2>⚙️ Opzioni</h2>
    ${t('music', '🎵 Musica')}${t('sfx', '🔊 Effetti sonori')}${t('vibration', '📳 Vibrazione')}
    <div class="toggle"><span>🖥️ Qualità grafica</span><button class="btn sm alt" data-act="quality">${S.settings.quality === 'high' ? 'ALTA' : 'BASSA'}</button></div>
    <button class="btn ghost" data-act="reset" style="margin-top:16px;border-color:var(--red)">Cancella progressi</button>
    <p class="muted" style="text-align:center">Cow Abduction – Night Highway · v1.0</p>`;
}
function renderPause() {
  $('pnl-pause').innerHTML = `<h2>❚❚ Pausa</h2><div class="stats"><span class="stat">Punti <b>${fmt(G.score)}</b></span><span class="stat">🐄 <b>${G.cows}</b></span></div>
    <button class="btn" data-act="resume">▶ Riprendi</button><button class="btn alt" data-act="open:settings-pause">⚙️ Opzioni audio</button><button class="btn ghost" data-act="quit">Abbandona partita</button>`;
}
/* --- Schermata Game Over / fine livello (con revive e raddoppio) --- */
function renderOver() {
  const r = G.endReason;
  const title = r === 'complete' ? '🎉 LIVELLO COMPLETATO' : r === 'missed' ? '😿 OBIETTIVO MANCATO' : '💥 GAME OVER';
  const adLbl = (txt) => AdService.enabled ? `🎬 ${txt} (video)` : `🎁 ${txt} (bonus)`;
  let btns = '';
  if (r === 'dead' && !G.revived) btns += `<button class="btn" data-act="revive">${adLbl('Rinasci con 1 vita')}</button>`;
  if (!G.doubled && G.cows > 0) btns += `<button class="btn gold" data-act="double">${adLbl('Raddoppia le mucche')}</button>`;
  if (CFG.IAP_ENABLED && !S.unlimited) btns += `<button class="btn pink" data-act="iap">💎 Pacchetto Illimitato</button>`;
  if (r === 'complete' && G.mode === 'level' && G.level.id < 24) btns += `<button class="btn alt" data-act="finish:next">Livello successivo ▶</button>`;
  if (r !== 'complete' && G.mode !== 'endless') btns += `<button class="btn alt" data-act="finish:retry">↻ Riprova</button>`;
  if (G.mode === 'endless') btns += `<button class="btn alt" data-act="finish:retry">↻ Ancora una partita</button>`;
  btns += `<button class="btn ghost" data-act="finish:menu">Raccogli e torna al menu</button>`;
  const coinsPrev = Math.round(G.cows * coinBonus() * (G.doubled ? 2 : 1));
  $('pnl-over').innerHTML = `<h2>${title}</h2>
    <div class="stats"><span class="stat">Punti <b>${fmt(G.score)}</b></span><span class="stat">🐄 <b>${G.cows}${G.target ? '/' + G.target : ''}</b></span><span class="stat">Distanza <b>${fmt(G.distance)}m</b></span></div>
    <div class="stats"><span class="stat">Close Call <b>${G.closeCalls}</b></span><span class="stat">Dorate <b>${G.golden}</b></span><span class="stat">Monete <b>~${coinsPrev}</b> 🪙${G.doubled ? ' (x2)' : ''}</span></div>
    ${Math.floor(G.score) > S.highScore ? '<p style="text-align:center;color:var(--gold);font-weight:900">⭐ NUOVO RECORD! ⭐</p>' : ''}
    ${btns}`;
  showScreen(null); $('scr-over').classList.add('active'); currentScreen = 'over';
}
function modal(html) { $('pnl-modal').innerHTML = html; document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); $('scr-modal').classList.add('active'); currentScreen = 'modal'; }
function showNoHearts() {
  modal(`<h2>❤ Energia UFO esaurita</h2><p style="text-align:center">Il prossimo cuore arriva tra ${Math.ceil(nextHeartMs() / 60000)} min.</p>
    <button class="btn" data-act="heartad">${AdService.enabled ? '🎬 Guarda un video: +1 ❤' : '🎁 +1 ❤ (bonus)'}</button>
    <button class="btn alt" data-act="play:endless">Gioca in Infinita (gratis)</button><button class="btn ghost" data-act="open:menu">Menu</button>`);
}
function showResults(coins) {
  let extra = '';
  if (G.sectorUnlocked !== undefined && G.sectorUnlocked !== null) {
    const s = SECTORS[G.sectorUnlocked];
    extra = `<div class="card done"><h3>${s.icon} Settore completato: ${s.name}!</h3><p>Nuova skin UFO: <b>${UFO_SKINS[s.skin].name}</b><br>Bonus permanente: <b>${s.passive}</b></p><button class="btn sm alt" data-act="ufoskin:${s.skin}">Equipaggia ora</button></div>`;
    G.sectorUnlocked = null;
  }
  return `<h2>Bottino</h2><p style="text-align:center;font-size:22px;font-weight:900;color:var(--gold)">+${coins} 🪙</p>${extra}`;
}

/* --- Gestore azioni (click delegato) --- */
function finish(next) {
  const coins = finalizeRun(); const res = showResults(coins);
  const lvl = G.level, mode = G.mode;
  if (next === 'menu') { goMenu(); toast(`Bottino: +${coins} 🪙`); if (res.includes('Settore completato')) modal(res + `<button class="btn" data-act="open:map">Vai alla mappa</button>`); return; }
  if (next === 'next') { modal(res + `<button class="btn" data-act="level:${lvl.id + 1}">Livello successivo ▶</button><button class="btn ghost" data-act="open:map">Mappa</button>`); return; }
  if (next === 'retry') { if (mode === 'level') startRun('level', { level: lvl.id }); else startRun(mode); toast(`Bottino: +${coins} 🪙`); }
}
function act(a, el) {
  Audio.init(); Audio.click();
  const [cmd, arg] = a.split(':');
  switch (cmd) {
    case 'open':
      if (arg === 'settings-pause') { showScreen('settings'); $('pnl-settings').querySelector('[data-act="open:menu"]').setAttribute('data-act', 'open:pause'); return; }
      if (arg === 'menu' && G.state !== 'menu') { goMenu(); return; }
      showScreen(arg); break;
    case 'play': startRun(arg); break;
    case 'level': startRun('level', { level: +arg }); break;
    case 'labtab': labTab = arg; renderLab(); break;
    case 'buy': { const u = UPGRADES[arg], c = u.costs[S.upgrades[arg]]; if (c !== undefined && S.coins >= c) { S.coins -= c; S.upgrades[arg]++; persist(); Audio.powerup(); } renderLab(); break; }
    case 'collect': { tickLab(); const n = Math.floor(S.lab.silo); S.coins += n; S.lab.silo -= n; persist(); Audio.coin(); toast(`+${n} 🪙 dal laboratorio`); renderLab(); break; }
    case 'breed': {
      if (S.coins < CFG.CROSSBREED_COST || S.goldenStock < 1) return;
      S.coins -= CFG.CROSSBREED_COST; S.goldenStock--;
      const k = pick(Object.keys(COW_SKINS).filter(x => x !== 'standard'));
      if (S.cowSkins.includes(k)) { S.coins += 60; toast(`🧬 Duplicato: ${COW_SKINS[k].name} — rimborso 60 🪙`); }
      else { S.cowSkins.push(k); toast(`🧬 Nuova razza: <b>${COW_SKINS[k].name}</b>!`); Audio.powerup(); }
      unlock('genetist'); if (S.cowSkins.length >= Object.keys(COW_SKINS).length) unlock('collector');
      persist(); renderLab(); break;
    }
    case 'cowskin': S.cowSkin = arg; persist(); renderLab(); break;
    case 'ufoskin': if (S.ufoSkins.includes(arg)) { S.ufoSkin = arg; persist(); setUFOSkin(arg); } if (currentScreen === 'lab') renderLab(); else toast(`Skin equipaggiata: ${UFO_SKINS[arg].name}`); break;
    case 'claim': { const q = QUEST_POOL.find(x => x.id === arg); if ((S.quests.progress[arg] || 0) >= q.goal && !S.quests.claimed[arg]) { S.quests.claimed[arg] = true; S.coins += q.reward; persist(); Audio.coin(); } showScreen(currentScreen); break; }
    case 'toggle': S.settings[arg] = !S.settings[arg]; persist(); Audio.apply(); renderSettings(); break;
    case 'quality': S.settings.quality = S.settings.quality === 'high' ? 'low' : 'high'; persist(); applyQuality(); resize(); renderSettings(); break;
    case 'reset': if (confirm('Cancellare tutti i progressi?')) { localStorage.removeItem(SAVE_KEY); S = defaultSave(); persist(); setUFOSkin('classic'); showScreen('menu'); } break;
    case 'pause': pauseGame(); break;
    case 'resume': resumeGame(); break;
    case 'quit': finishQuit(); break;
    case 'revive': AdService.showRewarded('revive', () => revive()); break;
    case 'double': AdService.showRewarded('double', () => { G.doubled = true; Audio.coin(); renderOver(); }); break;
    case 'iap': modal(`<h2>💎 Pacchetto Illimitato</h2><p>Cuori infiniti e nessuna pubblicità.</p><button class="btn pink" data-act="iapok">Acquista</button><button class="btn ghost" data-act="iapno">Annulla</button>`); break;
    case 'iapno': renderOver(); break;
    case 'iapok': toast('Acquisti non ancora attivi in questa versione'); renderOver(); break;
    case 'heartad': AdService.showRewarded('heart', () => { S.hearts = Math.min(CFG.MAX_HEARTS, S.hearts + 1); persist(); showScreen('menu'); }); break;
    case 'finish': finish(arg); break;
  }
}
function finishQuit() { // abbandono: niente monete per livelli/sfide (consuma un cuore), in Infinita si raccoglie
  if (G.mode === 'endless') { G.endReason = 'dead'; finish('menu'); return; }
  consumeHeart(); persist(); goMenu();
}
document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el && !el.disabled) act(el.getAttribute('data-act'), el); });

function pauseGame() { if (G.state !== 'playing' && G.state !== 'countdown') return; G.prevState = G.state; G.state = 'paused'; keysDown.beam = false; Audio.beam(false, 0); showScreen('pause'); }
function resumeGame() { if (G.state !== 'paused') return; showScreen(null); G.state = 'countdown'; G.countdown = 1.2; }

/* =====================================================================
   8. INPUT & MAIN LOOP
   ===================================================================== */
function moveLane(d) { if (G.state !== 'playing' && G.state !== 'countdown') return; const n = clamp(G.lane + d, 0, 2); if (n !== G.lane) { G.lane = n; Audio.whoosh(); } }
window.addEventListener('keydown', (e) => {
  Audio.init();
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') { moveLane(-1); e.preventDefault(); }
  else if (k === 'arrowright' || k === 'd') { moveLane(1); e.preventDefault(); }
  else if (k === ' ' || k === 'spacebar' || k === 'arrowup' || k === 'w') { keysDown.beam = true; e.preventDefault(); }
  else if (k === 'p' || k === 'escape') { G.state === 'paused' ? resumeGame() : pauseGame(); }
});
window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k === ' ' || k === 'spacebar' || k === 'arrowup' || k === 'w') keysDown.beam = false; });

/* Touch: pulsanti + swipe laterale sul canvas */
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
function holdBtn(id, down, up) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.init(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (_) { } down(); });
  const end = (e) => { el.classList.remove('down'); up && up(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}
holdBtn('tLeft', () => moveLane(-1)); holdBtn('tRight', () => moveLane(1));
holdBtn('tAbduct', () => { keysDown.beam = true; vibrate(10); }, () => { keysDown.beam = false; });
let swipe = null;
renderer.domElement.addEventListener('pointerdown', (e) => { Audio.init(); swipe = { x: e.clientX, y: e.clientY, used: false }; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.used) return; const dx = e.clientX - swipe.x;
  if (Math.abs(dx) > 35) { moveLane(dx > 0 ? 1 : -1); swipe.used = true; }
});
window.addEventListener('pointerup', () => { swipe = null; });

/* Pausa automatica quando l'app va in background */
document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseGame(); Audio.suspend(); } else Audio.resume(); });
/* Tasto Indietro Android (Capacitor App plugin, se presente) */
const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
if (CapApp) CapApp.addListener('backButton', () => {
  if (G.state === 'playing' || G.state === 'countdown') pauseGame();
  else if (G.state === 'paused') resumeGame();
  else if (currentScreen === 'over') act('finish:menu');
  else if (currentScreen && currentScreen !== 'menu') act(G.state === 'menu' ? 'open:menu' : 'open:pause');
  else CapApp.exitApp();
});

/* Main loop */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.state === 'paused' || G.freeze) { doRender(); return; }
  if (G.state === 'menu') { G.scrollSpeed = 9; G.t += dtReal; scrollWorld(9 * dtReal); updateUFOVisual(dtReal, dtReal); updateAtmosphere(dtReal); updateCamera(dtReal); updateHazards(dtReal); }
  else if (G.state === 'over') { G.t += dtReal; updateUFOVisual(dtReal, dtReal); updateCamera(dtReal); }
  else updateGame(dtReal);
  doRender();
}
/* Timer del menu (cuori e silo) */
setInterval(() => { if (currentScreen === 'menu' && G.state === 'menu' && heartsActive()) { const tb = document.querySelector('#topbar span:last-child'); if (tb) tb.innerHTML = heartsHTML(); } }, 1000);

camera.position.set(0, 7.4, 11.5);
showScreen('menu');
$('loading').remove();
requestAnimationFrame(frame);
window.__game = { G, get S() { return S; }, startRun, act, updateGame, cows, vehicles, spawnCow, spawnVehicle, setWeather, renderer, scene, camera, buildCow, buildVehicle, MODELS, doRender, bloomPass, beam, beamMat, beamPool, particles, updateParticles, get ufo() { return ufo; }, setUFOSkin, THREE }; // hook di debug/test
