# Roadmap ultra detalhado para adaptar multiplayer por IP ao HavenFall

## 1. Resumo executivo

O multiplayer do HavenFall deve ser implementado de forma incremental, segura e compatível com a arquitetura atual do jogo.

Como o HavenFall é um jogo **2D/canvas rodando em Electron**, com lógica central em JavaScript e módulos carregados manualmente pelo `src/game/boot.js`, a melhor rota inicial não é tentar fazer um multiplayer “massivo” nem um P2P completo. A melhor decisão técnica para a primeira versão é:

**Multiplayer host-client simples por IP, com um jogador atuando como host/servidor da sessão e os outros entrando como clientes.**

Na prática:

* Um jogador clica em **Hospedar Partida**.
* O HavenFall cria uma sessão local.
* O host compartilha IP e porta com outro jogador.
* O segundo jogador clica em **Entrar por IP**.
* O cliente conecta no host.
* O host mantém a autoridade principal do mundo.
* Os clientes enviam comandos/intenção de ação.
* O host valida, aplica no estado oficial e replica snapshots/eventos para os clientes.

Essa abordagem é a mais segura para o HavenFall porque o jogo já possui muitos sistemas globais, como mundo, colonos, objetos, IA, eventos, crafting, construção, pathfinding, save/load e game loop. Se cada jogador tentasse simular tudo sozinho, o risco de desync seria muito alto.

A primeira versão deve mirar em **coop simples**, não competitivo:

* 2 a 4 jogadores inicialmente.
* Um mundo compartilhado.
* Host como autoridade.
* Cliente controlando um colono específico.
* Outros colonos continuam com IA.
* Construções, ordens, coleta, combate e interações passam pelo host.
* Sem servidor dedicado na primeira versão.
* Sem matchmaking complexo na primeira versão.
* Sem NAT traversal avançado na primeira versão.
* Com suporte a LAN e IP manual.
* Com preparação estrutural para NAT/relay no futuro.

---

## 2. Objetivo do multiplayer no HavenFall

O objetivo não é transformar o HavenFall em MMO.

O objetivo é permitir uma experiência estilo:

> “Eu crio o mundo, hospedo, mando meu IP para um amigo, ele entra, escolhe/controla um colono e jogamos a mesma colônia juntos.”

Essa feature deve também preparar base para reaproveitar o sistema de **controle manual de colono**, porque esse sistema serve tanto para single-player quanto para multiplayer.

### Objetivos principais

| Objetivo                | Resultado esperado                                        |
| ----------------------- | --------------------------------------------------------- |
| Hospedar por IP         | Jogador consegue criar uma sessão local pelo próprio jogo |
| Entrar por IP           | Outro jogador consegue conectar informando IP e porta     |
| Coop simples            | Cada jogador controla um colono ou envia ordens limitadas |
| Host autoritativo       | O host é dono do estado oficial da simulação              |
| Baixo risco de bug      | Multiplayer isolado em módulos novos                      |
| Compatível com Electron | Rede usando Node/Electron, sem depender do navegador puro |
| Preparado para firewall | Fluxo para pedir permissão de rede no Windows             |
| Preparado para evolução | Base pronta para lobby, convite, relay e Steam no futuro  |

---

## 3. Decisão técnica recomendada

### Modelo escolhido

**Cliente-servidor hospedado pelo jogador.**

Isso significa:

* O host roda a simulação real.
* Os clientes não decidem o estado final.
* Os clientes apenas enviam comandos.
* O host envia atualizações do mundo.
* Se o host fechar o jogo, a sessão termina.
* O save principal fica no host.

### Por que não P2P completo?

P2P completo seria mais difícil porque:

* Todos teriam que simular exatamente igual.
* Qualquer diferença de frame, pathfinding ou evento aleatório poderia causar desync.
* O HavenFall tem muitos sistemas baseados em estado global.
* IA, clima, eventos, mobs, construção e recursos teriam que ficar perfeitamente sincronizados.
* O debugging seria muito mais difícil.

### Por que host-client é melhor para o HavenFall?

Porque o HavenFall já funciona como um jogo single-player com um estado central chamado `state`.

Então a lógica ideal é:

```txt
Host:
  roda gameLoop
  roda updateWorld
  roda IA
  roda eventos
  roda construção
  roda pathfinding
  roda save
  valida comandos
  envia snapshots

Cliente:
  renderiza mundo recebido
  envia input/comandos
  mostra HUD
  controla colono designado
  não altera recursos/objetos diretamente
```

---

## 4. Escopo recomendado para a primeira versão

A primeira versão precisa ser simples, testável e realista.

### Multiplayer V0 — protótipo técnico

Objetivo: provar que o jogo consegue conectar duas instâncias.

Inclui:

* Servidor local dentro do Electron.
* Cliente conectando por `IP:porta`.
* Handshake básico.
* Ping/pong.
* Tela simples de status.
* Log de conexão.
* Envio de snapshot mínimo do mundo.
* Cliente renderizando estado recebido.

Não inclui ainda:

* Controle completo de colono.
* Sync perfeito de todos os sistemas.
* Firewall automático.
* NAT traversal.
* Relay.
* Save multiplayer definitivo.

### Multiplayer V1 — coop jogável local/LAN

Objetivo: duas pessoas jogarem na mesma rede ou via IP aberto.

Inclui:

* Tela Multiplayer no menu.
* Botão **Hospedar Partida**.
* Botão **Entrar por IP**.
* Campo IP.
* Campo porta.
* Campo nome do jogador.
* Lista de jogadores conectados.
* Escolha/atribuição de colono por jogador.
* Host simulando o mundo.
* Cliente enviando comandos.
* Host replicando snapshots.
* Chat/log simples opcional.
* Save apenas no host.

