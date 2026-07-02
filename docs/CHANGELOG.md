# Changelog de Correções — Gameplay & Balanceamento

## Resumo

14 arquivos modificados, 95 inserções, 49 deleções.

---

## 1. Loop infinito de comida (`simpleMeal`)

**Arquivo:** `src/game/data/recipes.js`

**Antes:**
```
simpleMeal: cost { food: 2, wood: 1 }, output { food: 4 }  ← lucro infinito
```

**Depois:**
```
simpleMeal: cost { food: 5, wood: 1 }, output { food: 6 }
```

5 food + 1 madeira → 6 food + 2 simpleMeal items. Eficiência moderada, não é mais lucro infinito. O simpleMeal item pode ser equipado/consumido.

---

## 2. Receitas de preservação (4 novas)

**Arquivo:** `src/game/data/recipes.js`

Receitas que convertem colheitas _in natura_ em comida preservada com maior shelf life. Usam `itemCost` (consomem itens específicos do inventário) não recursos genéricos.

| Receita | Estação | Custo | Produz |
|---------|---------|-------|--------|
| `driedPotato` | Fogão | 1 wood + 4 batata | 8 food |
| `cannedCarrot` | Fogão | 1 wood + 3 cenoura | 6 food |
| `cornmeal` | Bancada | 4 milho | 8 food |
| `strawberryPreserve` | Fogão | 1 wood + 3 morango | 5 food |

---

## 3. Tocha: unlock `lighting` inexistente removido

**Arquivo:** `src/game/data/recipes.js`

A receita de tocha tinha `unlock: 'lighting'`, mas não existe pesquisa `lighting` em nenhuma das árvores. Isso fazia a tocha ficar sempre bloqueada (inacessível). Removido o unlock — a tocha agora está disponível desde o início.

---

## 4. Balanceamento: Bench vs Forja

**Arquivo:** `src/game/data/buildings.js`

A Bancada (estação inicial) era mais cara que a Forja (estação avançada):

| Estação | Antes (custo) | Depois (custo) |
|---------|---------------|----------------|
| **Bancada** | 18 wood + 8 stone, work 7 | 12 wood + 4 stone, work 5 |
| **Forja** | 14 wood + 12 stone, work 8 | (inalterado) |

---

## 5. Balanceamento: Veio de metal vs Rocha

**Arquivo:** `src/game/data/objects.js`

O veio de metal (ore) era pior que rocha comum em pedra/trabalho:

| Recurso | Antes | Depois |
|---------|-------|--------|
| **Rocha** | 7 stone, work 3.4 | (inalterado) |
| **Veio de metal** | 2 stone + 4 metal, work 4.0 | **3 stone + 6 metal, work 4.5** |

O metal é mais valioso que pedra, então ore agora tem rendimento total maior.

---

## 6. Sistema de Prioridades expandido

**Arquivos:** `priorities.js`, `world-systems.js`, `tab-tasks.js`, `living-world.js`, `colonist-generation.js`, `colonist-mechanics.js`, `hauling-adv.js`, `zones.js`

**Antes (3 tipos):**
- Construção (build)
- Coleta (gather)
- Defesa (defense)

**Depois (7 tipos):**
- Construção (build)
- Coleta (gather)
- **Agricultura** (farming) — prepara solo, planta e colhe
- **Artesanato** (crafting) — fabrica em bancadas/forja/foção
- **Pesquisa** (research) — trabalha na mesa de pesquisa
- **Transporte** (hauling) — leva itens até depósitos
- Defesa (defense)

### Detalhes:

- **UI (`tab-tasks.js`):** Painel agora mostra 6 sliders. Migração automática de `handle` → `hauling` em saves antigos.
- **Presets (`living-world.js`):** Valores padrão para cada tipo de colono (agricultor prioriza farming 4, etc).
- **Geração (`colonist-generation.js`):** Novas preferências de trabalho `farming` e `crafting`.
- **Bônus (`colonist-mechanics.js`):** Cada prioridade dá +10% de taxa no tipo correspondente.
- **Backward compatibility:** `'handle'` migrado para `'hauling'` automaticamente.

