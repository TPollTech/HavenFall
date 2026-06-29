# Roadmap — Sistema Universal de Inspeção / Seleção de Entidades

## 1. Visão geral

O sistema atual de clicar duas vezes no colono para abrir informações deve ser removido e reconstruído como um sistema novo, mais amplo, padronizado e expansível.

A nova feature será chamada conceitualmente de:

```txt
Sistema Universal de Inspeção
```

A ideia principal:

```txt
Clicou em algo do mundo → aparece um painel com informações úteis desse alvo.
```

Esse “algo” pode ser:

* colono;
* animal;
* inimigo/hostile;
* construção;
* estação de trabalho;
* recurso natural;
* item no chão;
* corpo/entidade caída;
* plantação;
* ruína;
* baú/cache;
* tile do terreno;
* zona;
* porta/parede/cama/fogueira;
* qualquer entidade futura.

O objetivo é parar de ter uma UI específica e quebrada para cada coisa, e criar uma base única.

---

# 2. Objetivo principal

Criar um sistema onde **um clique simples** em qualquer entidade do jogo seleciona o alvo e mostra suas informações em um painel compacto, contextual e não invasivo.

Exemplo:

```txt
Clique em colono → painel de colono
Clique em animal → painel de animal
Clique em árvore → painel de recurso
Clique em fogueira → painel de construção
Clique em inimigo → painel de ameaça
Clique em chão vazio → painel de terreno
```

---

# 3. Problema atual

Hoje existe uma feature parcial:

```txt
duplo clique em colono → mostra informações do colono
```

Problemas:

* depende de duplo clique;
* funciona basicamente só para colono;
* não serve para animais;
* não serve para inimigos;
* não serve para objetos do mundo;
* provavelmente usa lógica isolada;
* não segue um padrão único;
* pode conflitar com seleção, tarefas e construção;
* dificulta expansão futura.

O novo sistema deve substituir essa abordagem.

---

# 4. Nova regra de interação

## 4.1. Clique simples

Um clique simples deve:

```txt
selecionar o alvo
abrir/atualizar o painel de inspeção
destacar visualmente o alvo
```

Exemplo:

```txt
Clique em Lia
→ Lia fica destacada
→ painel mostra idade, saúde, fome, energia, humor, tarefa atual, habilidades e características
```

---

## 4.2. Clique em outro alvo

Ao clicar em outra coisa:

```txt
painel troca instantaneamente para o novo alvo
seleção anterior é removida
novo alvo fica destacado
```

---

## 4.3. Clique em chão vazio

Existem duas opções.

### Opção recomendada

Clique em chão vazio mostra informações do tile:

```txt
Terreno: Grama
Coordenada: X/Y
Zona: nenhuma
Explorado: sim
Construível: sim
Fertilidade: média
```

Isso deixa o sistema “universal de verdade”.

---

## 4.4. Esc

A tecla `Esc` deve:

```txt
fechar painel de inspeção
limpar seleção
```

Mas com cuidado: se o jogo já usa `Esc` para cancelar construção/menu, precisa obedecer prioridade.

Prioridade sugerida:

```txt
1. Se construção ativa → cancela construção
2. Se modal aberto → fecha modal
3. Se painel de inspeção aberto → fecha painel
4. Se nada aberto → abre menu de pausa
```

---

## 4.5. Duplo clique

O duplo clique deve deixar de ser obrigatório.

Pode ser reaproveitado futuramente para:

```txt
centralizar câmera no alvo
seguir colono
abrir painel avançado
```

Mas a informação principal precisa aparecer com **um clique só**.

---

# 5. Posição ideal do painel

O painel não pode atrapalhar o HUD inferior, nem cobrir totalmente o mapa.

## 5.1. Opções possíveis

### Canto inferior esquerdo

Boa opção porque:

* fica perto do HUD;
* não cobre topo de recursos;
* parece painel de jogo de estratégia;
* fácil de ver sem tirar foco do mapa.

Problema:

* pode conflitar com menus do HUD se o rodapé crescer.

---

### Canto direito

Boa opção porque:

* lembra painel de inspeção de RimWorld;
* deixa o mapa livre;
* bom para conteúdo vertical.

Problema:

* pode cobrir o alvo em telas pequenas.

---

### Painel flutuante lateral adaptativo

Melhor opção.

Regra:

```txt
Desktop largo → painel no canto inferior esquerdo ou lateral direita.
Tela menor → painel compacto acima do HUD.
Mobile/tablet → painel vira drawer recolhível.
```

---

## 5.2. Recomendação inicial

Para desktop:

```txt
canto inferior esquerdo, acima do HUD
```

Layout:

```txt
┌───────────────────────────────┐
│ Lia                            │
│ Colona · 24 anos · Coletora    │
├───────────────────────────────┤
│ Saúde 100%   Energia 82%      │
│ Fome 78%     Humor 76%        │
├───────────────────────────────┤
│ Tarefa atual: coletando madeira│
│ Estado: saudável              │
├───────────────────────────────┤
│ Características               │
│ resistente · calmo · teimoso   │
└───────────────────────────────┘
```

---

# 6. Comportamento visual do alvo selecionado

Todo alvo selecionado precisa ter feedback visual.

## 6.1. Colono selecionado

Visual sugerido:

```txt
anel azul/ciano no chão
nome acima
pequeno brilho de seleção
```

---

## 6.2. Animal selecionado

Visual sugerido:

