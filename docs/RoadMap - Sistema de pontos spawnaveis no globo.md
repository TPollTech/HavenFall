# Roadmap — Sistema de Pontos Spawnáveis no Globo / Varredura Planetária

## 1. Visão geral

A tela de **Varredura Planetária** deve deixar de ser apenas uma etapa informativa antes do jogo e passar a ser uma etapa estratégica de escolha de pouso.

O jogador verá um globo com vários pontos possíveis de pouso. Cada ponto representa um setor jogável com características próprias, como:

* bioma dominante;
* mistura de biomas secundários;
* terreno inicial;
* riscos naturais;
* quantidade de recursos;
* ameaças;
* pontos positivos;
* pontos negativos;
* prévia visual do terreno;
* dificuldade estimada;
* estilo de gameplay esperado.

A ideia é transformar essa tela em algo parecido com:

> “Escolha onde sua colônia vai cair. Cada local muda completamente o início da partida.”

---

# 2. Objetivo principal

Implementar no globo existente um sistema de **locais de pouso selecionáveis**, onde cada ponto tenha dados únicos e influencie diretamente a geração do mundo.

O jogador deve conseguir:

1. abrir a tela de varredura;
2. ver vários pontos marcados no globo;
3. clicar em cada ponto;
4. ver detalhes completos daquele setor;
5. visualizar uma prévia do terreno;
6. comparar vantagens e desvantagens;
7. escolher o local de pouso;
8. iniciar o jogo naquele setor específico.

---

# 3. Conceito central

Atualmente a tela parece representar um único setor gerado.

O novo sistema deve separar duas coisas:

## 3.1. Planeta / Varredura Global

Representa o planeta como um todo.

Contém:

* seed principal;
* perfil geral do planeta;
* distribuição geral de biomas;
* regiões detectadas no globo;
* quantidade de locais escaneados;
* dificuldade global.

## 3.2. Local de Pouso / Landing Site

Cada ponto no globo representa um setor específico.

Cada local possui:

```js
{
  id: 'landing_01',
  name: 'Vale Verdejante',
  globeX: 0.42,
  globeY: 0.58,
  biomePrimary: 'forest',
  biomeSecondary: ['meadow', 'river'],
  difficulty: 'safe',
  positives: [],
  negatives: [],
  resources: {},
  risks: {},
  preview: {},
  worldgenModifiers: {}
}
```

---

# 4. Resultado esperado para o jogador

Na prática, a tela deve funcionar assim:

## 4.1. O jogador entra na Varredura Planetária

O globo aparece com vários pontos brilhando.

Exemplo visual:

```txt
        GLOBO
     .-----------.
   /   •     •     \
  |       •         |
  |  •         •    |
   \      •        /
     '-----------'
```

Cada `•` é um local de pouso.

---

## 4.2. O jogador passa o mouse ou clica em um ponto

Ao selecionar um ponto, o painel da direita muda.

Mostra:

```txt
LOCAL DE POUSO 03 — VALE VERDEJANTE

Bioma dominante: Floresta temperada
Dificuldade: Segura
Recursos: Madeira alta, comida média, pedra baixa
Riscos: Chuva frequente, fauna moderada

Pontos positivos:
+ Muita madeira próxima
+ Solo fértil para plantio
+ Temperatura estável
+ Boa visibilidade inicial

Pontos negativos:
- Pouca pedra perto do spawn
- Mais animais selvagens
- Chuva pode atrapalhar eventos futuros
```

---

## 4.3. O jogador vê uma preview do terreno

A tela deve mostrar uma miniatura do mapa inicial daquele setor.

Não precisa ser o mapa inteiro. Pode ser uma preview simplificada, tipo:

```txt
🌲 🌲 🌲 🟩 🟩
🌲 🟩 🟩 🟫 🪨
🟩 🟩 🔥 🟩 🟩
🟩 🫐 🟩 🌲 🌲
🪨 🟫 🟩 🟩 🌲
```

Ou uma preview desenhada em canvas com tiles pequenos.

---

## 4.4. O jogador escolhe

Botão:

```txt
Escolher este local de pouso
```

Depois:

```txt
Continuar para Colonos
```

ou, dependendo do fluxo:

```txt
Iniciar pouso neste setor
```

