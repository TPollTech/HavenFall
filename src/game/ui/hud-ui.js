'use strict';

function activeCraftStation() {
  if (!state || !selectedCraftStationId) return null;
  const station = state.objects.find(o => o.id === selectedCraftStationId);
  return station && stationLabels[station.type] ? station : null;
}

function hasActiveCraftStation() {
  return !!activeCraftStation();
}

function setHudTab(tab) {
  const stationOpen = hasActiveCraftStation();
  const requested = tab || 'build';
  activeHudTab = requested === 'crafting' && !stationOpen ? 'build' : requested;

  document.querySelectorAll('[data-tab]').forEach(btn => {
    const isCraftingTab = btn.dataset.tab === 'crafting';
    const shouldHide = isCraftingTab && !stationOpen;
    btn.hidden = shouldHide;
    btn.classList.toggle('hidden', shouldHide);
    btn.classList.toggle('active', !shouldHide && btn.dataset.tab === activeHudTab);
  });

  document.querySelectorAll('[data-panel]').forEach(panel => {
    const isCraftingPanel = panel.dataset.panel === 'crafting';
    const shouldHide = isCraftingPanel && !stationOpen;
    panel.hidden = shouldHide;
    panel.classList.toggle('hidden', shouldHide);
    panel.classList.toggle('active', !shouldHide && panel.dataset.panel === activeHudTab);
  });
}

function uiSpriteSrc(name) {
  return typeof spriteSrc === 'function' ? spriteSrc(name) : `assets/sprites/${name}.png`;
}

function loadedIconSrc(name) {
  const key = name || 'icon_warn';
  if (typeof images === 'object' && images?.[key]?.src) return images[key].src;
  return null;
}

function iconFrame(icon, label = '', extraClass = '') {
  const src = loadedIconSrc(icon);
  const title = escapeHtml(label || icon || 'Item');
  const fallback = `<span class="ui-icon-fallback" aria-hidden="true" style="width:40px;height:40px;display:grid;place-items:center;border-radius:10px;background:rgba(58,58,58,.88);border:1px solid rgba(255,255,255,.12);color:#b8b0a0;font-size:16px;flex:0 0 40px;">▣</span>`;
  if (!src) return fallback;
  return `<span class="ui-icon-frame ${extraClass}" title="${title}" style="width:40px;height:40px;display:grid;place-items:center;border-radius:10px;background:rgba(8,11,16,.72);border:1px solid rgba(255,255,255,.10);overflow:hidden;flex:0 0 40px;"><img src="${escapeHtml(src)}" alt="" style="max-width:34px;max-height:34px;object-fit:contain;display:block;"></span>`;
}

function refreshMenuSaveInfo() {
  if (!dom.menuSaveInfo) return;
  const continueBtn = dom.buttons?.continue;
  if (activeSession && state) {
    if (continueBtn) { continueBtn.textContent = 'Continuar'; continueBtn.disabled = false; }
    dom.menuSaveInfo.innerHTML = `Partida em andamento · <b>${escapeHtml(state.config?.colonyName || 'Colônia sem nome')}</b> · Dia ${state.day || 1}`;
    return;
  }
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    if (continueBtn) { continueBtn.textContent = 'Carregar'; continueBtn.disabled = false; }
    dom.menuSaveInfo.textContent = 'Nenhum save local encontrado.';
    return;
  }
  try {
    const data = JSON.parse(raw);
    const s = data.state;
    if (continueBtn) { continueBtn.textContent = 'Continuar'; continueBtn.disabled = false; }
    dom.menuSaveInfo.innerHTML = `Save local · <b>${escapeHtml(s.config?.colonyName || 'Colônia sem nome')}</b> · Dia ${s.day || 1} · Seed ${escapeHtml(s.config?.seed || 'antiga')}`;
  } catch (_) {
    if (continueBtn) { continueBtn.textContent = 'Carregar'; continueBtn.disabled = true; }
    dom.menuSaveInfo.textContent = 'Save local encontrado, mas parece corrompido.';
  }
}