```txt
anel verde ou neutro
nome/tipo acima
```

---

## 6.3. Inimigo selecionado

Visual sugerido:

```txt
anel vermelho
ícone de perigo
barra de saúde visível
```

---

## 6.4. Objeto/recurso selecionado

Visual sugerido:

```txt
contorno amarelo
ícone pequeno de informação
```

---

## 6.5. Tile selecionado

Visual sugerido:

```txt
quadrado/losango semi-transparente no tile
```

---

# 7. Arquitetura conceitual

O sistema precisa separar três coisas:

```txt
1. Detecção do clique
2. Resolução do alvo clicado
3. Renderização do painel de informações
```

Não misturar tudo no mesmo arquivo.

---

# 8. Fluxo técnico ideal

```txt
Usuário clica no canvas
 ↓
Sistema calcula tile/mundo clicado
 ↓
Sistema procura entidades naquele ponto
 ↓
Sistema decide qual entidade tem prioridade
 ↓
Cria uma referência de seleção
 ↓
Atualiza painel de inspeção
 ↓
Renderiza destaque no alvo
```

---

# 9. Estrutura de seleção

Criar um estado único para seleção.

Sugestão:

```js
selectedInspectionTarget = {
  kind: 'colonist',
  id: 1,
  ref: objectReference,
  x: 42,
  y: 31,
  selectedAt: performance.now()
};
```

Ou dentro de `state.ui`:

```js
state.ui.inspection = {
  open: true,
  targetKind: 'colonist',
  targetId: 1,
  pinned: false,
  tab: 'overview'
};
```

---

# 10. Tipos de alvo

## 10.1. Colono

```txt
kind: 'colonist'
```

Dados exibidos:

* nome;
* idade;
* função;
* sprite/aparência;
* saúde;
* fome;
* energia;
* humor;
* tarefa atual;
* prioridade de trabalho;
* habilidade principal;
* características físicas;
* características positivas;
* características negativas;
* equipamento;
* estado atual;
* localização;
* comando atual;
* necessidades;
* bônus/penalidades.

---

## 10.2. Animal

```txt
kind: 'animal'
```

Dados exibidos:

* espécie;
* nome, se domesticado;
* idade/fase de vida;
* sexo, se existir futuramente;
* saúde;
* fome;
* comportamento;
* estado: selvagem, domesticado, hostil, fugindo, dormindo;
* perigo;
* recurso possível: carne, couro, etc.;
* filhote/adulto/idoso;
* bioma natural;
* se pode ser domesticado;
* se está ferido;
* se está agressivo.

---

## 10.3. Inimigo / hostile

```txt
kind: 'hostile'
```

Dados exibidos:

* nome/tipo;
* facção;
* nível de ameaça;
* saúde;
* arma/equipamento;
* comportamento;
* alvo atual;
* distância da base;
* estado: patrulhando, atacando, fugindo, ferido;
* intenção;
* possíveis drops;
* resistência.

Mesmo que ainda não exista inimigo, o sistema deve nascer preparado.

---

## 10.4. Objeto de recurso

```txt
kind: 'resourceNode'
```

Exemplos:

* árvore;
* pedra;
* minério;
* frutas;
* arbusto;
* toras;
* ervas.

Dados exibidos:

* nome;
* tipo;
* recurso gerado;
* quantidade estimada;
* trabalho necessário;
* bloqueia movimento ou não;
* marcado para coleta;
* ordem disponível;
* estado de respawn, se tiver.

---

## 10.5. Construção

```txt
kind: 'building'
```

Exemplos:

* cama;
* fogueira;
* depósito;
* bancada;
* mesa de pesquisa;
* parede;
* porta;
* plantação;
* forja;
* fogão;
* estação médica.

Dados exibidos:

* nome;
* tipo;
* integridade;
* função;
* estado atual;
* ocupada/livre;
* combustível, se aplicável;
* temperatura/luz, se aplicável;
* receitas disponíveis;
* produção atual;
* armazenamento;
* dono/usuário, se aplicável;
* ações disponíveis.

---

## 10.6. Blueprint

```txt
kind: 'blueprint'
```

Dados exibidos:

* construção planejada;
* progresso;
* materiais necessários;
* materiais já entregues;
* trabalho restante;
* construtor atribuído;
* cancelar construção.

---

## 10.7. Item no chão

```txt
kind: 'item'
```

Dados exibidos:

* nome;
* quantidade;
* categoria;
* qualidade, se existir;
* peso, se existir;
* deterioração, se existir;
* pode ser coletado;
* destino de armazenamento.

---

## 10.8. Ponto de interesse

```txt
kind: 'poi'
```

Exemplos:

* ruína;
* cache;
* caixa de suprimentos;
* estação abandonada.

Dados exibidos:

* nome;
* tipo;
* descoberto/inspecionado;
* risco;
* recompensa esperada;
* trabalho necessário;
* evento associado;
* status.

---

## 10.9. Tile do terreno

```txt
kind: 'tile'
```

Dados exibidos:

* tipo de terreno;
* coordenadas;
* bioma;
* zona;
* fertilidade;
* construível;
* caminhável;
* iluminado, se existir;
* temperatura local, se existir;
* roof/cobertura, se existir;
* exploração: desconhecido, visto, visível.

---

# 11. Prioridade de clique

Quando várias coisas estão no mesmo tile, precisa existir prioridade.

Exemplo:

```txt
colono em cima de recurso
animal perto de colono
objeto atrás de construção
```

