'use strict';

function repairModalDomReferences() {
  if (typeof dom === 'undefined') return;
  dom.modal = dom.modal || document.getElementById('eventModal');
  dom.buttons = dom.buttons || {};
  dom.buttons.modalStart = dom.buttons.modalStart || document.getElementById('modalStartBtn');
}

repairModalDomReferences();
