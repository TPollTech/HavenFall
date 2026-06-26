'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};

  function safeLoadedIconSrc(name) {
    const key = name || 'icon_warn';
    if (typeof images === 'object' && images?.[key]?.src) return images[key].src;
    return null;
  }

  window.iconFrame = function iconFrame(icon, label = '', extraClass = '') {
    const src = safeLoadedIconSrc(icon);
    const title = typeof escapeHtml === 'function' ? escapeHtml(label || icon || 'Item') : String(label || icon || 'Item');
    const baseStyle = 'width:40px;height:40px;display:grid;place-items:center;border-radius:10px;border:1px solid rgba(255,255,255,.12);overflow:hidden;flex:0 0 40px;';

    if (!src) {
      return `<span class="ui-icon-fallback ${extraClass}" title="${title}" aria-hidden="true" style="${baseStyle}background:rgba(58,58,58,.88);color:#b8b0a0;font-size:16px;">▣</span>`;
    }

    const safeSrc = typeof escapeHtml === 'function' ? escapeHtml(src) : String(src);
    return `<span class="ui-icon-frame ${extraClass}" title="${title}" style="${baseStyle}background:rgba(8,11,16,.72);"><span style="display:none;color:#b8b0a0;font-size:16px;">▣</span><img src="${safeSrc}" alt="" style="max-width:34px;max-height:34px;object-fit:contain;display:block;" onerror="this.style.display='none';this.previousElementSibling.style.display='grid';"></span>`;
  };

  window.HavenfallContext.uiIconSafetyInstalled = true;
})();