### Multiplayer V2 — internet mais amigável

Objetivo: melhorar a chance de funcionar fora da LAN.

Inclui:

* Detecção de IP local.
* Exibição de IP local e porta.
* Exibição de IP público, quando possível.
* Tentativa de liberar porta via firewall do Windows.
* Instruções de port forwarding.
* Diagnóstico de conexão.
* Teste de porta.
* Mensagens de erro claras.

### Multiplayer V3 — robustez futura

Objetivo: reduzir problemas de conexão real.

Inclui:

* Serviço de rendezvous.
* Código de sala.
* STUN/ICE.
* Relay fallback.
* Convite por link/código.
* Proteção maior contra pacotes inválidos.
* Sistema de versão de protocolo.
* Reconexão.
* Migração parcial de host, se futuramente necessário.

---

## 5. Arquitetura proposta para o HavenFall

A implementação deve ser feita criando uma camada nova, sem espalhar `socket.send()` pelo jogo inteiro.

### Estrutura de pastas recomendada

Criar:

```txt
src/game/network/
  network-constants.js
  network-state.js
  network-protocol.js
  network-serializer.js
  network-client.js
  network-host.js
  network-session.js
  network-command-router.js
  network-snapshot.js
  network-diagnostics.js
  network-ui.js
  network-firewall.js
```

E no Electron:

```txt
src/desktop/
  network-node-server.cjs
  network-node-client.cjs
  firewall-helper.cjs
```

Ou, caso prefira manter na raiz:

```txt
desktop/
  network-server.cjs
  network-client.cjs
  firewall-helper.cjs
```

### Ordem de carregamento no `boot.js`

Adicionar os módulos de multiplayer depois do estado/core e antes da UI final.

Exemplo conceitual:

```js
['network_constants','src/game/network/network-constants.js'],
['network_state','src/game/network/network-state.js'],
['network_protocol','src/game/network/network-protocol.js'],
['network_serializer','src/game/network/network-serializer.js'],
['network_session','src/game/network/network-session.js'],
['network_command_router','src/game/network/network-command-router.js'],
['network_snapshot','src/game/network/network-snapshot.js'],
['network_ui','src/game/network/network-ui.js'],
```

Importante: como o projeto carrega scripts de forma sequencial e global, todos os módulos devem expor APIs em `window.HavenfallNetwork`, em vez de depender de imports modernos espalhados.

---

## 6. Novo fluxo de menus

Hoje o menu principal possui:

```txt
Novo Jogo
Carregar
Configurações
Sair
```

O multiplayer deve adicionar:

```txt
Novo Jogo
Multiplayer
Carregar
Configurações
Sair
```

### Nova tela: Multiplayer

Criar nova section no `index.html`:

```html
<section id="multiplayerScreen" class="screen multiplayer-screen" data-screen="MULTIPLAYER">
  <div class="menu-card wide-card">
    <div class="screen-title-row">
      <div>
        <div class="kicker">Multiplayer</div>
        <h1>Jogar com amigos</h1>
        <p>Hospede uma colônia ou entre usando IP e porta.</p>
      </div>
      <button id="multiplayerBackBtn" class="secondary">Voltar</button>
    </div>

    <div class="multiplayer-layout">
      <section class="setup-section">
        <div class="setup-section-head">
          <span>01</span>
          <b>Hospedar</b>
        </div>

        <label>Porta
          <input id="hostPortInput" type="number" value="27015" min="1024" max="65535" />
        </label>

        <button id="hostGameBtn" class="primary">Hospedar Partida</button>
        <button id="copyHostInfoBtn" class="secondary">Copiar IP da Sessão</button>

        <div id="hostStatusBox" class="subtle-box">Nenhuma sessão hospedada.</div>
      </section>

      <section class="setup-section">
        <div class="setup-section-head">
          <span>02</span>
          <b>Entrar</b>
        </div>

        <label>Nome do jogador
          <input id="playerNameInput" type="text" value="Jogador" maxlength="24" />
        </label>

        <label>IP do host
          <input id="joinIpInput" type="text" placeholder="ex: 192.168.0.10" />
        </label>

        <label>Porta
          <input id="joinPortInput" type="number" value="27015" min="1024" max="65535" />
        </label>

        <button id="joinGameBtn" class="primary">Entrar na Partida</button>

        <div id="joinStatusBox" class="subtle-box">Informe IP e porta para entrar.</div>
      </section>
    </div>

    <section class="setup-section">
      <div class="setup-section-head">
        <span>03</span>
        <b>Jogadores conectados</b>
      </div>
      <div id="multiplayerPlayersList" class="colonist-list"></div>
    </section>
  </div>
</section>
```

### Atualizar enum de telas

No `state.js`, adicionar:

```js
MULTIPLAYER: 'MULTIPLAYER'
```

### Atualizar DOM

Adicionar em `dom.screens`:

```js
multiplayer: document.getElementById('multiplayerScreen')
```

Adicionar em `dom.buttons`:

```js
multiplayer: document.getElementById('multiplayerBtn'),
multiplayerBack: document.getElementById('multiplayerBackBtn'),
hostGame: document.getElementById('hostGameBtn'),
joinGame: document.getElementById('joinGameBtn'),
copyHostInfo: document.getElementById('copyHostInfoBtn')
```

Adicionar em `dom.inputs`:

```js
hostPort: document.getElementById('hostPortInput'),
joinIp: document.getElementById('joinIpInput'),
joinPort: document.getElementById('joinPortInput'),
playerName: document.getElementById('playerNameInput')
```

