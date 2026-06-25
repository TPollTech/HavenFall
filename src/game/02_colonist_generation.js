'use strict';

function initialResourcesForConfig(config) {
  const table = {
    scarce: { food: 10, wood: 12, stone: 4, metal: 0, medicine: 0 },
    standard: { food: 14, wood: 18, stone: 6, metal: 0, medicine: 1 },
    rich: { food: 24, wood: 30, stone: 12, metal: 2, medicine: 2 }
  };
  const res = { ...(table[config.resourcesPreset] || table.standard) };
  if (config.difficulty === 'easy') { res.food += 6; res.wood += 8; res.medicine += 1; }
  if (config.difficulty === 'hard') { res.food = Math.max(4, res.food - 5); res.wood = Math.max(5, res.wood - 7); res.stone = Math.max(2, res.stone - 3); }
  return res;
}

function createColonistCandidate(index, config, forceSeed = null) {
  const rand = seededRandom(forceSeed || `${config.seed}-colonist-${index}-${Date.now()}-${Math.random()}`);
  const firstNames = ['Lia','Téo','Nico','Bia','Gael','Mira','Davi','Luma','Caio','Iris','Noa','Eva','Ravi','Mila','Otto','Nina'];
  const roles = ['Coletora', 'Construtor', 'Faz-tudo'];
  const sprites = ['colonistA', 'colonistB', 'colonistC'];
  const physical = ['resistente', 'baixo', 'alto', 'ágil', 'visão boa', 'mãos firmes', 'cansa rápido', 'passo leve'];
  const psycheGood = ['calmo', 'curioso', 'otimista', 'focado', 'corajoso', 'organizado', 'paciente'];
  const psycheBad = ['teimoso', 'medroso', 'impaciente', 'desastrado', 'noturno', 'pessimista', 'distraído'];
  const workPrefs = ['Construção', 'Coleta', 'Defesa', 'Pesquisa', 'Culinária', 'Medicina'];
  const skills = {
    coleta: 1 + Math.floor(rand() * 5),
    construcao: 1 + Math.floor(rand() * 5),
    defesa: 1 + Math.floor(rand() * 5),
    pesquisa: 1 + Math.floor(rand() * 5),
    medicina: 1 + Math.floor(rand() * 5)
  };
  const role = roles[Math.floor(rand() * roles.length)];
  return {
    setupId: uid(),
    locked: false,
    name: firstNames[Math.floor(rand() * firstNames.length)],
    age: 18 + Math.floor(rand() * 38),
    sprite: sprites[index % sprites.length],
    role,
    physicalTraits: pickMany(physical, 2, rand),
    positiveTraits: pickMany(psycheGood, 2, rand),
    negativeTraits: pickMany(psycheBad, 1, rand),
    skills,
    workPreference: workPrefs[Math.floor(rand() * workPrefs.length)],
    needs: {
      hunger: 72 + Math.floor(rand() * 22),
      energy: 72 + Math.floor(rand() * 22),
      mood: 68 + Math.floor(rand() * 26),
      health: 88 + Math.floor(rand() * 13)
    }
  };
}

function pickMany(list, amount, rand) {
  const copy = list.slice();
  const out = [];
  while (out.length < amount && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}

function generateColonistCandidates(config) {
  colonistCandidates = Array.from({ length: config.colonistCount }, (_, i) => createColonistCandidate(i, config, `${config.seed}-candidate-${i}`));
  renderColonistSelection();
}

function rerollColonist(index) {
  if (colonistCandidates[index]?.locked) return;
  colonistCandidates[index] = createColonistCandidate(index, newGameConfig, `${newGameConfig.seed}-reroll-${index}-${Date.now()}-${Math.random()}`);
  renderColonistSelection();
}

function renderColonistSelection() {
  if (!dom.colonistCards) return;
  dom.colonistCards.innerHTML = colonistCandidates.map((c, i) => `
    <article class="colonist-card ${c.locked ? 'locked' : ''}">
      <div class="colonist-head">
        <div class="colonist-preview"><img src="assets/sprites/${c.sprite}_down_0.png" alt=""></div>
        <div>
          <h2>${escapeHtml(c.name)}, ${c.age}</h2>
          <div class="empty">${escapeHtml(c.role)} · Prefere ${escapeHtml(c.workPreference)}</div>
        </div>
      </div>
      <div class="tags">
        ${c.physicalTraits.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        ${c.positiveTraits.map(t => `<span class="tag good">+ ${escapeHtml(t)}</span>`).join('')}
        ${c.negativeTraits.map(t => `<span class="tag bad">- ${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="empty">Habilidades: coleta ${c.skills.coleta}, construção ${c.skills.construcao}, defesa ${c.skills.defesa}, pesquisa ${c.skills.pesquisa}, medicina ${c.skills.medicina}</div>
      <div class="empty">Necessidades: comida ${c.needs.hunger}%, energia ${c.needs.energy}%, humor ${c.needs.mood}%, saúde ${c.needs.health}%</div>
      <div class="card-actions">
        <button data-reroll-colonist="${i}" ${c.locked ? 'disabled' : ''}>Rerolar</button>
        <button data-lock-colonist="${i}" class="${c.locked ? 'active' : 'secondary'}">${c.locked ? 'Travado' : 'Travar'}</button>
      </div>
    </article>
  `).join('');
}

function candidateToColonist(candidate, id, x, y) {
  const c = makeColonist(id, candidate.name, candidate.sprite, x, y, candidate.role);
  c.age = candidate.age;
  c.appearance = candidate.sprite;
  c.physicalTraits = candidate.physicalTraits;
  c.positiveTraits = candidate.positiveTraits;
  c.negativeTraits = candidate.negativeTraits;
  c.skills = candidate.skills;
  c.workPreference = candidate.workPreference;
  c.hunger = candidate.needs.hunger;
  c.energy = candidate.needs.energy;
  c.mood = candidate.needs.mood;
  c.health = candidate.needs.health;
  c.priority = priorityFromWorkPreference(candidate.workPreference, candidate.role);
  return c;
}

function priorityFromWorkPreference(pref, role) {
  if (pref === 'Construção') return 'build';
  if (pref === 'Coleta') return 'gather';
  if (pref === 'Defesa') return 'defense';
  return defaultPriorityForRole(role);
}
