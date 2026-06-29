'use strict';

(() => {
  if (window.HavenfallContext?.performanceSettingsUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceSettingsUiInstalled = true;

  function h(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  function settingsNow() {
    return window.HavenfallSettings?.getSettings?.() || settings || {};
  }

  function selected(value, expected) {
    return String(value) === String(expected) ? 'selected' : '';
  }

  function checked(value) {
    return value ? 'checked' : '';
  }

  function option(value, label, current) {
    return `<option value="${h(value)}" ${selected(current, value)}>${h(label)}</option>`;
  }

  function fieldSelect(label, path, current, options, note = '') {
    return `<label class="perf-setting-field"><span>${h(label)}</span><select data-performance-setting="${h(path)}">${options.map(([value, text]) => option(value, text, current)).join('')}</select>${note ? `<small>${h(note)}</small>` : ''}</label>`;
  }

  function fieldToggle(label, path, current, note = '') {
    return `<label class="perf-setting-field perf-setting-toggle"><span>${h(label)}</span><input type="checkbox" data-performance-setting="${h(path)}" ${checked(current)}>${note ? `<small>${h(note)}</small>` : ''}</label>`;
  }

  function fieldSlider(label, path, current, min, max, step, note = '') {
    return `<label class="perf-setting-field"><span>${h(label)} <b data-setting-value="${h(path)}">${Math.round(Number(current) * 100)}%</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${h(current)}" data-performance-setting="${h(path)}" data-setting-slider="true">${note ? `<small>${h(note)}</small>` : ''}</label>`;
  }

  function presetButtons(s) {
    const preset = s.graphics?.preset || 'medium';
    const entries = [
      ['potato', 'Muito baixo', 'máximo FPS'],
      ['low', 'Baixo', 'notebook fraco'],
      ['medium', 'Médio', 'padrão'],
      ['high', 'Alto', 'bonito'],
      ['ultra', 'Ultra', 'pesado']
    ];
    return `<div class="perf-preset-row">${entries.map(([key, label, sub]) => `<button type="button" data-performance-preset="${key}" class="${preset === key ? 'is-active' : ''}"><b>${label}</b><small>${sub}</small></button>`).join('')}</div>`;
  }

  function renderSettingsScreen() {
    const screen = document.getElementById('settingsScreen');
    if (!screen || !window.HavenfallSettings) return;
    const s = settingsNow();
    screen.innerHTML = `<div class="menu-card wide-card performance-settings-card">
      <div class="screen-title-row performance-title-row">
        <div>
          <div class="kicker">Configurações</div>
          <h1>Vídeo, gráficos e desempenho</h1>
          <p>Opções funcionais: render scale, FPS, fullscreen, presets e qualidade visual alteram o jogo em tempo real.</p>
        </div>
        <button id="settingsBackBtn" class="secondary">Voltar</button>
      </div>

      <section class="perf-section perf-presets">
        <div class="perf-section-head"><span>01</span><div><b>Preset rápido</b><small>Altera várias opções de uma vez.</small></div></div>
        ${presetButtons(s)}
      </section>

      <div class="perf-settings-grid">
        <section class="perf-section">
          <div class="perf-section-head"><span>02</span><div><b>Vídeo</b><small>Canvas, tela e limite de quadros.</small></div></div>
          ${fieldSelect('Modo de tela', 'video.displayMode', s.video.displayMode, [['windowed','Janela'], ['fullscreen','Tela cheia'], ['borderless','Tela cheia sem borda'], ['maximized','Maximizado']], 'No navegador, borderless usa fallback de fullscreen.')}
          ${fieldSelect('Resolução interna', 'video.resolution', s.video.resolution, [['auto','Automática'], ['1280x720','1280x720'], ['1600x900','1600x900'], ['1920x1080','1920x1080'], ['2560x1440','2560x1440'], ['3840x2160','3840x2160']], 'Afeta o tamanho interno do canvas.')}
          ${fieldSlider('Escala de renderização', 'video.renderScale', s.video.renderScale, 0.5, 1.5, 0.05, 'Menor = mais leve; maior = mais nítido.')}
          ${fieldSelect('Limite de FPS', 'video.targetFPS', s.video.targetFPS, [[30,'30 FPS'], [45,'45 FPS'], [60,'60 FPS'], [75,'75 FPS'], [120,'120 FPS'], ['unlimited','Ilimitado']], 'O game loop respeita este limite.')}
          ${fieldSelect('VSync', 'video.vsync', s.video.vsync, [['auto','Automático'], ['on','Ligado'], ['off','Desligado']], 'No navegador usa fallback sobre requestAnimationFrame.')}
        </section>

        <section class="perf-section">
          <div class="perf-section-head"><span>03</span><div><b>Gráficos</b><small>Qualidade visual e efeitos.</small></div></div>
          ${fieldSelect('Sombras', 'graphics.shadows', s.graphics.shadows, [['off','Desligado'], ['simple','Simples'], ['high','Alta']])}
          ${fieldSelect('Partículas', 'graphics.particles', s.graphics.particles, [['off','Desligado'], ['low','Baixo'], ['medium','Médio'], ['high','Alto']], 'Afeta chuva e efeitos leves.')}
          ${fieldSelect('Água', 'graphics.waterQuality', s.graphics.waterQuality, [['low','Baixa'], ['medium','Média'], ['high','Alta']], 'Baixa reduz detalhes/animação.')}
          ${fieldSelect('Fog of war', 'graphics.fogQuality', s.graphics.fogQuality, [['low','Baixo'], ['medium','Médio'], ['high','Alto']], 'Baixo remove textura extra.')}
          ${fieldSelect('Animações da UI', 'graphics.uiAnimations', s.graphics.uiAnimations, [['off','Desligado'], ['reduced','Reduzido'], ['on','Ligado']])}
        </section>

        <section class="perf-section">
          <div class="perf-section-head"><span>04</span><div><b>Desempenho</b><small>Reduz custo de render e simulação.</small></div></div>
          ${fieldSelect('Distância de renderização', 'performance.renderDistance', s.performance.renderDistance, [['short','Curta'], ['medium','Média'], ['long','Longa'], ['very_long','Muito longa']], 'Muda quantos tiles/objetos entram no draw.')}
          ${fieldSelect('Mundo vivo', 'performance.livingWorldUpdateRate', s.performance.livingWorldUpdateRate, [['low','Baixo'], ['medium','Médio'], ['high','Alto']], 'Base para reduzir frequência dos sistemas ecológicos.')}
          ${fieldSelect('Limite de animais', 'performance.maxAnimals', s.performance.maxAnimals, [['low','Baixo'], ['medium','Médio'], ['high','Alto'], ['unlimited','Ilimitado']])}
          ${fieldSelect('Simulação fora da tela', 'performance.offscreenSimulation', s.performance.offscreenSimulation, [['minimal','Mínima'], ['reduced','Reduzida'], ['complete','Completa']])}
          ${fieldSelect('Pathfinding', 'performance.pathfindingQuality', s.performance.pathfindingQuality, [['eco','Econômico'], ['balanced','Equilibrado'], ['high','Alta qualidade']])}
          ${fieldToggle('Economia de bateria', 'performance.batterySaver', s.performance.batterySaver, 'Ativa opções mais leves quando usado via preset.')}
        </section>

        <section class="perf-section">
          <div class="perf-section-head"><span>05</span><div><b>Interface e diagnóstico</b><small>HUD, escala e métricas.</small></div></div>
          ${fieldSelect('Escala da interface', 'uiScale', s.uiScale, [['compact','Compacta'], ['normal','Normal'], ['large','Grande']])}
          ${fieldSelect('Densidade da interface', 'interface.density', s.interface.density, [['compact','Compacta'], ['normal','Normal'], ['comfortable','Confortável']])}
          ${fieldSelect('Tamanho da fonte', 'interface.fontSize', s.interface.fontSize, [['small','Pequena'], ['normal','Normal'], ['large','Grande'], ['huge','Muito grande']])}
          ${fieldSelect('Overlay de FPS', 'interface.fpsOverlay', s.interface.fpsOverlay, [['off','Desligado'], ['fps','FPS simples'], ['full','FPS completo']], 'Mostra FPS/frame time durante o jogo.')}
          ${fieldSelect('Autosave', 'autosave', s.autosave, [['on','Ligado'], ['off','Desligado']])}
          ${fieldToggle('Grade de debug', 'showGrid', s.showGrid)}
        </section>
      </div>

      <div class="perf-actions-row">
        <button type="button" data-performance-action="reset">Restaurar padrão</button>
        <button type="button" data-performance-action="apply-display">Reaplicar modo de tela</button>
        <button type="button" data-performance-action="potato">Modo batata</button>
        <span id="performanceSettingsStatus" class="perf-status">Configurações salvas automaticamente.</span>
      </div>
    </div>`;

    dom.buttons.settingsBack = document.getElementById('settingsBackBtn');
    dom.inputs.uiScale = document.getElementById('uiScaleSelect') || screen.querySelector('[data-performance-setting="uiScale"]');
    dom.inputs.autosave = document.getElementById('autosaveSelect') || screen.querySelector('[data-performance-setting="autosave"]');
  }

  function setStatus(text) {
    const el = document.getElementById('performanceSettingsStatus');
    if (el) el.textContent = text;
  }

  function valueForInput(input) {
    if (input.type === 'checkbox') return !!input.checked;
    if (input.dataset.performanceSetting === 'video.renderScale') return Number(input.value);
    if (input.dataset.performanceSetting === 'video.targetFPS' && input.value !== 'unlimited') return Number(input.value);
    return input.value;
  }

  function handleSettingChange(event) {
    const input = event.target?.closest?.('[data-performance-setting]');
    if (!input || !input.closest('#settingsScreen')) return;
    const path = input.dataset.performanceSetting;
    window.HavenfallSettings.set(path, valueForInput(input));
    if (!['graphics.preset'].includes(path) && path.startsWith('graphics.')) window.HavenfallSettings.set('graphics.preset', 'custom');
    const label = document.querySelector(`[data-setting-value="${path}"]`);
    if (label && path === 'video.renderScale') label.textContent = `${Math.round(Number(input.value) * 100)}%`;
    showDebugGrid = !!settings?.showGrid;
    setStatus('Aplicado e salvo.');
    if (typeof updateUI === 'function') updateUI(true);
  }

  function handleClick(event) {
    const preset = event.target?.closest?.('[data-performance-preset]');
    if (preset) {
      event.preventDefault();
      window.HavenfallSettings.applyPreset(preset.dataset.performancePreset);
      settings = window.HavenfallSettings.getSettings();
      renderSettingsScreen();
      setStatus('Preset aplicado.');
      return;
    }

    const action = event.target?.closest?.('[data-performance-action]');
    if (!action) return;
    event.preventDefault();
    if (action.dataset.performanceAction === 'reset') {
      settings = window.HavenfallSettings.apply(window.HavenfallSettings.defaults);
      localStorage.setItem(typeof SETTINGS_KEY !== 'undefined' ? SETTINGS_KEY : 'havenfall-v1-settings', JSON.stringify(settings));
      renderSettingsScreen();
      setStatus('Padrão restaurado.');
      return;
    }
    if (action.dataset.performanceAction === 'apply-display') {
      window.HavenfallSettings.applyDisplayMode();
      setStatus('Modo de tela reaplicado.');
      return;
    }
    if (action.dataset.performanceAction === 'potato') {
      window.HavenfallSettings.applyPreset('potato');
      settings = window.HavenfallSettings.getSettings();
      renderSettingsScreen();
      setStatus('Modo batata aplicado.');
    }
  }

  function ensureStyle() {
    if (document.getElementById('performance-settings-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'performance-settings-ui-style';
    style.textContent = `
      .performance-settings-card{width:min(1280px,calc(100vw - 28px));max-height:calc(100vh - 32px);overflow:auto}.performance-title-row p{max-width:740px}.perf-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px}.perf-section{border:1px solid rgba(255,255,255,.10);border-radius:18px;background:rgba(255,255,255,.045);padding:14px;display:grid;gap:10px}.perf-section-head{display:flex;gap:10px;align-items:center}.perf-section-head>span{display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:rgba(247,184,74,.16);border:1px solid rgba(247,184,74,.28);color:#ffe2a3;font-weight:900}.perf-section-head b{display:block;color:#fff3df}.perf-section-head small{display:block;color:#b8b0a0;font-size:11px}.perf-preset-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:8px}.perf-preset-row button{display:grid;gap:3px;text-align:left;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px 12px;background:rgba(255,255,255,.055);color:#f4efe4}.perf-preset-row button.is-active{border-color:#f7b84a;background:rgba(247,184,74,.18);box-shadow:0 0 0 1px rgba(247,184,74,.22)}.perf-preset-row small{color:#b8b0a0}.perf-setting-field{display:grid;gap:5px;color:#f4efe4;font-size:13px}.perf-setting-field span{display:flex;justify-content:space-between;gap:10px;color:#fff3df;font-weight:800}.perf-setting-field small{color:#9aa3b2;font-size:11px;line-height:1.25}.perf-setting-field select,.perf-setting-field input[type="range"]{width:100%}.perf-setting-toggle{grid-template-columns:1fr auto;align-items:center}.perf-setting-toggle small{grid-column:1/-1}.perf-setting-toggle input{width:22px;height:22px}.perf-actions-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}.perf-actions-row button{border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.06);color:#f4efe4;padding:9px 12px}.perf-status{margin-left:auto;color:#b8b0a0;font-size:12px}.hf-no-ui-animations *{transition:none!important;animation:none!important}.hf-reduced-ui-animations *{animation-duration:.08s!important;transition-duration:.08s!important}:root[data-ui-density="compact"] .menu-card{gap:10px}:root[data-ui-density="comfortable"] .menu-card{gap:18px}:root[data-font-size="large"] body{font-size:17px}:root[data-font-size="huge"] body{font-size:19px}`;
    document.head.appendChild(style);
  }

  ensureStyle();
  renderSettingsScreen();
  document.addEventListener('change', handleSettingChange, true);
  document.addEventListener('input', handleSettingChange, true);
  document.addEventListener('click', handleClick, true);
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.renderPerformanceSettingsScreen = renderSettingsScreen;
})();