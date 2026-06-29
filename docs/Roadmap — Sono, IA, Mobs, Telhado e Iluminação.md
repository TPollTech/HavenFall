# Roadmap — Sono, IA, Mobs, Telhado e Iluminação

Status: **documentado após primeira implementação**  
Projeto: **HavenFall**  
Escopo: rotina dos colonos, IA de trabalho, mobs, sono, aceleração automática, telhado real, escurecimento interno e iluminação dinâmica.

---

## 1. Objetivo geral

Implementar uma camada de simulação mais inteligente para que o jogo pareça vivo e funcional, aproximando o comportamento de uma colony sim no estilo RimWorld, mas adaptado à arquitetura atual do HavenFall.

O objetivo é garantir que:

- colonos tenham rotina real;
- colonos trabalhem, construam, descansem, durmam e acordem;
- o tempo acelere automaticamente quando todos estiverem dormindo;
- colonos parem de ficar ociosos quando existe trabalho possível;
- mobs parem de alternar tiles infinitamente;
- telhados sejam construídos com progresso real;
- ambientes cobertos fiquem mais escuros;
- fogueira, tocha, forja e fogão iluminem o ambiente.

---

## 2. Prioridades

### P0 — Urgente / bugs de base

| Sistema | Motivo |
|---|---|
| IA dos colonos | Eles não podem ficar parados se existe trabalho possível. |
| IA dos mobs | Flickering quebra a sensação de mundo vivo. |
| Jobs e reservas | Sem reserva, colonos competem por tarefa, cama ou recurso. |
| Movimento por tile com estado fixo | Evita mobs indo e voltando infinitamente. |

### P1 — Simulação essencial

| Sistema | Motivo |
|---|---|
| Sono dos colonos | Dá rotina e vida ao jogo. |
| Aceleração automática do tempo | Torna noite e sono jogáveis. |
| Construção real de telhados | Telhado não deve simplesmente aparecer. |
| Escurecimento interno | Abrigo precisa ter consequência visual. |

### P2 — Atmosfera e polimento

| Sistema | Motivo |
|---|---|
| Iluminação dinâmica | Fogueira, tocha, forja e fogão dão vida visual. |
| Overlay temporário de telhado | Mostra telhado sem poluir a visão. |
| Animações de dormir/trabalhar/construir | Deixa o jogo menos travado. |
| Feedback visual de tarefas | Jogador entende o que está acontecendo. |

---

## 3. Sistema de sono dos colonos

### Problema

Os colonos tinham energia e rotina parcial, mas o comportamento de sono ainda não era forte o suficiente. O fluxo desejado é:

```txt
idle -> find_sleep_job -> moving_to_bed -> sleeping -> waking -> idle
```

### Estados esperados

```txt
idle
moving
working
building
hauling
eating
sleeping
waking
stuck
```

### Dados esperados no colono

```js
npc.needs = {
  sleep: 0.35,
  hunger: 0.80,
  comfort: 0.50
};
```

A agenda deve indicar horários de sono, trabalho e lazer. O projeto já possui `ScheduleManager`, então a implementação deve se integrar com ele em vez de criar uma segunda agenda paralela.

### Regras de sono

O colono deve tentar dormir quando:

- está no horário de dormir;
- energia está muito baixa;
- é noite e não há tarefa urgente;
- está cansado fora do horário;
- não existe ameaça imediata.

### Cama reservável

A cama precisa funcionar como objeto reservável:

```js
bed = {
  id: 'bed_01',
  x: 12,
  y: 8,
  occupiedBy: null,
  reservedBy: null,
  quality: 1,
  ownerId: null
};
```

Regras:

- se `occupiedBy` existe, ninguém mais usa;
- se `reservedBy` existe, ninguém mais reserva;
- se existe dono, ele tem prioridade;
- sem cama livre, o colono dorme no chão;
- dormir no chão recupera menos energia e dá menos conforto/humor.

---

## 4. Aceleração automática quando todos dormem

### Regra base

```js
const allColonistsSleeping =
  colonists.length > 0 &&
  colonists.every(npc => npc.state === 'sleeping');
```

