# Roadmap — Sistema de Mapa Local + Mapa Mundo + Viagem entre Pontos Spawnáveis

## 1. Visão geral

Este roadmap continua o sistema anterior de **Pontos Spawnáveis no Globo / Landing Sites**.

A ideia agora é expandir o botão/atalho atual de mapa, acionado pela tecla `M`, para suportar dois níveis de visualização:

```txt
M → Abre o mapa
  ├─ Aba 1: Mapa Local
  │   └─ mostra o terreno/setor atual onde a colônia está
  │
  └─ Aba 2: Mapa Mundo
      └─ mostra o planeta/região global com os pontos spawnáveis/landing sites
```

A partir do **Mapa Mundo**, o jogador poderá:

* visualizar todos os pontos spawnáveis detectados;
* ver quais locais já foram visitados;
* ver locais ainda não explorados;
* selecionar um destino;
* preparar viagem;
* escolher colonos para a expedição;
* levar suprimentos;
* calcular tempo, risco e custo;
* viajar para outro setor;
* iniciar uma nova área jogável baseada naquele landing site.

---

# 2. Objetivo principal

Transformar o mapa atual em um sistema estratégico de navegação entre setores.

O jogo deixaria de ser apenas:

```txt
1 mapa único → sobreviver ali para sempre
```

e passaria a ser:

```txt
Mundo global → vários setores → viagem → exploração → expansão da colônia
```

Isso cria muito conteúdo sem precisar inventar outro jogo, porque cada landing site vira um possível novo mapa jogável.

---

# 3. Conceito central

## 3.1. Mapa Local

Representa o setor atual.

Exemplo:

```txt
Setor atual: Clareira Segura
Bioma: Floresta temperada
Mapa: 172x124 tiles
Base principal: Primeiro Refúgio
```

Serve para:

* ver terreno já explorado;
* localizar colonos;
* localizar base;
* ver recursos conhecidos;
* ver ameaças;
* ver pontos de interesse próximos;
* ver zonas criadas;
* ver áreas não exploradas.

---

## 3.2. Mapa Mundo

Representa os landing sites do planeta/região.

Exemplo:

```txt
Mundo: HAVEN-85B-VANTA-NEO
Locais detectados: 9
Visitados: 1
Disponíveis para viagem: 4
Bloqueados/desconhecidos: 4
```

Serve para:

* escolher destino;
* comparar setores;
* planejar expedição;
* viajar entre mapas;
* expandir a história da colônia.

---

# 4. Fluxo ideal do jogador

## 4.1. Antes do jogo começar

Na tela de Varredura Planetária, o jogador escolhe um ponto inicial:

```txt
Landing Site inicial:
Clareira Segura
```

Esse local vira o primeiro setor jogável.

---

## 4.2. Durante o jogo

O jogador aperta:

```txt
M
```

Abre o mapa.

A tela deve mostrar duas abas:

```txt
[Mapa Local] [Mapa Mundo]
```

---

## 4.3. No Mapa Local

O jogador vê o setor atual.

Coisas importantes:

* base;
* colonos;
* terreno descoberto;
* recursos;
* ruínas;
* ameaças;
* zonas;
* fog of war;
* pontos de saída/rotas.

---

## 4.4. No Mapa Mundo

O jogador vê os pontos do globo/planeta.

Exemplo:

```txt
         MAPA MUNDO

        [●] Clareira Segura
               atual

    [○] Vale Rochoso       [○] Mata Fechada

          [ ? ] Ruína Distante

    [○] Bacia Hídrica      [ ! ] Zona Instável
```

Legenda:

```txt
● setor atual
○ setor conhecido
? setor detectado, mas não escaneado
! setor perigoso
◆ setor visitado
✦ setor com missão/evento
```

---

## 4.5. O jogador escolhe um destino

Clica em:

```txt
Vale Rochoso
```

O painel lateral mostra:

```txt
Destino: Vale Rochoso
Distância: 2 dias
Risco: Moderado
Custo sugerido: 30 comida, 12 madeira, 4 remédios
Recompensas esperadas: pedra alta, minério médio, defesa natural
```

Botão:

```txt
Preparar Expedição
```

---

## 4.6. Preparar expedição

O jogador escolhe:

* quais colonos vão;
* quais recursos levar;
* qual objetivo da viagem;
* se vai abandonar o setor atual ou criar posto avançado;
* se a viagem será rápida, segura ou carregada.

---

## 4.7. Resultado da viagem

Após confirmar, existem três possibilidades:

### Viagem simples

Troca para o novo setor.

```txt
A expedição chegou em Vale Rochoso.
```

### Viagem com evento

Durante o percurso acontece algo:

```txt
A expedição encontrou uma carcaça abandonada.
Escolha:
- investigar;
- ignorar;
- coletar peças;
```

### Viagem perigosa

Pode haver perda de recurso, ferimento leve, atraso ou emboscada.

---

# 5. Estrutura de telas

## 5.1. Tela principal do mapa

Layout sugerido:

```txt
┌─────────────────────────────────────────────────────┐
│ MAPA                                                │
│ [Mapa Local] [Mapa Mundo]                           │
├──────────────────────────────┬──────────────────────┤
│                              │                      │
│                              │ Painel de detalhes   │
│     Visualização do mapa     │                      │
│                              │                      │
│                              │                      │
├──────────────────────────────┴──────────────────────┤
│ Botões: Fechar | Centralizar Base | Preparar Viagem  │
└─────────────────────────────────────────────────────┘
```