---

## 7. Protocolo de rede inicial

O protocolo precisa ser simples e versionado desde o começo.

### Constantes

Arquivo:

```txt
src/game/network/network-constants.js
```

Conteúdo base:

```js
'use strict';

window.HavenfallNetworkConstants = Object.freeze({
  PROTOCOL_VERSION: 1,
  DEFAULT_PORT: 27015,
  MAX_PLAYERS: 4,
  SNAPSHOT_RATE: 10,
  COMMAND_RATE: 20,
  PING_INTERVAL_MS: 1000,
  CLIENT_TIMEOUT_MS: 8000,
  HOST_TIMEOUT_MS: 8000
});
```

### Tipos de mensagens

Arquivo:

```txt
src/game/network/network-protocol.js
```

Tipos:

```txt
HELLO
HELLO_ACK
PING
PONG
JOIN_REQUEST
JOIN_ACCEPTED
JOIN_REJECTED
PLAYER_LIST
ASSIGN_COLONIST
CLIENT_COMMAND
WORLD_SNAPSHOT
WORLD_EVENT
DISCONNECT
ERROR
```

### Formato base da mensagem

```js
{
  "v": 1,
  "type": "CLIENT_COMMAND",
  "seq": 102,
  "time": 123456789,
  "playerId": "player_abc",
  "payload": {}
}
```

### Regras obrigatórias

* Toda mensagem precisa ter `v`.
* Toda mensagem precisa ter `type`.
* Mensagem com versão incompatível deve ser recusada.
* Payload grande demais deve ser descartado.
* Comando de cliente nunca altera o estado diretamente.
* Host sempre valida antes de aplicar.
* Cliente nunca decide recurso, dano, construção final ou evento aleatório.

---

## 8. Autoridade da simulação

O HavenFall deve usar autoridade no host.

### Host controla

```txt
state.world
state.terrain
state.objects
state.colonists
state.mobs
state.visitors
state.resources
state.items
state.research
state.day
state.hour
state.weather
eventos aleatórios
pathfinding oficial
construções
crafting
combate
save/load
```

### Cliente controla apenas

```txt
input local
câmera local
HUD local
seleção local
pedido de ação
nome do jogador
colono designado
```

### Cliente não pode fazer diretamente

```txt
state.resources.food += 10
state.objects.push(...)
state.colonists[0].health -= 20
randomEvent()
saveGame()
```

Tudo isso deve passar pelo host.

---

## 9. Sistema de comandos

Em vez de sincronizar teclas e mouse crus, o cliente deve enviar comandos de intenção.

### Exemplos de comandos

```txt
MOVE_COLONIST
ASSIGN_TASK
PLACE_BLUEPRINT
CANCEL_BLUEPRINT
SELECT_COLONIST
INTERACT_OBJECT
GATHER_RESOURCE
ATTACK_TARGET
SET_PRIORITY
START_RESEARCH
CRAFT_ITEM
CHANGE_SPEED_REQUEST
```

### Exemplo de comando

```js
{
  type: 'CLIENT_COMMAND',
  payload: {
    command: 'MOVE_COLONIST',
    colonistId: 'colonist_123',
    x: 42,
    y: 18
  }
}
```

### Validação no host

O host verifica:

```txt
O player existe?
O player está conectado?
Esse player controla esse colono?
O colono está vivo/consciente?
O tile existe?
O tile é caminhável?
A distância é válida?
A ação é permitida?
O comando respeita cooldown/rate limit?
```

Só depois aplica.

---

## 10. Controle de colonos no multiplayer

Essa parte precisa casar com a feature de controle manual.

### Modelo recomendado

Ao criar ou entrar numa sessão:

* Cada jogador recebe um colono.
* Esse colono fica marcado como `controlledByPlayerId`.
* O colono controlado pode receber comando direto do jogador.
* Colonos sem jogador continuam com IA.
* O host pode permitir trocar de colono, mas não deve permitir dois jogadores controlando o mesmo colono ao mesmo tempo.

### Campo novo no colono

```js
colonist.controlledByPlayerId = null;
colonist.controlMode = 'ai'; 
```

Valores possíveis:

```txt
ai
player
hybrid
```

### Regras

```txt
controlMode = ai:
  colono segue IA normal

controlMode = player:
  colono obedece comandos do jogador

controlMode = hybrid:
  jogador dá ordens diretas, mas IA cuida de fome, descanso, emergência e sobrevivência
```

### Recomendação para V1

Usar `hybrid`.

Motivo:

* Evita o jogador esquecer o colono parado até morrer.
* Mantém a cara de colony sim.
* Ajuda no single-player também.
* Fica melhor para multiplayer casual.

---

## 11. Sincronização de mundo

Existem duas formas principais:

### Opção A — snapshot completo

O host envia um resumo do mundo inteiro várias vezes por segundo.

Vantagens:

* Mais simples.
* Menos risco de desync.
* Fácil de debugar.

Desvantagens:

* Pode ficar pesado em mapas gigantes.
* Pode dar lag se enviar objetos demais.

### Opção B — eventos/deltas

O host envia apenas mudanças.

Vantagens:

* Mais eficiente.
* Melhor para mapas grandes.

Desvantagens:

* Mais difícil.
* Se perder evento, o cliente fica errado.
* Precisa resync.

### Recomendação

Usar híbrido:

```txt
V0:
  snapshot reduzido a cada 250ms ou 500ms

V1:
  snapshot reduzido 10 vezes por segundo para entidades importantes
  snapshot completo leve a cada 5 segundos
  eventos imediatos para ações importantes

V2:
  delta por entidade
  relevância por câmera/distância
  compressão
```