---

# 5. Quantidade de pontos spawnáveis

A quantidade pode variar conforme tamanho do mapa e tipo de varredura.

## 5.1. Padrão recomendado

| Mapa              | Pontos no globo |
| ----------------- | --------------: |
| Grande            |        5 locais |
| Enorme            |        7 locais |
| Gigante           |        9 locais |
| Infinito / Chunks |       12 locais |

## 5.2. Regra especial

O botão **Gerar outro setor** deve gerar outro conjunto de pontos, não apenas trocar uma leitura única.

---

# 6. Tipos de locais de pouso

Cada ponto deve ter um arquétipo. Isso evita pontos genéricos.

## 6.1. Local seguro

Foco em sobrevivência inicial fácil.

Características:

* spawn em clareira;
* recursos equilibrados;
* poucos inimigos;
* terreno plano;
* riscos baixos.

Exemplo:

```txt
Clareira Segura
```

Pontos positivos:

* boa área para construir;
* comida próxima;
* poucos obstáculos.

Pontos negativos:

* recursos raros mais distantes;
* pouca recompensa inicial.

---

## 6.2. Floresta densa

Foco em madeira, caça e risco animal.

Características:

* muitas árvores;
* muita vegetação;
* fauna mais ativa;
* pouca visibilidade;
* solo fértil.

Exemplo:

```txt
Mata Fechada
```

Pontos positivos:

* muita madeira;
* frutas e ervas;
* plantio favorecido.

Pontos negativos:

* muitos obstáculos;
* animais mais próximos;
* construção inicial exige limpeza.

---

## 6.3. Vale rochoso

Foco em pedra, metal e defesa natural.

Características:

* muita pedra;
* minério próximo;
* gargalos naturais;
* pouca comida.

Exemplo:

```txt
Vale de Basalto
```

Pontos positivos:

* minério próximo;
* bom para defesa;
* paredes naturais.

Pontos negativos:

* pouca madeira;
* solo ruim para plantio;
* movimentação mais difícil.

---

## 6.4. Margem de rio / bacia hídrica

Foco em água, fertilidade e risco climático.

Características:

* rio próximo;
* solo fértil;
* vegetação abundante;
* risco de chuva/umidade.

Exemplo:

```txt
Margem Alagada
```

Pontos positivos:

* comida e plantio melhores;
* vegetação rica;
* possível defesa natural pelo rio.

Pontos negativos:

* lama/pântano;
* doenças/eventos de umidade no futuro;
* construção limitada em certas áreas.

---

## 6.5. Deserto seco

Foco em desafio, calor e escassez.

Características:

* pouca madeira;
* pouca comida;
* pedra moderada;
* eventos climáticos mais duros.

Exemplo:

```txt
Planície Seca
```

Pontos positivos:

* campo aberto;
* boa visibilidade;
* menos árvores bloqueando construção.

Pontos negativos:

* pouca comida;
* pouca madeira;
* calor e tempestades de poeira.

---

## 6.6. Região fria / montanha gelada

Foco em sobrevivência climática.

Características:

* temperatura baixa;
* pouca vegetação;
* muito risco climático;
* recursos minerais bons.

Exemplo:

```txt
Cordilheira Fria
```

Pontos positivos:

* pedra e metal;
* defesa natural;
* menos pragas.

Pontos negativos:

* frio intenso;
* pouca comida;
* madeira limitada.

---

## 6.7. Ruínas antigas

Foco em recompensa e risco.

Características:

* POIs próximos;
* sucata;
* estruturas quebradas;
* risco de eventos ou inimigos.

Exemplo:

```txt
Posto Abandonado
```

Pontos positivos:

* loot inicial;
* sucata/metal;
* estruturas aproveitáveis.

Pontos negativos:

* possível ameaça próxima;
* terreno irregular;
* eventos narrativos mais perigosos.

---

## 6.8. Local extremo

Foco em jogadores que querem desafio.

Características:

* muitos negativos;
* grande recompensa;
* risco alto.

Exemplo:

```txt
Zona Instável
```

Pontos positivos:

* minério raro;
* POI especial;
* recursos valiosos.

Pontos negativos:

* clima agressivo;
* pouca segurança;
* inimigos mais próximos;
* spawn menos confortável.