A versão real também precisa verificar se é seguro acelerar:

```js
const canAutoFastForward =
  allColonistsSleeping &&
  !hasThreatNearby &&
  !hasFire &&
  !hasCriticalHunger &&
  !hasActiveCombat &&
  !hasUrgentEvent;
```

### Regra de velocidade

```js
finalTimeScale = playerSelectedSpeed * autoSpeedMultiplier;
```

Sugestão inicial:

```js
autoSpeedMultiplier = 6;
```

### Deve cancelar aceleração se

- algum colono acordar;
- mob hostil aparecer perto;
- começar incêndio;
- alguém estiver com fome crítica;
- alguém estiver ferido/incapacitado;
- um colono não conseguir alcançar cama;
- o jogador alterar a velocidade manual;
- aparecer evento importante.

---

## 5. IA dos colonos e jobs

### Problema

Colonos ficavam ociosos mesmo com trabalho possível. Causas prováveis:

- job não reavaliado;
- tarefa inválida silenciosamente;
- path até tarefa falhando;
- material não reservado;
- dois colonos disputando mesma tarefa;
- estado idle infinito;
- agenda diz trabalho, mas job system não força busca.

### Ciclo correto

```js
if (npc.currentJob) {
  continueCurrentJob();
} else {
  findBestAvailableJob();
}
```

O colono não deve abandonar job a cada tick. Ele só troca se:

- job ficou impossível;
- alvo foi destruído;
- outro colono concluiu;
- necessidade crítica apareceu;
- entrou em perigo;
- prioridade mudou;
- ficou travado.

### Reserva

```js
if (!job.reservedBy) {
  job.reservedBy = npc.id;
  npc.currentJob = job.id;
}
```

Ao desistir, dormir ou travar:

```js
job.reservedBy = null;
```

### Anti-idle

```js
npc.idleTimer += delta;

if (npc.idleTimer > 2.5) {
  npc.idleTimer = 0;
  npc.forceJobSearch = true;
}
```

---

## 6. IA dos mobs e anti-flicker

### Problema

Os mobs ficavam alternando entre tiles, dando impressão de tremedeira/flickering.

Causas prováveis:

- caminho recalculado todo frame;
- alvo mudando todo tick;
- falta de intenção fixa;
- movimento direto por tile sem interpolação;
- colisão empurrando para trás;
- pesos de decisão empatados.

### Estados básicos

```txt
idle
wander
chase
attack
flee
return_home
stuck
```

### Regra anti-flicker

Quando o mob escolhe um próximo tile, ele segura esse destino até:

- chegar no tile;
- tile ficar bloqueado;
- alvo ficar muito longe;
- tempo limite estourar;
- sofrer dano ou mudar para estado especial.

### Movimento

```js
mob.nextTile = { x: 10, y: 8 };
mob.moveProgress = 0;

while (mob.moveProgress < 1) {
  continueMovement();
}
```

A IA deve pensar com cooldown:

```js
mob.aiThinkTimer -= delta;

if (mob.aiThinkTimer <= 0) {
  mob.aiThinkTimer = randomBetween(0.5, 1.5);
  updateMobDecision(mob);
}
```

---

## 7. Telhado real

### Problema

O telhado parecia apenas um efeito visual. O sistema correto precisa diferenciar:

```txt
roofPlanned
roofUnderConstruction
roofBuilt
```

### Estrutura por tile

```js
tile.roof = {
  planned: true,
  built: false,
  progress: 0,
  reservedBy: null,
  flashTimer: 0
};
```

### Fluxo

1. Jogador fecha uma área ou marca telhado.
2. O jogo cria jobs `build_roof`.
3. Colono reserva o job.
4. Colono vai até tile próximo.
5. Progresso sobe.
6. Telhado vira built.
7. Overlay aparece temporariamente.
8. Tile passa a contar como coberto.
9. Iluminação interna é recalculada.

---

## 8. Overlay temporário de telhado

### Regras