### Snapshot mínimo

```js
{
  world: {
    cols,
    rows,
    tileSize,
    seed,
    mapSize
  },
  time: {
    day,
    hour,
    weather
  },
  resources,
  colonists: [
    { id, name, x, y, health, hunger, energy, task, controlledByPlayerId }
  ],
  mobs: [
    { id, type, x, y, health }
  ],
  objects: [
    { id, type, x, y, state, progress }
  ],
  logTail: []
}
```

### Não enviar no snapshot rápido

Evitar mandar sempre:

```txt
terrain inteiro
biome map inteiro
geology layer inteiro
roof layer inteiro
fog completo
histórico de log completo
save inteiro
dados estáticos de buildings/items/recipes
```

Esses dados podem ser enviados:

* no carregamento inicial;
* em snapshot completo raro;
* ou reconstruídos pelo cliente usando seed.

---

## 12. Estratégia para mundo procedural e seed

O HavenFall já usa seed na criação do mundo. Isso é ótimo para multiplayer.

### Recomendação

No início da conexão:

1. Host envia configuração da partida.
2. Cliente gera o mesmo mundo base localmente usando a mesma seed.
3. Host envia correções/snapshot de objetos dinâmicos.
4. Cliente usa snapshot para alinhar entidades.

### Dados enviados no início

```js
{
  colonyName,
  seed,
  difficulty,
  resourcesPreset,
  eventIntensity,
  mapSize,
  selectedColonists,
  worldgenVersion
}
```

### Cuidado crítico

A geração precisa ser determinística.

Não pode depender de:

```txt
Math.random solto
ordem variável de arrays
hora atual
performance.now
estado visual
quantidade de frames
```

Para multiplayer, o mundo precisa usar RNG por seed.

---

## 13. Game loop no multiplayer

O `gameLoop` atual roda:

```txt
updateWorld
GameSystems.tick
updateCamera
draw
updateUI
autosave
```

No multiplayer, o comportamento muda por modo.

### Modo single-player

Nada muda.

```txt
updateWorld roda local
GameSystems.tick roda local
saveGame local
```

### Modo host

Quase igual ao single-player, mas com rede.

```txt
updateWorld roda no host
GameSystems.tick roda no host
processa comandos recebidos
envia snapshots
saveGame permitido
```

### Modo client

Cliente não deve rodar a simulação completa.

```txt
não roda updateWorld oficial
não roda GameSystems.tick oficial
não roda eventos aleatórios
não roda autosave principal
recebe snapshot
interpola/renderiza
envia comandos
```

### Ajuste recomendado

Criar helpers:

```js
function isNetworkClient() {
  return window.HavenfallNetwork?.role === 'client';
}

function isNetworkHost() {
  return window.HavenfallNetwork?.role === 'host';
}

function shouldRunAuthoritativeSimulation() {
  return !isNetworkClient();
}
```

Então no loop:

```js
if (shouldRunAuthoritativeSimulation()) {
  updateWorld(dt);
  GameSystems.tick(dt, ...);
}
```

---

## 14. Save/load no multiplayer

### Regra da V1

Somente o host salva.

Motivo:

* O host é dono do estado oficial.
* Evita conflitos.
* Evita cliente salvar estado incompleto.
* Evita divergência de mundo.

### Save deve guardar

```txt
estado normal do jogo
modo multiplayer opcional
jogadores conectados não precisam persistir
colonos controláveis sim
atribuições podem ser resetadas ao carregar
```

### Ao carregar save multiplayer

Fluxo recomendado:

1. Host carrega save.
2. Host clica em Hospedar.
3. Amigos entram.
4. Host reatribui colonos.

Não tentar restaurar conexão antiga automaticamente na V1.

---

## 15. Firewall e permissões de rede

Como o HavenFall roda em Electron, o jogo pode ter um helper Node para tentar criar regra de firewall no Windows.

### Decisão recomendada

Não rodar o jogo inteiro como administrador.

Em vez disso:

* Jogo roda normal.
* Ao clicar em Hospedar, se precisar, chama helper elevado.
* Helper cria regra específica.
* Regra deve ser apenas para o executável/porta do HavenFall.
* Nunca pedir para desativar firewall.

### Texto recomendado no jogo

```txt
Para aceitar conexões de outros jogadores, o HavenFall precisa permitir entrada UDP/TCP na porta da sessão.

Isso cria uma regra específica para o jogo no Firewall do Windows. Não é necessário desativar o firewall.

Deseja permitir agora?
```

### Portas

Usar padrão:

```txt
27015
```

Permitir alteração pelo usuário.

### V1 mais simples

Começar com TCP/WebSocket local.

Motivo:

* Mais fácil de implementar em Electron/Node.
* Mais fácil de debugar.
* Suficiente para coop simples inicial.
* Depois pode evoluir para UDP ou WebRTC.

### V2/V3

Avaliar:

```txt
UDP
WebRTC DataChannel
SteamNetworkingSockets
relay próprio
```

---

## 16. Transporte recomendado por fase

### V0/V1: WebSocket TCP

Usar:

```txt
Node WebSocket server no host
WebSocket client no cliente
```

Vantagens:

* Simples.
* Funciona bem no Electron.
* Debug fácil.
* Menos código de protocolo baixo nível.
* Já tem conexão persistente.
* Bom para protótipo e coop leve.

Desvantagens:

* Não é ideal para ação rápida.
* TCP pode sofrer head-of-line blocking.
* Não é o melhor para jogo competitivo.