---

## 5.2. Aba Mapa Local

Elementos:

```txt
Topo:
- Nome do setor atual
- Bioma dominante
- Dia/hora
- Percentual explorado

Centro:
- Mini mapa do terreno
- Fog of war
- ícones de base, colonos, recursos, POIs, ameaças

Lateral:
- Informações do ponto selecionado
- Legenda
- Filtros
```

Filtros:

```txt
[✓] Colonos
[✓] Base
[✓] Recursos
[✓] Ruínas
[✓] Ameaças
[✓] Zonas
[✓] Áreas não exploradas
```

---

## 5.3. Aba Mapa Mundo

Elementos:

```txt
Topo:
- Nome do planeta/seed
- Setor atual
- Total de locais detectados
- Locais visitados

Centro:
- Globo ou mapa 2D estilizado
- Landing sites
- rotas
- distância entre setores

Lateral:
- Detalhes do destino selecionado
- Pontos positivos/negativos
- custo da viagem
- risco
- preview do setor

Rodapé:
- Preparar Expedição
- Voltar ao setor atual
- Fechar mapa
```

---

# 6. Estados dos pontos no Mapa Mundo

Cada landing site deve ter um estado.

```js
site.state = 'current' | 'known' | 'visited' | 'unknown' | 'locked' | 'danger' | 'quest';
```

## 6.1. `current`

Local onde a colônia está agora.

Visual:

```txt
ponto maior
anel dourado
label “Atual”
```

---

## 6.2. `known`

Local detectado e disponível.

Visual:

```txt
ponto azul/ciano
clicável
```

---

## 6.3. `visited`

Local já visitado.

Visual:

```txt
ponto verde
ícone de bandeira/posto
```

---

## 6.4. `unknown`

Local detectado parcialmente.

Visual:

```txt
ponto cinza com ?
clicável apenas para escanear, não viajar ainda
```

---

## 6.5. `locked`

Local bloqueado por tecnologia/evento.

Visual:

```txt
ponto escuro
cadeado
```

Exemplo:

```txt
Requer: Rádio de Longo Alcance
```

---

## 6.6. `danger`

Local de alto risco.

Visual:

```txt
ponto laranja/vermelho
pulso mais forte
```

---

## 6.7. `quest`

Local com evento/missão.

Visual:

```txt
estrela
brilho especial
```

---

# 7. Dados necessários para o Mapa Mundo

Cada landing site precisa ter dados extras além do roadmap anterior.

## 7.1. Estrutura estendida

```js
const landingSite = {
  id: 'landing_04',
  name: 'Vale Rochoso',
  archetype: 'rocky_valley',

  globe: {
    x: 0.62,
    y: 0.41,
    visible: true
  },

  travel: {
    discovered: true,
    visited: false,
    current: false,
    locked: false,
    distanceFromCurrent: 2.4,
    travelHours: 38,
    riskScore: 46,
    minFood: 24,
    recommendedFood: 42,
    recommendedMedicine: 3,
    requiredTech: null
  },

  worldState: {
    generated: false,
    hasBase: false,
    hasOutpost: false,
    lastVisitedDay: null,
    exploredPercent: 0,
    dangerLevel: 46,
    knownResources: {}
  },

  preview: {
    terrainSample: [],
    resourceHints: [],
    threatHints: []
  }
};
```

---

# 8. Estado global do mundo

O jogo precisa passar a guardar o conceito de vários setores.

Hoje o save provavelmente guarda:

```js
state.world
state.terrain
state.objects
state.colonists
```

Com viagem, o ideal é evoluir para:

```js
state.worldMap = {
  planetSeed: 'HAVEN-85B-VANTA-NEO',
  currentSiteId: 'landing_01',
  landingSites: [],
  routes: [],
  visitedSites: {},
  knownSites: {},
  travelLog: []
};
```

E cada setor jogável pode ser salvo assim:

```js
state.sectors = {
  landing_01: {
    id: 'landing_01',
    terrain,
    objects,
    exploration,
    pointsOfInterest,
    spawn,
    lastDayVisited
  },

  landing_04: {
    id: 'landing_04',
    terrain,
    objects,
    exploration,
    pointsOfInterest,
    spawn,
    lastDayVisited
  }
};
```

---

# 9. Estratégia de salvamento de setores

Existem duas opções.

## 9.1. Opção A — Salvar todos os setores completos

Mais simples de entender.

Prós:

* voltar para um setor mantém tudo exatamente como estava;
* fácil de debugar;
* permite várias bases.

Contras:

* save pode crescer bastante.

Uso recomendado:

```txt
Boa para Alpha, porque é mais seguro.
```

---

## 9.2. Opção B — Salvar só setores visitados

Setores não visitados ficam como seed + metadados.

Quando o jogador viaja pela primeira vez, o setor é gerado.

Prós:

* save menor;
* geração sob demanda;
* mais eficiente.

Contras:

* exige cuidado com consistência.

Uso recomendado:

```txt
Melhor para versão final.
```

---

## 9.3. Recomendação para agora

