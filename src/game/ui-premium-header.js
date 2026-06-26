'use strict';

(() => {
  const rows = [
    ['txt-food', '🥩', 'Comida', 'food'],
    ['txt-wood', '🪵', 'Madeira', 'wood'],
    ['txt-stone', '🪨', 'Pedra', 'stone'],
    ['txt-metal', '🪙', 'Metal', 'metal'],
    ['txt-meds', '💊', 'Remédios', 'medicine']
  ];

  function injectHeaderStyle() {
    if (document.getElementById('ui-premium-header-style')) return;
    const style = document.createElement('style');
    style.id = 'ui-premium-header-style';
    style.textContent = `
      #top-resource-bar{position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:45px!important;background:linear-gradient(to bottom,rgba(10,15,30,.95) 60%,rgba(10,15,30,.8) 80%,rgba(0,0,0,0))!important;display:flex;justify-content:center!important;align-items:center!important;gap:30px!important;color:#f1f5f9!important;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif!important;font-size:13px!important;font-weight:600!important;letter-spacing:.5px!important;z-index:9999!important;border-bottom:1px solid rgba(59,130,246,.2)!important;box-shadow:0 4px 20px rgba(0,0,0,.4)!important;pointer-events:auto!important}
      #top-resource-bar .res-item{background:rgba(255,255,255,.03)!important;padding:4px 12px!important;border-radius:6px!important;border:1px solid rgba(255,255,255,.05)!important;display:flex!important;align-items:center!important;gap:6px!important;box-shadow:inset 0 1px 3px rgba(0,0,0,.2)!important;transition:all .2s ease!important;white-space:nowrap!important}
      #top-resource-bar .res-item:hover{background:rgba(59,130,246,.1)!important;border-color:rgba(59,130,246,.3)!important}
      #top-resource-bar .res-item span{color:#3b82f6!important;font-weight:700!important}
      @media(max-width:720px){#top-resource-bar{justify-content:flex-start!important;gap:8px!important;overflow-x:auto!important;padding:0 8px!important}}
    `;
    document.head.appendChild(style);
  }

  function renderHeader() {
    const bar = document.getElementById('top-resource-bar');
    if (!bar) return;
    bar.innerHTML = rows.map(([id, icon, label]) => `<div class="res-item">${icon} ${label}: <span id="${id}">0</span></div>`).join('');
    syncHeader();
  }

  function syncHeader() {
    if (!state?.resources) return;
    rows.forEach(([id, , , key]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.floor(state.resources[key] || 0);
    });
  }

  if (typeof updateUI === 'function' && !window.HavenfallContext?.premiumHeaderUpdatePatched) {
    const originalUpdateUI = updateUI;
    updateUI = force => {
      originalUpdateUI(force);
      syncHeader();
    };
    window.HavenfallContext = window.HavenfallContext || {};
    window.HavenfallContext.premiumHeaderUpdatePatched = true;
  }

  window.syncPremiumHeader = syncHeader;
  injectHeaderStyle();
  renderHeader();
})();
