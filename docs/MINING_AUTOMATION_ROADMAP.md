# Roadmap — Mineração, Metalurgia, Energia e Automação

Status: backlog planejado. Este documento registra uma linha futura de evolução para HavenFall. Antes desta frente, a prioridade imediata é um patch de desempenho geral do jogo.

## 1. Visão geral

A mineração deve virar uma coluna de progressão própria. O jogador começa com coleta e mineração manual, aprende a processar minério, cria ferramentas e componentes, desbloqueia energia, e só depois chega em mineradoras, esteiras, máquinas e automação.

A referência de sensação é:

- mineração manual com decisão e progressão;
- veios persistentes de recurso;
- processamento em etapas;
- energia como gargalo real;
- máquinas conectadas por logística;
- automação como recompensa de longo prazo.

O objetivo não é copiar nenhum jogo ou mod. A ideia é criar uma versão própria para HavenFall, com assets simples e mecânicas boas.

## 2. Filosofia de design

### 2.1. Manual antes da automação

A automação não deve aparecer cedo demais. Antes de construir mineradoras, o jogador precisa ter o que fazer manualmente.

A mineração manual deve envolver:

- achar recurso;
- identificar minério;
- escolher ferramenta;
- quebrar rocha;
- extrair minério bruto;
- processar em bancada;
- fundir;
- criar peças;
- pesquisar melhorias;
- lidar com cansaço, luz e tempo.

### 2.2. Automação como recompensa

A mineradora automática só deve fazer sentido depois que o jogador passou por várias etapas manuais:

1. coleta de pedra e carvão;
2. picareta simples;
3. prospecção básica;
4. extração manual de minério;
5. quebra do minério bruto;
6. separação de minério útil;
7. fundição;
8. fabricação de componentes;
9. energia básica;
10. mineradora assistida;
11. mineradora automática;
12. esteiras e processamento contínuo.

## 3. Recursos base

### 3.1. Rochas comuns

| Recurso | Função inicial | Função futura |
|---|---|---|
| Pedra comum | construção simples | concreto e fundação |
| Granito | paredes fortes | máquinas pesadas |
| Ardósia | piso e acabamento | isolamento e telhado |
| Arenito | construção barata | cal e blocos simples |
| Basalto | rocha dura | estrutura industrial |
| Calcário | recurso de construção | cimento e cal |

### 3.2. Minérios brutos

| Minério | Processamento | Uso principal |
|---|---|---|
| Ferro bruto | minério preparado, lingote | ferramentas, estruturas, máquinas |
| Cobre bruto | lingote, fio | energia, cabos, componentes elétricos |
| Estanho bruto | lingote | bronze e peças leves |
| Carvão bruto | carvão limpo | combustível e aço |
| Chumbo bruto | lingote | baterias e proteção industrial |
| Prata bruta | lingote | componentes precisos e comércio |
| Ouro bruto | lingote | componentes avançados e comércio |
| Quartzo bruto | sílica e cristal | vidro, sensores e circuitos |
| Bauxita | alumínio | estruturas leves e máquinas médias |
| Níquel bruto | liga metálica | motores e peças resistentes |
| Titânio bruto | liga avançada | máquinas finais |
| Minério energético raro | combustível avançado futuro | late game |

### 3.3. Subprodutos

| Subproduto | Uso |
|---|---|
| Cascalho | concreto e filtros |
| Poeira mineral | processamento avançado |
| Sílica | vidro |
| Argila | tijolo e cerâmica |
| Enxofre | química e fertilizante |
| Salitre | química e fertilizante |
| Cristais raros | pesquisa e sensores |
| Gemas | comércio e decoração |

## 4. Tipos de depósito

### 4.1. Pedra solta

Recurso pequeno no mapa. Serve para o começo da partida.

Exemplos:

- pedra solta;
- fragmento de minério;
- carvão superficial;
- restos metálicos.

### 4.2. Bloco de minério em montanha

Tile mineável dentro da massa rochosa.

Exemplos:

- rocha de ferro;
- rocha de cobre;
- rocha com carvão;
- rocha de quartzo.

Comportamento:

- pode ser minerado manualmente;
- some ao ser totalmente minerado;
- gera minério bruto e pedra;
- pode ter subproduto.

### 4.3. Veio fixo de minério

Objeto/deposito especial, persistente, inspirado em veios de recurso quase infinitos.

Características:

- não desaparece com mineração manual;
- pode ser minerado manualmente em baixa quantidade;
- possui tipo de minério;
- possui pureza;
- futuramente aceita mineradora automática;
- aparece no mapa como formação especial.

Purezas sugeridas:

| Pureza | Produção manual | Produção automática futura |
|---|---:|---:|
| Impuro | baixa | baixa |
| Normal | média | média |
| Rico | alta | alta |
| Excepcional | muito alta | muito alta |

### 4.4. Depósito profundo

Recurso oculto inicialmente.

Aparece apenas depois de tecnologias como:

- prospecção avançada;
- scanner geológico;
- sonda de profundidade;
- análise sísmica.

## 5. Mineração manual

### 5.1. Interação com modo manual

No modo manual com WASD, a tecla de interação deve ser central.

Exemplos:

```txt
[E] Minerar rocha
[E] Extrair minério de ferro
[E] Minerar veio de cobre
[E] Usar fornalha
[E] Usar bancada
[E] Usar mesa de seleção
```

### 5.2. Ferramentas manuais

| Ferramenta | Fase | Função |
|---|---|---|
| Mãos nuas | início | coleta básica e pedra solta |
| Picareta de pedra | começo | rocha fraca |
| Picareta de cobre | início industrial | cobre, estanho e carvão |
| Picareta de ferro | metalurgia básica | ferro e rocha média |
| Picareta de aço | mid game | rocha dura e minério raro |
| Broca manual | pré-automação | mineração rápida, cansa mais |
| Martelo geológico | prospecção | identificar minério e pureza |
| Lanterna de mineração | suporte | reduz penalidade no escuro |
| Capacete com luz | energia inicial | mineração subterrânea prolongada |

### 5.3. Ciclo manual básico

```txt
Encontrar rocha ou veio
→ aproximar colono manualmente
→ interagir com E
→ escolher ferramenta disponível
→ gastar tempo e energia
→ receber minério bruto/subproduto
→ levar para processamento
```

### 5.4. Variáveis de mineração

O resultado deve depender de:

- ferramenta equipada;
- habilidade do colono;
- tipo da rocha;
- pureza do veio;
- iluminação;
- energia/fome/sede do colono;
- pesquisa desbloqueada;
- presença de bancada adequada.

### 5.5. Riscos e limitações

| Situação | Efeito |
|---|---|
| Escuro demais | mineração mais lenta |
| ferramenta ruim | menor rendimento |
| rocha dura | maior cansaço |
| teto natural | risco sistêmico futuro |
| poeira mineral | penalidade leve se minerar demais |
| área quente/fria | afeta humor e energia |

## 6. Processamento manual de minério

### 6.1. Fluxo geral

```txt
Rocha mineral
→ minério bruto
→ minério quebrado
→ minério selecionado
→ minério preparado
→ lingote
→ peça
→ ferramenta ou máquina
```

### 6.2. Bancadas iniciais

| Construção | Função |
|---|---|
| Bancada simples | ferramentas iniciais |
| Pilão de pedra | quebrar minério bruto |
| Mesa de seleção | separar minério útil de cascalho |
| Fornalha simples | fundir minério preparado |
| Bigorna | criar peças simples |
| Caixa de carvão | armazenar combustível |

### 6.3. Fluxos por minério

#### Ferro

```txt
Minério bruto de ferro
→ minério quebrado de ferro
→ minério preparado de ferro
→ lingote de ferro
→ chapa, barra, engrenagem, ferramenta
```

#### Cobre

```txt
Minério bruto de cobre
→ minério quebrado de cobre
→ minério preparado de cobre
→ lingote de cobre
→ fio de cobre, tubo de cobre, componente elétrico
```