Usar:

```txt
Salvar completo apenas os setores visitados.
```

Ou seja:

```js
if (site.visited) {
  save full sector
} else {
  save metadata only
}
```

---

# 10. Conceito de setor atual

O jogo precisa saber qual setor está ativo.

```js
state.worldMap.currentSiteId = 'landing_01';
state.currentSector = state.sectors[state.worldMap.currentSiteId];
```

Para manter compatibilidade com o código atual:

```js
state.world = state.currentSector.world;
state.terrain = state.currentSector.terrain;
state.objects = state.currentSector.objects;
```

Assim, os sistemas existentes continuam funcionando.

---

# 11. Viagem entre setores

## 11.1. Não deve ser teleport seco

A viagem pode até ser instantânea na primeira versão, mas o sistema deve estar preparado para:

* passar horas/dias;
* consumir comida;
* consumir remédios;
* cansar colonos;
* gerar eventos;
* carregar recursos;
* ter risco.

---

## 11.2. Dados da viagem

```js
const travelPlan = {
  fromSiteId: 'landing_01',
  toSiteId: 'landing_04',
  colonistIds: [1, 2],
  supplies: {
    food: 40,
    medicine: 3,
    wood: 10
  },
  mode: 'balanced',
  estimatedHours: 38,
  riskScore: 46,
  status: 'ready'
};
```

---

## 11.3. Modos de viagem

### Rápida

```txt
Menos tempo
Mais risco
Mais cansaço
Menor consumo total
```

### Equilibrada

```txt
Tempo normal
Risco normal
Consumo normal
```

### Segura

```txt
Mais tempo
Menos risco
Mais consumo
Menos chance de ferimentos/eventos ruins
```

### Carregada

```txt
Mais capacidade de transporte
Muito mais lenta
Risco maior
Cansaço maior
```

---

# 12. Custo de viagem

## 12.1. Fórmula base

```js
travelHours = distance * terrainMultiplier * modeMultiplier;
foodCost = colonistCount * Math.ceil(travelHours / 12);
medicineRecommended = Math.ceil(riskScore / 30);
```

---

## 12.2. Modificadores por destino

| Tipo de destino | Efeito                      |
| --------------- | --------------------------- |
| Floresta        | viagem mais lenta           |
| Deserto         | mais consumo de comida/água |
| Montanha        | maior risco e tempo         |
| Bacia hídrica   | risco de doença/atraso      |
| Ruínas          | risco de evento hostil      |
| Local seguro    | tempo e risco menores       |

---

## 12.3. Exemplo prático

```txt
Destino: Vale Rochoso
Distância: 2.4 regiões
Tempo estimado: 38 horas
Comida mínima: 18
Comida recomendada: 36
Remédios recomendados: 3
Risco: Moderado
```

---

# 13. Tela de preparar expedição

Ao clicar em um destino:

```txt
[Preparar Expedição]
```

abre um modal/painel.

## 13.1. Layout

```txt
┌────────────────────────────────────────────┐
│ Preparar Expedição                         │
│ De: Clareira Segura                        │
│ Para: Vale Rochoso                         │
├────────────────────────────────────────────┤
│ Colonos                                    │
│ [✓] Lia     energia 82  saúde 100          │
│ [✓] Téo     energia 76  saúde 92           │
│ [ ] Nico    energia 64  saúde 88           │
├────────────────────────────────────────────┤
│ Suprimentos                                │
│ Comida:    [-] 40 [+]                      │
│ Remédios:  [-] 3  [+]                      │
│ Madeira:   [-] 10 [+]                      │
│ Pedra:     [-] 0  [+]                      │
├────────────────────────────────────────────┤
│ Modo de viagem                             │
│ [Rápida] [Equilibrada] [Segura] [Carregada]│
├────────────────────────────────────────────┤
│ Resumo                                     │
│ Tempo: 38h                                 │
│ Risco: Moderado                            │
│ Consumo: 36 comida                         │
│ Chance de evento: 42%                      │
├────────────────────────────────────────────┤
│ [Cancelar] [Iniciar viagem]                │
└────────────────────────────────────────────┘
```

---

# 14. Quem viaja?

Existem três modelos possíveis.

## 14.1. Toda a colônia viaja

Mais simples.

Prós:

* fácil de implementar;
* evita gerenciar duas bases.

Contras:

* menos profundo.

Uso inicial recomendado para Alpha.

---

## 14.2. Grupo de expedição viaja

Mais profundo.

Prós:

* permite deixar gente na base;
* cria expedições reais;
* abre sistema de múltiplas bases.

Contras:

* exige simulação de bases inativas.

Uso recomendado depois.

---

## 14.3. Escolha híbrida

Primeira versão:

```txt
Toda a colônia viaja.
```

Versão avançada:

```txt
Escolher colonos.
```

Roadmap ideal:

```txt
Fase 1: toda colônia viaja
Fase 2: grupo de expedição
Fase 3: múltiplos postos/bases
```

---

# 15. O que acontece com o setor antigo?

## 15.1. Primeira versão

Quando viajar, o setor antigo fica congelado.

Salvar:

```js
state.sectors[oldSiteId] = snapshotCurrentSector();
```

Depois carregar novo setor.

---

## 15.2. Versão futura