### Como funciona:

O sistema de prioridades agora lê `state.taskPriorities[colonist.id][tipo]` (0-4). Cada tick, o `assignAutoTask` em `world-systems.js` tenta tasks na ordem das prioridades do colono. Farming delega para `HavenfallFarming.assignFarmingTask`. Crafting varre receitas desbloqueadas com estação disponível. Hauling procura itens soltos com destino de armazenamento.

---

## 7. Schedule override removido

**Arquivo:** `src/game/systems/colonist-autonomy-system.js`

**Problema:** A função `runBeforeHooksWithoutLegacySchedule` sobrescrevia `ScheduleManager.getScheduleState` para **sempre retornar WORK**, ignorando completamente o schedule do colono (sono, lazer, trabalho).

**Antes:**
```js
manager.getScheduleState = (colonist, hour) => {
  // ... define scheduleMode ...
  return manager.SCHEDULE.WORK;  // ← sempre WORK!
};
```

**Depois:**
```js
function runBeforeHooksWithoutLegacySchedule(c, dt) {
  const manager = window.ScheduleManager;
  if (!window.GameSystems?.runBeforeColonistUpdate) return;
  manager?.ensureColonistSchedule?.(c);
  window.GameSystems.runBeforeColonistUpdate(c, dt);
}
```

Agora os hooks registrados pelo ScheduleManager rodam normalmente, e `getScheduleState` retorna o valor real do schedule (SLEEP=0, WORK=1, LEISURE=2). Colonos agora dormem e tem lazer conforme o horário.

---

## 8. Sistema de Pesquisa: merge em vez de overwrite

**Arquivo:** `src/game/data/research-defs.js`

**Problema:** `installExpandedResearchTree()` limpava toda a `researchDefs` (definida em `research.js` com 30+ entries, tiers 0-5, categorias, efeitos, posições) e substituía por `expandedResearchDefs` (26 entries, estrutura diferente, categorias diferentes).

**Antes:**
```js
Object.keys(researchDefs).forEach(key => delete researchDefs[key]);
Object.assign(researchDefs, expandedResearchDefs);
```

**Depois:**
```js
for (const [key, def] of Object.entries(expandedResearchDefs)) {
  if (!researchDefs[key]) {
    researchDefs[key] = { ...def };
  }
}
```

Isso preserva a árvore completa de `research.js` (com 30+ tecnologias, 6 tiers, efeitos de gameplay) e **adiciona** apenas as entries únicas de `research-defs.js` que não existem na árvore principal: `watercraft`, `butchery`, `fishing`, `reinforced_tools`.

### Normalização condicional

Em `recipes.js` (`normalizeResearchUnlockKeysWhenReady`), as sobrescritas de `unlocks` agora só acontecem se o array estiver vazio:
```js
if (researchDefs.agriculture && !researchDefs.agriculture.unlocks?.length)
```

Isso impede que a normalização destrua os `unlocks` definidos em `research.js`.

### Requisitos de construção preservados

`installExpandedResearchTree` continua definindo `buildDefs[key].requires = value` para conectar construções à pesquisa (campfire → survival_basics, bench → basic_tools, etc.).

---

## 9. Bandagens utilizáveis na estação médica

**Arquivo:** `src/game/systems/world-systems.js`

**Problema:** A estação médica consumia apenas o recurso `medicine` (genérico). Bandagens (`bandage` item) podiam ser fabricadas mas nunca usadas.

**Depois:** O handler de `'heal'` agora aceita tanto `medicine` (recurso) quanto `bandage` (item do inventário):
1. Tenta pagar `{ medicine: 1 }` — se tiver recurso, usa
2. Se não tiver `medicine`, tenta pagar `{ bandage: 1 }` do inventário
3. Se não tiver nenhum dos dois, mostra "Falta remédio ou curativo"

O `notifyWorkComplete` reporta qual insumo foi usado.

---

## 10. Itens faltantes adicionados

**Arquivo:** `src/game/systems/workstations-tools.js`