function refreshLoadScreen() {
  if (!dom.loadSlot) return;
  const loadBtn = dom.buttons?.loadSlot;
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    dom.loadSlot.innerHTML = 'Nenhum save local encontrado.';
    if (loadBtn) loadBtn.disabled = true;
    return;
  }
  try {
    const data = JSON.parse(raw);
    const s = data.state;
    const cols = s.world?.cols || s.terrain?.[0]?.length || MAP_SIZES.standard.cols;
    const rows = s.world?.rows || s.terrain?.length || MAP_SIZES.standard.rows;
    dom.loadSlot.innerHTML = `<strong>${escapeHtml(s.config?.colonyName || 'Colônia sem nome')}</strong><br>Dia ${s.day || 1}, ${formatHour(s.hour || 6)} · Seed ${escapeHtml(s.config?.seed || 'save antigo')} · ${cols}x${rows} · ${s.colonists?.length || 0} colonos`;
    if (loadBtn) loadBtn.disabled = false;
  } catch (_) {
    dom.loadSlot.innerHTML = 'Save local encontrado, mas não foi possível ler o resumo.';
    if (loadBtn) loadBtn.disabled = true;
  }
}

function renderColonistSelection() {
  if (!dom.colonistCards) return;

  if (typeof characterBuilderCard === 'function') {
    const validation = typeof validateColonistBuilders === 'function' ? validateColonistBuilders() : { ok: true };
    if (dom.buttons?.startSelectedGame) {
      dom.buttons.startSelectedGame.disabled = !validation.ok;
      dom.buttons.startSelectedGame.title = validation.ok ? 'Iniciar com estes colonos.' : 'Corrija a distribuição de pontos antes de iniciar.';
    }
    if (dom.buttons?.rerollAll) dom.buttons.rerollAll.hidden = true;
    dom.colonistCards.innerHTML = colonistCandidates.map((c, i) => characterBuilderCard(c, i)).join('');
    return;
  }

  dom.colonistCards.innerHTML = colonistCandidates.map((c, i) => `
    <article class="colonist-card ${c.locked ? 'locked' : ''}">
      <div class="colonist-head"><div class="colonist-preview"><img src="${uiSpriteSrc(`${c.sprite}_down_0`)}" alt=""></div><div><h2>${escapeHtml(c.name)}, ${c.age}</h2><div class="empty">${escapeHtml(c.role)} · Prefere ${escapeHtml(workPreferenceLabel(c.workPreferenceId || c.workPreference))}</div></div></div>
      <div class="tags">${colonistTraitTags(c.physicalTraitIds, 'physical')}${colonistTraitTags(c.positiveTraitIds, 'positive', '+ ', 'good')}${colonistTraitTags(c.negativeTraitIds, 'negative', '- ', 'bad')}</div>
      <div class="empty">Habilidades: coleta ${c.skills.coleta}, construção ${c.skills.construcao}, defesa ${c.skills.defesa}, pesquisa ${c.skills.pesquisa}, medicina ${c.skills.medicina}</div>
      <div class="empty">Necessidades: comida ${c.needs.hunger}%, energia ${c.needs.energy}%, humor ${c.needs.mood}%, saúde ${c.needs.health}%</div>
    </article>`).join('');
}

function colonistTraitTags(ids, kind, prefix = '', cls = '') {
  const source = Array.isArray(ids) && ids.length ? ids : [];
  return source.map(id => `<span class="tag ${cls}">${escapeHtml(prefix + colonistTraitLabel(kind, id))}</span>`).join('');
}

function selectedSummary(c) {
  if (!c) return '<span class="empty">Nenhum colono selecionado.</span>';
  ensureColonistMeta(c);
  ensureEquipment(c);
  const eq = c.equipment;
  const equipText = [eq.tool ? `Ferramenta: ${itemLabel(eq.tool)}` : 'Ferramenta: nenhuma', eq.weapon ? `Arma: ${itemLabel(eq.weapon)}` : 'Arma: nenhuma', eq.offhand ? `Apoio: ${itemLabel(eq.offhand)}` : 'Apoio: nenhum'].join(' · ');
  return `<div><b>${escapeHtml(c.name)}</b> <span class="muted">${escapeHtml(c.role)}${c.age ? ` · ${c.age} anos` : ''}</span></div><div class="empty"><b>Estado:</b> ${escapeHtml(c.state || 'idle')} · <b>Tarefa:</b> ${escapeHtml(c.note || 'Ocioso')}</div><div class="empty"><b>Posição:</b> ${Math.round(c.x)}, ${Math.round(c.y)} · <b>Equipamento:</b> ${escapeHtml(equipText)}</div><div class="empty"><b>Prioridade:</b> ${escapeHtml((priorityDefs[c.priority] || priorityDefs[defaultPriorityForRole(c.role)]).label)}</div>`;
}
