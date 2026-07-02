'use strict';

function worldPointForMobEvent(event) {
  if (typeof window.worldPointFromEvent === 'function') return window.worldPointFromEvent(event);
  if (typeof window.canvasClientToWorld === 'function') return window.canvasClientToWorld(event.clientX, event.clientY);
  if (!canvas || !viewTransform || !canvas.width || !canvas.height) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const px = (event.clientX - rect.left) * (canvas.width / rect.width);
  const py = (event.clientY - rect.top) * (canvas.height / rect.height);
  return {
    x: (px - viewTransform.offsetX) / viewTransform.scale,
    y: (py - viewTransform.offsetY) / viewTransform.scale
  };
}

function mobFromEvent(event) {
  const tile = typeof tileFromEvent === 'function' ? tileFromEvent(event) : null;
  if (!tile || !isTileDiscovered(tile.x, tile.y)) return null;
  const point = worldPointForMobEvent(event);
  const query = window.HavenfallEntityQuery || null;
  if (point && typeof query?.getMobAtWorld === 'function') return query.getMobAtWorld(point.x, point.y);
  if (point && typeof window.getMobAtWorld === 'function') return window.getMobAtWorld(point.x, point.y);
  if (typeof getMobAt === 'function') return getMobAt(tile.x, tile.y);
  return null;
}

function installMobCanvasInteractions() {
  if (!canvas || window.HavenfallContext?.mobCanvasInteractionsInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};

  canvas.addEventListener('click', event => {
    if (appScreen !== SCREEN.PLAYING || !state || currentBuild || currentZoneTool) return;
    const mob = mobFromEvent(event);
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
    if (typeof showContextMenu !== 'function') return;
    const mob = mobFromEvent(event);
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