Para o HavenFall, isso é aceitável porque o jogo é colony sim, não shooter.

### V2: UDP opcional

Depois que o jogo estiver jogável:

* snapshots rápidos podem ir por UDP;
* comandos importantes podem continuar confiáveis;
* ou usar uma biblioteca com confiabilidade.

### V3: Relay/WebRTC/Steam

Quando a UX precisar melhorar:

* código de sala;
* convite;
* relay;
* ocultar IP do host;
* reduzir problemas com NAT.

---

## 17. Segurança mínima

Mesmo sendo coop, precisa de segurança básica.

### Validar tudo

O host deve rejeitar:

```txt
mensagem sem versão
mensagem sem tipo
JSON inválido
payload gigante
comando de jogador inexistente
comando para colono de outro player
posição fora do mapa
ação impossível
spam de comando
versão incompatível
```

### Rate limit

Por jogador:

```txt
máximo 20 comandos por segundo
máximo 5 mensagens administrativas por segundo
máximo 1 join request por segundo
```

### Tamanho máximo

```txt
mensagem normal: até 64 KB
snapshot inicial: pode ser maior, mas controlado
```

### Senha de sessão

Adicionar opção:

```txt
Senha da sala
```

Mesmo simples, já evita entrada acidental.

### Token de sessão

Ao aceitar jogador:

```js
player.sessionToken = createRandomToken();
```

Depois disso, comandos precisam carregar token.

---

## 18. Interface de status

O jogador precisa entender o que está acontecendo.

### Status do host

Mostrar:

```txt
Status: hospedando
Porta: 27015
IP local: 192.168.x.x
IP público: disponível/indisponível
Jogadores: 1/4
Firewall: permitido/não verificado
Rota: LAN/IP direto
```

### Status do cliente

Mostrar:

```txt
Conectando...
Handshake...
Sincronizando mundo...
Entrou na partida
Ping: 42ms
Colono atribuído: Lara
```

### Erros amigáveis

```txt
Não foi possível conectar ao host.
Verifique se:
1. O IP está correto.
2. A porta está correta.
3. O host está com a partida aberta.
4. O firewall permitiu o HavenFall.
5. O roteador do host encaminha a porta, se estiverem em redes diferentes.
```

---

## 19. Diagnóstico/logs

Criar:

```txt
src/game/network/network-diagnostics.js
```

Registrar:

```txt
quando host inicia
porta usada
erro de bind
cliente conectado
cliente desconectado
ping médio
snapshot enviado
snapshot recebido
comando rejeitado
motivo da rejeição
versão de protocolo
erro de JSON
timeout
```

No Electron, salvar logs em arquivo usando a API desktop já existente ou um novo canal IPC.

### Exemplo de log

```txt
[Network] Host iniciado em 0.0.0.0:27015
[Network] Player conectado: Enzo / 192.168.0.12
[Network] JOIN_ACCEPTED player_abc colonist_003
[Network] Snapshot enviado: 42 entidades / 18 KB
[Network] Comando rejeitado: MOVE_COLONIST fora do mapa
```

---

## 20. Integração com Electron

### Preload

Adicionar APIs seguras no `electron-preload.cjs`:

```js
window.HavenfallDesktop.network = {
  startHost,
  stopHost,
  connectToHost,
  disconnect,
  sendMessage,
  onMessage,
  getLocalIps,
  getPublicIp,
  checkFirewall,
  requestFirewallRule
};
```

### Main process

No `electron-main.cjs`:

* criar handlers IPC;
* iniciar servidor Node;
* manter lista de conexões;
* repassar mensagens para renderer;
* evitar expor Node direto ao renderer.

### Cuidado

Não habilitar `nodeIntegration` no renderer só para facilitar.

Preferir:

```txt
contextBridge + ipcRenderer
```

Isso mantém o Electron mais seguro.

---

## 21. Plano de implementação por fases

## Fase 0 — Preparação técnica

### Objetivo

Preparar o código para receber multiplayer sem quebrar single-player.

### Tarefas

* Criar pasta `src/game/network`.
* Criar constantes de rede.
* Criar estado global `window.HavenfallNetwork`.
* Criar helpers de role:

  * singleplayer
  * host
  * client
* Adicionar tela `MULTIPLAYER`.
* Adicionar botão Multiplayer no menu.
* Adicionar CSS da tela.
* Adicionar logs de rede.
* Não alterar ainda a simulação.

### Critérios de aceite

* O jogo abre normalmente.
* Single-player continua funcionando.
* Menu Multiplayer abre e volta.
* Nenhum erro no console.
* Build Electron continua funcionando.

---

## Fase 1 — Host local e cliente local

### Objetivo

Conectar duas instâncias do jogo no mesmo PC ou na mesma rede.

### Tarefas

* Criar servidor WebSocket no Electron host.
* Criar cliente WebSocket no Electron.
* Implementar `HELLO`.
* Implementar `HELLO_ACK`.
* Implementar `PING`.
* Implementar `PONG`.
* Mostrar status de conexão.
* Mostrar jogadores conectados.
* Permitir parar host.
* Permitir desconectar cliente.

### Critérios de aceite

* Abrir duas instâncias do HavenFall.
* Uma hospeda.
* Outra entra em `127.0.0.1:27015`.
* Ping aparece.
* Cliente aparece na lista do host.
* Desconexão não trava o jogo.

---

## Fase 2 — Snapshot inicial do mundo

### Objetivo

Cliente entrar e receber o estado inicial do host.

### Tarefas

