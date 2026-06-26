'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};

  function drawCreatureFallback(mob) {
    const x = mob.px;
    const y = mob.py;
    ctx.save();
    if (mob.type === 'rabbit') {
      ctx.fillStyle = '#d8d0bd';
      ctx.strokeStyle = '#6f6251';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y + 12, 13, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#eee7d9';
      ctx.beginPath(); ctx.ellipse(x + 8, y + 4, 5, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (mob.type === 'spider') {
      ctx.fillStyle = '#3b303e';
      ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3b303e';
      for (let i = -3; i <= 3; i += 2) {
        ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + i * 7, y + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + i * 7, y + 19); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCreatureSpriteMob(mob) {
    const frame = Math.floor((mob.anim || 0) * 6) % 5;
    const key = mob.state === 'dead' ? `${mob.type}_dead` : `${mob.type}_walk_${frame}`;
    const img = images[key] || images[`${mob.type}_front`];
    if (!img || !img.width || !img.height) return false;
    const scale = mob.type === 'spider' ? 0.42 : 0.58;
    const flip = mob.dir === 'right';
    drawAsset(img, mob.px, mob.py + 25, scale, 0.5, 1, flip);
    return true;
  }

  if (typeof drawMob === 'function') {
    const nativeDrawMob = drawMob;
    drawMob = function drawMobWithCreatureSprites(mob) {
      if ((mob.type === 'rabbit' || mob.type === 'spider') && drawCreatureSpriteMob(mob)) return;
      if (mob.type === 'rabbit' || mob.type === 'spider') return drawCreatureFallback(mob);
      return nativeDrawMob(mob);
    };
    window.HavenfallContext.creatureRendererPatched = true;
  }
})();
