'use strict';

(() => {
  const colonists = window.HavenfallColonistRenderer;

  function drawNpcPawn(npc) {
    if (!npc) return false;
    const actor = {
      ...npc,
      appearance: {
        ...(npc.appearance || {}),
        clothes: npc.appearance?.clothes || npc.appearance?.cloth || npc.cloth || '#735c3f'
      }
    };
    colonists.drawHumanoid(actor);
    if (npc.name) drawName?.(npc.name, npc.px, npc.py - 38);
    return true;
  }

  window.HavenfallNpcRenderer = Object.freeze({
    drawNpc: drawNpcPawn
  });
})();