Setores antigos podem continuar simulando lentamente:

* plantação cresce;
* comida estraga;
* ameaças podem se mover;
* colonos deixados lá consomem recursos.

Mas isso é complexo e deve ficar para depois.

---

# 16. Gerar novo setor ao viajar

Quando o jogador chega em um destino não visitado:

```js
if (!state.sectors[toSiteId]) {
  state.sectors[toSiteId] = generateSectorFromLandingSite(toSite);
}
```

Esse setor deve usar:

```js
site.seed
site.archetype
site.worldgenModifiers
```

E então o jogo troca:

```js
state.world = sector.world;
state.terrain = sector.terrain;
state.objects = sector.objects;
```

---

# 17. Voltar para setor visitado

Se o jogador voltar para um setor já visitado:

```js
if (state.sectors[toSiteId]) {
  loadSector(toSiteId);
}
```

O mapa deve voltar igual:

* terreno;
* objetos;
* construções;
* recursos coletados;
* exploração;
* POIs inspecionados;
* estado da base.

---

# 18. Rotas entre pontos

O Mapa Mundo pode mostrar linhas entre locais.

## 18.1. Rota direta

Todos os locais conhecidos podem ser acessíveis diretamente.

Simples para Alpha.

---

## 18.2. Rota por alcance

Só pode viajar para locais próximos.

Exemplo:

```txt
Clareira Segura → Vale Rochoso
Vale Rochoso → Ruína Distante
```

Isso cria progressão.

---

## 18.3. Rota bloqueada

Alguns destinos exigem:

* rádio;
* carroça;
* abrigo térmico;
* remédios;
* pesquisa;
* evento.

Exemplo:

```txt
Cordilheira Fria
Requer: Isolamento Térmico
```

---

# 19. Tecnologias que podem desbloquear viagem

O sistema de pesquisa pode ganhar tecnologias novas.

## 19.1. Cartografia básica

Efeito:

```txt
Mostra mais detalhes no Mapa Mundo.
```

---

## 19.2. Batedores

Efeito:

```txt
Reduz risco de viagem.
```

---

## 19.3. Carroça de carga

Efeito:

```txt
Aumenta recursos transportáveis.
```

---

## 19.4. Rádio de longo alcance

Efeito:

```txt
Desbloqueia locais distantes.
```

---

## 19.5. Abrigo portátil

Efeito:

```txt
Reduz risco climático em viagens longas.
```

---

# 20. Eventos de viagem

Durante uma viagem, pode acontecer um evento.

## 20.1. Tipos

```txt
Evento positivo
Evento neutro
Evento negativo
Evento narrativo
Evento de escolha
```

---

## 20.2. Exemplos

### Carcaça abandonada

```txt
A expedição encontrou restos de um veículo.
Escolhas:
- coletar sucata;
- ignorar;
- desmontar com cuidado.
```

Resultados:

```txt
+ metal
+ peças
risco de ferimento pequeno
```

---

### Chuva intensa

```txt
A chuva atrasou o grupo.
```

Resultado:

```txt
+ tempo de viagem
- energia dos colonos
```

---

### Rastro de animal

```txt
O grupo encontrou rastros recentes.
```

Escolhas:

```txt
- seguir;
- evitar;
- montar guarda.
```

---

### Comerciante nômade

```txt
Um viajante oferece troca.
```

Resultado:

```txt
troca de comida/remédio/sucata
```

---

### Emboscada

```txt
O grupo foi surpreendido no caminho.
```

Resultado:

```txt
combate rápido ou perda de suprimentos
```

---

# 21. Fórmula de chance de evento

```js
eventChance =
  baseChance
  + riskScore * 0.4
  + travelHours * 0.15
  - scoutBonus
  - safeModeBonus
```

Exemplo:

```txt
Viagem curta e segura: 12%
Viagem média: 35%
Viagem extrema: 68%
```

---

# 22. Risco de viagem

## 22.1. Categorias

|  Score | Label       |
| -----: | ----------- |
|   0–20 | Muito baixo |
|  21–40 | Baixo       |
|  41–60 | Moderado    |
|  61–80 | Alto        |
| 81–100 | Extremo     |

---

## 22.2. O risco deve considerar

* distância;
* bioma do destino;
* bioma do caminho;
* clima;
* quantidade de colonos;
* suprimentos;
* tecnologias;
* modo de viagem;
* estado dos colonos;
* presença de eventos ativos.

---

# 23. Mapa Local detalhado

O Mapa Local também precisa evoluir.

## 23.1. Mini mapa de terreno

Representar:

| Elemento     | Cor/ícone          |
| ------------ | ------------------ |
| grama        | verde              |
| terra        | marrom             |
| pedra        | cinza              |
| areia        | amarelo            |
| construção   | branco/cinza claro |
| colono       | azul               |
| inimigo      | vermelho           |
| recurso      | verde/amarelo      |
| POI          | roxo               |
| desconhecido | preto/azul escuro  |

---

## 23.2. Interações no Mapa Local

Clicar em uma área pode:

* centralizar câmera;
* marcar ponto;
* criar ping;
* abrir info do tile;
* mostrar distância da base.

---

## 23.3. Filtros

```txt
Todos
Terreno
Recursos
Construções
Colonos
Ameaças
POIs
Zonas
```

