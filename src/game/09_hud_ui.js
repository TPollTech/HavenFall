'use strict';

function setHudTab(tab) {
  activeHudTab = tab || 'build';
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeHudTab);
  });
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === activeHudTab);
  });
}

function uiSpriteSrc(name) {
  return typeof spriteSrc === 'function' ? spriteSrc(name) : `assets/sprites/${name}.png`;
}

function refreshMenuSaveInfo() {
  if (!dom.menuSaveInfo) return;
  const continueBtn = dom.buttons?.continue;

  if (activeSession && state) {
    if (continueBtn) {
      continueBtn.textContent = 'Continuar';
      continueBtn.disabled = false;
    }
    dom.menuSaveInfo.innerHTML = `Partida em andamento · <b>${escapeHtml(state.config?.colonyName || 'Colônia sem nome')}</b> · Dia ${state.day || 1}`;
    return;
  }

  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    if (continueBtn) {
      continueBtn.textContent = 'Carregar';
      continueBtn.disabled = false;
    }
    dom.menuSaveInfo.textContent = 'Nenhum save local encontrado.';
    return;
  }

  try {
    const data = JSON.parse(raw);
    const s = data.state;
    if (continueBtn) {
      continueBtn.textContent = 'Continuar';
      continueBtn.disabled = false;
    }
    dom.menuSaveInfo.innerHTML = `Save local · <b>${escapeHtml(s.config?.colonyName || 'Colônia sem nome')}</b> · Dia ${s.day || 1} · Seed ${escapeHtml(s.config?.seed || 'antiga')}`;
  } catch (_) {
    if (continueBtn) {
      continueBtn.textContent = 'Carregar';
      continueBtn.disabled = true;
    }
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
  dom.colonistCards.innerHTML = colonistCandidates.map((c, i) => `
    <article class="colonist-card ${c.locked ? 'locked' : ''}">
      <div class="colonist-head">
        <div class="colonist-preview"><img src="${uiSpriteSrc(`${c.sprite}_down_0`)}" alt=""></div>
        <div>
          <h2>${escapeHtml(c.name)}, ${c.age}</h2>
          <div class="empty">${escapeHtml(c.role)} · Prefere ${escapeHtml(workPreferenceLabel(c.workPreferenceId || c.workPreference))}</div>
        </div>
      </div>
      <div class="tags">
        ${colonistTraitTags(c.physicalTraitIds, 'physical', '')}
        ${colonistTraitTags(c.positiveTraitIds, 'positive', '+ ', 'good')}
        ${colonistTraitTags(c.negativeTraitIds, 'negative', '- ', 'bad')}
      </div>
      <div class="empty">Habilidades: coleta ${c.skills.coleta}, construção ${c.skills.construcao}, defesa ${c.skills.defesa}, pesquisa ${c.skills.pesquisa}, medicina ${c.skills.medicina}</div>
      <div class="empty">Necessidades: comida ${c.needs.hunger}%, energia ${c.needs.energy}%, humor ${c.needs.mood}%, saúde ${c.needs.health}%</div>
      <div class="card-actions">
        <button data-reroll-colonist="${i}" ${c.locked ? 'disabled' : ''}>Rerolar</button>
        <button data-lock-colonist="${i}" class="${c.locked ? 'active' : 'secondary'}">${c.locked ? 'Travado' : 'Travar'}</button>
      </div>
    </article>
  `).join('');
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
  const equipText = [
    eq.tool ? `Ferramenta: ${itemLabel(eq.tool)}` : 'Ferramenta: nenhuma',
    eq.weapon ? `Arma: ${itemLabel(eq.weapon)}` : 'Arma: nenhuma',
    eq.offhand ? `Apoio: ${itemLabel(eq.offhand)}` : 'Apoio: nenhum'
  ].join(' · ');
  return `
    <div><b>${escapeHtml(c.name)}</b> <span class="muted">${escapeHtml(c.role)}${c.age ? ` · ${c.age} anos` : ''}</span></div>
    <div class="empty"><b>Estado:</b> ${escapeHtml(c.state || 'idle')} · <b>Tarefa:</b> ${escapeHtml(c.note || 'Ocioso')}</div>
    <div class="empty"><b>Posição:</b> ${Math.round(c.x)}, ${Math.round(c.y)} · <b>Equipamento:</b> ${escapeHtml(equipText)}</div>
    <div class="empty"><b>Prioridade:</b> ${escapeHtml((priorityDefs[c.priority] || priorityDefs[defaultPriorityForRole(c.role)]).label)}</div>
  `;
}