#### Carvão

```txt
Carvão bruto
→ carvão limpo
→ combustível
→ fundição, aço e energia inicial
```

#### Quartzo

```txt
Quartzo bruto
→ quartzo quebrado
→ sílica
→ vidro
→ sensor simples ou componente avançado
```

## 7. Metalurgia

### 7.1. Metais básicos

| Metal | Uso |
|---|---|
| Ferro | ferramentas, estruturas, máquinas simples |
| Cobre | fio, energia, motores e componentes |
| Estanho | bronze e peças leves |
| Chumbo | baterias e proteção industrial |
| Prata | componentes precisos |
| Ouro | componentes avançados e comércio |

### 7.2. Ligas

| Liga | Receita conceitual | Uso |
|---|---|---|
| Bronze | cobre + estanho | ferramentas melhores |
| Aço | ferro + carvão | máquinas, estruturas e ferramentas fortes |
| Latão | cobre + metal secundário | válvulas e tubos |
| Alumínio | bauxita processada | peças leves |
| Aço reforçado | aço + níquel | máquinas avançadas |
| Liga de titânio | titânio + processamento avançado | late game |

### 7.3. Produtos intermediários

| Produto | Uso |
|---|---|
| Chapa de ferro | máquinas e estruturas |
| Barra de ferro | construção e peças |
| Engrenagem | máquinas simples |
| Eixo | motores e transmissão |
| Parafuso | montagem |
| Tubo de cobre | fluídos e máquinas |
| Fio de cobre | energia |
| Bobina | motor e gerador |
| Placa metálica | estrutura |
| Componente mecânico | máquinas |
| Componente elétrico | energia |
| Circuito simples | automação inicial |

## 8. Energia

### 8.1. Entrada na energia

Antes da eletricidade, o jogador usa:

- trabalho manual;
- lenha;
- carvão;
- fornalha;
- operação por colono.

### 8.2. Geradores iniciais

| Gerador | Entrada | Saída |
|---|---|---|
| Gerador a lenha | madeira | energia fraca |
| Gerador a carvão | carvão | energia estável |
| Dínamo manual | trabalho de colono | energia emergencial |
| Roda d'água | água corrente | energia passiva |
| Motor a vapor | carvão + água | energia média |

### 8.3. Rede elétrica simples

Elementos:

- fio de cobre;
- poste simples;
- conector;
- bateria pequena;
- quadro de energia;
- fusível.

Problemas possíveis:

- falta de energia;
- consumo maior que geração;
- máquina parada;
- bateria descarregada;
- cabo insuficiente;
- sobrecarga simples.

## 9. Automação

### 9.1. Primeira mineradora

A mineradora automática só pode ser colocada em cima de um veio fixo.

Requisitos sugeridos:

- pesquisa Mineração Mecânica;
- energia básica;
- motor simples;
- chapa de ferro;
- engrenagens;
- fio de cobre;
- broca.

### 9.2. Tipos de mineradora

| Máquina | Papel |
|---|---|
| Mineradora assistida | colono opera, produz mais que manual |
| Mineradora MK1 | automática lenta |
| Mineradora MK2 | automática média |
| Mineradora pesada | alto consumo e alta produção |
| Broca profunda | depósitos subterrâneos |
| Escavadora industrial | late game |

### 9.3. Produção por pureza

| Pureza | Manual | Mineradora MK1 | Mineradora MK2 |
|---|---:|---:|---:|
| Impuro | 1 por ciclo | 20/h | 45/h |
| Normal | 1-2 por ciclo | 40/h | 90/h |
| Rico | 2-3 por ciclo | 80/h | 180/h |
| Excepcional | 3-4 por ciclo | 120/h | 270/h |

## 10. Esteiras e logística industrial

### 10.1. Peças de esteira

| Estrutura | Função |
|---|---|
| Esteira simples | move item devagar |
| Esteira rápida | move mais item por tempo |
| Divisor | divide fluxo |
| Unificador | junta fluxo |
| Entrada de máquina | recebe item |
| Saída de máquina | despeja item |
| Caixa industrial | buffer |
| Elevador simples | move entre níveis futuros |
| Filtro | separa item por tipo |