(() => {
  window.HavenfallContext = window.HavenfallContext || {};
  if (window.HavenfallContext.alphaCriticalFixesWired) return;
  window.HavenfallContext.alphaCriticalFixesWired = true;

  const CSS_MODULES = ['src/css/01_global.css', 'src/css/02_game_canvas.css', 'src/css/03_hud_top.css', 'src/css/04_hud_bottom.css', 'src/css/05_modals.css'];
  const SAFE_RADIUS = 15;
  const MAX_MOBILE = 18;
  const MAX_HOSTILES = 6;
  const SEP_PX = 26;
  const IMPACT_T = 0.18;

  function loadCssModules() {
    CSS_MODULES.forEach((href) => {
      if (document.head?.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.havenfallCssModule = 'true';
      document.head?.appendChild(link);
    });
  }

  function d(a, b) { return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0)); }
  function hostileType(type) { return type === 'wolf' || type === 'spider'; }
  function allMobiles() { return [...(state?.mobs || []), ...(state?.wolves || [])].filter(Boolean); }
  function totalMobiles() { return allMobiles().length; }
  function hostileCount() { return (state?.wolves?.length || 0) + (state?.mobs || []).filter((m) => hostileType(m.type)).length; }
  function safeZone(x, y) { return (state?.colonists || []).some((c) => d({ x, y }, c) < SAFE_RADIUS); }
  function occupied(x, y) { return allMobiles().some((e) => Math.round(e.x) === x && Math.round(e.y) === y); }
  function tileOk(type, t) {
    if (!t) return false;
    if (typeof isInside === 'function' && !isInside(t.x, t.y)) return false;
    if (typeof isBlocked === 'function' && isBlocked(t.x, t.y)) return false;
    if (typeof getObjectAt === 'function' && getObjectAt(t.x, t.y)) return false;
    if (occupied(t.x, t.y)) return false;
    if (hostileType(type) && safeZone(t.x, t.y)) return false;
    return true;
  }
  function randomSafeTile(type, edge = hostileType(type)) {
    const cols = typeof getWorldCols === 'function' ? getWorldCols() : 64;
    const rows = typeof getWorldRows === 'function' ? getWorldRows() : 46;
    for (let i = 0; i < 160; i++) {
      let t;
      if (edge && i < 110) {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) t = { x: 1, y: 1 + Math.floor(Math.random() * Math.max(1, rows - 2)) };
        else if (side === 1) t = { x: cols - 2, y: 1 + Math.floor(Math.random() * Math.max(1, rows - 2)) };
        else if (side === 2) t = { x: 1 + Math.floor(Math.random() * Math.max(1, cols - 2)), y: 1 };
        else t = { x: 1 + Math.floor(Math.random() * Math.max(1, cols - 2)), y: rows - 2 };
      } else {
        t = { x: 2 + Math.floor(Math.random() * Math.max(1, cols - 4)), y: 2 + Math.floor(Math.random() * Math.max(1, rows - 4)) };
      }
      if (tileOk(type, t)) return t;
    }
    return null;
  }

  function patchSpawn() {
    if (window.HavenfallContext.alphaSpawnPatched) return;
    if (window.mobSpawnConfig) {
      if (window.mobSpawnConfig.wolf) window.mobSpawnConfig.wolf.maxCount = Math.min(window.mobSpawnConfig.wolf.maxCount || 4, 3);
      if (window.mobSpawnConfig.spider) window.mobSpawnConfig.spider.maxCount = Math.min(window.mobSpawnConfig.spider.maxCount || 6, 4);
    }
    if (typeof canSpawnMob === 'function') {
      const baseCanSpawnMob = canSpawnMob;
      canSpawnMob = function canSpawnMobSafe(type) {
        if (totalMobiles() >= MAX_MOBILE) return false;
        if (hostileType(type) && hostileCount() >= MAX_HOSTILES) return false;
        return baseCanSpawnMob(type);
      };
      window.canSpawnMob = canSpawnMob;
    }
    if (typeof mobSpawnTile === 'function') {
      const baseMobSpawnTile = mobSpawnTile;
      mobSpawnTile = function mobSpawnTileSafe(type) {
        for (let i = 0; i < 70; i++) {
          const t = baseMobSpawnTile(type);
          if (tileOk(type, t)) return t;
        }
        return randomSafeTile(type);
      };
    }
    if (typeof spawnMob === 'function') {
      const baseSpawnMob = spawnMob;
      spawnMob = function spawnMobSafe(type, tile = null) {
        if (totalMobiles() >= MAX_MOBILE) return null;
        if (hostileType(type) && hostileCount() >= MAX_HOSTILES) return null;
        if (tile && !tileOk(type, tile)) return null;
        return baseSpawnMob(type, tile || null);
      };
      window.spawnMob = spawnMob;
    }
    if (typeof spawnWolf === 'function') {
      spawnWolf = function spawnWolfSafe() {
        if (!state?.wolves || totalMobiles() >= MAX_MOBILE || hostileCount() >= MAX_HOSTILES) return null;
        const t = randomSafeTile('wolf', true);
        if (!t) return null;
        const wolf = { id: typeof uid === 'function' ? uid() : String(Date.now()), x: t.x, y: t.y, px: t.x * TILE + TILE / 2, py: t.y * TILE + TILE / 2, anim: 0, dir: 'left', hp: 100, morale: 100, aggression: 1 + Math.random() * 0.25, state: 'hunting' };
        state.wolves.push(wolf);
        return wolf;
      };
      window.spawnWolf = spawnWolf;
    }
    window.HavenfallContext.alphaSpawnPatched = true;
  }

  function nudge(e, dx, dy, amount) {
    if (!e) return;
    const len = Math.hypot(dx, dy) || 1;
    const worldW = typeof getWorldWidth === 'function' ? getWorldWidth() : 99999;
    const worldH = typeof getWorldHeight === 'function' ? getWorldHeight() : 99999;
    e.px = Math.max(TILE / 2, Math.min(worldW - TILE / 2, (e.px || e.x * TILE + TILE / 2) + (dx / len) * amount));
    e.py = Math.max(TILE / 2, Math.min(worldH - TILE / 2, (e.py || e.y * TILE + TILE / 2) + (dy / len) * amount));
    e.x = Math.round((e.px - TILE / 2) / TILE);
    e.y = Math.round((e.py - TILE / 2) / TILE);
  }
  function resolveOverlap() {
    const list = allMobiles();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        let dx = (a.px || 0) - (b.px || 0);
        let dy = (a.py || 0) - (b.py || 0);
        let distPx = Math.hypot(dx, dy);
        if (distPx >= SEP_PX) continue;
        if (distPx < 0.01) { const angle = ((i + 1) * 1.9 + (j + 1) * .73) % (Math.PI * 2); dx = Math.cos(angle); dy = Math.sin(angle); distPx = 1; }
        const push = (SEP_PX - distPx) * 0.5;
        nudge(a, dx, dy, push);
        nudge(b, -dx, -dy, push);
      }
    }
  }

  function impactOffset(e) {
    const at = Math.max(0, e?.attackAnimTimer || 0) / IMPACT_T;
    const ht = Math.max(0, e?.hitAnimTimer || 0) / IMPACT_T;
    return { x: (e?.attackOffsetX || 0) * at + (e?.hitOffsetX || 0) * ht, y: (e?.attackOffsetY || 0) * at + (e?.hitOffsetY || 0) * ht };
  }
  function markImpact(a, b, amount = 12) {
    if (!a || !b) return;
    const dx = (b.px || b.x * TILE) - (a.px || a.x * TILE);
    const dy = (b.py || b.y * TILE) - (a.py || a.y * TILE);
    const len = Math.hypot(dx, dy) || 1;
    a.attackAnimTimer = IMPACT_T; a.attackOffsetX = dx / len * amount; a.attackOffsetY = dy / len * amount;
    b.hitAnimTimer = IMPACT_T; b.hitOffsetX = -dx / len * amount * .45; b.hitOffsetY = -dy / len * amount * .45;
  }
  function tickImpact(e, tick) {
    if (!e) return;
    if (e.attackAnimTimer > 0) e.attackAnimTimer = Math.max(0, e.attackAnimTimer - tick);
    if (e.hitAnimTimer > 0) e.hitAnimTimer = Math.max(0, e.hitAnimTimer - tick);
  }
  function hitParticles() { window.hitParticles = Array.isArray(window.hitParticles) ? window.hitParticles : []; return window.hitParticles; }
  function emitHit(x, y, n = 6) {
    const arr = hitParticles();
    const now = performance.now() / 1000;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 18 + Math.random() * 48;
      arr.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: now, life: .42 + Math.random() * .28, size: 1.4 + Math.random() * 2.2 });
    }
    if (arr.length > 120) arr.splice(0, arr.length - 120);
  }
  function drawHitParticles() {
    const arr = hitParticles();
    if (!arr.length || typeof ctx === 'undefined') return;
    const now = performance.now() / 1000;
    ctx.save(); ctx.translate(viewTransform.offsetX, viewTransform.offsetY); ctx.scale(viewTransform.scale, viewTransform.scale);
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i], age = now - p.born;
      if (age >= p.life) { arr.splice(i, 1); continue; }
      const fade = 1 - age / p.life;
      ctx.globalAlpha = fade * .72; ctx.fillStyle = '#b9332d'; ctx.beginPath(); ctx.arc(p.x + p.vx * age, p.y + p.vy * age, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function knock(c, reason = 'Ferimento grave') {
    if (!c || c.isUnconscious) return;
    c.isUnconscious = true; c.health = Math.max(1, c.health || 1); c.energy = Math.min(c.energy || 0, 4); c.task = null; c.path = []; c.work = 0;
    c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
    if (!c.statuses.includes('inconsciente')) c.statuses.push('inconsciente');
    c.note = `${reason} — aguardando resgate`;
    if (typeof log === 'function') log(`${c.name} caiu inconsciente e precisa de resgate.`);
  }
  function wake(c, note = 'Recuperando') {
    if (!c) return;
    c.isUnconscious = false; c.health = Math.max(c.health || 1, 18); c.energy = Math.max(c.energy || 0, 18);
    c.statuses = (c.statuses || []).filter((s) => s !== 'inconsciente'); c.note = note;
  }
  function rescueTarget(rescuer) {
    const colonists = state?.colonists || [];
    return colonists.filter((c) => c.id !== rescuer.id && c.isUnconscious && !colonists.some((o) => o.task?.type === 'rescueAlly' && o.task.patientId === c.id)).sort((a, b) => d(rescuer, a) - d(rescuer, b))[0] || null;
  }
  function medDestination(c) {
    return (state?.objects || []).filter((o) => o.type === 'med_station' || o.type === 'bed').sort((a, b) => (a.type === 'med_station' ? 0 : 1) - (b.type === 'med_station' ? 0 : 1) || d(c, a) - d(c, b))[0] || null;
  }
  function assignRescue(c, patient) {
    const dest = medDestination(patient);
    if (!dest) return false;
    const adj = (typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(dest.x, dest.y, c.x, c.y) : null) || { x: dest.x, y: dest.y };
    c.task = { type: 'rescueAlly', patientId: patient.id, stationId: dest.id, x: adj.x, y: adj.y };
    c.path = typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, dest) : [];
    c.work = 0; c.note = `Resgatando ${patient.name}`;
    return true;
  }
  function handleRescue(c, task, tick) {
    const patient = state?.colonists?.find((x) => x.id === task.patientId);
    const dest = state?.objects?.find((x) => x.id === task.stationId);
    if (!patient || !patient.isUnconscious || !dest) { c.task = null; c.work = 0; c.note = 'Ocioso'; return; }
    c.work += tick * 1.15; c.note = `Carregando ${patient.name} ${Math.floor((c.work / 2.2) * 100)}%`;
    if (c.work < 2.2) return;
    patient.x = task.x; patient.y = task.y; patient.px = task.x * TILE + TILE / 2; patient.py = task.y * TILE + TILE / 2;
    if (dest.type === 'med_station' && state.resources?.medicine > 0) { state.resources.medicine -= 1; wake(patient, 'Recebendo tratamento'); patient.health = Math.max(patient.health, 32); log(`${c.name} levou ${patient.name} até a estação médica e usou 1 remédio.`); }
    else { wake(patient, dest.type === 'bed' ? 'Deitado na cama, recuperando' : 'Resgatado, recuperando'); log(`${c.name} levou ${patient.name} para um local seguro.`); }
    c.task = null; c.work = 0; c.note = 'Resgate concluído';
  }

  function patchSimulation() {
    if (window.HavenfallContext.alphaSimulationPatched) return;
    if (typeof updateMobsTick === 'function') { const base = updateMobsTick; updateMobsTick = function(dt) { base(dt); const tick = (dt || 0) * (state?.speed || 1); allMobiles().forEach((e) => tickImpact(e, tick)); resolveOverlap(); }; window.updateMobsTick = updateMobsTick; }
    if (typeof updateWorld === 'function') { const base = updateWorld; updateWorld = function(dt) { base(dt); const tick = (dt || 0) * (state?.speed || 1); (state?.colonists || []).forEach((c) => tickImpact(c, tick)); resolveOverlap(); }; }
    if (typeof updateColonist === 'function') { const base = updateColonist; updateColonist = function(c, dt) { if (c?.isUnconscious) { c.task = null; c.path = []; c.work = 0; c.note ||= 'Inconsciente — aguardando resgate'; return; } base(c, dt); if ((c?.health || 0) <= 1) knock(c); }; }
    if (typeof assignAutoTask === 'function') { const base = assignAutoTask; assignAutoTask = function(c) { if (!c || c.isUnconscious) return false; const target = rescueTarget(c); if (target && assignRescue(c, target)) return true; return base(c); }; }
    if (typeof handleTaskAtTarget === 'function') { const base = handleTaskAtTarget; handleTaskAtTarget = function(c, tick) { if (c?.task?.type === 'rescueAlly') return handleRescue(c, c.task, tick); return base(c, tick); }; }
    window.HavenfallContext.alphaSimulationPatched = true;
  }

  function patchCombat() {
    if (window.HavenfallContext.alphaCombatPatched) return;
    if (typeof handleCombatTask === 'function') { const base = handleCombatTask; handleCombatTask = function(c, task, tick) { const wolf = state?.wolves?.find((w) => w.id === task?.wolfId); const whp = wolf?.hp, hp = c?.health; base(c, task, tick); if (wolf && whp !== undefined && wolf.hp < whp) { markImpact(c, wolf, 13); emitHit(wolf.px, wolf.py, 7); } if (c && hp !== undefined && c.health < hp) { if (wolf) markImpact(wolf, c, 10); emitHit(c.px, c.py, 4); if (c.health <= 1) knock(c, 'Ataque recebido'); } }; }
    if (typeof handleHuntMobTask === 'function') { const base = handleHuntMobTask; handleHuntMobTask = function(c, task, tick) { const mob = state?.mobs?.find((m) => m.id === task?.mobId); const hp = mob?.hp; base(c, task, tick); if (mob && hp !== undefined && mob.hp < hp) { markImpact(c, mob, mob.type === 'rabbit' ? 8 : 12); emitHit(mob.px, mob.py, mob.type === 'rabbit' ? 3 : 6); } }; }
    if (typeof updateWolves === 'function') { const base = updateWolves; updateWolves = function(dt) { const before = new Map((state?.colonists || []).map((c) => [c.id, c.health])); base(dt); for (const c of state?.colonists || []) { const hp = before.get(c.id); if (hp !== undefined && c.health < hp && performance.now() - (c.lastHitParticleAt || 0) > 280) { c.lastHitParticleAt = performance.now(); emitHit(c.px, c.py, 3); if (c.health <= 1) knock(c, 'Ataque recebido'); } } }; }
    window.HavenfallContext.alphaCombatPatched = true;
  }

  function patchRenderer() {
    if (window.HavenfallContext.alphaRendererPatched) return;
    if (typeof resizeGameCanvas === 'function' && typeof rendererLayoutCache !== 'undefined') {
      resizeGameCanvas = function resizeGameCanvasDpr(force = false) {
        const rect = canvas.getBoundingClientRect();
        const cssW = Math.max(320, Math.floor(rect.width || window.innerWidth));
        const cssH = Math.max(240, Math.floor(rect.height || window.innerHeight));
        const pr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
        rendererLayoutCache.canvasCssWidth = cssW; rendererLayoutCache.canvasCssHeight = cssH;
        canvas.width = Math.round(cssW * pr); canvas.height = Math.round(cssH * pr);
        if (typeof measureRendererLayout === 'function') measureRendererLayout(force || true);
        viewTransform.scale = camera.zoom * pr; if (typeof clampCamera === 'function') clampCamera();
        const safe = typeof cameraSafeViewport === 'function' ? cameraSafeViewport() : { height: canvas.height };
        viewTransform.offsetX = canvas.width / 2 - camera.x * viewTransform.scale;
        viewTransform.offsetY = safe.height / 2 - camera.y * viewTransform.scale;
      };
      window.resizeGameCanvas = resizeGameCanvas;
    }
    function wrapDraw(fn) { return function(e) { const o = impactOffset(e); if (!o.x && !o.y) return fn(e); ctx.save(); ctx.translate(o.x, o.y); fn(e); ctx.restore(); }; }
    if (typeof drawColonist === 'function') { const base = drawColonist; drawColonist = function(c) { if (!c?.isUnconscious) return wrapDraw(base)(c); drawDowned(c); }; }
    if (typeof drawWolf === 'function') { drawWolf = wrapDraw(drawWolf); }
    if (typeof drawMob === 'function') { drawMob = wrapDraw(drawMob); }
    if (typeof draw === 'function') { const base = draw; draw = function() { base(); drawHitParticles(); }; }
    window.HavenfallContext.alphaRendererPatched = true;
  }
  function drawDowned(c) {
    const img = images[`${c.sprite || 'colonistA'}_${c.dir || 'down'}_0`] || images[`${c.sprite || 'colonistA'}_down_0`];
    ctx.save(); ctx.fillStyle = 'rgba(231, 189, 88, .22)'; ctx.strokeStyle = '#e7bd58'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c.px, c.py + 19, 22, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(c.px, c.py + 24); ctx.rotate(Math.PI / 2); if (img?.width) { const s = .48, w = img.width * s, h = img.height * s; ctx.drawImage(img, -w / 2, -h, w, h); } ctx.restore();
    if (typeof drawTinyBars === 'function') drawTinyBars(c);
    if (typeof drawName === 'function') drawName(`${c.name} · inconsciente`, c.px, c.py - 38);
  }

  function patchBuildPanel() {
    if (window.HavenfallContext.alphaBuildCardsPatched) return;
    const grid = document.querySelector('#buildPanel .build-grid');
    if (!grid || typeof buildDefs === 'undefined') return;
    const groups = [{ id: 'structures', label: 'Estruturas', items: ['wall','door','crate','crop'] }, { id: 'furniture', label: 'Mobília', items: ['bed','campfire','bench','research_desk'] }, { id: 'security', label: 'Segurança', items: ['forge','stove','med_station'] }];
    const desc = { bed:'Recuperação e descanso.', campfire:'Fogo e aquecimento.', crate:'Organização de estoque.', wall:'Bloqueio simples.', door:'Passagem controlada.', crop:'Produção de comida.', bench:'Ferramentas e armas simples.', research_desk:'Desbloqueia tecnologias.', forge:'Produção metálica.', stove:'Cozinha da colônia.', med_station:'Tratamento e resgate.' };
    const ico = { food:'🥩', wood:'🪵', stone:'🪨', metal:'🪙', medicine:'💊' };
    const tabs = document.createElement('div'); tabs.className = 'build-category-tabs'; tabs.innerHTML = groups.map((g, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-build-category="${g.id}">${g.label}</button>`).join('');
    const cards = document.createElement('div'); cards.className = 'build-card-grid';
    cards.innerHTML = groups.map((g, i) => `<div class="build-category-page ${i === 0 ? 'active' : ''}" data-build-page="${g.id}">${g.items.map((key) => { const def = buildDefs[key]; if (!def) return ''; const costs = Object.entries(def.cost || {}).map(([r, v]) => `<span class="cost-badge">${ico[r] || ''} ${typeof resourceLabel === 'function' ? resourceLabel(r) : r} x${v}</span>`).join(''); const req = def.requires ? `<span class="cost-badge locked-badge">🔒 ${researchDefs?.[def.requires]?.label || def.requires}</span>` : ''; return `<button type="button" class="build-card" data-build="${key}"><strong>${def.label}</strong><small>${desc[key] || 'Construção disponível.'}</small><span class="build-card-costs">${costs}${req}</span></button>`; }).join('')}</div>`).join('');
    grid.replaceWith(tabs, cards);
    tabs.addEventListener('click', (ev) => { const b = ev.target.closest('[data-build-category]'); if (!b) return; tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); cards.querySelectorAll('[data-build-page]').forEach((p) => p.classList.toggle('active', p.dataset.buildPage === b.dataset.buildCategory)); });
    window.HavenfallContext.alphaBuildCardsPatched = true;
  }

  loadCssModules();
  patchSpawn();
  patchSimulation();
  patchCombat();
  patchRenderer();
  patchBuildPanel();
})();
