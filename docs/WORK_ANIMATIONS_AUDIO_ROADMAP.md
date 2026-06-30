# Roadmap — Animações de Trabalho + Sons do HavenFall

## Auditoria 2026-06-30

Estado real encontrado:

- Os arquivos `audio-sfx-system.js` e `work-feedback-system.js` existiam, mas o carregamento principal estava fragil: dependia do `menu-branding.js` injetar scripts em paralelo. Agora os dois sistemas entram pelo manifesto oficial em `src/game/boot.js`, com o `menu-branding.js` apenas como fallback.
- O feedback de mineracao estava parcialmente integrado; as demais tarefas tinham feedback durante o trabalho, mas varias conclusoes terminavam em silencio. Agora coleta, construcao, craft, forja, pesquisa, cozinha, cura e desconstrucao chamam `HavenfallWorkFeedback.notifyComplete(...)`.
- O progresso visual de tarefas em bancadas usava `c.work % 1`, o que nao representava o progresso real. Agora usa duracao da receita, custo da pesquisa ou `work` da estacao/objeto.
- O sistema de audio tinha volumes fixos. Agora `settings.audio` existe, e o mixer respeita audio ligado/desligado, volume geral, SFX, ambiente, UI reservado e chuva normal/reduzida/desligada.
- O feedback visual agora respeita `graphics.particles` para reduzir ou desligar particulas.

Ainda pendente:

- Fallback para arquivos reais em `assets/audio`.
- Sons de UI nos botoes principais.
- Variacoes visuais/sonoras mais profundas por ferramenta equipada; hoje a ferramenta equipada aparece no pawn, mas o perfil procedural do trabalho ainda e por tipo de tarefa.

---

## Objetivo

Implementar um sistema leve, modular e reaproveitável para dar vida aos NPCs/colonos durante tarefas de trabalho, no estilo de feedback visual de jogos como RimWorld: o personagem fica no tile correto, olha para o alvo, executa uma animação curta de ferramenta, solta partículas, toca som contextual e mostra progresso.

A meta é melhorar a sensação de ação sem criar sprites pesados para cada tarefa e sem comprometer o framerate.

---

## Princípio técnico

O sistema deve ser baseado em camadas:

```text
Tarefa real do jogo
+ estado visual temporário do colono
+ ferramenta procedural desenhada no canvas
+ partículas curtas
+ som procedural ou arquivo futuro
+ barra de progresso contextual
```

Isso evita criar uma animação completa diferente para cada ação. O mesmo motor visual pode ser reaproveitado para mineração, madeira, construção, crafting, pesquisa, cozinha e cura.

---

## Fase 1 — Base implementada nesta versão

### 1. Sistema de sons procedural

Arquivo criado:

```text
src/game/systems/audio-sfx-system.js
```

Responsabilidades:

- Inicializar Web Audio API sob demanda.
- Respeitar o bloqueio natural do navegador/Electron, liberando áudio no primeiro clique/tecla.
- Criar SFX sem depender de arquivos `.wav` iniciais.
- Gerar sons por síntese leve:
  - impacto em pedra;
  - minério/metálico;
  - pedra quebrando;
  - madeira cortando;
  - madeira quebrando;
  - sucata/metal;
  - trabalho leve de crafting, pesquisa, cozinha e cura;
  - chuva procedural em loop;
  - trovão distante eventual.

API pública:

```js
window.HavenfallAudio.playWorkImpact(kind, detail)
window.HavenfallAudio.playWorkComplete(kind, detail)
window.HavenfallAudio.setRainActive(active, intensity)
window.HavenfallAudio.unlock()
```

### 2. Sistema visual de feedback de trabalho

Arquivo criado:

```text
src/game/systems/work-feedback-system.js
```

Responsabilidades:

- Observar colonos com tarefa ativa e sem caminho pendente.
- Detectar o tipo de tarefa atual.
- Virar o colono para o alvo.
- Desenhar ferramenta procedural por cima do colono.
- Criar pulso visual no alvo.
- Gerar partículas curtas de impacto.
- Mostrar barra de progresso contextual.
- Disparar SFX de impacto no ritmo da ação.

Tarefas cobertas nesta fase:

| Tarefa | Feedback visual | Som |
|---|---|---|
| `mine` | picareta, poeira, pulso na rocha | pedra/minério |
| `gather` em árvore | machado, lascas | madeira |
| `gather` genérico | mãos/ferramenta leve | coleta leve |
| `build` | martelo | construção |
| `craft` | ferramenta curta | bancada/crafting |
| `forge` | martelo/metálico | metal/sucata |
| `research` | pulso de análise | bip/scan leve |
| `cook` | movimento leve | preparo |
| `heal` | ferramenta médica leve | cura leve |

### 3. Integração com mineração real

Arquivo alterado:

```text
src/game/systems/mining-task-handler.js
```

O handler de mineração agora notifica o sistema visual/sonoro quando uma rocha é removida:

```js
window.HavenfallWorkFeedback.notifyComplete(...)
```

Isso toca som de quebra e solta uma explosão curta de partículas no tile minerado.