---

# 24. Mapa Mundo detalhado

## 24.1. Tipos de visualização

Duas opções possíveis:

### Globo reutilizado

Usa o mesmo globo da tela de varredura.

Prós:

* reaproveita visual atual;
* combina com a tela anterior.

Contras:

* mais difícil para rotas.

---

### Mapa 2D estilizado

Mostra os pontos em um plano.

Prós:

* mais fácil para rotas;
* mais claro para viagem;
* melhor para UI.

Contras:

* menos impactante visualmente.

---

## 24.2. Recomendação

Usar os dois com funções diferentes:

```txt
Varredura Planetária inicial → Globo
Mapa Mundo durante o jogo → Mapa 2D orbital estilizado
```

Mas mantendo o mesmo conceito visual.

---

# 25. Painel de destino no Mapa Mundo

Ao selecionar um local:

```txt
DESTINO SELECIONADO
Vale Rochoso

Status: Conhecido
Bioma: Cordilheira rochosa
Distância: 2 dias
Risco: Moderado
Visitado: Não

Recursos esperados:
Madeira baixa
Pedra alta
Metal médio
Comida baixa

Pontos positivos:
+ Minério próximo
+ Defesa natural
+ Menos vegetação bloqueando construção

Pontos negativos:
- Pouca comida
- Pouca madeira
- Terreno irregular

[Preparar Expedição]
```

---

# 26. Sistema de postos avançados

Depois que o jogador viaja, ele pode ter a opção:

```txt
Estabelecer posto avançado
```

## 26.1. O que é um posto?

Um setor visitado com uma marca permanente.

Benefícios:

* facilita retorno;
* reduz risco de viagem para aquele local;
* permite armazenar recursos;
* permite missões futuras.

---

## 26.2. Custo inicial sugerido

```txt
20 madeira
10 comida
5 pedra
```

---

## 26.3. Efeitos

```txt
- rota segura até esse setor;
- retorno mais rápido;
- local aparece como visitado/ocupado;
- eventos podem surgir lá.
```

---

# 27. Vários tipos de viagem

## 27.1. Explorar

Objetivo:

```txt
Ir até o local e revelar o setor.
```

---

## 27.2. Migrar

Objetivo:

```txt
Mover toda a colônia para outro setor.
```

---

## 27.3. Coletar recursos

Objetivo:

```txt
Ir, coletar, voltar.
```

---

## 27.4. Investigar ruína

Objetivo:

```txt
Visitar POI especial.
```

---

## 27.5. Resgate

Objetivo futuro:

```txt
Buscar colono perdido ou NPC.
```

---

# 28. Diferença entre viajar e migrar

Isso precisa ficar claro.

## Viajar

```txt
Grupo vai até outro setor.
A base principal continua onde está.
Pode retornar.
```

## Migrar

```txt
A colônia muda o setor principal.
O antigo setor pode virar posto abandonado ou base secundária.
```

---

# 29. Sistema inicial recomendado

Para não explodir a complexidade logo de cara:

## Alpha da viagem

Implementar primeiro:

```txt
1. Aba Mapa Local / Mapa Mundo
2. Mapa Mundo mostra landing sites
3. Jogador escolhe destino
4. Toda a colônia viaja
5. Consome comida
6. Passa tempo
7. Gera ou carrega novo setor
8. Setor antigo fica salvo/congelado
```

Depois expandir para:

```txt
- escolher colonos;
- eventos de viagem;
- postos avançados;
- retorno automático;
- bases múltiplas;
- rotas bloqueadas;
- tecnologia de viagem.
```

---

# 30. Estrutura técnica recomendada

## 30.1. Arquivos prováveis

```txt
src/game/ui/map-ui.js
src/game/ui/planet-scan-ui.js
src/game/systems/planet-scan-profile.js
src/game/world-generator.js
src/game/save-load.js
src/game/game-loop.js
src/game/event-listeners.js
src/game/state.js
```

Caso o mapa atual esteja em outro arquivo, primeiro localizar:

```txt
atalho M
map overlay
world map
draw map
```

---

## 30.2. Não criar arquivos paralelos de versão

Não criar:

```txt
map-v2.js
world-map-v2.js
travel-v2.js
```

Se for necessário criar arquivo novo, ele deve ser um módulo real de sistema, não versão paralela.

Exemplo aceitável:

```txt
src/game/systems/world-travel-system.js
```

Exemplo ruim:

```txt
src/game/world-travel-v2.js
```

---

# 31. Novos módulos aceitáveis

Diferente da gambiarra de gerador duplicado, aqui pode fazer sentido criar módulos novos porque são sistemas novos.

## 31.1. Sistema de viagem

Arquivo aceitável:

```txt
src/game/systems/world-travel-system.js
```

Responsável por:

* calcular distância;
* calcular risco;
* calcular custo;
* iniciar viagem;
* concluir viagem;
* salvar setor atual;
* carregar destino.

---

## 31.2. UI de mapa

Arquivo aceitável se ainda não existir:

```txt
src/game/ui/world-map-ui.js
```

Responsável por:

* abas local/mundo;
* renderização do mapa mundo;
* seleção de destino;
* modal de expedição.

Mas se já existe um arquivo do mapa atual, o ideal é evoluir o arquivo existente.