function worldObjectSummary(obj) {
  if (!obj) return '<span class="empty">Nenhum objeto selecionado.</span>';
  const def = objectDefs[obj.type] || {};
  const poi = obj.poiId ? state.world?.pointsOfInterest?.find(p => p.id === obj.poiId) : null;
  const status = [
    obj.inspected ? 'investigado' : def.interactable ? 'não investigado' : '',
    obj.looted ? 'vasculhado' : def.interactable ? 'com possíveis itens' : '',
    poi?.name ? `local: ${poi.name}` : ''
  ].filter(Boolean).join(' · ');
  return `
    <div><b>${escapeHtml(def.name || obj.type)}</b> <span class="muted">${Math.round(obj.x)}, ${Math.round(obj.y)}</span></div>
    <div class="empty">${escapeHtml(status || 'objeto do mundo')}</div>
    <div class="empty">Clique com o botão direito para ações contextuais.</div>
  `;
}

function updateUI(force = false) {
  if (!state) return;
  uiTimer += force ? 1 : 0;
  dom.dayLabel.textContent = `Dia ${state.day}`;
  dom.timeLabel.textContent = formatHour(state.hour);
  dom.weatherLabel.textContent = state.weather === 'chuva' ? 'Chuva' : 'Tempo limpo';
  if (dom.speedLabel) {
    dom.speedLabel.textContent = state.paused || appScreen === SCREEN.PAUSED ? 'Pausado' : `${state.speed}x`;
    dom.speedLabel.title = `Zoom ${Math.round(camera.zoom * 100)}% · WASD/setas movem a câmera · Shift acelera · roda do mouse/+/- ajusta o zoom · G alterna a grade`;
  }
  if (dom.colonyTitle) dom.colonyTitle.textContent = state.config?.colonyName || 'First Haven';
  if (dom.gameConfigLabel) dom.gameConfigLabel.textContent = `Dif.: ${labelDifficulty(state.config?.difficulty || 'normal')} · Mapa: ${labelMapSize(state.config?.mapSize || 'standard')} ${getWorldCols()}x${getWorldRows()} · Eventos: ${labelEventIntensity(state.config?.eventIntensity || 'normal')} · Seed ${state.config?.seed || 'antiga'}`;
  dom.resFood.textContent = Math.floor(state.resources.food || 0);
  dom.resWood.textContent = Math.floor(state.resources.wood || 0);
  dom.resStone.textContent = Math.floor(state.resources.stone || 0);
  dom.resMetal.textContent = Math.floor(state.resources.metal || 0);
  if (dom.resMedicine) dom.resMedicine.textContent = Math.floor(state.resources.medicine || 0);
  ensureResearchState();
  updateResearchUI();
  updateCraftingUI();
  updateColonistPanel();

  const c = selectedColonist();
  if (c) {
    ensureColonistMeta(c);
    const priority = priorityDefs[c.priority] || priorityDefs[defaultPriorityForRole(c.role)];
    const traits = [
      ...(c.physicalTraits || []),
      ...(c.positiveTraits || []).map(t => `+ ${t}`),
      ...(c.negativeTraits || []).map(t => `- ${t}`)
    ];
    const skills = c.skills ? `Coleta ${c.skills.coleta}, Construção ${c.skills.construcao}, Defesa ${c.skills.defesa}, Pesquisa ${c.skills.pesquisa}, Medicina ${c.skills.medicina}` : 'habilidades antigas não definidas';
    dom.selectedInfo.innerHTML = `
      <div><b>${escapeHtml(c.name)}</b> <span class="muted">${escapeHtml(c.role)}${c.age ? ` · ${c.age} anos` : ''}</span></div>
      <div class="empty"><b>Bônus:</b> ${roleBonusText(c)}</div>
      <div class="empty"><b>Preferência:</b> ${escapeHtml(workPreferenceLabel(c.workPreferenceId || c.workPreference))}</div>
      <div class="empty"><b>Habilidades:</b> ${escapeHtml(skills)}</div>
      <div class="empty"><b>Equipado:</b> ${escapeHtml(equipmentLine(c))}</div>
      ${equipmentButtons(c)}
      ${traits.length ? `<div class="tags">${traits.map(t => `<span class="tag ${t.startsWith('-') ? 'bad' : t.startsWith('+') ? 'good' : ''}">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      ${statLine('Comida', c.hunger)}
      ${statLine('Sono', c.energy)}
      ${statLine('Humor', c.mood)}
      ${statLine('Saúde', c.health)}
      <div class="priority-box">
        <div><b>Prioridade automática:</b> ${priority.label}</div>
        <div class="priority-buttons">
          ${priorityOrder.map(key => `<button class="mini ${c.priority === key ? 'active' : ''}" data-priority="${key}">${priorityDefs[key].label}</button>`).join('')}
        </div>
        <div class="empty">${priority.note}</div>
      </div>
      <div class="empty"><b>Tarefa:</b> ${escapeHtml(c.note || 'Ocioso')}</div>
    `;
    if (dom.selectedObjectInfo) {
      const selectedObj = state.objects.find(o => o.id === selectedWorldObjectId);
      dom.selectedObjectInfo.innerHTML = selectedObj ? worldObjectSummary(selectedObj) : selectedSummary(c);
    }
  } else if (dom.selectedObjectInfo) {
    const selectedObj = state.objects.find(o => o.id === selectedWorldObjectId);
    dom.selectedObjectInfo.innerHTML = selectedObj ? worldObjectSummary(selectedObj) : '<span class="empty">Nenhum colono selecionado.</span>';
  }
  dom.log.innerHTML = state.log.map(line => `<p>${escapeHtml(line)}</p>`).join('');
  dom.buildStatus.textContent = currentBuild ? `Construindo: ${buildDefs[currentBuild].label}. Clique no chão do mapa.` : 'Nenhuma construção selecionada.';
  document.querySelectorAll('[data-build]').forEach(btn => {
    const key = btn.dataset.build;
    const unlocked = isBuildUnlocked(key);
    btn.classList.toggle('active', key === currentBuild);
    btn.classList.toggle('locked', !unlocked);
    btn.disabled = !unlocked;
    if (!unlocked) {
      const req = buildDefs[key].requires;
      btn.title = `Bloqueado: pesquise ${researchDefs[req]?.label || req}.`;
    } else {
      btn.title = '';
    }
  });
}

function updateColonistPanel() {
  if (!dom.colonistList || !state?.colonists) return;
  dom.colonistList.innerHTML = state.colonists.map(c => `
    <div class="colonist-row ${c.id === selectedColonistId ? 'active' : ''}" data-select-colonist="${c.id}">
      <img src="${uiSpriteSrc(`${c.sprite}_down_0`)}" alt="">
      <div><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.note || 'Ocioso')}</small></div>
      <span>${Math.floor(c.mood || 0)}%</span>
    </div>
  `).join('');
}

function updateResearchUI() {
  const el = document.getElementById('researchInfo');
  if (!el) return;
  const key = state.research.current;
  const unlockedLabels = state.research.completed.map(k => researchDefs[k]?.label).filter(Boolean);
  if (!key) {
    el.innerHTML = `<b>Todas as pesquisas concluídas.</b><br><span class="muted-inline">Liberado: ${unlockedLabels.join(', ') || 'nenhuma'}</span>`;
    return;
  }
  const def = researchDefs[key];
  const pct = Math.floor(((state.research.progress || 0) / def.cost) * 100);
  const unlocks = def.unlocks.map(k => buildDefs[k]?.label || k).join(', ');
  el.innerHTML = `
    <div><b>Pesquisa atual:</b> ${def.label}</div>
    <div class="statline compact">
      <label><span>Progresso</span><span>${pct}%</span></label>
      <div class="bar"><span style="width:${clamp(pct,0,100)}%"></span></div>
    </div>
    <div class="empty">Desbloqueia: ${unlocks}</div>
    <div class="empty">Construa uma Mesa de Pesquisa e clique nela com um colono selecionado.</div>
    <div class="empty"><b>Liberadas:</b> ${unlockedLabels.join(', ') || 'nenhuma ainda'}</div>
  `;
}


function equipmentLine(c) {
  ensureEquipment(c);
  const eq = c.equipment;
  return [
    eq.tool ? `Ferramenta: ${itemLabel(eq.tool)}` : 'Ferramenta: nenhuma',
    eq.weapon ? `Arma: ${itemLabel(eq.weapon)}` : 'Arma: nenhuma',
    eq.offhand ? `Apoio: ${itemLabel(eq.offhand)}` : 'Apoio: nenhum'
  ].join(' · ');
}

function equipmentButtons(c) {
  ensureEquipment(c);
  const slots = ['tool','weapon','offhand'];
  return `<div class="equipment-strip">${slots.map(slot => {
    const key = c.equipment[slot];
    if (!key) return `<span class="equipment-slot empty">${slotLabel(slot)} vazio</span>`;
    const item = itemDefs[key];
    return `<button class="equipment-slot" data-unequip-slot="${slot}"><img src="${uiSpriteSrc(item.icon)}" alt=""> ${escapeHtml(item.label)} ✕</button>`;
  }).join('')}</div>`;
}

function slotLabel(slot) {
  return ({ tool: 'Ferramenta', weapon: 'Arma', offhand: 'Apoio' })[slot] || slot;
}

function updateCraftingUI() {
  const recipeGrid = document.getElementById('recipeGrid');
  const info = document.getElementById('craftingInfo');
  const inventory = document.getElementById('inventoryInfo');
  if (!recipeGrid || !info || !inventory || !state) return;

  const station = selectedCraftStationId ? state.objects.find(o => o.id === selectedCraftStationId) : null;
  const stationType = station?.type || null;
  const c = selectedColonist();
  const stationTitle = station ? `${objectDefs[station.type]?.name || station.type} em ${station.x},${station.y}` : 'Nenhuma estação aberta';

  info.innerHTML = `
    <div><b>Estação:</b> ${escapeHtml(stationTitle)}</div>
    <div class="empty">Botão direito em Bancada/Forja/Fogão/Estação Médica para filtrar receitas. Sem estação selecionada, mostra todas.</div>
  `;

  const recipes = Object.entries(recipeDefs).filter(([, recipe]) => {
    if (stationType) return recipe.station === stationType;
    return true;
  });

  recipeGrid.innerHTML = recipes.map(([key, recipe]) => {
    const unlocked = recipeUnlocked(key);
    const built = recipeStationBuilt(recipe.station);
    const affordable = hasRecipeCost(recipe);
    const disabled = !unlocked || !built || !affordable || !c;
    const output = outputText(recipe.output);
    const iconKey = Object.keys(recipe.output?.items || {})[0];
    const icon = itemDefs[iconKey]?.icon || (recipe.output?.resources?.food ? 'icon_food' : 'tool_hammer');
    const reason = !unlocked ? `Pesquise ${researchDefs[recipe.unlock]?.label || recipe.unlock}` : !built ? `Construa ${stationLabels[recipe.station] || recipe.station}` : !affordable ? `Faltam: ${itemCostText(recipe.cost, recipe.itemCost)}` : recipe.desc;
    return `
      <button class="recipe-card ${disabled ? 'locked' : ''}" data-craft="${key}" ${disabled ? 'disabled' : ''}>
        <img src="${uiSpriteSrc(icon)}" alt="">
        <b>${escapeHtml(recipe.label)}</b>
        <small>${escapeHtml(itemCostText(recipe.cost, recipe.itemCost))}</small>
        <small>Resultado: ${escapeHtml(output)}</small>
        <em>${escapeHtml(reason || '')}</em>
      </button>
    `;
  }).join('');

  const itemEntries = Object.entries(state.items || {}).filter(([, qty]) => qty > 0);
  inventory.innerHTML = `
    <h3>Itens no estoque</h3>
    <div class="item-strip">
      ${itemEntries.length ? itemEntries.map(([key, qty]) => {
        const item = itemDefs[key] || { label: key, icon: 'icon_warn' };
        const canEquip = !!item.slot && !!c;
        return `
          <div class="item-pill">
            <img src="${uiSpriteSrc(item.icon)}" alt="">
            <span>${escapeHtml(item.label)} <b>x${qty}</b></span>
            ${canEquip ? `<button class="mini" data-equip-item="${key}">Equipar</button>` : ''}
          </div>
        `;
      }).join('') : '<span class="empty">Nenhum item fabricado ainda.</span>'}
    </div>
  `;
}

function statLine(label, value) {
  const cls = value < 25 ? 'danger' : value < 45 ? 'warn' : '';
  return `
    <div class="statline">
      <label><span>${label}</span><span>${Math.floor(value)}%</span></label>
      <div class="bar ${cls}"><span style="width:${clamp(value,0,100)}%"></span></div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>'"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[s]));
}