---

# 7. Estrutura dos dados de um ponto de pouso

Cada ponto precisa ter uma estrutura clara.

Sugestão:

```js
const landingSite = {
  id: 'landing_03',
  name: 'Vale Verdejante',
  archetype: 'forest_safe',

  globe: {
    x: 0.42,
    y: 0.57,
    hemisphere: 'southwest',
    visible: true
  },

  labels: {
    title: 'Vale Verdejante',
    subtitle: 'Floresta temperada · risco baixo',
    biomeLabel: 'Floresta temperada'
  },

  difficulty: {
    tier: 'safe',
    score: 28,
    label: 'Seguro'
  },

  biomes: {
    primary: 'forest',
    secondary: ['meadow', 'riverbank'],
    mix: {
      forest: 52,
      meadow: 24,
      rock: 12,
      water: 8,
      ruins: 4
    }
  },

  resources: {
    wood: 82,
    food: 64,
    stone: 34,
    metal: 18,
    medicine: 42,
    water: 57
  },

  risks: {
    fauna: 36,
    weather: 28,
    disease: 18,
    raids: 12,
    terrain: 22
  },

  positives: [
    'Muita madeira próxima',
    'Solo fértil para plantio',
    'Boa área para construir',
    'Temperatura estável'
  ],

  negatives: [
    'Pouca pedra perto do pouso',
    'Fauna moderada nas bordas',
    'Chuva mais frequente'
  ],

  worldgenModifiers: {
    treeMultiplier: 1.35,
    rockMultiplier: 0.75,
    oreMultiplier: 0.65,
    berryMultiplier: 1.20,
    riverChance: 0.45,
    mountainChance: 0.20,
    ruinChance: 0.12,
    spawnClearingRadius: 7
  },

  preview: {
    seed: 'HAVEN-85B-VANTA-NEO|landing_03',
    thumbnail: null,
    terrainSample: []
  }
};
```

---

# 8. Relação entre ponto do globo e geração real do mapa

Essa é a parte mais importante.

O ponto escolhido no globo precisa alterar a geração real do mundo.

Não pode ser só visual.

## 8.1. Configuração final da partida

Ao selecionar um landing site, o `config` da partida deve receber:

```js
config.selectedLandingSite = landingSite;
config.landingSiteId = landingSite.id;
config.sectorProfile = landingSite.archetype;
config.planetScan = {
  ...planetScanProfile,
  selectedLandingSite: landingSite
};
```

## 8.2. A geração do mundo usa isso

Dentro de `world-generator.js`, as funções devem ler:

```js
config.selectedLandingSite
```

ou:

```js
config.planetScan.selectedLandingSite
```

E aplicar os modificadores:

* densidade de floresta;
* chance de pedra;
* chance de minério;
* chance de ruína;
* proximidade de água;
* tamanho da clareira inicial;
* risco de mobs;
* clima;
* quantidade de POIs.

---

# 9. Prévia visual do terreno

A preview não precisa renderizar o mapa completo. Ela pode ser uma mini simulação.

## 9.1. Primeira versão da preview

Criar uma grade pequena:

```txt
16x10
```

ou:

```txt
24x14
```

Cada célula representa um tipo de terreno.

Tipos:

```js
grass
dirt
stone
sand
forest
water
ruin
spawn
```

Visualmente:

| Tipo   | Cor/ícone            |
| ------ | -------------------- |
| grass  | verde                |
| dirt   | marrom               |
| stone  | cinza                |
| sand   | amarelo              |
| forest | verde escuro         |
| water  | azul                 |
| ruin   | cinza quebrado       |
| spawn  | ponto branco/dourado |

## 9.2. Preview no painel da direita

Adicionar card:

```txt
PRÉVIA DO TERRENO
[ mini canvas / grade ]
```

Abaixo:

```txt
Leitura aproximada do setor. O mapa final será gerado com variações da seed.
```

## 9.3. Preview ao passar o mouse

Ao passar o mouse em cima de um ponto do globo, pode aparecer um tooltip curto:

```txt
Vale Verdejante
Madeira alta · risco baixo · solo fértil
```

Ao clicar, abre detalhes completos.

---

# 10. Interação no globo