### `fishingRod`
- Item que faltava (referenciado em `research-defs.js` como unlock de `watercraft`)
- Tool slot, gatherBonus food +0.8
- Nota: funcionalidade de pesca em si não foi implementada — é um placeholder para quando o sistema de pesca existir

### `fieldRations`
- Item que faltava (referenciado em `research-defs.js` como unlock de `butchery`)
- Food item, nutrition 30, moodBonus 1, stableFood true

### `butcher_table`
- **buildDef:** Açougue, 14 wood + 4 stone, work 6, requires 'butchery'
- **objectDef:** craft station com work 4.5
- **stationLabel:** Açougue
- Já era referenciado em: `construction-system.js` (botão de construção), `canvas-input-building.js` (tipo de estação), `workstation-renderer.js` (renderização)

---

---

## 11. Limpeza de colonos mortos

**Arquivo:** `src/game/runtime/game-loop.js`

**Problema:** Colonos com `isDead = true` continuavam no estado do jogo para sempre, ocupando espaço na UI e no loop de update.

**Depois:**
- O loop de update (`updateWorld`) agora **pula** colonos mortos (`if (c.isDead) continue`)
- Nova função `removeDeadColonists()`: remove colonos mortos após **12 horas** de jogo
- Log de enterro com causa da morte: `"João foi enterrado após 14h (causa: inanição)."`
- A função roda no final de `updateWorld`, após o update de todos os colonos vivos

---

## 12. Farming e heal no ScheduleManager.isWorkTask

**Arquivo:** `src/game/systems/schedule-manager.js`

**Problema:** As tarefas agrícolas (`prepareSoil`, `sowCrop`, `tendCrop`, `harvestCrop`) e médica (`heal`) não eram reconhecidas como "trabalho" pelo ScheduleManager. Isso fazia o schedule interromper estas tarefas incorretamente.

**Antes:**
```js
['gather','mine','build','buildRoof','haul','deconstruct',
 'research','craft','forge','cook','inspect','loot','inspectPoi']
```

**Depois:**
```js
['gather','mine','build','buildRoof','haul','deconstruct',
 'research','craft','forge','cook','inspect','loot','inspectPoi',
 'prepareSoil','sowCrop','tendCrop','harvestCrop','heal']
```

---

## 13. Produção de remédio (medicine)

**Arquivo:** `src/game/systems/workstations-tools.js`

**Problema:** O recurso `medicine` era consumido pela estação médica e pela receita de bandagens, mas não havia nenhuma forma de produzi-lo.

**Nova receita:**

| Receita | Estação | Custo | Produz | Unlock |
|---------|---------|-------|--------|--------|
| `medicine` | Estação Médica | 3 food + 1 wood + 1 cloth | 3 medicine | `medicine` |

Isso desbloqueia o ciclo completo de medicina: colha/compre recursos → produza medicine → use para curativos ou tratamento.

---

## 14. Auto-heal para colonos feridos

**Arquivo:** `src/game/systems/colonist-autonomy-system.js`

**Problema:** Colonos com saúde baixa não procuravam tratamento automaticamente. Precisavam de atribuição manual de tarefa.

**Depois:** Em `applyDecision`, antes de verificar fome, adicionado:
```js
if (c.health < 35 && c.health > 0 && !c.task) {
  const station = state?.objects?.find(o => o.type === 'med_station');
  if (station && (hasCost(medicine) || hasItems({ bandage: 1 }))) {
    assignHeal(c, station);
    return true;
  }
}
```

O colono agora:
1. Verifica se saúde está abaixo de **35**
2. Procura uma estação médica construída
3. Verifica se há `medicine` (recurso) ou `bandage` (item) disponível
4. Se sim, vai automaticamente se tratar

A verificação ocorre **antes** da checagem de fome (health < hunger priority) e **depois** do sono de emergência.

---

## 15. Auto-heal no handler da estação médica (reforço)

**Arquivo:** `src/game/systems/world-systems.js`