### 4. Integração no runtime

Arquivo alterado:

```text
src/game/boot.js
```

Os novos sistemas entram no runtime pelo manifesto oficial de boot:

```text
audio_sfx_system
work_feedback_system
```

Eles se registram no `GameSystems`, sem duplicar o loop principal.

Nota de auditoria: `src/game/ui/menu-branding.js` permanece apenas como fallback para evitar regressao em carregamentos antigos; o caminho correto agora e `src/game/boot.js`.

---

## Fase 2 — Próximo passo recomendado

### 1. Finalização por tarefa além da mineração

Status 2026-06-30: concluido na auditoria. As notificacoes foram adicionadas para:

- árvore derrubada;
- coleta de berry/crop;
- blueprint finalizado;
- item fabricado;
- pesquisa concluída;
- comida preparada;
- cura finalizada.

Exemplo desejado:

```js
window.HavenfallWorkFeedback.notifyComplete('wood', { objectType: 'tree' }, obj.x, obj.y)
```

### 2. Mixagem e configurações de áudio

Adicionar no menu de configurações:

- Áudio: ligado/desligado;
- Volume geral;
- Volume SFX;
- Volume ambiente;
- Volume UI;
- Chuva: normal/reduzida/desligada.

Salvar em `settings` para o sistema de áudio respeitar automaticamente.

### 3. Arquivos de áudio reais opcionais

Quando houver um pack próprio de áudio, o sistema pode ser expandido assim:

```text
assets/audio/sfx/stone_hit_01.wav
assets/audio/sfx/stone_hit_02.wav
assets/audio/sfx/stone_break_01.wav
assets/audio/sfx/wood_chop_01.wav
assets/audio/sfx/wood_break_01.wav
assets/audio/ambient/rain_light_loop.wav
assets/audio/ambient/rain_heavy_loop.wav
assets/audio/ambient/wind_loop.wav
assets/audio/ui/click_01.wav
```

O motor atual pode continuar como fallback caso algum arquivo não carregue.

---

## Fase 3 — Animações específicas por profissão

Criar perfis por tipo de trabalho:

```js
workProfile: {
  type: 'mine',
  tool: 'pickaxe',
  impactEvery: 0.48,
  sfx: 'stone_hit',
  completeSfx: 'stone_break',
  particle: 'dust'
}
```

Perfis planejados:

| Perfil | Uso |
|---|---|
| `mine` | rochas, minério, paredes naturais |
| `woodcut` | árvores, troncos |
| `build` | blueprint, paredes, portas, móveis |
| `repair` | equipamentos e estruturas danificadas |
| `craft` | bancadas de fabricação |
| `forge` | metalurgia |
| `research` | mesa de pesquisa |
| `medical` | estação médica |
| `cook` | fogão/fogueira |
| `loot` | ruínas, caixas, sucata |

---

## Fase 4 — Otimização visual

Para manter FPS alto:

- Limitar partículas ativas.
- Só desenhar feedback em objetos visíveis na câmera.
- Não usar sprites grandes para cada ação.
- Reaproveitar cálculos simples com seno/cosseno.
- Tocar SFX com cooldown por tipo.
- Não criar áudio novo a cada frame.
- Fazer loops de ambiente com `GainNode`, não recriando fontes toda hora.

Limites atuais da Fase 1:

```text
MAX_SPARKS = 70
impact cooldown mínimo = 70ms
rain tick interval = 180ms
```

---

## Fase 5 — Direção artística

O padrão visual final deve seguir esta ideia:

```text
Colono parado no tile
+ olhando para o alvo
+ ferramenta procedural curta
+ impacto/poeira/faísca
+ som correspondente
+ progresso claro
```

Nada de animações gigantes por enquanto. O foco é clareza, performance e sensação de vida.

---

## Checklist de validação

- [x] O jogo carrega os novos sistemas pelo runtime.
- [x] A mineração tem animação visual de trabalho.
- [x] A mineração toca impacto periódico.
- [x] A quebra da rocha toca som de conclusão.
- [x] A chuva tem loop ambiente procedural.
- [x] O sistema não depende de arquivos `.wav` para funcionar.
- [x] O sistema registra ticks e overlays pelo `GameSystems`.
- [x] O sistema limita partículas para proteger FPS.
- [x] Conclusão sonora/visual para todas as tarefas não-mineração.
- [x] Sliders de volume no menu de configurações.
- [ ] Fallback para arquivos reais em `assets/audio`.
- [ ] Variações por ferramenta equipada.
- [ ] Sons de UI integrados aos botões principais.

---

## Arquitetura atual após esta entrega

```text
src/game/systems/audio-sfx-system.js
  └─ motor procedural de sons e ambiente

src/game/systems/work-feedback-system.js
  └─ motor visual de trabalho dos colonos

src/game/systems/mining-task-handler.js
  └─ mineração real + notificação de conclusão

src/game/boot.js
  └─ carregamento oficial dos sistemas no runtime
```

Essa estrutura deixa o HavenFall pronto para evoluir de forma limpa, sem criar arquivos de hotfix, patch ou duplicação de lógica.