* Criar serializer de estado.
* Criar snapshot reduzido.
* Enviar snapshot ao entrar.
* Cliente aplicar snapshot em `state`.
* Cliente ir para tela `PLAYING`.
* Cliente renderizar mundo recebido.
* Bloquear autosave no cliente.
* Bloquear eventos aleatórios no cliente.
* Bloquear simulação autoritativa no cliente.

### Critérios de aceite

* Host inicia mundo.
* Cliente entra.
* Cliente vê mesmo dia/hora/clima.
* Cliente vê colonos.
* Cliente vê objetos.
* Cliente não gera eventos próprios.
* Cliente não salva como save principal.

---

## Fase 3 — Replicação contínua

### Objetivo

Manter cliente atualizado enquanto host simula.

### Tarefas

* Enviar snapshot leve 5 a 10 vezes por segundo.
* Atualizar posição dos colonos.
* Atualizar recursos.
* Atualizar objetos.
* Atualizar mobs.
* Atualizar clima/hora.
* Atualizar log recente.
* Adicionar interpolação simples para movimento.
* Medir tamanho dos snapshots.

### Critérios de aceite

* Cliente acompanha colonos se movendo.
* Cliente vê recursos mudando.
* Cliente vê construções aparecendo.
* Cliente vê eventos do host.
* Ping e snapshot rate aparecem no diagnóstico.
* Não há travamento após 10 minutos de sessão.

---

## Fase 4 — Comandos do cliente

### Objetivo

Permitir que cliente jogue de verdade.

### Tarefas

* Criar `network-command-router.js`.
* Enviar comandos do cliente para o host.
* Validar comandos no host.
* Implementar comando de mover colono.
* Implementar comando de interagir com objeto.
* Implementar comando de coletar recurso.
* Implementar comando de construir blueprint.
* Implementar comando de cancelar ordem.
* Implementar resposta de erro para comando negado.

### Critérios de aceite

* Cliente consegue mandar colono andar.
* Cliente consegue mandar colono coletar recurso.
* Cliente consegue pedir construção.
* Host valida e aplica.
* Cliente não consegue controlar colono de outro jogador.
* Cliente não consegue criar recurso do nada.

---

## Fase 5 — Atribuição de colonos

### Objetivo

Cada jogador controla um colono específico.

### Tarefas

* Adicionar `playerId`.
* Adicionar `playerName`.
* Adicionar `controlledByPlayerId` no colono.
* Tela de jogadores conectados.
* Host atribui colono automaticamente.
* Impedir dois players no mesmo colono.
* Mostrar no HUD:

  * “Controlado por você”
  * “Controlado por outro jogador”
  * “IA”
* Criar botão para host trocar atribuição.

### Critérios de aceite

* Player 1 controla colono A.
* Player 2 controla colono B.
* IA continua cuidando dos demais.
* Cliente não toma controle de colono ocupado.
* Ao desconectar, colono volta para IA.

---

## Fase 6 — Permissões de rede e firewall

### Objetivo

Facilitar hospedagem no Windows.

### Tarefas

* Detectar IPs locais.
* Mostrar IPs no painel.
* Botão “Copiar dados da sessão”.
* Criar helper de firewall.
* Pedir permissão somente ao hospedar.
* Criar regra de firewall específica.
* Mostrar status:

  * verificado
  * não verificado
  * negado
  * erro
* Criar instruções manuais.

### Critérios de aceite

* Host consegue copiar IP/porta.
* Jogo mostra IP local correto.
* Se firewall bloquear, jogo informa.
* Jogo nunca pede para desativar firewall.
* Negar permissão não quebra a sessão LAN local.

---

## Fase 7 — Save multiplayer

### Objetivo

Garantir que o host consiga salvar sem corromper sessão.

### Tarefas

* Marcar save como `multiplayerCapable`.
* Salvar estado oficial apenas no host.
* Impedir cliente de salvar o mundo como principal.
* Permitir cliente salvar preferências locais.
* Ao carregar save, limpar players antigos.
* Ao carregar, colonos voltam para IA.
* Host reatribui jogadores quando entrarem.

### Critérios de aceite

* Host salva.
* Host fecha.
* Host abre save.
* Host hospeda novamente.
* Cliente entra.
* Mundo continua correto.
* Atribuições antigas não quebram.

---

## Fase 8 — Testes pesados

### Objetivo

Garantir que o multiplayer não destrua performance nem single-player.

### Tarefas

* Testar single-player após cada fase.
* Testar duas instâncias locais.
* Testar LAN real.
* Testar IP público com porta aberta.
* Testar desconexão abrupta.
* Testar host fechando jogo.
* Testar cliente com ping alto.
* Testar snapshot grande.
* Testar mapa large/huge/giant.
* Testar save/load após sessão.
* Testar construir/coletar/craftar/pesquisar em multiplayer.

### Critérios de aceite

* Single-player intacto.
* Multiplayer funciona por 30 minutos sem crash.
* Cliente reconecta ou sai limpo.
* Host não perde save.
* Sem queda absurda de FPS.
* Logs explicam falhas.

---

## 22. Arquivos que provavelmente serão alterados

### `index.html`

Alterações:

* Adicionar botão Multiplayer.
* Adicionar tela `multiplayerScreen`.
* Adicionar campos IP/porta/nome.
* Adicionar lista de jogadores.
* Adicionar status host/client.

### `src/game/state.js`

Alterações:

* Adicionar `SCREEN.MULTIPLAYER`.
* Adicionar referências DOM.
* Adicionar estado de rede se necessário.
* Adicionar campos de controle por jogador em colonos.

### `src/game/boot.js`

