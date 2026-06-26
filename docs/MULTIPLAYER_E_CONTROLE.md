# HavenFall — Sandbox, controle direto e multiplayer simples

## 1. Demolir construções

Formas de usar:

- Botão direito em uma construção -> `Demolir construção`.
- Botão `Demolir` no painel de construção.
- Atalho `X` para ligar/desligar modo demolir.
- `Delete` ou `Backspace` remove a construção selecionada, se ela for demolível.

O sistema recupera parte dos recursos:

- Blueprint/obra ainda não pronta: recupera mais recurso.
- Construção pronta: recupera parte menor.

Objetos de loot/ruínas/interativos não são demolidos por padrão para não quebrar exploração.

## 2. Tomar controle de um colono

Formas de usar:

- Selecionar um colono e clicar em `Tomar controle`.
- Atalho `C` alterna controle manual do colono selecionado.

Controles:

- `W`, `A`, `S`, `D` ou setas movem o colono.
- A câmera segue o colono controlado.
- Clique em objetos ainda mantém as interações normais do jogo.

Observação: este é um controle manual inicial, inspirado em liberdade de sandbox. Ainda não é combate/action completo estilo Terraria.

## 3. Multiplayer simples

O multiplayer atual é um protótipo simples por HTTP:

- O host roda a simulação principal.
- O segundo jogador entra em modo join/espectador e recebe o estado do host.
- Ainda não é coop completo com dois jogadores alterando o mundo ao mesmo tempo.

### LAN/local

No PC host:

```bash
npm start
```

No outro PC da mesma rede:

```txt
http://IP-DO-HOST:5173/?join=1
```

## 4. Jogar com alguém fora da sua rede

Se a pessoa está em outra cidade, como Santa Maria, precisa expor o localhost com túnel.

### Opção rápida com Cloudflare Quick Tunnel

Terminal 1:

```bash
npm start
```

Terminal 2:

```bash
cloudflared tunnel --url http://localhost:5173
```

O Cloudflare vai gerar um link público parecido com:

```txt
https://alguma-coisa.trycloudflare.com
```

Para o amigo assistir/entrar no modo join:

```txt
https://alguma-coisa.trycloudflare.com/?join=1
```

Para tu jogar como host:

```txt
https://alguma-coisa.trycloudflare.com
```

## 5. Próxima evolução recomendada

Para virar multiplayer de verdade:

- trocar o sync HTTP por WebSocket;
- criar sala com host/join;
- cada jogador assumir um colono;
- enviar comandos do jogador remoto para o host;
- resolver conflitos de construção/coleta/combate;
- separar simulação autoritativa no servidor.