---

# 32. Estado mínimo necessário

Adicionar no `state`:

```js
state.worldMap = {
  planetSeed: config.seed,
  currentSiteId: config.selectedLandingSiteId,
  selectedWorldMapSiteId: null,
  landingSites: config.planetScan.landingSites,
  routes: [],
  travelLog: []
};
```

Adicionar setores:

```js
state.sectors = {
  [currentSiteId]: snapshotAtual
};
```

Adicionar viagem ativa:

```js
state.activeTravel = null;
```

---

# 33. Snapshot do setor

Função necessária:

```js
function snapshotCurrentSector() {
  return {
    id: state.worldMap.currentSiteId,
    world: state.world,
    terrain: state.terrain,
    objects: state.objects,
    colonists: state.colonists,
    mobs: state.mobs,
    wolves: state.wolves,
    items: state.items,
    resources: state.resources,
    day: state.day,
    hour: state.hour
  };
}
```

Cuidado:

* colonos podem ou não ser salvos no setor dependendo do modelo de viagem;
* se toda colônia viaja, colonos saem do setor antigo;
* se bases múltiplas existirem, colonos podem ficar separados.

---

# 34. Carregar setor

Função necessária:

```js
function loadSector(siteId) {
  const sector = state.sectors[siteId];

  state.world = sector.world;
  state.terrain = sector.terrain;
  state.objects = sector.objects;
  state.mobs = sector.mobs || [];
  state.wolves = sector.wolves || [];

  state.worldMap.currentSiteId = siteId;

  centerCameraOnSelectedColonist();
  updateExploration(true);
  updateUI(true);
}
```

---

# 35. Gerar setor de destino

Função necessária:

```js
function generateSectorForLandingSite(site) {
  const config = {
    ...state.config,
    selectedLandingSiteId: site.id,
    selectedLandingSite: site,
    seed: site.seed
  };

  return generateWorldFromSeed(config);
}
```

Mas deve ser feito com cuidado para não destruir o `state` atual antes de salvar snapshot.

---

# 36. Preparar viagem — regras

## 36.1. Não pode viajar se

```txt
- nenhum destino selecionado;
- destino é o setor atual;
- destino está bloqueado;
- comida mínima não está disponível;
- todos os colonos estão incapacitados;
- evento crítico impede viagem;
```

---

## 36.2. Pode viajar com aviso se

```txt
- comida abaixo do recomendado;
- remédios abaixo do recomendado;
- risco alto;
- colono está com energia baixa;
- clima atual está ruim;
```

---

# 37. Confirmação de viagem

Antes de iniciar:

```txt
Confirmar viagem para Vale Rochoso?

Tempo estimado: 38h
Comida consumida: 36
Risco: Moderado
Modo: Equilibrado

A colônia atual será salva e este setor ficará congelado até seu retorno.

[Cancelar] [Confirmar viagem]
```

---

# 38. Passagem de tempo

Ao viajar:

```js
state.hour += travelHours;
while (state.hour >= 24) {
  state.hour -= 24;
  state.day += 1;
}
```

Também aplicar:

* fome;
* energia;
* humor;
* clima;
* chance de evento.

---

# 39. Consequências nos colonos

Viagem deve afetar:

```txt
energia
fome
mood
saúde
nota/status
```

Exemplo:

```js
colonist.energy -= travelHours * 0.35;
colonist.hunger -= foodShortage ? 18 : 6;
colonist.mood -= riskEvent ? 8 : 2;
```

---

# 40. Consumo de recursos

No início da viagem:

```js
state.resources.food -= foodCost;
state.resources.medicine -= medicineUsed;
```

Ou durante evento.

Para Alpha, consumir no início é mais simples.

---

# 41. Eventos de chegada

Ao chegar no novo setor:

```txt
A expedição alcançou Vale Rochoso após 1 dia e 14 horas.
```

Dependendo do destino:

```txt
As encostas fornecem boa defesa, mas há pouca comida ao redor.
```

Gerar log:

```js
log(`A colônia viajou para ${site.name}. Tempo: ${hours}h. Risco: ${riskLabel}.`);
```

---

# 42. Mapa Mundo depois da chegada

Atualizar:

```js
site.visited = true;
site.current = true;
oldSite.current = false;
site.lastVisitedDay = state.day;
site.exploredPercent = 0;
```

---

# 43. Relação com fog of war

Cada setor precisa ter seu próprio fog of war.

```js
sector.exploration = state.world.exploration;
```

Ao voltar:

```js
state.world.exploration = sector.exploration;
```

---

# 44. Relação com POIs

Cada setor tem seus próprios POIs.

```js
sector.pointsOfInterest = world.pointsOfInterest;
```

Mapa Mundo pode mostrar:

```txt
POIs conhecidos neste setor: 2/5
```

---

# 45. Relação com eventos

Eventos podem ser locais ou globais.

## 45.1. Evento local

Afeta só o setor atual.

```txt
Lobos rondam a floresta.
```

## 45.2. Evento global

Afeta o mundo inteiro.

```txt
Tempestade solar dificulta viagens.
```

## 45.3. Evento de rota

Afeta viagem entre dois locais.

```txt
A rota para Vale Rochoso está bloqueada por deslizamento.
```