Alterações:

* Adicionar módulos de network no manifesto.
* Garantir ordem correta de carregamento.

### `src/game/event-listeners.js`

Alterações:

* Evento do botão Multiplayer.
* Evento Voltar.
* Evento Hospedar.
* Evento Entrar.
* Evento Copiar IP.
* Bloquear ações indevidas em modo client.

### `src/game/game-loop.js`

Alterações:

* Diferenciar single-player/host/client.
* Host roda simulação.
* Client recebe snapshot.
* Client não roda simulação autoritativa.
* Host envia snapshots.
* Client envia ping/comandos.

### `src/game/save-load.js`

Alterações:

* Host salva.
* Client não salva estado oficial.
* Save limpa dados de players conectados.
* Save preserva mundo e colonos.

### `src/game/systems/manual-control-system.js`

Alterações:

* Adaptar controle manual para enviar comando ao host.
* Em single-player, aplicar local.
* Em host, aplicar local e replicar.
* Em client, enviar `CLIENT_COMMAND`.

### `src/game/canvas-input-building.js`

Alterações:

* Em client, clique de construção vira comando.
* Host valida recursos e posicionamento.
* Cliente não cria blueprint direto.

### `src/game/ui/hud-ui.js`

Alterações:

* Mostrar estado multiplayer.
* Mostrar colono controlado pelo jogador.
* Mostrar ping/status.
* Evitar botões proibidos no client.

### `electron-main.cjs`

Alterações:

* IPC para iniciar/parar host.
* IPC para conectar/desconectar.
* IPC para mensagens de rede.
* IPC para IP local.
* IPC para helper de firewall.

### `electron-preload.cjs`

Alterações:

* Expor API segura `window.HavenfallDesktop.network`.
* Não expor Node direto ao renderer.

### `package.json`

Alterações possíveis:

* Adicionar dependência WebSocket.
* Adicionar scripts de teste multiplayer.
* Garantir dependência empacotada pelo electron-builder.

Exemplo:

```json
"dependencies": {
  "ws": "^8.18.0"
}
```

---

## 23. Dependência recomendada para V1

Para WebSocket em Node:

```txt
ws
```

Instalação:

```bash
npm install ws
```

Motivo:

* Simples.
* Popular.
* Funciona bem no Node/Electron.
* Suficiente para protótipo e coop inicial.

---

## 24. Regras para não quebrar o HavenFall atual

### Regra 1

Single-player nunca deve depender da rede.

### Regra 2

Se multiplayer falhar, o jogo deve continuar abrindo.

### Regra 3

Módulos de rede devem ficar isolados.

### Regra 4

Cliente nunca deve alterar `state` autoritativo sem snapshot do host.

### Regra 5

Host deve validar tudo.

### Regra 6

Save oficial apenas no host.

### Regra 7

Não implementar NAT traversal antes do básico funcionar.

### Regra 8

Não tentar sincronizar tudo no primeiro commit.

### Regra 9

Não mexer em todos os sistemas de uma vez.

### Regra 10

Cada fase precisa ser testável sozinha.

---

## 25. Cronograma sugerido

### Etapa 1 — Base de UI e estado

Tempo estimado: 1 a 2 dias.

Entregas:

* Tela Multiplayer.
* Botões.
* Estado de rede.
* Logs.
* Single-player intacto.

### Etapa 2 — Conexão local

Tempo estimado: 2 a 4 dias.

Entregas:

* Host WebSocket.
* Cliente WebSocket.
* Ping/pong.
* Lista de jogadores.

### Etapa 3 — Snapshot inicial

Tempo estimado: 3 a 5 dias.

Entregas:

* Cliente entra e vê mundo do host.
* Simulação client bloqueada.
* Render funcionando.

### Etapa 4 — Snapshot contínuo

Tempo estimado: 3 a 6 dias.

Entregas:

* Cliente acompanha mundo em tempo real.
* Recursos/colonos/objetos sincronizados.

### Etapa 5 — Comandos jogáveis

Tempo estimado: 5 a 10 dias.

Entregas:

* Mover colono.
* Interagir.
* Construir.
* Coletar.
* Validação host.

### Etapa 6 — Controle por jogador

Tempo estimado: 3 a 6 dias.

Entregas:

* Jogador controla colono específico.
* Outros colonos ficam com IA.
* Desconexão devolve colono para IA.

### Etapa 7 — Firewall e UX de conexão

Tempo estimado: 3 a 7 dias.

Entregas:

* IP local.
* Copiar sessão.
* Status.
* Firewall helper.
* Instruções.

### Etapa 8 — QA e estabilização

Tempo estimado: 5 a 10 dias.

Entregas:

* Testes.
* Correções.
* Logs.
* Proteções.
* Build final.

### Estimativa total realista

```txt
Protótipo técnico: 5 a 10 dias
Coop jogável LAN/IP simples: 18 a 35 dias
Coop mais robusto para internet real: 35 a 60 dias
```

---

## 26. Ordem cirúrgica de implementação

A ordem ideal para mandar para o dev é:

```txt
1. Criar tela Multiplayer sem funcionalidade real.
2. Criar estado global HavenfallNetwork.
3. Criar host WebSocket no Electron.
4. Criar client WebSocket no Electron.
5. Implementar HELLO/PING/PONG.
6. Mostrar jogadores conectados.
7. Criar serializer de snapshot mínimo.
8. Enviar snapshot inicial ao cliente.
9. Fazer cliente renderizar snapshot.
10. Bloquear simulação autoritativa no cliente.
11. Enviar snapshots contínuos do host.
12. Criar command router.
13. Adaptar controle manual para comando de rede.
14. Validar comando no host.
15. Atribuir colonos por jogador.
16. Adaptar construção/coleta/interação.
17. Adicionar save apenas no host.
18. Adicionar logs e diagnóstico.
19. Adicionar IP local/copiar sessão.
20. Adicionar helper de firewall.
21. Testar LAN.
22. Testar IP externo com porta aberta.
23. Otimizar snapshot.
24. Preparar V2 com relay/código de sala.
```

