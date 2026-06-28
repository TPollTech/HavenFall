'use strict';

(() => {
  function drawVfxFrame(animationKey, x, y, scale = 1, ax = 0.5, ay = 0.5) {
    const animation = typeof vfxAnimation === 'function' ? vfxAnimation(animationKey) : null;
    const img = images?.[`vfx:${animation?.key}`];
    if (!animation || !img || !animation.frames || !animation.frameWidth || !animation.frameHeight) return false;

    const delays = Array.isArray(animation.frameDelaysMs) && animation.frameDelaysMs.length
      ? animation.frameDelaysMs
      : [100];
    const avgDelay = delays.reduce((sum, value) => sum + Number(value || 100), 0) / delays.length;
    const frame = Math.floor(performance.now() / Math.max(40, avgDelay)) % animation.frames;
    const sx = frame * animation.frameWidth;
    const sw = animation.frameWidth;
    const sh = animation.frameHeight;
    const w = sw * scale;
    const h = sh * scale;

    ctx.drawImage(img, sx, 0, sw, sh, x - w * ax, y - h * ay, w, h);
    return true;
  }

  function colonistHasTorch(c) {
    const equipment = c?.equipment || {};
    return equipment.offhand === 'torch' || equipment.weapon === 'torch' || equipment.tool === 'torch';
  }

  function drawTorchEquipmentOverlay() {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const colonists = state.colonists || [];
    if (!colonists.some(colonistHasTorch)) return;

    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    for (const c of colonists) {
      if (!colonistHasTorch(c)) continue;
      if (typeof isWorldPointInView === 'function' && !isWorldPointInView(c.px, c.py)) continue;
      drawVfxFrame('weapon_torch', c.px + 21, c.py + 6, 0.34, 0.5, 0.88);
    }

    ctx.restore();
  }

  window.drawTorchEquipmentOverlay = drawTorchEquipmentOverlay;
  window.GameSystems?.registerDrawOverlay('fire:equipped-torches', drawTorchEquipmentOverlay, { order: 55 });
})();
