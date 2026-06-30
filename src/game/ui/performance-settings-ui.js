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
    return `<label class="perf-setting-field perf-setting-slider"><span>${h(label)} <b data-setting-value="${h(path)}">${Math.round(Number(current) * 100)}%</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${h(current)}" data-performance-setting="${h(path)}" data-setting-slider="true">${note ? `<small>${h(note)}</small>` : ''}</label>`;
  }

  function presetButtons(s) {
    const preset = s.graphics?.preset || 'medium';
    const entries = [
      ['potato', 'BAIXÍSSIMO', 'FPS acima de visual'],
      ['low', 'BAIXO', 'PC fraco'],
      ['medium', 'MÉDIO', 'recomendado'],
      ['high', 'ALTO', 'visual melhor'],
      ['ultra', 'ULTRA', 'pesado']
    ];
    return `<div class="game-preset-stack">${entries.map(([key, label, sub]) => `<button type="button" data-performance-preset="${key}" class="game-preset-button ${preset === key ? 'is-active' : ''}"><i></i><span><b>${label}</b><small>${sub}</small></span></button>`).join('')}</div>`;
  }

  function renderSettingsScreen() {
    const screen = document.getElementById('settingsScreen');
    if (!screen || !window.HavenfallSettings) return;
    const s = settingsNow();
    const audio = s.audio || {};
    const activePreset = window.HavenfallSettings?.presets?.[s.graphics?.preset]?.label || (s.graphics?.preset === 'custom' ? 'Personalizado' : 'Médio');

    screen.innerHTML = `<div class="game-settings-shell">
      <header class="game-settings-header">
        <div class="game-settings-title-block">
          <span class="game-settings-kicker">HAVENFALL · SISTEMA</span>
          <h1>CONFIGURAÇÕES</h1>
          <p>Vídeo, gráficos, áudio e desempenho aplicados em tempo real.</p>
        </div>
        <div class="game-settings-header-status">
          <span>PERFIL ATIVO</span>
          <b>${h(activePreset)}</b>
        </div>
        <button id="settingsBackBtn" class="game-settings-back">VOLTAR</button>
      </header>

      <div class="game-settings-body">
        <aside class="game-settings-sidebar">
          <div class="game-settings-sidebar-title">
            <span>PERFORMANCE</span>
            <b>PRESETS</b>
          </div>
          ${presetButtons(s)}
          <div class="game-settings-hint-box">
            <b>Modo batata</b>
            <small>Reduz resolução interna, FPS, partículas, água e distância de render.</small>
          </div>
        </aside>

        <section class="game-settings-content">
          <nav class="game-settings-tabs" aria-label="Categorias de configurações">
            <button type="button" data-settings-anchor="videoGroup">Vídeo</button>
            <button type="button" data-settings-anchor="graphicsGroup">Gráficos</button>
            <button type="button" data-settings-anchor="audioGroup">Áudio</button>
            <button type="button" data-settings-anchor="performanceGroup">Desempenho</button>
            <button type="button" data-settings-anchor="interfaceGroup">Interface</button>
          </nav>

          <div class="game-settings-scroll">
            <section id="videoGroup" class="game-settings-group">
              <div class="game-group-title"><span>01</span><div><b>Vídeo</b><small>Tela, canvas e limite de quadros</small></div></div>
              <div class="game-setting-list">
                ${fieldSelect('Modo de tela', 'video.displayMode', s.video.displayMode, [['windowed','Janela'], ['fullscreen','Tela cheia'], ['borderless','Tela cheia sem borda'], ['maximized','Maximizado']], 'No navegador, borderless usa fallback de fullscreen.')}
                ${fieldSelect('Resolução interna', 'video.resolution', s.video.resolution, [['auto','Automática'], ['1280x720','1280x720'], ['1600x900','1600x900'], ['1920x1080','1920x1080'], ['2560x1440','2560x1440'], ['3840x2160','3840x2160']], 'Afeta o tamanho interno do canvas.')}
                ${fieldSlider('Escala de renderização', 'video.renderScale', s.video.renderScale, 0.5, 1.5, 0.05, 'Menor = mais leve; maior = mais nítido.')}
                ${fieldSelect('Limite de FPS', 'video.targetFPS', s.video.targetFPS, [[30,'30 FPS'], [45,'45 FPS'], [60,'60 FPS'], [75,'75 FPS'], [120,'120 FPS'], ['unlimited','Ilimitado']], 'O game loop respeita este limite.')}
                ${fieldSelect('VSync', 'video.vsync', s.video.vsync, [['auto','Automático'], ['on','Ligado'], ['off','Desligado']], 'No navegador usa fallback sobre requestAnimationFrame.')}
              </div>
            </section>

            <section id="graphicsGroup" class="game-settings-group">
              <div class="game-group-title"><span>02</span><div><b>Gráficos</b><small>Efeitos visuais que pesam no render</small></div></div>
              <div class="game-setting-list">
                ${fieldSelect('Sombras', 'graphics.shadows', s.graphics.shadows, [['off','Desligado'], ['simple','Simples'], ['high','Alta']])}
                ${fieldSelect('Partículas', 'graphics.particles', s.graphics.particles, [['off','Desligado'], ['low','Baixo'], ['medium','Médio'], ['high','Alto']], 'Afeta chuva e efeitos leves.')}
                ${fieldSelect('Água', 'graphics.waterQuality', s.graphics.waterQuality, [['low','Baixa'], ['medium','Média'], ['high','Alta']], 'Baixa reduz detalhes/animação.')}
                ${fieldSelect('Fog of war', 'graphics.fogQuality', s.graphics.fogQuality, [['low','Baixo'], ['medium','Médio'], ['high','Alto']], 'Baixo remove textura extra.')}
                ${fieldSelect('Animações da UI', 'graphics.uiAnimations', s.graphics.uiAnimations, [['off','Desligado'], ['reduced','Reduzido'], ['on','Ligado']])}
              </div>
            </section>

            <section id="audioGroup" class="game-settings-group">
              <div class="game-group-title"><span>03</span><div><b>Áudio</b><small>Volume, SFX e ambiente procedural</small></div></div>
              <div class="game-setting-list">
                ${fieldSelect('Áudio', 'audio.enabled', audio.enabled || 'on', [['on','Ligado'], ['off','Desligado']])}
                ${fieldSlider('Volume geral', 'audio.masterVolume', audio.masterVolume ?? 0.8, 0, 1, 0.05)}
                ${fieldSlider('Volume SFX', 'audio.sfxVolume', audio.sfxVolume ?? 0.85, 0, 1, 0.05, 'Impactos, conclusoes de trabalho e efeitos curtos.')}
                ${fieldSlider('Volume ambiente', 'audio.ambientVolume', audio.ambientVolume ?? 0.55, 0, 1, 0.05, 'Chuva, trovao e loops de ambiente.')}
                ${fieldSlider('Volume UI', 'audio.uiVolume', audio.uiVolume ?? 0.7, 0, 1, 0.05, 'Reservado para botoes e confirmacoes de interface.')}
                ${fieldSelect('Chuva', 'audio.rain', audio.rain || 'normal', [['normal','Normal'], ['reduced','Reduzida'], ['off','Desligada']])}
              </div>
            </section>

            <section id="performanceGroup" class="game-settings-group">
              <div class="game-group-title"><span>04</span><div><b>Desempenho</b><small>Simulação, entidades e mundo vivo</small></div></div>
              <div class="game-setting-list">
                ${fieldSelect('Distância de renderização', 'performance.renderDistance', s.performance.renderDistance, [['short','Curta'], ['medium','Média'], ['long','Longa'], ['very_long','Muito longa']], 'Muda quantos tiles/objetos entram no draw.')}
                ${fieldSelect('Mundo vivo', 'performance.livingWorldUpdateRate', s.performance.livingWorldUpdateRate, [['low','Baixo'], ['medium','Médio'], ['high','Alto']], 'Base para reduzir frequência dos sistemas ecológicos.')}
                ${fieldSelect('Limite de animais', 'performance.maxAnimals', s.performance.maxAnimals, [['low','Baixo'], ['medium','Médio'], ['high','Alto'], ['unlimited','Ilimitado']])}
                ${fieldSelect('Simulação fora da tela', 'performance.offscreenSimulation', s.performance.offscreenSimulation, [['minimal','Mínima'], ['reduced','Reduzida'], ['complete','Completa']])}
                ${fieldSelect('Pathfinding', 'performance.pathfindingQuality', s.performance.pathfindingQuality, [['eco','Econômico'], ['balanced','Equilibrado'], ['high','Alta qualidade']])}
                ${fieldToggle('Economia de bateria', 'performance.batterySaver', s.performance.batterySaver, 'Ativa opções mais leves quando usado via preset.')}
              </div>
            </section>

            <section id="interfaceGroup" class="game-settings-group">
              <div class="game-group-title"><span>05</span><div><b>Interface e diagnóstico</b><small>HUD, escala e medidores</small></div></div>
              <div class="game-setting-list">
                ${fieldSelect('Escala da interface', 'uiScale', s.uiScale, [['compact','Compacta'], ['normal','Normal'], ['large','Grande']])}
                ${fieldSelect('Densidade da interface', 'interface.density', s.interface.density, [['compact','Compacta'], ['normal','Normal'], ['comfortable','Confortável']])}
                ${fieldSelect('Tamanho da fonte', 'interface.fontSize', s.interface.fontSize, [['small','Pequena'], ['normal','Normal'], ['large','Grande'], ['huge','Muito grande']])}
                ${fieldSelect('Overlay de FPS', 'interface.fpsOverlay', s.interface.fpsOverlay, [['off','Desligado'], ['fps','FPS simples'], ['full','FPS completo']], 'Mostra FPS/frame time durante o jogo.')}
                ${fieldSelect('Autosave', 'autosave', s.autosave, [['on','Ligado'], ['off','Desligado']])}
                ${fieldToggle('Grade de debug', 'showGrid', s.showGrid)}
              </div>
            </section>
          </div>
        </section>
      </div>

      <footer class="game-settings-footer">
        <div class="game-settings-actions">
          <button type="button" data-performance-action="reset">Restaurar padrão</button>
          <button type="button" data-performance-action="apply-display">Reaplicar tela</button>
          <button type="button" data-performance-action="potato">Modo batata</button>
        </div>
        <span id="performanceSettingsStatus" class="perf-status">Salvo automaticamente.</span>
      </footer>
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
    if (input.dataset.settingSlider === 'true') return Number(input.value);
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
    if (label && input.dataset.settingSlider === 'true') label.textContent = `${Math.round(Number(input.value) * 100)}%`;
    showDebugGrid = !!settings?.showGrid;
    setStatus('Aplicado e salvo.');
    if (typeof updateUI === 'function') updateUI(true);
  }

  function handleClick(event) {
    const anchor = event.target?.closest?.('[data-settings-anchor]');
    if (anchor) {
      event.preventDefault();
      document.getElementById(anchor.dataset.settingsAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

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
    let style = document.getElementById('performance-settings-ui-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'performance-settings-ui-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      #settingsScreen.settings-screen{align-items:center;justify-content:center;background:radial-gradient(circle at 20% 10%,rgba(93,140,180,.18),transparent 34%),radial-gradient(circle at 85% 70%,rgba(214,162,74,.13),transparent 30%),linear-gradient(135deg,#070a0f,#101723 52%,#05070b);overflow:hidden;padding:18px}.game-settings-shell{position:relative;width:min(1180px,calc(100vw - 40px));height:min(760px,calc(100vh - 38px));display:grid;grid-template-rows:auto 1fr auto;background:linear-gradient(180deg,rgba(21,27,37,.98),rgba(8,11,17,.98));border:2px solid rgba(214,162,74,.42);box-shadow:0 30px 90px rgba(0,0,0,.72),inset 0 0 0 1px rgba(255,255,255,.06);border-radius:10px;overflow:hidden;color:#f4efe4}.game-settings-shell:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(0deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:38px 38px;pointer-events:none;opacity:.55}.game-settings-header,.game-settings-footer{position:relative;z-index:1;display:flex;align-items:center;gap:16px;padding:16px 18px;background:linear-gradient(90deg,rgba(0,0,0,.62),rgba(25,32,43,.82));border-bottom:1px solid rgba(214,162,74,.24)}.game-settings-footer{border-top:1px solid rgba(214,162,74,.24);border-bottom:0;justify-content:space-between;padding:12px 18px}.game-settings-title-block{flex:1}.game-settings-kicker{display:block;color:#d6a24a;font:900 11px system-ui;letter-spacing:.18em;text-transform:uppercase}.game-settings-title-block h1{margin:1px 0 2px;font:950 34px/1.0 system-ui;text-transform:uppercase;letter-spacing:.08em;color:#fff4d9;text-shadow:0 3px 0 rgba(0,0,0,.55),0 0 22px rgba(214,162,74,.18)}.game-settings-title-block p{margin:0;color:#aeb7c3;font-size:13px}.game-settings-header-status{min-width:158px;padding:9px 12px;border:1px solid rgba(214,162,74,.28);background:rgba(0,0,0,.28);box-shadow:inset 0 0 18px rgba(214,162,74,.05)}.game-settings-header-status span{display:block;font-size:10px;color:#8894a4;letter-spacing:.16em}.game-settings-header-status b{display:block;color:#f6c76a;text-transform:uppercase}.game-settings-back,.game-settings-actions button{border:1px solid rgba(246,199,106,.50);background:linear-gradient(180deg,#2d3442,#151a23);color:#fff4d9;border-radius:4px;padding:11px 16px;font:950 12px system-ui;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 3px 0 rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);cursor:pointer}.game-settings-back:hover,.game-settings-actions button:hover{background:linear-gradient(180deg,#3d4658,#1b2230);border-color:#f6c76a}.game-settings-body{position:relative;z-index:1;display:grid;grid-template-columns:235px 1fr;min-height:0}.game-settings-sidebar{border-right:1px solid rgba(214,162,74,.22);background:linear-gradient(180deg,rgba(0,0,0,.30),rgba(5,7,11,.62));padding:16px;display:grid;grid-template-rows:auto auto 1fr;gap:14px}.game-settings-sidebar-title span{display:block;color:#8f9aaa;font-size:10px;letter-spacing:.18em}.game-settings-sidebar-title b{display:block;color:#fff4d9;font-size:18px;letter-spacing:.08em}.game-preset-stack{display:grid;gap:8px}.game-preset-button{display:grid;grid-template-columns:10px 1fr;align-items:center;gap:10px;text-align:left;padding:11px 10px;border-radius:4px;border:1px solid rgba(255,255,255,.11);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(0,0,0,.20));color:#e7edf6;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);cursor:pointer}.game-preset-button i{display:block;width:8px;height:34px;background:#3d4658;border:1px solid rgba(255,255,255,.14)}.game-preset-button b{display:block;font-size:13px;letter-spacing:.06em}.game-preset-button small{display:block;color:#8995a5;font-size:11px}.game-preset-button.is-active{border-color:#f6c76a;background:linear-gradient(90deg,rgba(214,162,74,.28),rgba(37,44,56,.70));box-shadow:0 0 0 1px rgba(214,162,74,.22),inset 0 1px 0 rgba(255,255,255,.08)}.game-preset-button.is-active i{background:#f6c76a;box-shadow:0 0 14px rgba(246,199,106,.45)}.game-settings-hint-box{align-self:end;border:1px solid rgba(148,163,184,.20);background:rgba(8,12,18,.72);padding:12px;color:#dbeafe;font-size:12px}.game-settings-hint-box b{display:block;color:#f6c76a;text-transform:uppercase}.game-settings-hint-box small{display:block;color:#9aa7b8;line-height:1.35}.game-settings-content{display:grid;grid-template-rows:auto 1fr;min-height:0;background:linear-gradient(180deg,rgba(15,22,32,.72),rgba(4,7,12,.30))}.game-settings-tabs{display:flex;gap:8px;padding:13px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.22)}.game-settings-tabs button{flex:1;border:1px solid rgba(255,255,255,.12);background:#111823;color:#ccd6e4;border-radius:4px;padding:10px 12px;font:900 12px system-ui;text-transform:uppercase;letter-spacing:.08em;cursor:pointer}.game-settings-tabs button:hover{border-color:rgba(246,199,106,.65);color:#fff4d9;background:#1b2432}.game-settings-scroll{min-height:0;overflow:auto;padding:14px;scroll-behavior:smooth}.game-settings-scroll::-webkit-scrollbar{width:10px}.game-settings-scroll::-webkit-scrollbar-track{background:#070a0f}.game-settings-scroll::-webkit-scrollbar-thumb{background:#3b4656;border:2px solid #070a0f}.game-settings-group{border:1px solid rgba(255,255,255,.12);background:linear-gradient(180deg,rgba(24,31,42,.86),rgba(9,13,20,.86));box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);margin-bottom:12px}.game-group-title{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(214,162,74,.18);background:linear-gradient(90deg,rgba(214,162,74,.14),rgba(255,255,255,.025))}.game-group-title>span{display:grid;place-items:center;width:34px;height:28px;border:1px solid rgba(246,199,106,.42);color:#f6c76a;background:rgba(0,0,0,.34);font-weight:950}.game-group-title b{display:block;font-size:16px;text-transform:uppercase;letter-spacing:.08em;color:#fff4d9}.game-group-title small{display:block;color:#8d99a8;font-size:11px}.game-setting-list{display:grid}.perf-setting-field{display:grid;grid-template-columns:minmax(190px,1fr) minmax(200px,280px);gap:8px 14px;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.065);color:#e6edf7}.perf-setting-field:last-child{border-bottom:0}.perf-setting-field>span{font:850 13px system-ui;color:#edf3fb}.perf-setting-field>span b{float:right;color:#f6c76a;font-size:12px}.perf-setting-field small{grid-column:1/-1;color:#7f8b9b;font-size:11px;margin-top:-3px;line-height:1.25}.perf-setting-field select,.perf-setting-field input[type="range"]{width:100%}.perf-setting-field select{height:38px;border-radius:4px;border:1px solid rgba(214,162,74,.35);background:#05080d;color:#f4efe4;padding:0 12px;font-weight:800;outline:none}.perf-setting-field select:focus{border-color:#f6c76a;box-shadow:0 0 0 2px rgba(246,199,106,.12)}.perf-setting-slider input[type="range"]{accent-color:#f6c76a}.perf-setting-toggle input{justify-self:end;width:22px;height:22px;accent-color:#f6c76a}.game-settings-actions{display:flex;gap:8px;flex-wrap:wrap}.perf-status{color:#9aa7b8;font-size:12px}.hf-no-ui-animations *{transition:none!important;animation:none!important}.hf-reduced-ui-animations *{animation-duration:.08s!important;transition-duration:.08s!important}:root[data-ui-density="compact"] .game-setting-list .perf-setting-field{padding:9px 12px}:root[data-ui-density="comfortable"] .game-setting-list .perf-setting-field{padding:15px 16px}:root[data-font-size="large"] body{font-size:17px}:root[data-font-size="huge"] body{font-size:19px}@media(max-width:860px){#settingsScreen.settings-screen{padding:8px}.game-settings-shell{width:calc(100vw - 16px);height:calc(100vh - 16px)}.game-settings-body{grid-template-columns:1fr}.game-settings-sidebar{grid-template-rows:auto auto;border-right:0;border-bottom:1px solid rgba(214,162,74,.22)}.game-preset-stack{grid-template-columns:repeat(2,1fr)}.game-settings-hint-box{display:none}.game-settings-header-status{display:none}.game-settings-title-block h1{font-size:26px}.perf-setting-field{grid-template-columns:1fr}.game-settings-tabs{overflow:auto}.game-settings-tabs button{min-width:130px}}`;
  }

  ensureStyle();
  renderSettingsScreen();
  document.addEventListener('change', handleSettingChange, true);
  document.addEventListener('input', handleSettingChange, true);
  document.addEventListener('click', handleClick, true);
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.renderPerformanceSettingsScreen = renderSettingsScreen;
})();