Complementar à correção 9 (bandagens), o handler de `'heal'` agora:
- Primeiro tenta pagar `{ medicine: 1 }` com `requireEnough: false`
- Se não tiver medicine, tenta pagar `{ bandage: 1 }` do inventário
- Se nenhum dos dois estiver disponível, cancela com "Faltaram recursos"

---

---

## 16. Food resource não é mais sobrescrito

**Arquivo:** `src/game/systems/farming-system.js`

**Problema:** `updateFoodAggregate` usava `state.resources.food = Math.max(0, fromLots || itemFood)` — sobrescrevia todo o food resource com o total dos farming lots. Comida de receitas (preservação, simpleMeal) era perdida no próximo tick.

**Depois:** O cálculo agora usa delta tracking. Apenas a diferença entre o total atual e o anterior é aplicada:
```js
if (total !== prev) {
  state.resources.food = Math.max(0, (state.resources.food || 0) + total - prev);
  farming._lastFoodAggregate = total;
}
```
Isso preserva comida de receitas, eventos, e outras fontes não-agrícolas.

---

## 17. Sementes renováveis na colheita

**Arquivo:** `src/game/systems/farming-system.js`

**Problema:** Plantar consumia 1 semente (`finishSow` via `removeItem`), mas a colheita nunca devolvia sementes. Depois das 4 sementes iniciais (dadas por `ensureStartingSeeds`), a agricultura chegava ao fim.

**Depois:** Em `finishHarvest`, após adicionar os itens colhidos, uma semente é devolvida:
```js
if (def.seedItem) addItem(def.seedItem, 1);
```
Agora cada colheita devolve 1 semente → plantio sustentável para sempre.

## 17b. Receitas de sementes (produção extra)

**Arquivo:** `src/game/data/recipes.js`

4 novas receitas na bancada (unlock: `agriculture`):

| Receita | Custo (item) | Produz | Duração |
|---------|-------------|--------|---------|
| Semente de batata x2 | 1 batata | 2 sementes | 3 |
| Semente de cenoura x2 | 1 cenoura | 2 sementes | 3 |
| Semente de milho x2 | 1 milho | 2 sementes | 4 |
| Semente de morango x2 | 1 morango | 2 sementes | 3 |

Permite expandir a produção: converta parte da colheita em sementes para plantar mais tiles.

## 17c. Notificação de falta de sementes

**Arquivo:** `src/game/systems/farming-system.js`

Quando há células prontas para semear mas sem sementes, um log é emitido uma vez por hora:
```
Falta batata para semear no talhão 1. Use a bancada para extrair sementes dos vegetais.
```

## 17d. Loop infinito de plantio corrigido

**Arquivo:** `src/game/systems/farming-system.js`

**Problema:** `cellWorkType` retornava `'sowCrop'` mesmo sem sementes. O colono ia até a célula, tentava plantar, falhava, entrava em cooldown de 6 ticks, e repetia — loop infinito até a colheita.

**Depois:** `cellWorkType` verifica `state.items[seedItem] > 0` antes de retornar `'sowCrop'`. Sem sementes, a célula é ignorada e o colono faz outras tarefas.

---

## 18. Regeneração de recursos do mapa

**Arquivos:** `src/game/runtime/game-loop.js`, `src/game/systems/world-systems.js`

**Problema:** Todos os recursos naturais (árvores, rochas, veios, arbustos, berries) tinham `respawn: false` e nunca regeneravam. O mapa se esgotava permanentemente.

**Depois:**
- `window.regrowthQueue` — fila global de recursos a regenerar
- Quando um recurso é coletado, um entry é adicionado à fila com tempo de regeneração
- `processRegrowth()` em cada tick verifica se o tempo passou e respawna o recurso (no mesmo tile ou adjacente)

| Recurso | Tempo p/ regenerar |
|---------|--------------------|
| Árvores | 48h (2 dias) |
| Pinheiro | 60h (2.5 dias) |
| Arbusto | 36h (1.5 dias) |
| Berry | 24h (1 dia) |
| Rocha | 72h (3 dias) |
| Veio de metal | 120h (5 dias) |

---

## 19. Durabilidade de ferramentas