## 11.1. Prioridade sugerida

```txt
1. Modal/UI aberta
2. Context menu
3. Colono
4. Hostile
5. Animal
6. Objeto/construção
7. Item no chão
8. Recurso natural
9. POI
10. Tile do terreno
```

Mas existe uma nuance:

```txt
Hostile pode ter prioridade maior que colono se estiver exatamente no clique e visivelmente sobreposto.
```

Para o Alpha:

```txt
Colono > Hostile > Animal > Objeto > Tile
```

---

# 12. Área de clique / hitbox

Não pode depender só do tile exato, porque sprites ocupam mais que um tile visualmente.

## 12.1. Colono

Clique deve detectar:

```txt
círculo ao redor do corpo
```

Exemplo:

```js
distância entre clique e centro do colono < 22px
```

---

## 12.2. Animal

Animais podem ter tamanhos diferentes.

Exemplo:

```js
rabbit: raio 14
wolf: raio 22
cow: raio 28
```

---

## 12.3. Construções

Construções devem usar:

```txt
tile ocupado
largura/altura se multi-tile no futuro
```

---

## 12.4. Objetos altos

Árvore pode estar visualmente acima do tile.

Precisa considerar:

```txt
base tile + altura visual do sprite
```

Caso contrário, clicar na copa da árvore não seleciona.

---

# 13. Painel de inspeção — layout geral

## 13.1. Estrutura padrão

Todo painel deve ter:

```txt
Cabeçalho
Status principal
Resumo
Detalhes
Ações rápidas
```

Exemplo:

```txt
┌───────────────────────────────┐
│ Nome do alvo              [x] │
│ Tipo · subtipo                │
├───────────────────────────────┤
│ Status principal              │
├───────────────────────────────┤
│ Blocos de dados               │
├───────────────────────────────┤
│ Ações                         │
└───────────────────────────────┘
```

---

## 13.2. Cabeçalho

Deve mostrar:

* nome;
* tipo;
* ícone;
* botão fechar;
* botão fixar, futuramente.

Exemplo:

```txt
Lia
Colona · Coletora · 24 anos
```

---

## 13.3. Barras principais

Para seres vivos:

```txt
Saúde
Fome
Energia
Humor
```

Para construções:

```txt
Integridade
Progresso
Combustível
Produção
```

Para recursos:

```txt
Trabalho restante
Rendimento estimado
```

---

## 13.4. Chips/etiquetas

Usar chips para características.

Exemplo colono:

```txt
resistente
calmo
teimoso
mãos firmes
```

Exemplo animal:

```txt
selvagem
adulto
ferido
medroso
```

Exemplo hostile:

```txt
agressivo
armado
ferido
perigoso
```

---

# 14. Abas dentro do painel

O painel pode começar simples, mas deve ser preparado para abas.

## 14.1. Colono

Abas possíveis:

```txt
Resumo
Necessidades
Habilidades
Equipamento
Tarefas
Histórico
```

Na primeira versão, pode mostrar tudo em uma rolagem curta.

---

## 14.2. Animal

Abas possíveis:

```txt
Resumo
Saúde
Comportamento
Domesticação
Recursos
```

---

## 14.3. Hostile

Abas possíveis:

```txt
Resumo
Ameaça
Equipamento
Comportamento
Drops
```

---

## 14.4. Construção

Abas possíveis:

```txt
Resumo
Produção
Armazenamento
Manutenção
Ações
```

---

# 15. Ações rápidas

O painel não deve ser só informativo. Ele pode permitir ações.

## 15.1. Colono

Ações:

```txt
Selecionar
Seguir câmera
Prioridades
Descansar
Mandar para tarefa
Abrir ficha completa
```

Primeira versão:

```txt
Seguir
Centralizar
```

---

## 15.2. Animal

Ações futuras:

```txt
Caçar
Domesticar
Observar
Marcar como ameaça
```

---

## 15.3. Hostile

Ações futuras:

```txt
Atacar
Evitar
Marcar alvo
Priorizar defesa
```

---

## 15.4. Recurso

Ações:

```txt
Coletar
Cancelar coleta
Priorizar
```

---

## 15.5. Construção

Ações:

```txt
Priorizar
Cancelar
Desconstruir
Reparar
Abrir produção
```

---

## 15.6. Tile

Ações:

```txt
Mover para cá
Construir aqui
Marcar zona
```

Cuidado: não transformar tudo em botão de uma vez. Primeiro informativo, depois ações.

---

# 16. Informação por tipo de entidade

## 16.1. Colono — dados detalhados

### Identidade

```txt
Nome
Idade
Função
Preferência de trabalho
Classe/preset
```

### Condição

```txt
Saúde
Fome
Energia
Humor
Temperatura corporal, futuro
Ferimentos, futuro
Doenças, futuro
```

### Estado atual

```txt
Tarefa
Alvo da tarefa
Caminho atual
Está ocioso?
Está dormindo?
Está comendo?
Está trabalhando?
```

### Características

```txt
Traços físicos
Traços positivos
Traços negativos
```

### Habilidades

```txt
Coleta
Construção
Defesa
Pesquisa
Medicina
Culinária, futuro
Crafting, futuro
```

### Equipamento

```txt
Ferramenta
Arma
Offhand
Armadura, futuro
```

### Relação com gameplay

```txt
Velocidade de trabalho
Bônus aplicáveis
Penalidades
Prioridades
```