---

## 27. Primeiro MVP ideal

O MVP mais inteligente para o HavenFall não é “multiplayer completo”.

O primeiro MVP deve ser:

```txt
Dois jogadores em LAN.
Host cria mundo.
Cliente entra por IP.
Cliente vê o mesmo mundo.
Cliente controla um colono.
Host controla outro colono.
Colonos restantes ficam em IA.
Construção e coleta funcionam via host.
Save fica só no host.
```

Isso já prova a feature principal e cria a fundação para todo o resto.

---

## 28. O que deixar para depois

Não implementar na primeira versão:

```txt
matchmaking
conta/login
servidor dedicado
relay
Steam
NAT traversal completo
chat de voz
host migration
replay
anti-cheat pesado
compressão avançada
rollback
delta snapshot complexo
sincronização determinística total
```

Essas coisas só devem entrar depois que o coop básico estiver jogável.

---

## 29. Riscos principais

### Risco 1 — Desync

Mitigação:

* Host autoritativo.
* Cliente não simula mundo oficial.
* Snapshot periódico.

### Risco 2 — Performance

Mitigação:

* Snapshot reduzido.
* Enviar só entidades importantes.
* Medir bytes.
* Reduzir taxa em mapas gigantes.

### Risco 3 — UI quebrada

Mitigação:

* Tela separada.
* CSS dedicado.
* Não misturar com setup de novo jogo.

### Risco 4 — Firewall/NAT

Mitigação:

* Começar por LAN.
* Mostrar diagnóstico.
* Port forwarding manual.
* Helper Windows depois.

### Risco 5 — Save corrompido

Mitigação:

* Save só no host.
* Backup antes de salvar multiplayer.
* Validação de save.

### Risco 6 — Muita alteração de uma vez

Mitigação:

* Fases pequenas.
* Cada fase testável.
* Não adaptar todos os sistemas no primeiro commit.

---

## 30. Prompt pronto para mandar ao dev

Implementar multiplayer inicial no HavenFall seguindo arquitetura host-client por IP, compatível com Electron e com a estrutura atual do projeto.

Objetivo da primeira etapa: criar uma base multiplayer simples, segura e incremental, sem quebrar o single-player.

Regras obrigatórias:

1. O single-player deve continuar funcionando exatamente como antes.
2. O multiplayer deve ficar isolado em `src/game/network/`.
3. O host será autoritativo.
4. O cliente não pode alterar o estado oficial diretamente.
5. O cliente deve enviar comandos de intenção.
6. O host valida e aplica comandos.
7. O host envia snapshots do mundo.
8. Save oficial apenas no host.
9. Não implementar NAT traversal avançado agora.
10. Começar com WebSocket via Electron/Node.
11. Adicionar tela Multiplayer ao menu principal.
12. Adicionar botão Hospedar Partida.
13. Adicionar botão Entrar por IP.
14. Adicionar campo IP, porta e nome do jogador.
15. Adicionar lista de jogadores conectados.
16. Adicionar logs de conexão.
17. Adicionar ping/pong.
18. Adicionar snapshot inicial.
19. Preparar estrutura para controle de colono por jogador.
20. Não espalhar lógica de rede pelos sistemas; usar command router.

Arquivos prováveis:

* `index.html`
* `src/game/state.js`
* `src/game/boot.js`
* `src/game/event-listeners.js`
* `src/game/game-loop.js`
* `src/game/save-load.js`
* `src/game/systems/manual-control-system.js`
* `src/game/canvas-input-building.js`
* `src/game/ui/hud-ui.js`
* `electron-main.cjs`
* `electron-preload.cjs`
* `package.json`

Criar novos arquivos:

* `src/game/network/network-constants.js`
* `src/game/network/network-state.js`
* `src/game/network/network-protocol.js`
* `src/game/network/network-serializer.js`
* `src/game/network/network-client.js`
* `src/game/network/network-host.js`
* `src/game/network/network-session.js`
* `src/game/network/network-command-router.js`
* `src/game/network/network-snapshot.js`
* `src/game/network/network-diagnostics.js`
* `src/game/network/network-ui.js`

Primeira entrega esperada:

* Tela Multiplayer abrindo pelo menu.
* Host inicia servidor local na porta 27015.
* Cliente conecta por IP e porta.
* HELLO/HELLO_ACK funcionando.
* PING/PONG funcionando.
* Lista de jogadores conectados funcionando.
* Log visual de status funcionando.
* Single-player intacto.

Segunda entrega esperada:

* Host envia snapshot inicial do mundo.
* Cliente recebe snapshot.
* Cliente renderiza mundo do host.
* Cliente não roda simulação autoritativa.
* Cliente não salva estado principal.
* Desconectar não trava.

Terceira entrega esperada:

* Cliente envia comando de mover colono.
* Host valida comando.
* Host aplica no estado oficial.
* Host replica snapshot atualizado.
* Cada jogador controla um colono.
* Colonos sem jogador continuam com IA.

Prioridade máxima:

Fazer funcionar primeiro em LAN/local. Internet pública, firewall automático, NAT traversal, relay e código de sala ficam para fases posteriores.