| Situação | Telhado aparece? |
|---|---|
| Gameplay normal | Não ou quase invisível. |
| Logo após construir | Sim, por curto período. |
| Mouse em cima | Futuro. |
| Modo construção | Sim. |
| Ferramenta de telhado ativa | Futuro. |
| Debug | Sim. |

### Dados

```js
tile.roof.flashTimer = 1.0;
```

Ao concluir:

```js
tile.roof.built = true;
tile.roof.flashTimer = 1.0;
```

---

## 9. Escurecimento interno

### Regras de luminosidade

```js
let ambientLight = isDay ? 0.85 : 0.20;

if (tile.roof?.built) {
  ambientLight *= 0.45;
}

tile.light = clamp(ambientLight + localLight, 0, 1);
```

### Resultado esperado

| Situação | Luz |
|---|---|
| Dia fora de casa | Claro |
| Dia dentro sem tocha | Meio escuro |
| Noite fora | Escuro |
| Noite dentro sem luz | Bem escuro |
| Noite dentro com tocha | Iluminado |
| Perto da fogueira | Iluminação forte |
| Perto da forja/fogão | Iluminação média |

---

## 10. Iluminação dinâmica

### Fontes de luz

| Objeto | Intensidade | Alcance | Observação |
|---|---:|---:|---|
| Fogueira | Alta | Médio | Pisca levemente. |
| Tocha | Média | Pequeno/médio | Boa para interiores. |
| Forja | Alta | Médio | Luz forte quando ativa. |
| Fogão | Média | Pequeno | Luz quando em uso. |
| Lâmpada futura | Alta | Grande | Pode depender de energia. |
| Sol | Global | Mapa inteiro | Varia com horário. |

### Estrutura

```js
lightSource = {
  id: 'torch_01',
  x: 8,
  y: 5,
  radius: 5,
  intensity: 0.8,
  flicker: true,
  active: true,
  color: 'warm'
};
```

### Falloff

```js
distance = getDistance(tile, lightSource);

if (distance <= lightSource.radius) {
  contribution = lightSource.intensity * (1 - distance / lightSource.radius);
}
```

---

## 11. Debug de IA

Ao clicar em um colono no sistema de inspeção, deve ser possível exibir/usar dados como:

| Campo | Exemplo |
|---|---|
| Estado atual | idle |
| Job atual | build_roof |
| Motivo de idle | no_valid_jobs |
| Caminho válido | sim/não |
| Tile bloqueado | sim/não |
| Material encontrado | sim/não |
| Material reservado | sim/não |
| Cama reservada | bed_01 |
| Próxima decisão | 0.8s |
| Stuck timer | 1.2s |

---

## 12. Sistema anti-stuck

Se personagem tenta andar mas não muda de posição por tempo demais:

```js
if (npc.positionSameFor > 3 && npc.state === 'moving') {
  npc.state = 'stuck';
}
```

Ao travar:

- recalcula caminho;
- tenta tile alternativo;
- libera reserva;
- cancela job atual se necessário;
- procura outro job.

Se um job falhar várias vezes, ele deve poder ser desativado temporariamente no futuro:

```js
job.disabledUntil = gameTime + 30;
job.failReason = 'unreachable';
```

---

## 13. Ordem recomendada de renderização

```txt
1. Chão/base
2. Grid/tiles
3. Objetos baixos
4. Blueprints/construções em progresso
5. Itens no chão
6. Camas/móveis
7. NPCs/mobs
8. Paredes/objetos altos
9. Overlay de telhado temporário
10. Sombra interna
11. Luzes
12. UI
```

---

## 14. Etapas do roadmap original

### Etapa 1 — Arrumar base da IA

- estado fixo para NPC;
- job atual persistente;
- reserva de job;
- reserva de material/objeto;
- reserva de cama;
- reavaliação de idle;
- motivo claro de job recusado;
- anti-stuck.

### Etapa 2 — Corrigir flickering dos mobs

- máquina de estados;
- cooldown de decisão;
- `nextTile`;
- interpolação visual;
- histerese de alvo;
- detecção de stuck.

### Etapa 3 — Sistema de sono