---

## 16.2. Animal — dados detalhados

### Identidade

```txt
Espécie
Nome, se tiver
Fase de vida
Selvagem/domesticado
```

### Fase de vida

```txt
Filhote
Jovem
Adulto
Idoso
```

### Condição

```txt
Saúde
Fome
Energia, se aplicável
Ferimentos
Medo/agressividade
```

### Comportamento

```txt
Pastando
Fugindo
Dormindo
Caçando
Seguindo grupo
Atacando
```

### Relação com jogador

```txt
Neutro
Hostil
Domesticável
Domesticado
Ameaça
```

### Recompensas/uso

```txt
Carne
Couro
Leite, futuro
Ovos, futuro
Lã, futuro
```

---

## 16.3. Hostile — dados detalhados

### Identidade

```txt
Nome/tipo
Facção
Classe
Nível de ameaça
```

### Condição

```txt
Saúde
Ferimentos
Moral
Estado de combate
```

### Comportamento

```txt
Patrulhando
Perseguindo
Atacando
Fugindo
Invadindo
Investigando
```

### Alvo

```txt
Alvo atual
Distância da base
Última posição conhecida
```

### Equipamento

```txt
Arma
Armadura
Ferramentas
Drops possíveis
```

---

## 16.4. Construção — dados detalhados

### Identidade

```txt
Nome
Categoria
Função
```

### Estado

```txt
Integridade
Ligado/desligado
Ocupado/livre
Em uso por quem
```

### Produção

```txt
Receita atual
Progresso
Entrada
Saída
Tempo restante
```

### Manutenção

```txt
Precisa reparar?
Precisa combustível?
Precisa recurso?
Está bloqueada?
```

---

## 16.5. Recurso natural — dados detalhados

### Identidade

```txt
Nome
Tipo
Bioma
```

### Coleta

```txt
Recurso produzido
Quantidade estimada
Trabalho necessário
Ferramenta recomendada
Marcado para coleta?
```

### Estado

```txt
Bloqueia passagem?
Pode regenerar?
Está esgotado?
```

---

# 17. Painel compacto vs ficha completa

O painel no canto deve ser compacto.

Mas futuramente pode existir:

```txt
Abrir ficha completa
```

## 17.1. Painel compacto

Serve para:

```txt
consulta rápida
estado atual
ações básicas
```

## 17.2. Ficha completa

Serve para:

```txt
detalhes profundos
histórico
equipamento
prioridades
relações
biografia
```

Para agora, o foco é o painel compacto.

---

# 18. Atualização em tempo real

O painel precisa atualizar enquanto o alvo muda.

Exemplo:

```txt
Colono está com fome 78%
passa tempo
painel atualiza para 77%
```

Não precisa atualizar a cada frame. Pode atualizar:

```txt
a cada 250ms ou 500ms
```

Ou junto com `updateUI`.

---

# 19. Alvo inexistente ou removido

Se o alvo selecionado deixar de existir:

Exemplos:

```txt
árvore foi coletada
animal morreu/fugiu
inimigo saiu da visão
objeto foi destruído
```

O painel deve:

```txt
fechar automaticamente
```

ou mostrar:

```txt
Alvo não disponível
```

Recomendação:

```txt
Se objeto foi removido → fechar painel e limpar seleção.
Se hostile saiu da visão → painel mostra “última posição conhecida” futuramente.
```

---

# 20. Fog of war e visibilidade

Não deve mostrar informações completas de algo não visível.

## 20.1. Entidade visível

Mostrar dados completos.

## 20.2. Entidade descoberta, mas não visível

Mostrar dados limitados:

```txt
Última vez visto: Dia 3, 08:00
Estado atual: desconhecido
```

## 20.3. Entidade nunca descoberta

Não deve ser clicável.

---

# 21. Animais e entidades móveis

Animais podem se mover. Então a seleção não pode depender só do tile salvo na hora do clique.

Deve ser por ID.

Exemplo:

```js
selectedInspectionTarget = {
  kind: 'animal',
  id: animal.id
};
```

A cada atualização, o painel resolve novamente:

```js
findAnimalById(id)
```

---

# 22. Entidades sem ID

Todo objeto selecionável precisa ter ID.

Se alguma entidade não tiver ID:

```txt
gerar ou garantir ID na criação
```

Exemplos:

* objetos já usam `worldUid`;
* colonos já têm `id`;
* mobs/animais precisam garantir `id`;
* itens no chão precisam ter `id`.

---

# 23. Compatibilidade com sistemas atuais

O sistema não pode quebrar:

```txt
ordens manuais
construção
seleção de colono
coleta
context menu
painel inferior
tab “Selecionado”
modal de colono atual
```

## 23.1. Seleção de colono atual

Hoje provavelmente existe:

```js
selectedColonistId
```

O novo sistema deve respeitar isso.

Ao clicar em colono:

```js
selectedColonistId = colono.id
inspectionTarget = { kind: 'colonist', id: colono.id }
```

Assim os sistemas que dependem de colono selecionado continuam funcionando.

---

## 23.2. Painel “Selecionado” do HUD

Existem duas opções.

### Opção A — Manter tab “Selecionado” como complemento

O painel flutuante mostra resumo rápido.

A tab “Selecionado” mostra detalhes maiores.

### Opção B — Remover tab “Selecionado” futuramente

Não recomendado agora.

Recomendação:

```txt
Manter tab Selecionado por enquanto.
Criar painel flutuante novo.
Depois decidir se a tab ainda faz sentido.
```

---

# 24. Canvas input

O clique no mundo precisa seguir uma ordem clara.

## 24.1. Quando estiver construindo

Se `currentBuild` estiver ativo:

```txt
clique coloca blueprint
não abre inspeção
```

Ou, se o jogador usar botão direito:

```txt
botão direito inspeciona
```

Para Alpha:

```txt
Construção ativa tem prioridade sobre inspeção.
```

---

## 24.2. Quando tiver seleção de coleta

Se estiver arrastando seleção de coleta:

```txt
não abrir painel em cada tile
```

---

## 24.3. Clique normal sem modo ativo

```txt
abre inspeção
```

---

# 25. Sistema de hit test

Criar uma função central:

```js
function resolveInspectionTargetAt(worldX, worldY) {
  return (
    hitColonist(worldX, worldY) ||
    hitHostile(worldX, worldY) ||
    hitAnimal(worldX, worldY) ||
    hitObject(worldX, worldY) ||
    hitItem(worldX, worldY) ||
    hitTile(worldX, worldY)
  );
}
```

Essa função vira o coração do sistema.

---

# 26. Adaptadores de dados

Cada tipo precisa ter um adaptador que transforma dados crus em dados de UI.

Exemplo:

```js
function inspectColonist(c) {
  return {
    title: c.name,
    subtitle: `${c.role} · ${c.age} anos`,
    bars: [],
    sections: [],
    actions: []
  };
}
```

O painel não deve conhecer diretamente todos os detalhes internos de cada entidade.

Ele deve receber um modelo padronizado.

---

# 27. Modelo de UI padronizado

Todos os adaptadores devem retornar algo parecido com:

```js
{
  title: 'Lia',
  subtitle: 'Colona · Coletora · 24 anos',
  kind: 'colonist',
  icon: 'person',
  status: 'Saudável',
  dangerLevel: 0,

  bars: [
    { label: 'Saúde', value: 100, max: 100 },
    { label: 'Fome', value: 78, max: 100 },
    { label: 'Energia', value: 82, max: 100 },
    { label: 'Humor', value: 76, max: 100 }
  ],

  chips: ['resistente', 'calmo', 'teimoso'],

  sections: [
    {
      title: 'Estado atual',
      rows: [
        ['Tarefa', 'Coletando madeira'],
        ['Prioridade', 'Coleta'],
        ['Localização', '42, 31']
      ]
    }
  ],

  actions: [
    { id: 'follow', label: 'Seguir' },
    { id: 'center', label: 'Centralizar' }
  ]
}
```

---

# 28. Vantagem desse modelo

Com esse padrão:

```txt
o painel é um só
cada entidade só precisa de um adaptador
novos sistemas entram fácil
```

Exemplo futuro:

```txt
inspectHostile()
inspectVehicle()
inspectNPC()
inspectMachine()
inspectTradeCaravan()
```

---

# 29. Visual do painel

## 29.1. Estilo

Combinar com HUD atual:

```txt
fundo escuro translúcido
borda azul escura
detalhes dourados/ciano
texto claro
chips pequenos
barras horizontais
```

---

## 29.2. Tamanho

Desktop:

```txt
largura: 300–380px
altura máxima: 45vh
scroll interno se passar
```

Mobile/tablet:

```txt
largura: quase tela toda
posição: bottom drawer
altura: 35–50vh
```

---

# 30. Painel fechado/recolhido

O painel pode ter:

```txt
botão X
botão minimizar
botão fixar
```

## 30.1. Fechar

Limpa seleção.

## 30.2. Minimizar

Fica só uma barrinha com nome do alvo.

## 30.3. Fixar

Futuramente, permitir manter painel mesmo clicando em outro lugar.

Para Alpha:

```txt
apenas X já basta
```

---

# 31. Painel para colono — exemplo completo

```txt
┌────────────────────────────────────┐
│ Lia                            X   │
│ Colona · Coletora · 24 anos         │
├────────────────────────────────────┤
│ Saúde   ██████████ 100%             │
│ Fome    ███████░░░ 78%              │
│ Energia ████████░░ 82%              │
│ Humor   ███████░░░ 76%              │
├────────────────────────────────────┤
│ Estado atual                        │
│ Tarefa: Coletando madeira           │
│ Prioridade: Coleta                  │
│ Local: 42,31                        │
├────────────────────────────────────┤
│ Características                     │
│ resistente · calmo · teimoso         │
├────────────────────────────────────┤
│ Habilidades                         │
│ Coleta 8 · Construção 4 · Defesa 3  │
│ Pesquisa 2 · Medicina 3             │
├────────────────────────────────────┤
│ [Centralizar] [Seguir]              │
└────────────────────────────────────┘
```

---

# 32. Painel para animal — exemplo completo

```txt
┌────────────────────────────────────┐
│ Coelho selvagem                X   │
│ Animal · Adulto · Neutro           │
├────────────────────────────────────┤
│ Saúde   █████████░ 92%              │
│ Fome    ██████░░░░ 64%              │
├────────────────────────────────────┤
│ Estado                              │
│ Comportamento: Pastando             │
│ Relação: Selvagem                   │
│ Perigo: Baixo                       │
├────────────────────────────────────┤
│ Informações                         │
│ Fase: Adulto                        │
│ Bioma: Floresta temperada           │
│ Domesticável: Não implementado      │
├────────────────────────────────────┤
│ [Observar]                          │
└────────────────────────────────────┘
```

