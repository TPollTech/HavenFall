'use strict';

(() => {
  if (window.HavenfallWorkFeedback?.version === 'work-feedback-v1') return;

  const activities = new Map();
  const sparks = [];
  const MAX_SPARKS = 70;
  const profiles = {
    mine: { interval: 0.5, color: '#f1d28a', sound: 'stone' },
    ore: { interval: 0.5, color: '#ffd08a', sound: 'ore' },
    wood: { interval: 0.6, color: '#f8d08a', sound: 'wood' },
    build: { interval: 0.55, color: '#ffe0a3', sound: 'build' },
    forge: { interval: 0.5, color: '#ffd1bb', sound: 'forge' },
    research: { interval: 0.85, color: '#e8ebff', sound: 'research' },
    craft: { interval: 0.7, color: '#dff6ff', sound: 'craft' },
    gather: { interval: 0.75, color: '#ddf5aa', sound: 'gather' }
  };

  function playing() {
    return !!state && appScreen === SCREEN.PLAYING && state.isPreview !== true && state.runtimeMode !== 'menu-preview';
  }

  function obj(id) {
    return (state?.objects || []).find(o => o.id === id) || null;
  }

  function tileCenter(x, y) {
    return { x: Number(x || 0) * TILE + TILE / 2, y: Number(y || 0) * TILE + TILE / 2 };
  }

  function taskKey(task) {
    if (!task) return '';
    return [task.type, task.objId, task.mineX, task.mineY, task.recipeKey].filter(v => v !== undefined && v !== null).join(':');
  }

  function targetFor(c) {
    const task = c?.task;
    if (!task || c.path?.length) return null;

    if (task.type === 'mine') {
      const rock = typeof getRockAt === 'function' ? getRockAt(task.mineX, task.mineY) : null;
      if (!rock?.solid) return null;
      const kind = rock.resource === 'metal' ? 'ore' : 'mine';
      return { kind, x: task.mineX, y: task.mineY, detail: { rockType: rock.type, resource: rock.resource }, progress: rock.maxHp ? 1 - Number(rock.hp || 0) / Math.max(1, Number(rock.maxHp || 1)) : 0 };
    }

    if (task.type === 'gather') {
      const o = obj(task.objId);
      if (!o) return null;
      const kind = o.type === 'tree' || o.type === 'logs' ? 'wood' : 'gather';
      const def = objectDefs?.[o.type];
      return { kind, x: o.x, y: o.y, detail: { objectType: o.type }, progress: def?.work ? Number(c.work || 0) / def.work : 0 };
    }

    if (task.type === 'build') {
      const o = obj(task.objId);
      if (!o) return null;
      const def = buildDefs?.[o.buildType];
      return { kind: 'build', x: o.x, y: o.y, detail: { buildType: o.buildType }, progress: def?.work ? Number(o.progress || 0) / def.work : 0 };
    }

    if (task.type === 'forge' || task.type === 'research' || task.type === 'craft' || task.type === 'cook' || task.type === 'heal') {
      const o = obj(task.objId);
      if (!o) return null;
      return { kind: profiles[task.type] ? task.type : 'craft', x: o.x, y: o.y, detail: { objectType: o.type, recipeKey: task.recipeKey }, progress: Number(c.work || 0) % 1 };
    }

    return null;
  }

  function face(c, target) {
    const dx = target.x - c.x;
    const dy = target.y - c.y;
    if (Math.abs(dx) > Math.abs(dy)) c.dir = dx >= 0 ? 'right' : 'left';
    else if (Math.abs(dy) > 0) c.dir = dy >= 0 ? 'down' : 'up';
  }

  function addSparks(x, y, color, strong = false) {
    if (sparks.length > MAX_SPARKS) sparks.splice(0, sparks.length - MAX_SPARKS);
    const count = strong ? 5 : 3;
    for (let i = 0; i < count; i++) {
      sparks.push({ x, y, dx: (Math.random() - 0.5) * 26, dy: -Math.random() * 22, age: 0, life: strong ? 0.42 : 0.28, color });
    }
  }

  function updateColonyWork(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt || 0;
      s.x += s.dx * (dt || 0);
      s.y += s.dy * (dt || 0);
      s.dy += 60 * (dt || 0);
      if (s.age >= s.life) sparks.splice(i, 1);
    }

    if (!playing()) {
      activities.clear();
      return;
    }

    const live = new Set();
    for (const c of state.colonists || []) {
      const target = targetFor(c);
      if (!target) continue;
      const id = String(c.id || c.name || `${c.x},${c.y}`);
      live.add(id);
      const profile = profiles[target.kind] || profiles.gather;
      const key = taskKey(c.task);
      let activity = activities.get(id);
      if (!activity || activity.key !== key) activity = { id, key, target, pulse: 0, timer: profile.interval * 0.4 };
      activity.target = target;
      activity.pulse += dt || 0;
      activity.timer -= (dt || 0) * Math.max(1, Number(state.speed || 1));
      activity.progress = Math.max(0, Math.min(1, Number(target.progress || 0)));
      activities.set(id, activity);
      face(c, target);

      if (activity.timer <= 0) {
        activity.timer += profile.interval * (0.85 + Math.random() * 0.3);
        const p = tileCenter(target.x, target.y);
        addSparks(p.x, p.y + 6, profile.color, target.kind === 'mine' || target.kind === 'ore' || target.kind === 'forge');
        window.HavenfallAudio?.playWorkImpact?.(profile.sound || target.kind, target.detail || {});
      }
    }
    for (const id of Array.from(activities.keys())) if (!live.has(id)) activities.delete(id);
  }

  function drawSparkLayer() {
    ctx.save();
    for (const s of sparks) {
      const alpha = Math.max(0, 1 - s.age / Math.max(0.001, s.life));
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5 * alpha + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawActivity(activity, c) {
    const target = activity.target;
    const profile = profiles[target.kind] || profiles.gather;
    const p = tileCenter(target.x, target.y);
    const angle = Math.atan2(p.y - c.py, p.x - c.px);
    const swing = Math.sin(activity.pulse * 11) * 0.55;
    const hx = c.px + Math.cos(angle) * 13;
    const hy = c.py + Math.sin(angle) * 13 + 9;
    const tx = hx + Math.cos(angle + swing) * 24;
    const ty = hy + Math.sin(angle + swing) * 24;

    ctx.save();
    ctx.strokeStyle = profile.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 4, 14 + Math.sin(activity.pulse * 8) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,.58)';
    ctx.fillRect(c.px - 19, c.py - 47, 38, 5);
    ctx.fillStyle = profile.color;
    ctx.fillRect(c.px - 19, c.py - 47, 38 * Math.max(0, Math.min(1, activity.progress || 0)), 5);
    ctx.restore();
  }

  function drawWorkLayer() {
    if (!playing()) return;
    drawSparkLayer();
    for (const activity of activities.values()) {
      const c = (state.colonists || []).find(col => String(col.id || col.name || `${col.x},${col.y}`) === activity.id);
      if (!c) continue;
      if (typeof isWorldPointInView === 'function' && !isWorldPointInView(c.px, c.py, TILE * 2)) continue;
      drawActivity(activity, c);
    }
  }

  function notifyComplete(kind, detail = {}, x = null, y = null) {
    window.HavenfallAudio?.playWorkComplete?.(kind, detail);
    if (x !== null && y !== null) {
      const profile = profiles[kind] || profiles.mine;
      const p = tileCenter(x, y);
      addSparks(p.x, p.y + 6, profile.color, true);
    }
  }

  window.HavenfallWorkFeedback = { version: 'work-feedback-v1', notifyComplete, activities, sparks };
  window.GameSystems?.registerTick('work:feedback', updateColonyWork, { order: 74, type: 'visual-feedback' });
  window.GameSystems?.registerWorldOverlay('work:feedback-overlay', drawWorkLayer, { order: 72, type: 'visual-feedback' });
})();