**Arquivos:** `src/game/data/items.js`, `src/game/systems/workstations-tools.js`, `src/game/systems/world-systems.js`

**Problema:** Ferramentas nunca quebravam. Depois de craftadas uma vez, duravam para sempre — não havia motivo para craftar novamente, e a economia de crafting estagnava.

**Depois:**

- Adicionado `maxDurability` nos itens ferramenta
- Nova função `degradeTool(c)` decrementa durabilidade a cada tick de trabalho
- Quando a durabilidade chega a 0, a ferramenta é removida do inventário e o colono fica sem ferramenta

| Ferramenta | Durabilidade |
|-----------|-------------|
| Machado de pedra | 25 usos |
| Picareta | 25 usos |
| Martelo | 30 usos |
| Kit de ferramentas | 40 usos |
| Foice | 30 usos |
| Picareta reforçada | 50 usos |
| Vara de pesca | 20 usos |

A degradação ocorre em tarefas de: coleta (`gather`), mineração (`mine`), fabricação (`craft`), forja (`forge`) e construção (`build`).

---

## Balanceamento de objetos do mundo

**Arquivo:** `src/game/data/objects.js`

### Bush (arbusto)

**Antes:** `gather: { wood: 2 }, work: 1.5` → 1.33 madeira/trabalho (pior que qualquer árvore)

**Depois:** `gather: { wood: 3 }` → 2.0 madeira/trabalho. Ainda pior que árvores, mas não mais um desperdício de tempo.

### Forja (conversão automática)

**Antes:** 3 pedra → 1 metal em 4.5 trabalho (~8x menos eficiente que minerar veio de metal)

**Depois:** 2 pedra → 1 metal em 3.0 trabalho. A forja continua sendo uma fonte renovável de metal (vs veios que esgotam), mas agora razoável de usar.

**Arquivo:** `src/game/input/canvas-input-building.js` — hint da ação rápida atualizado para "2 pedra → 1 metal".

### Fogão (cozimento automático)

**Antes:** `work: 3.8` — 2 food + 1 wood → 4 food em 3.8 trabalho

**Depois:** `work: 3.0` — mesmo benefício, mas 24% mais rápido.

---

## Resumo de arquivos alterados (total)

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `src/game/data/buildings.js` | Balance | Bench mais barato |
| `src/game/data/items.js` | Feature | Tool durability |
| `src/game/data/objects.js` | Balance | Ore + Bush + Forge + Stove |
| `src/game/data/priorities.js` | Feature | 4 novos tipos |
| `src/game/data/recipes.js` | Feature+Bugfix | simpleMeal balanceado + 4 receitas + torch fix |
| `src/game/data/research-defs.js` | Bugfix | Merge em vez de overwrite |
| `src/game/input/canvas-input-building.js` | Refactor | Hint da forja atualizado |
| `src/game/runtime/game-loop.js` | Bugfix+Feature | Colonos mortos + regrowth queue + processamento |
| `src/game/systems/colonist-autonomy-system.js` | Bugfix+Feature | Schedule override removido + auto-heal |
| `src/game/systems/colonist-generation.js` | Feature | Novas preferências |
| `src/game/systems/colonist-mechanics.js` | Feature | Bônus para novos tipos |
| `src/game/systems/farming-system.js` | Bugfix+Feature | Food aggregate delta + sementes renováveis |
| `src/game/systems/hauling-adv.js` | Refactor | `handle` → `hauling` |
| `src/game/systems/living-world.js` | Feature | Presets expandidos |
| `src/game/systems/schedule-manager.js` | Bugfix | Farming + heal adicionados ao isWorkTask |
| `src/game/systems/workstations-tools.js` | Feature+Balance | Itens avançados + durabilidade |
| `src/game/systems/world-systems.js` | Feature+Bugfix | Prioridades + bandagens + auto-heal + durabilidade + regrowth push |
| `src/game/systems/zones.js` | Refactor | `handle` → `hauling` |
| `src/game/ui/tab-tasks.js` | Feature | UI com 6 sliders + migração |