## 10.1. Estados visuais dos pontos

Cada ponto deve ter estados:

```js
idle
hover
selected
danger
locked
recommended
```

## 10.2. Aparência recomendada

| Estado           | Visual                 |
| ---------------- | ---------------------- |
| Normal           | ponto azul/ciano       |
| Hover            | ponto maior com brilho |
| Selecionado      | anel dourado           |
| Alto risco       | vermelho/laranja       |
| Recomendado      | verde                  |
| Bloqueado/futuro | cinza                  |

## 10.3. Animação

Os pontos podem pulsar de forma leve.

Nada exagerado.

Regras:

* ponto seguro pulsa suave;
* ponto perigoso pulsa mais forte;
* ponto selecionado tem anel girando ou brilho fixo;
* tooltip acompanha o mouse ou aparece ao lado do ponto.

---

# 11. Layout sugerido da tela

A tela atual já tem:

* globo à esquerda;
* dados à direita;
* botões embaixo.

O novo layout pode ficar assim:

```txt
┌───────────────────────┬────────────────────────────────────┐
│                       │ VARREDURA PLANETÁRIA               │
│        GLOBO          │ Análise de Setor                   │
│                       │                                    │
│   • pontos clicáveis  │ Local selecionado                  │
│                       │ Nome / Bioma / Dificuldade         │
│                       │                                    │
│ Legenda de biomas     │ Pontos positivos / negativos       │
│                       │                                    │
│                       │ Preview do terreno                 │
│                       │                                    │
└───────────────────────┴────────────────────────────────────┘
```

---

# 12. Cards do painel direito

## 12.1. Card de identidade

```txt
LOCAL DE POUSO 04
Vale Verdejante

Floresta temperada · Risco baixo · Pouso seguro
```

## 12.2. Card de recursos

```txt
RECURSOS ESTIMADOS

Madeira     █████████░ 82%
Comida      ███████░░░ 64%
Pedra       ████░░░░░░ 34%
Metal       ██░░░░░░░░ 18%
Remédios    █████░░░░░ 42%
Água        ██████░░░░ 57%
```

## 12.3. Card de riscos

```txt
RISCOS

Clima       ███░░░░░░░ 28%
Fauna       ████░░░░░░ 36%
Doença      ██░░░░░░░░ 18%
Terreno     ██░░░░░░░░ 22%
Ataques     █░░░░░░░░░ 12%
```

## 12.4. Card de positivos

```txt
PONTOS POSITIVOS

+ Muita madeira próxima
+ Solo fértil
+ Boa área de construção
+ Temperatura estável
```

## 12.5. Card de negativos

```txt
PONTOS NEGATIVOS

- Pouca pedra perto do spawn
- Fauna moderada
- Chuva frequente
```

## 12.6. Card de preview

```txt
PRÉVIA DO TERRENO

[canvas pequeno com mini mapa]
```

---

# 13. Sistema de pontuação

Cada ponto de pouso deve ter uma pontuação geral.

## 13.1. Fórmula base

```js
score =
  recursos * 0.35
  + segurança * 0.30
  + espaçoConstrução * 0.20
  + fertilidade * 0.15
  - riscos * 0.30
```

## 13.2. Classificação

|  Score | Label           |
| -----: | --------------- |
|   0–25 | Extremo         |
|  26–45 | Difícil         |
|  46–65 | Moderado        |
|  66–80 | Seguro          |
| 81–100 | Muito favorável |

## 13.3. Uso no UI

Mostrar:

```txt
Classificação: Seguro
Score orbital: 74/100
```

---

# 14. Pontos positivos e negativos automáticos

Os pontos positivos e negativos não devem ser escritos manualmente para cada setor. Eles devem ser derivados dos dados.

## 14.1. Exemplos de regras positivas

```js
if (resources.wood > 75) positives.push('Muita madeira próxima');
if (resources.food > 65) positives.push('Boa disponibilidade de comida');
if (resources.stone > 70) positives.push('Rochas abundantes para construção');
if (resources.metal > 60) positives.push('Sinais fortes de minério');
if (risks.weather < 25) positives.push('Clima estável');
if (buildSpace > 70) positives.push('Boa área plana para construção');
```

## 14.2. Exemplos de regras negativas