---

# 33. Painel para hostile — exemplo futuro

```txt
┌────────────────────────────────────┐
│ Lobo raivoso                   X   │
│ Hostil · Ameaça moderada           │
├────────────────────────────────────┤
│ Saúde   ██████░░░░ 61%              │
│ Moral   ███████░░░ 74%              │
├────────────────────────────────────┤
│ Combate                             │
│ Estado: Perseguindo                 │
│ Alvo: Lia                           │
│ Distância da base: 18 tiles         │
├────────────────────────────────────┤
│ Perigo                              │
│ Velocidade alta                     │
│ Dano corpo a corpo                  │
├────────────────────────────────────┤
│ [Marcar alvo] [Evitar]              │
└────────────────────────────────────┘
```

---

# 34. Painel para recurso — exemplo

```txt
┌────────────────────────────────────┐
│ Carvalho                       X   │
│ Recurso natural · Madeira          │
├────────────────────────────────────┤
│ Trabalho ███░░░░░░░ 3.2             │
├────────────────────────────────────┤
│ Coleta                              │
│ Produz: 8 madeira                   │
│ Bloqueia passagem: Sim              │
│ Marcado para coleta: Não            │
├────────────────────────────────────┤
│ [Coletar] [Priorizar]               │
└────────────────────────────────────┘
```

---

# 35. Painel para construção — exemplo

```txt
┌────────────────────────────────────┐
│ Fogueira                       X   │
│ Construção · Calor                 │
├────────────────────────────────────┤
│ Integridade ██████████ 100%         │
├────────────────────────────────────┤
│ Estado                              │
│ Acesa: Sim                          │
│ Aquecimento: +1                     │
│ Bloqueia passagem: Sim              │
├────────────────────────────────────┤
│ [Desconstruir] [Priorizar]          │
└────────────────────────────────────┘
```

---

# 36. Painel para tile — exemplo

```txt
┌────────────────────────────────────┐
│ Terreno                        X   │
│ Grama · Coordenada 42,31           │
├────────────────────────────────────┤
│ Informações                         │
│ Caminhável: Sim                     │
│ Construível: Sim                    │
│ Zona: nenhuma                       │
│ Exploração: visível                 │
│ Bioma: Floresta temperada           │
└────────────────────────────────────┘
```

---

# 37. Hostiles — preparação futura

Mesmo sem inimigos implementados, deixar padrão pronto.

## 37.1. Dados mínimos para hostile futuro

```js
{
  id,
  type: 'raider',
  name: 'Saqueador',
  faction: 'Bandos',
  x,
  y,
  px,
  py,
  health,
  maxHealth,
  state,
  targetId,
  threatLevel,
  equipment,
  hostile: true
}
```

## 37.2. Adaptador futuro

```js
inspectHostile(hostile)
```

## 37.3. Hit test futuro

```js
hitHostile(worldX, worldY)
```

Mesmo que a lista esteja vazia agora:

```js
state.hostiles || []
```

---

# 38. Animais — dados necessários

Os animais precisam ter dados suficientes para inspeção.

Caso atualmente tenham poucos dados, adicionar gradualmente:

```js
{
  id,
  species,
  ageStage,
  health,
  maxHealth,
  hunger,
  behavior,
  temperament,
  domesticState
}
```

## 38.1. Fase de vida

```txt
baby
juvenile
adult
elder
```

Labels:

```txt
Filhote
Jovem
Adulto
Idoso
```

---

# 39. Integração com renderer

O renderer deve desenhar:

```txt
destaque do alvo selecionado
```

Funções possíveis:

```js
drawInspectionSelection()
drawSelectedEntityRing()
drawSelectedTileHighlight()
```

Ordem de renderização:

```txt
tiles
destaque de tile selecionado
objetos
animais
hostiles
colonos
anel/overlay de seleção
UI do mundo
```

O destaque precisa aparecer visível, mas não poluir.

---

# 40. Integração com input

Arquivos prováveis:

```txt
src/game/canvas-input-building.js
src/game/event-listeners.js
src/game/systems/manual-control-system.js
src/game/ui/colonist-modal.js
src/game/ui/hud-ui.js
src/game/renderer.js
```

Precisará localizar exatamente onde:

```txt
canvas.addEventListener('click')
dblclick
selectedColonistId
contextMenu
```

---

# 41. Integração com UI

Arquivos possíveis:

```txt
src/game/ui/inspection-panel.js
src/game/ui/hud-ui.js
src/game/styles.css
```

Criar arquivo novo é aceitável aqui porque é um sistema novo real, não uma versão paralela.

Nome recomendado:

```txt
src/game/ui/inspection-panel.js
```

Não usar:

```txt
inspection-v2.js
colonist-info-v2.js
```

---

# 42. Atualizar boot

Se criar `inspection-panel.js`, adicionar ao boot.

Mas com cuidado:

```txt
não duplicar sistema antigo
não carregar dois painéis conflitantes
não deixar modal antigo abrindo junto
```

---

# 43. Remover sistema antigo

Antes ou durante a implementação, localizar e remover/desativar:

```txt
duplo clique de colono
modal antigo de colono
handler antigo de ficha
qualquer função isolada que abre info apenas de colono
```

Mas não apagar às cegas.

Processo correto:

```txt
1. localizar eventos de dblclick
2. localizar openColonistModal / showColonistModal
3. verificar se é usado em outro lugar
4. substituir pelo novo inspectionTarget
5. manter fallback se necessário
```

---

# 44. Compatibilidade com o tab Colonos

Clicar no card de um colono na aba Colonos também deve abrir inspeção.

Exemplo:

```txt
clicou no card da Lia no HUD
→ seleciona Lia
→ painel de inspeção abre
→ câmera pode centralizar ou não
```

Regra:

```txt
clicar no card seleciona e abre painel
duplo clique no card pode centralizar
```

---

# 45. Compatibilidade com mapa e mundo

Futuramente, no Mapa Local:

```txt
clicar em ícone de colono → abre inspeção
clicar em animal → abre inspeção
clicar em ameaça → abre inspeção
```

O sistema deve ser reaproveitado.

---

# 46. Performance

## 46.1. Hit test

Não testar tudo de forma pesada se tiver muitas entidades.

Primeira versão pode fazer loop simples porque ainda tem poucas entidades.

Depois:

```txt
índice espacial por tile
quadtree
mapa de ocupação
```

---

## 46.2. Atualização do painel

Não reconstruir HTML inteiro a cada frame.

Opções:

```txt
atualizar ao selecionar
atualizar a cada 500ms enquanto aberto
atualizar quando updateUI(true)
```

Recomendado:

```txt
render completo ao selecionar
refresh leve a cada 500ms
```

---

# 47. Estados do painel

```js
inspectionState = {
  open: false,
  targetKind: null,
  targetId: null,
  lastRenderAt: 0,
  pinned: false,
  compact: false
}
```

Estados:

```txt
closed
open
minimized
stale
target_missing
```

---

# 48. Estado “stale”

Quando o alvo não está visível, mas ainda existe:

```txt
Informações podem estar desatualizadas.
Última posição conhecida: X,Y.
```

Para Alpha, pode apenas fechar.

---

# 49. Tratamento de erros

O painel não pode quebrar o jogo se um dado estiver faltando.

Exemplo:

```js
c.age ?? 'idade desconhecida'
c.health ?? 100
animal.health ?? animal.hp ?? 100
```

Se adaptador falhar:

```txt
mostrar painel genérico
logar erro no console
não quebrar gameLoop
```

---

# 50. Painel genérico

Qualquer entidade desconhecida deve ter fallback.

```txt
Objeto desconhecido
Tipo: xyz
Coordenada: X,Y
ID: abc
```

Isso ajuda debug.

---

# 51. Dados ocultos e debug

Para gameplay normal, não mostrar ID técnico.

Mas em modo debug:

```txt
ID
tipo interno
posição exata
estado bruto
```

---

# 52. Responsividade

## Desktop

Painel flutuante compacto.

## Tela menor

Painel acima do HUD.

## Mobile/tablet

Drawer inferior com swipe/fechar.

---

# 53. Acessibilidade visual

Usar:

* textos curtos;
* ícones com label;
* barras com percentual;
* cores não sendo a única informação;
* contraste alto;
* botão fechar claro.

---

# 54. Sons e feedback

Futuro:

```txt
som leve ao selecionar
som diferente para hostile
som de erro ao clicar em alvo inválido
```

Não obrigatório agora.

---

# 55. Fases de implementação

## Fase 1 — Remover dependência de duplo clique

Objetivo:

```txt
um clique simples já seleciona colono e abre painel novo
```

Tarefas:

* localizar handler atual de duplo clique;
* impedir abertura do modal antigo;
* criar estado de inspeção;
* criar painel básico;
* clicar em colono abre painel.

Critério de sucesso:

```txt
clicar uma vez no colono mostra painel com nome, idade, vida, fome, energia e humor
```

---

## Fase 2 — Modelo padronizado de inspeção

Objetivo:

```txt
painel receber dados padronizados
```

Tarefas:

* criar adaptador `inspectColonist`;
* criar renderizador genérico;
* criar barras;
* criar seções;
* criar chips;
* criar ações.

Critério de sucesso:

```txt
painel não depende diretamente de colono
```

---

## Fase 3 — Seleção visual no mapa

Objetivo:

```txt
alvo selecionado fica destacado
```

Tarefas:

* desenhar anel em colono;
* desenhar contorno em objetos;
* desenhar tile selecionado;
* limpar destaque ao fechar.

Critério de sucesso:

```txt
o jogador sabe exatamente o que está selecionado
```

---

## Fase 4 — Animais

Objetivo:

```txt
clicar animal abre painel de animal
```

Tarefas:

* localizar estrutura atual de mobs/animais;
* garantir ID;
* criar `hitAnimal`;
* criar `inspectAnimal`;
* exibir espécie, fase, saúde e comportamento.

Critério de sucesso:

```txt
clicar em coelho/lobo/animal mostra ficha compacta
```

---

## Fase 5 — Objetos e recursos

Objetivo:

```txt
clicar em árvore, pedra, baú, fogueira etc. abre painel
```

Tarefas:

* criar `hitObject`;
* criar `inspectWorldObject`;
* diferenciar recurso/construção/POI/blueprint;
* ações básicas: coletar, cancelar, priorizar.

Critério de sucesso:

```txt
qualquer objeto do mundo mostra informação útil
```

---

## Fase 6 — Tiles

Objetivo:

```txt
clicar no chão vazio mostra informação do terreno
```

Tarefas:

* criar `inspectTile`;
* mostrar terreno, coordenada, bioma, zona, visibilidade;
* destacar tile.

Critério de sucesso:

```txt
nenhum clique no mapa fica “sem resposta”
```

---

## Fase 7 — Hostiles preparados

Objetivo:

```txt
sistema pronto para inimigos
```

Tarefas:

* criar tipo `hostile`;
* criar `hitHostile`;
* criar `inspectHostile`;
* criar fallback para `state.hostiles || []`;
* desenhar seleção vermelha.

Critério de sucesso:

```txt
quando hostiles forem implementados, painel já suporta
```

---

## Fase 8 — Ações rápidas

Objetivo:

```txt
painel vira ferramenta de gameplay
```

Tarefas:

* centralizar;
* seguir;
* coletar;
* cancelar coleta;
* priorizar;
* marcar alvo futuro.

Critério de sucesso:

```txt
ações do painel funcionam sem conflitar com HUD
```

---

## Fase 9 — Polimento visual

Objetivo:

```txt
painel parecer parte nativa do jogo
```

Tarefas:

* CSS final;
* animação de entrada;
* scroll interno;
* responsividade;
* ícones;
* chips;
* barras;
* botão fechar;
* estado minimizado futuro.

Critério de sucesso:

```txt
painel não parece improvisado
```

---

## Fase 10 — Remoção completa do sistema antigo

Objetivo:

```txt
não existir mais modal/duplo clique antigo conflitante
```

Tarefas:

* remover handler antigo;
* remover funções mortas se seguro;
* limpar CSS antigo;
* testar colono/card/HUD/canvas;
* garantir que tab Selecionado ainda funciona ou foi adaptada.

Critério de sucesso:

```txt
não abre duas UIs ao clicar no colono
```

---

# 56. Ordem segura de implementação

A ordem mais segura:

```txt
1. Criar painel novo escondido
2. Fazer clique em colono abrir painel
3. Desativar duplo clique antigo
4. Padronizar adaptadores
5. Adicionar destaque visual
6. Adicionar animais
7. Adicionar objetos
8. Adicionar tile
9. Preparar hostile
10. Adicionar ações rápidas
11. Polir UI
12. Remover sobras antigas
```

Não começar removendo tudo antes de ter substituto funcionando.

---

# 57. Arquivos prováveis

```txt
src/game/event-listeners.js
src/game/canvas-input-building.js
src/game/renderer.js
src/game/ui/hud-ui.js
src/game/ui/colonist-modal.js
src/game/ui/tab-colonists.js
src/game/mobs.js
src/game/mob-interactions.js
src/game/data/objects.js
src/game/state.js
src/styles.css
```

Arquivo novo aceitável:

```txt
src/game/ui/inspection-panel.js
```

Sistema futuro aceitável:

```txt
src/game/systems/inspection-system.js
```

Evitar nomes:

```txt
inspection-v2.js
colonist-modal-v2.js
selected-panel-new.js
```

---

# 58. Checklist de comportamento

## Colono

```txt
[ ] Clique simples seleciona
[ ] Painel aparece
[ ] Mostra idade
[ ] Mostra saúde
[ ] Mostra fome
[ ] Mostra energia
[ ] Mostra humor
[ ] Mostra tarefa
[ ] Mostra características
[ ] Mostra habilidades
[ ] Mostra equipamento
[ ] Destaca colono
```

---

## Animal

```txt
[ ] Clique simples seleciona
[ ] Mostra espécie
[ ] Mostra fase de vida
[ ] Mostra saúde
[ ] Mostra comportamento
[ ] Mostra relação com jogador
[ ] Destaca animal
```

---

## Hostile

```txt
[ ] Estrutura preparada
[ ] Lista vazia não quebra
[ ] Adaptador pronto
[ ] Seleção vermelha pronta
[ ] Painel mostra ameaça quando existir
```

---

## Objeto

```txt
[ ] Árvore mostra madeira
[ ] Pedra mostra pedra
[ ] Minério mostra metal
[ ] Fogueira mostra função
[ ] Cama mostra conforto
[ ] Baú mostra interação
[ ] Blueprint mostra progresso
```

---

## Tile

```txt
[ ] Chão vazio mostra terreno
[ ] Mostra coordenada
[ ] Mostra construível/caminhável
[ ] Mostra bioma/zona se disponível
[ ] Destaca tile
```

---

# 59. Critérios de qualidade

O sistema só está bom quando:

```txt
o jogador clica em qualquer coisa e entende o que é
```

E também:

```txt
nenhum clique importante parece morto
```

O painel precisa responder:

```txt
O que é isso?
Como está?
O que está fazendo?
É perigoso?
O que posso fazer com isso?
```

---

# 60. Frase de design

```txt
Todo elemento do mundo precisa contar ao jogador o que ele é, em que estado está e por que importa.
```

---

# 61. Resultado final esperado

Ao final, o jogo terá:

```txt
- seleção universal;
- painel contextual;
- clique simples em qualquer entidade;
- inspeção de colonos;
- inspeção de animais;
- base pronta para inimigos;
- inspeção de recursos;
- inspeção de construções;
- inspeção de tiles;
- feedback visual no mundo;
- ações rápidas;
- sistema expansível para futuras features.
```

Esse sistema vira a base para várias coisas futuras:

```txt
combate
domesticação
ordens avançadas
ficha completa de colono
saúde detalhada
ferimentos
facções
NPCs
comércio
missões
eventos
```

---
