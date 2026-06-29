# HavenFall — Roadmap e Implementação da Geração de Mundo V2

## Objetivo

Substituir a geração visualmente genérica por uma geração procedural em camadas, com macroformas legíveis, biomas coerentes, spawn inteligente, recursos com intenção de gameplay e pontos de interesse com narrativa.

A meta não é apenas trocar probabilidades de tiles. A meta é transformar o mapa em um setor que pareça planejado pelo mundo do jogo: floresta, clareira, montanha, vale úmido, áreas secas, ruínas e recursos precisam surgir de regras compreensíveis.

---

## Diagnóstico da geração anterior

A geração anterior tinha os seguintes problemas principais:

- Ruído visual excessivo, com tiles e objetos parecendo distribuídos sem hierarquia.
- Falta de macroformas: o jogador não identificava rapidamente floresta, montanha, clareira, vale ou área de risco.
- Recursos espalhados como confete, sem relação forte com terreno ou bioma.
- Spawn apenas razoável, sem avaliação ampla de segurança, espaço, recursos e leitura visual.
- Pontos de interesse pouco integrados ao terreno.
- Pouca base técnica para debug de camadas invisíveis.

---

## Pipeline novo

A geração V2 segue esta ordem:

```txt
Seed
 ↓
Mapas invisíveis: altura, umidade, temperatura, fertilidade e rocha
 ↓
Bioma base compatível com o BiomeEngine: forest, desert, snow
 ↓
Zonas de gameplay: forest_core, meadow, rough_field, mountain, wetland, dry_flat, dry_ridge
 ↓
Terreno base: grass, dirt, sand, stone
 ↓
Hidrologia visual: riverbed, bank, basin, wetland
 ↓
Polimento anti-ruído
 ↓
Spawn inteligente
 ↓
Clareira inicial
 ↓
Recursos em clusters
 ↓
Pontos de interesse narrativos
 ↓
Compatibilidade com BiomeEngine
 ↓
Reaplicação das formas críticas: spawn, rios e metadados
```

---

## Camadas implementadas

### 1. Altura

Define montanhas, vales, rios e zonas rochosas.

### 2. Umidade

Define áreas férteis, regiões úmidas, bancos de rio e densidade de vegetação.

### 3. Temperatura

Ajuda a separar regiões secas, temperadas e frias.

### 4. Fertilidade

Influencia árvores, frutas, arbustos, clareiras e áreas boas para início.

### 5. Rocha

Controla montanhas, pedra, minério e áreas de mineração.

### 6. Bioma

Usa IDs compatíveis com o sistema atual:

- `forest`
- `desert`
- `snow`

### 7. Zona

Camada mais específica, usada para gameplay:

- `forest_core`
- `meadow`
- `rough_field`
- `mountain`
- `wetland`
- `dry_flat`
- `dry_ridge`
- `landing_clearing`

### 8. Hidrologia

Como ainda não existe tile real de água no renderer principal, a V2 marca leitos e margens como metadados e representa visualmente usando `dirt` e `sand`, evitando inserir tiles quebrados sem asset.

Tipos:

- `riverbed`
- `bank`
- `basin`
- `wetland`

---

## Melhorias de gameplay

### Spawn inteligente

O spawn agora avalia:

- Distância das bordas.
- Quantidade de grama e terra ao redor.
- Penalidade para pedra, areia e excesso de umidade.
- Proximidade de recursos úteis.
- Fertilidade.
- Rocha próxima, mas não em cima da base.
- Prioridade de pouso: safe, resources, exploration ou challenge.

### Clareira inicial

Depois do spawn, a área inicial é limpa em formato orgânico:

- Núcleo seguro de grama.
- Anel externo suavizado.
- Pedra e areia removidas perto do acampamento.
- Hidrologia removida do centro da clareira.

### Recursos em clusters

Recursos deixam de parecer pontos aleatórios e passam a formar pequenos grupos:

- Árvores preferem floresta fértil.
- Frutas preferem meadow/forest e evitam deserto.
- Rochas e minério preferem montanhas e pedra.
- Toras aparecem mais em regiões florestais ou secas dependendo da história do mapa.

### Pontos de interesse narrativos

O mapa recebe uma história procedural:

- `mining_scars`
- `flooded_valley`
- `dry_ashland`
- `cold_ridge`
- `old_crash_site`
- `abandoned_outpost`
- `green_refuge`
- `broken_frontier`

Essa história influencia nomes, tipos e decoração dos POIs.

---

## Arquivos alterados

### `src/game/worldgen-v2.js`

Novo módulo com a geração procedural em camadas.

### `src/game/boot.js`

Carrega `worldgen-v2.js` depois do BiomeEngine, garantindo que a V2 substitua o gerador anterior sem apagar o arquivo antigo.

---

## Compatibilidade

A V2 mantém compatibilidade com:

- `generateWorldFromSeed(config)`
- `createInitialState(config)`
- `BiomeEngine.applyToWorld(world, config)`
- `makeExplorationMatrix`
- `makeSpawnPoints`
- `generateWeatherPattern`
- `objectDefs`
- `worldUid`
- saves locais com estrutura parecida

O gerador antigo continua no projeto, mas é sobrescrito em runtime pelo módulo V2.

---

## Debug disponível

Durante runtime, existe:

```js
window.HavenfallWorldGenV2.describeTile(x, y)
```

Retorna:

```js
{
  x,
  y,
  height,
  moisture,
  temperature,
  fertility,
  rock,
  biome,
  zone,
  hydrology
}
```

Também fica salvo em `world.generation` um resumo com:

- versão da geração;
- seed;
- história do mapa;
- spawn;
- contagem de terrenos;
- contagem de objetos;
- contagem de biomas;
- contagem de zonas;
- contagem de hidrologia;
- quantidade de POIs.

---

## Próximas evoluções recomendadas

### Fase 2.1 — Tile real de água

Adicionar assets e renderer para:

- água rasa;
- água profunda;
- margem;
- lama;
- ponte futura.

### Fase 2.2 — Overlay visual de debug

Atalhos recomendados:

```txt
F2: altura
F3: umidade
F4: temperatura
F5: fertilidade
F6: rocha
F7: biomas
F8: zonas
F9: hidrologia
```

### Fase 2.3 — POIs multi-tile reais

Criar estruturas maiores:

- ruína com paredes quebradas;
- mina abandonada;
- depósito de carga;
- abrigo alagado;
- destroço antigo.

### Fase 2.4 — Integração com gameplay avançado

Usar zonas para influenciar:

- eventos de animais;
- qualidade de plantio;
- chance de desmoronamento;
- temperatura local;
- velocidade de movimento;
- risco de doença em áreas úmidas;
- riqueza mineral.

---

## Resultado esperado

A geração V2 deve entregar mapas com:

- Leitura visual melhor.
- Menos ruído aleatório.
- Clareiras e regiões reconhecíveis.
- Recursos com lógica.
- Montanhas mais coerentes.
- Leitos e margens simulando rios/vales úmidos.
- Spawn mais seguro e útil.
- POIs com mais narrativa.
- Base pronta para debug e expansões futuras.