```js
if (resources.wood < 30) negatives.push('Madeira escassa');
if (resources.food < 30) negatives.push('Comida inicial limitada');
if (risks.weather > 65) negatives.push('Clima instável');
if (risks.fauna > 60) negatives.push('Fauna agressiva próxima');
if (terrainDifficulty > 65) negatives.push('Terreno irregular');
if (resources.stone < 25) negatives.push('Pouca pedra próxima');
```

---

# 15. Tipos de assinatura detectada

Na tela atual já existem assinaturas, como falha geológica.

Essas assinaturas devem ser conectadas aos pontos do globo.

## 15.1. Exemplos

| Assinatura              | Efeito                               |
| ----------------------- | ------------------------------------ |
| Falha geológica         | mais pedra/minério, risco de terreno |
| Atividade biológica     | mais comida/fauna, risco animal      |
| Bacia hídrica           | água/fertilidade, risco de umidade   |
| Ruína detectada         | POI próximo, risco narrativo         |
| Eco metálico            | sucata/minério, possível ameaça      |
| Instabilidade climática | clima difícil                        |
| Zona fértil             | plantio melhor                       |
| Vale protegido          | spawn seguro                         |

## 15.2. Exemplo no painel

```txt
ASSINATURAS DO LOCAL

Falha geológica 01
+ Minério próximo
- Terreno irregular

Atividade biológica 02
+ Caça e frutas
- Fauna mais ativa
```

---

# 16. Dados que precisam ser salvos no save

O save precisa guardar o local escolhido.

Exemplo:

```js
state.world.landingSite = selectedLandingSite;
state.world.planetScan.selectedLandingSiteId = selectedLandingSite.id;
state.world.worldgenSource = {
  planetSeed,
  landingSeed,
  landingSiteId,
  archetype
};
```

Isso permite:

* mostrar depois onde o jogador pousou;
* garantir que a seed gere o mesmo mapa;
* debugar problemas;
* usar eventos futuros baseados no local.

---

# 17. Integração com o gerador de mundo atual

A implementação deve ser feita no fluxo atual.

Sem criar:

```txt
worldgen-v2.js
```

Sem duplicar gerador.

Sem sobrescrever função em runtime.

A integração correta é alterar o fluxo existente.

## Arquivos principais prováveis

```txt
src/game/ui/planet-scan-ui.js
src/game/systems/planet-scan-profile.js
src/game/world-generator.js
src/game/game-setup.js
src/game/boot.js
```

## 17.1. `planet-scan-profile.js`

Responsável por gerar:

* dados globais do planeta;
* lista de landing sites;
* métricas de cada local;
* assinaturas de cada local;
* seed específica de cada local.

## 17.2. `planet-scan-ui.js`

Responsável por:

* desenhar pontos no globo;
* detectar hover/click;
* mostrar dados do landing site selecionado;
* mostrar preview;
* salvar seleção no `newGameConfig`.

## 17.3. `world-generator.js`

Responsável por:

* ler `config.selectedLandingSite`;
* aplicar modificadores do local;
* ajustar terreno;
* ajustar recursos;
* ajustar POIs;
* ajustar spawn inicial.

## 17.4. `game-setup.js`

Responsável por:

* normalizar o config;
* garantir que o landing site escolhido seja carregado;
* preservar dados ao voltar/avançar nas telas.

---

# 18. Fluxo técnico recomendado

## 18.1. Ao entrar na tela de varredura

```js
const scan = generatePlanetScanProfile(config);
config.planetScan = scan;
config.selectedLandingSiteId = scan.landingSites[0].id;
```

## 18.2. Gerar pontos

```js
scan.landingSites = generateLandingSites(config.seed, config.mapSize, scan);
```

## 18.3. Renderizar no globo

```js
renderGlobeLandingPoints(scan.landingSites);
```

## 18.4. Selecionar ponto

```js
selectLandingSite(siteId);
```

Atualiza:

```js
newGameConfig.selectedLandingSite = site;
newGameConfig.selectedLandingSiteId = site.id;
```

## 18.5. Continuar para colonos

O config segue com o local selecionado.

## 18.6. Iniciar jogo

```js
startNewGame(config, selectedColonists);
```

O `world-generator.js` usa:

```js
config.selectedLandingSite
```

---

# 19. Preview do terreno — geração leve

A preview não deve chamar a geração completa do mundo.

Ela deve usar uma função leve.

Exemplo:

```js
function generateLandingPreview(site, width = 24, height = 14) {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => resolvePreviewTile(site, x, y))
  );
}
```

## 19.1. Exemplo de tiles

```js
{
  type: 'grass',
  elevation: 0.42,
  moisture: 0.61,
  resourceHint: null
}
```

## 19.2. Renderização

```js
function drawLandingPreview(canvas, preview) {
  // desenha quadradinhos pequenos
}
```

---

# 20. Regras de posicionamento dos pontos no globo

Os pontos não podem aparecer aleatoriamente em qualquer canto.

Precisam respeitar:

* dentro da área circular do globo;
* não sobrepor demais;
* refletir biomas visuais do globo;
* ter distribuição equilibrada.

## 20.1. Distância mínima

```js
minDistanceBetweenPoints = 0.10;
```

## 20.2. Coordenadas normalizadas

```js
globeX: 0.0 até 1.0
globeY: 0.0 até 1.0
```

## 20.3. Conversão para tela

```js
screenX = globeCenterX + (globeX - 0.5) * globeWidth;
screenY = globeCenterY + (globeY - 0.5) * globeHeight;
```

## 20.4. Verificação circular

```js
dx = globeX - 0.5;
dy = globeY - 0.5;
inside = dx * dx + dy * dy <= 0.25;
```

---

# 21. Estados do botão principal

## Nenhum ponto selecionado

```txt
Selecione um local no globo
```

Botão desabilitado.

## Ponto selecionado

```txt
Continuar para Colonos
```

Botão habilitado.

## Ponto extremo selecionado

Mostrar aviso:

```txt
Este local possui risco extremo. Recomendado apenas para jogadores experientes.
```

---

# 22. Textos de UI sugeridos

## Título da seção

```txt
Locais de Pouso Detectados
```

## Ajuda

```txt
Clique em um ponto no globo para analisar o setor antes de escolher o local inicial da colônia.
```

## Tooltip

```txt
Vale Verdejante
Madeira alta · Risco baixo · Solo fértil
```

## Botão

```txt
Escolher este local
```

ou:

```txt
Continuar com este pouso
```

---

# 23. Eventos futuros baseados no local

O local escolhido pode alimentar sistemas futuros.

## 23.1. Se pousou em floresta

Eventos:

* ataque de lobos;
* colheita abundante;
* incêndio florestal;
* chuva forte.

## 23.2. Se pousou em vale rochoso

Eventos:

* deslizamento;
* minério raro;
* cavernas;
* bloqueios naturais.

## 23.3. Se pousou em ruínas

Eventos:

* saqueadores;
* descoberta de tecnologia;
* estrutura instável;
* loot escondido.

## 23.4. Se pousou perto de água

Eventos:

* enchente;
* doenças;
* pesca futura;
* solo fértil.

---

# 24. Plano de implementação por fases

## Fase 1 — Estrutura de dados

Criar `landingSites` dentro do perfil da varredura.

Tarefas:

* gerar IDs;
* gerar nomes;
* gerar arquétipos;
* gerar coordenadas no globo;
* gerar métricas;
* gerar positivos/negativos;
* gerar preview básica.

Critério de sucesso:

```js
config.planetScan.landingSites.length > 0
```

---

## Fase 2 — UI dos pontos no globo

Adicionar pontos clicáveis no globo.

Tarefas:

* desenhar pontos;
* hover;
* seleção;
* tooltip;
* estado selecionado;
* legenda.

Critério de sucesso:

* clicar no ponto muda o painel da direita;
* ponto selecionado fica destacado.

---

## Fase 3 — Painel detalhado do local

Adicionar cards de análise.

Tarefas:

* nome do local;
* bioma;
* dificuldade;
* recursos;
* riscos;
* positivos;
* negativos;
* assinaturas do local.

Critério de sucesso:

* cada ponto mostra dados diferentes.

---

## Fase 4 — Preview do terreno

Adicionar mini mapa.

Tarefas:

* criar função leve de preview;
* renderizar em canvas ou grid HTML;
* atualizar ao selecionar ponto.

