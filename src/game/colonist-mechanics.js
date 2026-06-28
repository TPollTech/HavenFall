'use strict';

function defaultPriorityForRole(role) {
  if (role === 'Coletora' || role === 'Coletor') return 'gather';
  if (role === 'Construtor') return 'build';
  if (role === 'Generalista') return 'gather';
  return 'defense';
}

function roleBonusText(c) {
  if (c.role === 'Coletora' || c.role === 'Coletor') return '+25% em coleta';
  if (c.role === 'Construtor') return '+25% em construção';
  if (c.role === 'Faz-tudo' || c.role === 'Generalista') return '+10% em tarefas gerais';
  return 'sem bônus';
}

function ensureEquipment(c) {
  c.equipment = c.equipment || { tool: null, weapon: null, offhand: null };
  if (!('tool' in c.equipment)) c.equipment.tool = null;
  if (!('weapon' in c.equipment)) c.equipment.weapon = null;
  if (!('offhand' in c.equipment)) c.equipment.offhand = null;
  return c.equipment;
}

function workRate(c, kind, target = null) {
  ensureEquipment(c);
  let rate = 1;
  if ((c.role === 'Coletora' || c.role === 'Coletor') && kind === 'gather') rate += 0.25;
  if (c.role === 'Construtor' && kind === 'build') rate += 0.25;
  if ((c.role === 'Faz-tudo' || c.role === 'Generalista') && ['gather','build','research','forge','cook','heal','defense','craft'].includes(kind)) rate += 0.10;
  if (c.priority === 'build' && kind === 'build') rate += 0.10;
  if (c.priority === 'gather' && kind === 'gather') rate += 0.10;
  if (c.priority === 'defense' && kind === 'defense') rate += 0.10;

  const eq = c.equipment || {};
  const tool = itemDefs[eq.tool];
  if (kind === 'build' && tool?.buildBonus) rate += tool.buildBonus;
  if (kind === 'craft' && tool?.craftBonus) rate += tool.craftBonus;
  if (kind === 'gather' && tool?.gatherBonus) {
    const gather = target ? objectDefs[target.type]?.gather || {} : {};
    if (gather.wood && tool.gatherBonus.wood) rate += tool.gatherBonus.wood;
    if (gather.stone && tool.gatherBonus.stone) rate += tool.gatherBonus.stone;
    if (gather.metal && tool.gatherBonus.metal) rate += tool.gatherBonus.metal;
  }
  return window.GameSystems?.applyWorkRateModifiers(rate, c, kind, target) ?? rate;
}

function ensureColonistMeta(c) {
  if (!priorityDefs[c.priority]) c.priority = defaultPriorityForRole(c.role);
  c.path = c.path || [];
  c.px = c.px ?? c.x * TILE + TILE / 2;
  c.py = c.py ?? c.y * TILE + TILE / 2;
  c.note = c.note || 'Ocioso';
  c.work = c.work || 0;
  ensureEquipment(c);
}

function makeColonist(id, name, sprite, x, y, role) {
  return {
    id, name, role, sprite,
    x, y, px: x * TILE + TILE / 2, py: y * TILE + TILE / 2,
    dir: 'down', frame: 0, anim: 0,
    hunger: 78,
    energy: 82,
    mood: 76,
    health: 100,
    priority: defaultPriorityForRole(role),
    task: null,
    path: [],
    work: 0,
    note: 'Ocioso'
  };
}