- necessidade de sono;
- agenda por horário;
- job sleep;
- cama reservável;
- estado sleeping;
- recuperação de energia;
- acordar por rotina ou emergência.

### Etapa 4 — Aceleração automática

- detector `allColonistsSleeping`;
- multiplicador automático;
- cancelamento por ameaça/evento;
- mensagem visual/log;
- respeito à velocidade manual.

### Etapa 5 — Telhado real

- dados por tile;
- job `build_roof`;
- progresso;
- material futuramente;
- NPC construindo;
- overlay parcial.

### Etapa 6 — Sombra interna

- tile coberto reduz luz ambiente;
- interior fica escuro;
- dia/noite altera intensidade;
- fonte de luz compensa escuridão.

### Etapa 7 — Luz dinâmica

- fontes de luz;
- raio;
- intensidade;
- falloff;
- flicker leve;
- atualização otimizada.

---

# Implementação aplicada

## Commit 1

```txt
37c11e52384ce92d27542d8c7f99bf96915dbb25
feat: implementar rotina, sono, mobs, telhado e luz
```

### Arquivo criado

```txt
src/game/systems/simulation-upgrade-system.js
```

### O que foi implementado

#### Sono

- `startSleepUpgraded(c)`;
- reserva de cama por `reservedBy`;
- ocupação de cama por `occupiedBy`;
- dormir no chão se não houver cama;
- estado `moving_to_bed`;
- estado `sleeping`;
- acordar por perigo, fome, agenda ou energia cheia;
- visual simples de sono com corpo deitado e `Zzz`.

#### Aceleração automática

- `allColonistsSleeping()`;
- `updateAutoSleepSpeed()`;
- multiplicador automático de 6x;
- cancelamento por ameaça e fome crítica;
- log ao acelerar e ao restaurar velocidade.

#### IA / reservas

- `ensureColonyBrain()`;
- `ensureColonistBrain(c)`;
- reservas para objetos, camas e roof jobs;
- patch em `assignBuild`;
- patch em `assignGather`;
- patch em `nearestBlueprint`;
- liberação de reservas quando o colono fica sem tarefa;
- `stuckTimer` por colono;
- cancelamento de tarefa travada.

#### Mobs anti-flicker

- patch em `updatePassiveMob`;
- patch em `updateSpider`;
- `aiTimer`;
- `intentLock`;
- `nextTile`;
- `moveProgress`;
- `continueMobMove()`;
- `chooseWanderTile()`;
- `chooseStepToward()`;
- comportamento `wander`, `flee`, `hunt` e `sleep`.

#### Telhado real

- `roofLayer`;
- `builtRoofLayer`;
- `pendingRoofJobs`;
- `planned`;
- `built`;
- `progress`;
- `flashTimer`;
- `reservedBy`;
- `assignRoofJobReserved(c)`;
- `handleRoofBuildTaskReserved(c, task, tick)`.

#### Luz e sombra

- `ambientLight()`;
- `activeLightSources()`;
- `computeLighting()`;
- `state.world.lightMap`;
- escurecimento por telhado;
- falloff circular;
- flicker leve;
- luz visual quente com gradiente.

#### Fontes de luz suportadas

```txt
campfire
torch
wall_torch
forge
stove
```

#### Render overlay

- overlay de telhado em construção;
- overlay de telhado recém-construído;
- sombra por tile baseada em `lightMap`;
- brilho circular de fontes de luz.

---

## Commit 2

```txt
d3ac97af717e49d82fe758a1b516d5946c5fec96
chore: carregar sistema de simulação após renderers
```

### Arquivo alterado

```txt
src/game/rendering/pawn-renderer.js
```

### Motivo

O carregamento direto no `boot.js` foi evitado para não forçar ordem ruim antes dos renderers de pawn. O sistema de simulação precisa enxergar e eventualmente substituir funções visuais, principalmente para o sono dos colonos.

### O que foi feito

- adicionado carregamento dinâmico de:

```txt
src/game/systems/simulation-upgrade-system.js
```

- o carregamento acontece depois que o `pawn-renderer` instala renderers de colonos, mobs e hostiles;
- adicionada proteção para carregar apenas uma vez:

```js
window.HavenfallContext.simulationUpgradeRequested
```

---

# Status por item

| Item | Status |
|---|---|
| Sono dos colonos | Primeira versão implementada. |
| Reserva de camas | Implementado. |
| Dormir no chão | Implementado. |
| Visual de sono | Implementado, simples. |
| Aceleração automática | Implementado. |
| Cancelamento por ameaça/fome | Implementado. |
| Reservas de build/gather | Implementado. |
| Anti-stuck dos colonos | Implementado. |
| Debug interno `c.ai.debug` | Parcialmente implementado. |
| Mobs anti-flicker | Implementado para passivos e aranhas. |
| Telhado com estado real | Implementado. |
| Telhado com progresso | Implementado. |
| Overlay temporário | Implementado. |
| Escurecimento interno | Implementado. |
| Luz dinâmica | Implementado. |
| Tocha | Preparado, depende do objeto existir. |
| Forja/fogão iluminando | Implementado quando em uso. |
| Sistema de cômodos | Ainda futuro. |
| Material real para telhado | Ainda precisa evoluir. |
| Painel debug visual dedicado | Ainda futuro. |

---

# Pontos que ainda precisam de validação visual

Como a implementação foi feita diretamente no repositório, a validação final deve ser feita rodando o jogo localmente.

Checklist de teste:

```txt
1. Iniciar jogo.
2. Verificar se não há erro no console.
3. Esperar noite.
4. Ver se colonos buscam cama.
5. Ver se cada cama aceita um colono.
6. Ver se colono dorme no chão quando não existe cama.
7. Ver se todos dormindo acelera o tempo.
8. Ver se alguém acordando restaura velocidade.
9. Ver se mobs param de tremedeira/flickering.
10. Construir paredes fechadas.
11. Ver se telhados são planejados.
12. Ver se colonos constroem telhado.
13. Ver overlay temporário do telhado.
14. Ver interior escurecendo.
15. Ver fogueira iluminando.
16. Ver forja/fogão emitindo luz quando em uso.
```

---

# Próximas melhorias recomendadas

## IA

- criar painel visual de debug para `c.ai.debug`;
- registrar último job recusado e motivo;
- adicionar `disabledUntil` em jobs falhos;
- controlar job queue global de forma explícita.

## Sono

- sprite real deitado por direção;
- cama com dono;
- penalidade de humor por dormir no chão;
- eventos que acordam colonos.

## Mobs

- aplicar anti-flicker também em lobos/blood wolves se ainda usarem sistema separado;
- adicionar `stuckTimer` visual/debug para mobs;
- melhorar comportamento de manada.

## Telhado

- custo real de madeira por tile;
- reservar material antes de construir;
- ferramenta manual de telhado;
- remover telhado/desconstruir telhado;
- aparecer ao passar mouse por área coberta.

## Iluminação

- luz com cor real por fonte;
- luz suave usando cache por chunk;
- otimizar recalculo para mapas grandes;
- adicionar lâmpadas futuras dependentes de energia.

---

# Regra de manutenção

Este sistema deve continuar integrado ao código atual. Evitar criar arquivos paralelos como:

```txt
simulation-v2.js
mobs-v2.js
roof-v2.js
lighting-v2.js
```

Arquivos novos são aceitáveis apenas quando representam sistemas reais, como:

```txt
simulation-upgrade-system.js
world-travel-system.js
inspection-panel.js
```

---

# Resultado esperado final

Quando o sistema estiver validado e polido, o fluxo ideal será:

```txt
Chega a noite.
Colonos param tarefas não urgentes.
Cada colono procura uma cama livre.
A cama é reservada.
O colono vai até ela.
O colono dorme.
Todos dormindo aceleram o tempo.
Perigo ou despertar restaura a velocidade.
Durante o dia, colonos procuram trabalho real.
Mobs andam com intenção e sem flickering.
Telhados são construídos por colonos.
Interiores cobertos ficam escuros.
Fogueira, tocha, forja e fogão iluminam o ambiente.
```
