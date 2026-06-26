'use strict';

function repairModalDomReferences() {
  if (typeof dom === 'undefined') return;
  dom.modal = dom.modal || document.getElementById('eventModal');
  dom.buttons = dom.buttons || {};
  dom.buttons.modalStart = dom.buttons.modalStart || document.getElementById('modalStartBtn');
}

function applyPremiumHeaderPolish() {
  const bar = document.getElementById('top-resource-bar');
  if (!bar) return;
  bar.innerHTML = [
    '<div class="res-item">🥩 Comida: <span id="txt-food">0</span></div>',
    '<div class="res-item">🪵 Madeira: <span id="txt-wood">0</span></div>',
    '<div class="res-item">🪨 Pedra: <span id="txt-stone">0</span></div>',
    '<div class="res-item">🪙 Metal: <span id="txt-metal">0</span></div>',
    '<div class="res-item">💊 Remédios: <span id="txt-meds">0</span></div>'
  ].join('');

  if (!document.getElementById('premium-header-polish-style')) {
    const style = document.createElement('style');
    style.id = 'premium-header-polish-style';
    style.textContent = '#top-resource-bar{height:45px!important;background:linear-gradient(to bottom,rgba(10,15,30,.95) 60%,rgba(10,15,30,.8) 80%,rgba(0,0,0,0))!important;justify-content:center!important;gap:30px!important;color:#f1f5f9!important;font-size:13px!important;font-weight:600!important;letter-spacing:.5px!important;border-bottom:1px solid rgba(59,130,246,.2)!important;box-shadow:0 4px 20px rgba(0,0,0,.4)!important}.res-item{background:rgba(255,255,255,.03)!important;padding:4px 12px!important;border-radius:6px!important;border:1px solid rgba(255,255,255,.05)!important;display:flex!important;align-items:center!important;gap:6px!important;box-shadow:inset 0 1px 3px rgba(0,0,0,.2)!important}.res-item:hover{background:rgba(59,130,246,.1)!important;border-color:rgba(59,130,246,.3)!important}.res-item span{color:#3b82f6!important;font-weight:700!important}.game-popup-modal{width:550px!important;max-height:80vh!important;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(30,41,59,.98))!important;border:2px solid #3b82f6!important;box-shadow:0 0 20px rgba(59,130,246,.2),inset 0 0 15px rgba(255,255,255,.02)!important}.game-popup-modal.is-active{display:flex!important;flex-direction:column!important}.modal-header h3{color:#3b82f6!important}';
    document.head.appendChild(style);
  }
}

repairModalDomReferences();
applyPremiumHeaderPolish();