Critério de sucesso:

* locais diferentes mostram previews diferentes.

---

## Fase 5 — Persistência da seleção

Garantir que o ponto escolhido vá para a próxima tela.

Tarefas:

* salvar `selectedLandingSiteId`;
* salvar `selectedLandingSite`;
* manter seleção ao voltar;
* manter seleção ao avançar.

Critério de sucesso:

* depois de escolher colonos, o jogo ainda sabe qual ponto foi escolhido.

---

## Fase 6 — Integração real com geração de mundo

Aplicar os modificadores no `world-generator.js`.

Tarefas:

* árvore;
* pedra;
* minério;
* comida;
* POIs;
* clareira;
* risco;
* spawn;
* terreno base.

Critério de sucesso:

* escolher floresta gera começo com mais floresta;
* escolher rocha gera começo mais rochoso;
* escolher seguro gera clareira melhor;
* escolher extremo gera início mais difícil.

---

## Fase 7 — Polimento visual

Tarefas:

* animação dos pontos;
* tooltip bonito;
* cards compactos;
* preview mais legível;
* cores por bioma;
* aviso de risco extremo;
* feedback ao escolher.

Critério de sucesso:

* tela parece uma etapa importante do jogo, não um menu temporário.

---

## Fase 8 — Debug e validação

Adicionar modo debug temporário.

Tarefas:

* listar landing sites no console;
* mostrar site selecionado;
* mostrar seed do site;
* mostrar modificadores aplicados;
* confirmar que o world-generator recebeu o site.

Comandos úteis:

```js
newGameConfig.planetScan.landingSites
newGameConfig.selectedLandingSite
state.world.landingSite
```

---

# 25. Cuidados obrigatórios

## 25.1. Não criar arquivo V2 paralelo

Não criar:

```txt
worldgen-v2.js
planet-scan-v2.js
landing-system-v2.js
```

A implementação deve usar os arquivos reais do sistema atual.

## 25.2. Não sobrescrever função em runtime

Evitar:

```js
window.generateWorldFromSeed = outraFuncao;
```

## 25.3. Não duplicar estado

Evitar ter:

```js
selectedSite
selectedLanding
landingChoice
currentLanding
```

Escolher um padrão.

Recomendado:

```js
selectedLandingSiteId
selectedLandingSite
```

## 25.4. Não quebrar save antigo

Se save antigo não tiver `landingSite`, usar fallback:

```js
world.landingSite || null
```

## 25.5. Não depender só da UI

A geração real precisa ler o landing site.
A UI não pode ser apenas cosmética.

---

# 26. Modelo final esperado

No final, o fluxo deve ficar assim:

```txt
Novo Jogo
 ↓
Configuração da Colônia
 ↓
Varredura Planetária
  ├─ globo com pontos spawnáveis
  ├─ seleção de local
  ├─ análise de positivos/negativos
  ├─ preview do terreno
  └─ escolha do pouso
 ↓
Seleção de Colonos
 ↓
Início da Partida
  └─ world-generator usa o local escolhido
```

---

# 27. Exemplo de experiência ideal

O jogador vê três pontos interessantes:

## Ponto 1 — Clareira Segura

```txt
+ fácil para construir
+ recursos equilibrados
- poucas recompensas especiais
```

## Ponto 2 — Cordilheira Rochosa

```txt
+ muito metal
+ defesa natural
- pouca comida
- terreno difícil
```

## Ponto 3 — Ruína Submersa

```txt
+ loot raro
+ água e fertilidade
- risco de doença
- ameaça desconhecida
```

A escolha muda o início da história da colônia.

---

# 28. Conclusão

Esse sistema transforma a Varredura Planetária em uma etapa fundamental do jogo.

O globo deixa de ser apenas decoração e passa a ser:

* escolha estratégica;
* prévia do mapa;
* gerador de história;
* controle de dificuldade;
* variação real entre partidas;
* ponte entre UI e geração procedural.

A implementação correta deve ser feita no sistema atual, principalmente em:

```txt
src/game/ui/planet-scan-ui.js
src/game/systems/planet-scan-profile.js
src/game/world-generator.js
src/game/game-setup.js
```

Sem criar arquivos paralelos de versão 2.
