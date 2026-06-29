'use strict';

function installMobCanvasInteractions() {
  if (!canvas || window.HavenfallContext?.mobCanvasInteractionsInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};

  canvas.addEventListener('click', event => {
    if (appScreen !== SCREEN.PLAYING || !state || currentBuild || currentZoneTool) return;
    if (typeof tileFromEvent !== 'function' || typeof getMobAt !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile || !isTileDiscovered(tile.x, tile.y)) return;
    const mob = getMobAt(tile.x, tile.y);
    if (!mob) return;
    const c = selectedColonist();
    if (typeof assignHuntMob === 'function' && assignHuntMob(c, mob)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      updateUI(true);
    }
  }, true);

  canvas.addEventListener('contextmenu', event => {
    if (appScreen !== SCREEN.PLAYING || !state) return;
    if (typeof tileFromEvent !== 'function' || typeof getMobAt !== 'function' || typeof showContextMenu !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile || !isTileDiscovered(tile.x, tile.y)) return;
    const mob = getMobAt(tile.x, tile.y);
    if (!mob) return;
    const c = selectedColonist();
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    showContextMenu(event.clientX, event.clientY, [
      { label: 'Inspecionar animal', hint: 'estado, grupo, rota e memória', run: () => window.HavenfallLivingWorld?.inspectAnimal?.(mob) },
      { label: `Caçar ${mobName?.(mob.type) || 'animal'}`, hint: mob.type === 'rabbit' ? 'carne e pele' : 'risco de lentidão', run: () => assignHuntMob(c, mob) },
      { label: 'Mover até perto', hint: `${mob.x},${mob.y}`, run: () => assignMoveNearTarget(c, mob) }
    ], { kind: 'mob', mob, label: mobName?.(mob.type) || 'Animal' });
  }, true);

  window.HavenfallContext.mobCanvasInteractionsInstalled = true;
}

installMobCanvasInteractions();
