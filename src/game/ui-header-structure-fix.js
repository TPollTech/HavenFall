'use strict';

(() => {
  function restoreResourceBarMarkup() {
    const bar = document.getElementById('top-resource-bar');
    if (!bar) return;
    bar.classList.add('top-resource-bar');
    bar.innerHTML = [
      '<div class="res-item" title="Comida"><span class="res-icon">🥩</span> Comida <b id="resFood">0</b><span id="txt-food" hidden>0</span></div>',
      '<div class="res-item" title="Madeira"><span class="res-icon">🪵</span> Madeira <b id="resWood">0</b><span id="txt-wood" hidden>0</span></div>',
      '<div class="res-item" title="Pedra"><span class="res-icon">🪨</span> Pedra <b id="resStone">0</b><span id="txt-stone" hidden>0</span></div>',
      '<div class="res-item" title="Metal"><span class="res-icon">🪙</span> Metal <b id="resMetal">0</b><span id="txt-metal" hidden>0</span></div>',
      '<div class="res-item" title="Remédios"><span class="res-icon">💊</span> Remédios <b id="resMedicine">0</b><span id="txt-meds" hidden>0</span></div>'
    ].join('');
  }

  function injectStructureStyle() {
    document.getElementById('premium-header-polish-style')?.remove();
    document.getElementById('ui-header-structure-fix-style')?.remove();
    const style = document.createElement('style');
    style.id = 'ui-header-structure-fix-style';
    style.textContent = `
      body.ui-gameplay-active #topBar {
        display: grid !important;
        grid-template-columns: minmax(220px, 1fr) minmax(360px, auto) auto auto !important;
        gap: 14px !important;
        align-items: center !important;
        top: 10px !important;
        left: 20px !important;
        right: 20px !important;
        min-height: 54px !important;
        padding: 8px 14px !important;
        background: rgba(10,15,30,.82) !important;
        border: 1px solid rgba(59,130,246,.18) !important;
        border-radius: 14px !important;
        box-shadow: 0 10px 28px rgba(0,0,0,.34) !important;
        backdrop-filter: blur(8px) !important;
        z-index: 120 !important;
      }
      #top-resource-bar {
        position: static !important;
        width: auto !important;
        height: auto !important;
        min-width: 0 !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        gap: 10px !important;
        overflow: hidden !important;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        z-index: auto !important;
        color: #f1f5f9 !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        pointer-events: auto !important;
      }
      #top-resource-bar .res-item {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        white-space: nowrap !important;
        padding: 5px 10px !important;
        border-radius: 8px !important;
        background: rgba(255,255,255,.04) !important;
        border: 1px solid rgba(255,255,255,.07) !important;
        box-shadow: inset 0 1px 3px rgba(0,0,0,.2) !important;
      }
      #top-resource-bar .res-item b { color:#3b82f6 !important; font-weight:800 !important; }
      body.ui-gameplay-active #topBar .top-left-info { min-width:0 !important; overflow:hidden !important; }
      body.ui-gameplay-active #topBar #gameConfigLabel { white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; max-width:520px !important; }
      body.ui-gameplay-active #topBar .clock { justify-content:center !important; flex-wrap:nowrap !important; }
      body.ui-gameplay-active #topBar .clock span { height:30px !important; display:inline-flex !important; align-items:center !important; padding:4px 12px !important; border-radius:999px !important; background:rgba(0,0,0,.52) !important; }
      body.ui-gameplay-active #topBar .top-actions { justify-content:flex-end !important; white-space:nowrap !important; }
      body.ui-gameplay-active #topBar .top-actions button { height:34px !important; padding:6px 12px !important; border-radius:10px !important; }
      @media(max-width:1100px){body.ui-gameplay-active #topBar{grid-template-columns:1fr!important;gap:8px!important}#top-resource-bar{justify-content:flex-start!important;overflow-x:auto!important;padding-bottom:2px!important}body.ui-gameplay-active #topBar .clock{justify-content:flex-start!important;overflow-x:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function syncResources() {
    if (!state?.resources) return;
    const pairs = [
      ['resFood', 'txt-food', state.resources.food],
      ['resWood', 'txt-wood', state.resources.wood],
      ['resStone', 'txt-stone', state.resources.stone],
      ['resMetal', 'txt-metal', state.resources.metal],
      ['resMedicine', 'txt-meds', state.resources.medicine]
    ];
    pairs.forEach(([visibleId, hiddenId, value]) => {
      const text = Math.floor(value || 0);
      const visible = document.getElementById(visibleId);
      const hidden = document.getElementById(hiddenId);
      if (visible) visible.textContent = text;
      if (hidden) hidden.textContent = text;
    });
  }

  function applyHeaderStructureFix() {
    restoreResourceBarMarkup();
    injectStructureStyle();
    syncResources();
  }

  if (typeof updateUI === 'function' && !window.HavenfallContext?.headerStructureUpdatePatched) {
    const nativeUpdateUI = updateUI;
    updateUI = function updateUIWithHeaderStructureFix(force = false) {
      nativeUpdateUI(force);
      applyHeaderStructureFix();
    };
    window.HavenfallContext = window.HavenfallContext || {};
    window.HavenfallContext.headerStructureUpdatePatched = true;
  }

  window.applyHeaderStructureFix = applyHeaderStructureFix;
  applyHeaderStructureFix();
})();