---

# 46. Sistema de rotas seguras

Depois de viajar várias vezes por uma rota, ela pode melhorar.

```txt
Rota conhecida
-10% tempo
-15% risco
```

Com posto avançado:

```txt
Rota segura
-25% risco
```

---

# 47. Progressão de exploração global

Adicionar indicador:

```txt
Exploração planetária: 18%
Setores visitados: 2/9
POIs descobertos: 4/31
Rotas seguras: 1
```

Isso dá meta de longo prazo.

---

# 48. Objetivos/missões ligados ao mapa mundo

Exemplos:

```txt
Visitar 3 setores diferentes
Criar 1 posto avançado
Encontrar uma ruína antiga
Descobrir uma bacia hídrica
Mapear 50% do planeta
```

---

# 49. Interface do atalho M

## 49.1. Pressionar M

Se mapa fechado:

```txt
abre mapa na última aba usada
```

Se mapa aberto:

```txt
fecha mapa
```

---

## 49.2. Atalhos dentro do mapa

```txt
1 → Mapa Local
2 → Mapa Mundo
Esc → fechar
Enter → confirmar seleção quando seguro
```

---

# 50. Estados do mapa

```js
state.ui.map = {
  open: false,
  tab: 'local',
  selectedLocalTile: null,
  selectedWorldSiteId: null,
  filters: {
    resources: true,
    colonists: true,
    threats: true,
    poi: true,
    zones: true
  }
};
```

Se não quiser colocar dentro de `state`, usar variável UI, mas precisa salvar filtros em settings.

---

# 51. Preview do destino no Mapa Mundo

Ao selecionar destino, mostrar:

```txt
Prévia orbital do setor
```

Pode reaproveitar a mesma preview do roadmap anterior.

Mostrar:

* terreno aproximado;
* spawn sugerido;
* recursos principais;
* risco;
* POIs esperados.

---

# 52. Não confundir preview com mapa real

Importante:

```txt
Preview mostra estimativa.
Mapa real só é gerado ao visitar.
```

Mas precisa ser consistente com a seed e os modificadores.

---

# 53. Como evitar save gigante demais

## 53.1. Setores não visitados

Salvar só:

```js
{
  siteId,
  seed,
  metadata,
  preview,
  visited: false
}
```

## 53.2. Setores visitados

Salvar completo:

```js
{
  siteId,
  generated: true,
  terrain,
  objects,
  exploration,
  world,
  pointsOfInterest
}
```

---

# 54. Performance

## 54.1. Não renderizar mapa mundo pesado todo frame

O mapa overlay pode renderizar apenas quando:

* abrir mapa;
* trocar aba;
* selecionar ponto;
* mudar filtro;
* viajar.

---

## 54.2. Usar canvas pequeno para mini mapas

Evitar DOM com milhares de divs.

Melhor:

```txt
canvas para mapa local
canvas para preview
```

---

# 55. Faseamento da implementação

## Fase 1 — Corrigir base do Mapa M

Objetivo:

```txt
Garantir que o M abre/fecha corretamente e tem estrutura para abas.
```

Tarefas:

* localizar implementação atual da tecla M;
* localizar overlay do mapa atual;
* adicionar `activeMapTab`;
* criar abas “Local” e “Mundo”;
* manter mapa local funcionando como antes.

Critério de sucesso:

```txt
M abre mapa
1 troca para Local
2 troca para Mundo
Esc fecha
```

---

## Fase 2 — Estado global de worldMap

Objetivo:

```txt
Criar estado global para pontos do mundo.
```

Tarefas:

* criar `state.worldMap`;
* puxar `landingSites` do planet scan;
* definir `currentSiteId`;
* marcar site inicial como `current` e `visited`;
* salvar no save.

Critério de sucesso:

```js
state.worldMap.currentSiteId
state.worldMap.landingSites.length > 0
```

---

## Fase 3 — Renderizar Mapa Mundo

Objetivo:

```txt
Mostrar landing sites no mapa do M.
```

Tarefas:

* desenhar fundo;
* desenhar pontos;
* desenhar rotas simples;
* desenhar labels;
* destacar setor atual;
* clicar em destino.

Critério de sucesso:

```txt
No Mapa Mundo aparecem os mesmos pontos da Varredura Planetária.
```

---

## Fase 4 — Painel de destino

Objetivo:

```txt
Mostrar detalhes do ponto selecionado.
```

Tarefas:

* nome;
* bioma;
* distância;
* risco;
* recursos;
* positivos;
* negativos;
* status;
* preview.

Critério de sucesso:

```txt
Cada ponto selecionado mostra dados próprios.
```

---

## Fase 5 — Preparar Expedição

Objetivo:

```txt
Criar modal/painel de confirmação de viagem.
```

Tarefas:

* destino;
* custo;
* tempo;
* risco;
* modo de viagem;
* aviso de suprimentos;
* botão confirmar.

Primeira versão pode viajar com toda a colônia.

Critério de sucesso:

```txt
O jogador consegue confirmar uma viagem.
```

---

## Fase 6 — Snapshot e troca de setor

Objetivo:

```txt
Salvar setor atual e carregar/gerar destino.
```

Tarefas:

* `snapshotCurrentSector`;
* `saveSector`;
* `loadSector`;
* `generateSectorFromLandingSite`;
* atualizar `currentSiteId`;
* centralizar câmera;
* atualizar exploração.

Critério de sucesso:

```txt
Viajar muda o mapa jogável sem perder o setor anterior.
```

---

## Fase 7 — Consumo e passagem de tempo

Objetivo:

```txt
Viagem ter custo real.
```

Tarefas:

* calcular tempo;
* avançar dia/hora;
* consumir comida;
* afetar energia;
* registrar log.

Critério de sucesso:

```txt
Viajar altera tempo, recursos e status dos colonos.
```

---

## Fase 8 — Eventos de viagem

Objetivo:

```txt
Adicionar imprevisibilidade.
```

Tarefas:

* chance de evento;
* tabela de eventos;
* escolhas simples;
* consequências.

Critério de sucesso:

```txt
Algumas viagens geram eventos.
```

---

## Fase 9 — Retorno e setores visitados

Objetivo:

```txt
Permitir voltar para setor anterior.
```

Tarefas:

* marcar visitado;
* manter setor salvo;
* carregar setor antigo;
* preservar exploração/construções.

Critério de sucesso:

```txt
Viajar para um setor visitado carrega ele como estava.
```

---

## Fase 10 — Postos avançados

Objetivo:

```txt
Dar motivo para manter múltiplos setores.
```

Tarefas:

* criar posto;
* custo;
* ícone no mapa mundo;
* reduzir risco;
* permitir armazenamento futuro.

Critério de sucesso:

```txt
Setor visitado pode virar posto avançado.
```

---

# 56. Ordem segura para não quebrar o jogo

A ordem mais segura é:

```txt
1. Só UI de abas no mapa M
2. Mostrar Mapa Mundo sem viagem
3. Clicar pontos e ver detalhes
4. Salvar estado do worldMap
5. Criar viagem fake apenas com log
6. Criar troca real de setor
7. Criar consumo/custo
8. Criar eventos
9. Criar retorno
10. Criar postos
```

Não começar pela troca de mapa real direto.

---

# 57. Critérios de qualidade

## 57.1. O jogador precisa entender

Ao olhar o Mapa Mundo, deve ficar claro:

```txt
Onde estou?
Para onde posso ir?
O que ganho indo lá?
O que arrisco indo lá?
Quanto custa?
Quanto demora?
Já visitei?
Posso voltar?
```

---

## 57.2. A UI precisa ser limpa

Evitar jogar tudo de uma vez.

Usar:

* abas;
* cards;
* ícones;
* barras;
* tooltips;
* detalhes só ao clicar.

---

## 57.3. A viagem precisa parecer decisão importante

Não pode ser só:

```txt
Clique aqui e teleportou.
```

Precisa parecer:

```txt
Estou mandando minha colônia atravessar o mundo.
```

---

# 58. Possíveis problemas e soluções

## Problema 1 — Save muito grande

Solução:

```txt
Salvar completo só setores visitados.
```

---

## Problema 2 — Jogador se perde

Solução:

```txt
Sempre destacar setor atual e botão “Voltar ao setor atual”.
```

---

## Problema 3 — Viagem quebra sistemas existentes

Solução:

```txt
Manter state.terrain, state.world e state.objects apontando para o setor carregado.
```

---

## Problema 4 — Múltiplas bases complicam demais

Solução:

```txt
Primeira versão: toda colônia viaja.
Depois: expedições separadas.
```

---

## Problema 5 — Gerar mapa novo causa bugs

Solução:

```txt
Primeiro implementar viagem fake.
Depois gerar setor real.
```

---

# 59. Integração com o plano anterior

O plano anterior cria:

```txt
landingSites na Varredura Planetária
```

Este plano usa esses mesmos landing sites dentro do jogo.

Ou seja:

```txt
Varredura Planetária escolhe ponto inicial
Mapa Mundo permite viajar para os outros pontos
```

A estrutura fica:

```txt
Landing Sites
  ├─ usados na escolha inicial
  ├─ usados no Mapa Mundo
  ├─ usados na geração de setores
  └─ usados em viagem/eventos/progressão
```

---

# 60. Resultado final esperado

Ao final desse sistema, HavenFall ganha uma camada estratégica enorme:

```txt
- vários setores jogáveis;
- mundo persistente;
- exploração global;
- viagem;
- risco;
- progressão;
- setores visitáveis;
- locais com biomas próprios;
- postos avançados;
- eventos de rota;
- objetivos globais.
```

Isso aumenta muito o conteúdo sem depender apenas de adicionar objetos soltos no mapa.

---

# 61. Frase de design do sistema

```txt
O mapa local mostra onde a colônia sobrevive.
O mapa mundo mostra para onde a colônia pode ir.
```

---

# 62. Regra final de implementação

Implementar como evolução do sistema existente.

Não criar gambiarra paralela.

Permitido criar novos sistemas reais quando fizer sentido:

```txt
world-travel-system.js
world-map-ui.js
```

Evitar:

```txt
map-v2.js
world-map-v2.js
travel-v2.js
```

O sistema precisa ser integrado com:

```txt
planet-scan-profile
planet-scan-ui
world-generator
save-load
map UI atual
state
```

E deve preservar compatibilidade com o restante do jogo.