### 10.2. Linha básica

```txt
Veio de ferro
→ mineradora
→ esteira
→ britador
→ esteira
→ fornalha
→ esteira
→ caixa de lingotes
```

### 10.3. Linha intermediária

```txt
Veio de cobre
→ mineradora
→ britador
→ lavador
→ fundição
→ bobinadeira
→ caixa de fios
```

## 11. Máquinas industriais

| Máquina | Entrada | Saída |
|---|---|---|
| Britador | minério bruto | minério triturado + cascalho |
| Peneira | minério triturado | minério selecionado |
| Lavador | minério selecionado + água | minério limpo |
| Fornalha industrial | minério limpo + combustível | lingote |
| Fundição elétrica | minério limpo + energia | lingote |
| Prensa | lingote | chapa |
| Cortadora | chapa/barra | peça |
| Bobinadeira | cobre | fio/bobina |
| Montadora | peças | componente |
| Misturador | pó + líquido | composto |
| Refinaria | minério avançado | produto refinado |

## 12. Árvore de pesquisa sugerida

### Tier 0 — Sobrevivência mineral

- Coleta de pedra;
- ferramentas improvisadas;
- picareta de pedra;
- fornalha simples;
- bancada simples.

Desbloqueia:

- pedra;
- minério superficial;
- carvão bruto;
- picareta de pedra;
- fornalha simples.

### Tier 1 — Mineração manual

- Prospecção básica;
- martelo geológico;
- picareta de cobre;
- minério bruto;
- separação manual.

Desbloqueia:

- identificação de minério;
- minérios visíveis;
- mesa de seleção;
- minério quebrado;
- maior rendimento manual.

### Tier 2 — Metalurgia básica

- fundição de ferro;
- fundição de cobre;
- bigorna;
- ferramentas de metal;
- peças simples.

Desbloqueia:

- lingote de ferro;
- lingote de cobre;
- chapa;
- engrenagem;
- fio de cobre;
- picareta de ferro.

### Tier 3 — Ligas metálicas

- bronze;
- aço;
- carvão como combustível industrial;
- forno melhorado;
- peças mecânicas.

Desbloqueia:

- aço;
- bronze;
- ferramentas melhores;
- máquinas primitivas.

### Tier 4 — Energia inicial

- gerador a lenha;
- gerador a carvão;
- fio de cobre;
- bateria pequena;
- rede elétrica simples.

Desbloqueia:

- energia;
- cabos;
- bateria;
- máquinas elétricas simples.

### Tier 5 — Mineração mecânica

- broca mecânica;
- mineradora assistida;
- motor simples;
- britador;
- esteira simples.

Desbloqueia:

- mineradora manual assistida;
- britador;
- esteira;
- caixa industrial.

### Tier 6 — Automação industrial

- mineradora MK1;
- fundição elétrica;
- prensa;
- montadora;
- filtros.

Desbloqueia:

- produção automatizada básica;
- chapas;
- componentes;
- linha de produção.

### Tier 7 — Depósitos profundos

- scanner geológico;
- sonda;
- broca profunda;
- energia média;
- refinaria.

Desbloqueia:

- depósitos ocultos;
- recursos raros;
- mineração profunda.

### Tier 8 — Indústria avançada

- mineradora MK2;
- ligas avançadas;
- química mineral;
- turbina;
- automação com sensores.

Desbloqueia:

- produção em massa;
- circuitos avançados;
- máquinas pesadas.

### Tier 9 — Late game

- titânio;
- minério energético raro;
- fábrica autônoma;
- logística inteligente;
- refinamento avançado.

## 13. Assets simples

A primeira versão deve usar assets simples, sem travar o projeto por visual complexo.

### 13.1. Minérios no chão

Visual sugerido:

- rocha cinza com detalhe colorido;
- ferro: vermelho escuro;
- cobre: laranja/verde;
- carvão: preto;
- ouro: amarelo;
- quartzo: branco/translúcido;
- bauxita: vermelho/terra;
- recurso energético raro: verde discreto.

### 13.2. Veios fixos

Visual sugerido:

- rocha maior;
- rachaduras coloridas;
- leve brilho;
- marcador pequeno de pureza.

### 13.3. Máquinas

Visual simples:

- mineradora MK1: caixa metálica com broca;
- britador: caixa pesada com boca mecânica;
- fornalha industrial: bloco escuro com calor interno;
- esteira: faixa escura com setas;
- gerador: caixa com chaminé;
- bateria: bloco com símbolo elétrico;
- prensa: estrutura vertical simples.

## 14. Ordem recomendada de implementação

### Pacote 1 — Mineração manual expandida

Objetivo: fazer o manual ficar divertido antes da automação.

Implementar:

- novos itens de minério bruto;
- veios fixos superficiais;
- pureza de veio;
- prompt manual com E para minerar veio;
- rendimento por ferramenta;
- subprodutos básicos;
- cansaço maior para mineração.

Arquivos prováveis:

- `src/game/data/items.js`
- `src/game/data/objects.js`
- `src/game/data/recipes.js`
- `src/game/systems/geology-system.js`
- `src/game/systems/manual-control-system.js`

### Pacote 2 — Processamento manual

Implementar:

- pilão de pedra;
- mesa de seleção;
- fornalha simples;
- bigorna;
- minério bruto para minério preparado;
- minério preparado para lingote;
- lingote para peças.

### Pacote 3 — Pesquisa de metalurgia

Implementar:

- Prospecção Básica;
- Mineração Manual;
- Fundição Básica;
- Metalurgia do Ferro;
- Cobre e Energia Inicial;
- Ligas Simples.

### Pacote 4 — Energia inicial

Implementar:

- fio de cobre;
- gerador simples;
- bateria pequena;
- consumo por máquina;
- painel simples de energia.

### Pacote 5 — Primeiras máquinas

Implementar:

- britador;
- mineradora assistida;
- mineradora MK1;
- caixa industrial;
- fornalha industrial.

### Pacote 6 — Esteiras

Implementar:

- esteira simples;
- direção;
- entrada e saída;
- buffer;
- item viajando visualmente;
- conexão com máquinas.

### Pacote 7 — Automação real

Implementar fluxo:

```txt
veio fixo
→ mineradora
→ esteira
→ britador
→ fornalha
→ caixa industrial
```

### Pacote 8 — Refinamento avançado

Implementar:

- lavador;
- prensa;
- bobinadeira;
- montadora;
- circuito simples;
- liga avançada.

## 15. MVP recomendado

A primeira entrega jogável deve ser pequena, mas com loop completo.

MVP:

1. gerar veios fixos de ferro, cobre e carvão;
2. permitir minerar manualmente com E;
3. adicionar minério bruto;
4. adicionar pilão ou bancada de quebra;
5. adicionar fornalha simples;
6. gerar lingote;
7. criar chapa/fio/engrenagem;
8. usar esses componentes em uma construção nova.

Loop mínimo:

```txt
achar veio
→ minerar com E
→ quebrar minério
→ fundir
→ criar peça
→ construir melhoria
```

## 16. Observações para o patch de desempenho antes desta frente

Antes de implementar mineração industrial, revisar desempenho em:

- renderização de tile;
- renderização de objetos;
- loops por todos os objetos;
- loops por todos os mobs;
- ticks diários do mundo vivo;
- pathfinding;
- fog of war;
- lookup de objeto por tile;
- colisão;
- overlays de geologia e mundo vivo.

A automação futura vai aumentar muito a quantidade de objetos/ticks. Então o patch de desempenho precisa preparar o jogo para:

- muitos itens no mapa;
- muitas máquinas;
- esteiras atualizando por tick;
- redes de energia;
- produção contínua;
- pathfinding com base maior;
- mundo vivo ativo ao mesmo tempo.
