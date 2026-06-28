# Roadmap Hiper-Mega: Mundo Vivo do HavenFall

Este roadmap transforma o HavenFall de um simulador com entidades soltas em um ecossistema de colônia com comportamento, memória, rotas, ciclos naturais, água, exploração, visitantes e eventos emergentes.

## Visão geral

Objetivo: fazer o mundo parecer vivo mesmo quando o jogador não está mexendo diretamente em nada.

Pilares:

1. Fauna com identidade própria.
2. Natureza dinâmica.
3. Água como elemento real de mapa e simulação.
4. Exploração com fog of war legível.
5. Mapa global com waypoints.
6. Visitantes, mercadores e eventos sociais.
7. Ameaças externas tratadas como eventos sistêmicos, sem depender de spawn aleatório vazio.
8. IA com intenção: fome, descanso, abrigo, água, grupo, medo, curiosidade e rotas.

---

## Fase 1 — Fundação do mundo vivo

Status: implementado como primeira base.

### Animais

Cada animal precisa ter:

- velocidade base;
- velocidade de disparada curta;
- raio de alerta;
- preferência de terreno;
- afinidade por água;
- afinidade por cobertura vegetal;
- comportamento de grupo;
- período de atividade;
- estados internos simples.

Estados iniciais:

- pastando;
- vagando;
- bebendo água;
- repousando;
- acompanhando grupo;
- em alerta.

Resultado esperado:

- cervos ficam mais atentos e mantêm distância;
- coelhos alternam parada e disparada curta;
- patos e tartarugas tendem a ficar perto da água;
- esquilos procuram mais cobertura vegetal;
- animais de rebanho tendem a ficar próximos.

---

## Fase 2 — Água real no mundo

Adicionar:

- lagos pequenos;
- açudes naturais;
- rios sinuosos;
- margens orgânicas;
- renderização própria de água;
- bloqueio de passagem em água profunda;
- preferência de spawn de certos animais perto de água.

Implementação inicial:

- geração pós-mapa cria lagoas e um possível rio;
- tiles de água são renderizados com camada procedural;
- água entra na colisão do mapa;
- mapa global mostra água em destaque.

Próximas melhorias:

- ponte;
- pesca;
- sede;
- captação de água;
- qualidade da água;
- irrigação.

---

## Fase 3 — Natureza dinâmica

Adicionar regeneração natural:

- árvores novas surgindo longe da base;
- arbustos aparecendo em bordas de floresta;
- frutas silvestres reaparecendo em áreas férteis;
- crescimento mais provável perto de água;
- menor crescimento perto de muita construção.

Implementação inicial:

- todo novo dia pode gerar vegetação natural em áreas válidas;
- o sistema evita spawn sobre objetos existentes;
- prioriza tiles de grama/terra, perto de água ou de árvores existentes.

Próximas melhorias:

- mudas com estágios visuais;
- árvores adultas levando vários dias;
- eventos de seca;
- incêndio ambiental abstrato;
- estação do ano.

---

## Fase 4 — Fog of war mais agradável

Problema anterior:

- área não descoberta ficava totalmente apagada.

Meta:

- área nunca vista fica escura, mas com textura sutil;
- área já vista fica sombreada;
- área visível fica clara;
- pontos de interesse já descobertos continuam legíveis.

Implementação inicial:

- fog desconhecido deixa o mapa escuro, mas não 100% preto;
- tiles lembrados ficam com sombra média;
- grade de exploração fica mais confortável visualmente.

---

## Fase 5 — Mapa global e waypoints

Atalho:

- tecla M abre/fecha mapa global.

Funções:

- ver o mapa inteiro;
- diferenciar terrenos;
- ver área descoberta;
- ver colonos;
- ver visitantes;
- ver pontos marcados;
- clicar no mapa para criar waypoint.

Implementação inicial:

- overlay de mapa em tela cheia;
- canvas com miniatura do mundo;
- clique cria marcador;
- marcadores aparecem no mundo.

Próximas melhorias:

- renomear waypoint;
- remover waypoint;
- categoria por cor;
- rota sugerida até waypoint;
- ordem de exploração automática.

---

## Fase 6 — Visitantes e mercadores

Adicionar:

- visitantes ocasionais;
- mercadores ocasionais;
- pequenos grupos passando pelo mapa;
- chegada por borda do mapa;
- caminhada até região da base;
- saída depois de algumas horas.

Implementação inicial:

- sistema cria visitantes em dias alternados;
- alguns visitantes trazem oferta simples;
- visitantes aparecem no mapa global e no mundo.

Próximas melhorias:

- reputação;
- trocas;
- missões;
- pedidos de abrigo;
- boatos sobre pontos de interesse;
- facções.

---

## Fase 7 — Eventos externos com contexto

Trocar eventos soltos por eventos com causa:

- fauna se aproxima se há comida exposta;
- mercador aparece mais em clima bom;
- visitantes evitam noites ruins;
- eventos ambientais dependem de água, floresta e estação;
- áreas exploradas aumentam chance de encontros.

---

## Fase 8 — IA avançada de animais

Melhorias futuras:

- memória de local seguro;
- rotas preferidas;
- descanso por horário;
- busca de água;
- busca de cobertura;
- grupo com líder;
- filhotes e reprodução abstrata;
- migração por estação;
- reação a chuva;
- reação a presença humana;
- reação a barulho.

---

## Fase 9 — Ecossistema completo

Sistemas futuros:

- cadeias alimentares abstratas;
- água afetando vegetação;
- vegetação afetando fauna;
- fauna espalhando sementes;
- eventos de seca e excesso de chuva;
- solo fértil;
- plantas invasoras;
- biomas com regras próprias.

---

## Fase 10 — Polimento visual e UX

Melhorias visuais:

- animações de caminhada por espécie;
- pausa natural antes de movimento;
- movimento em curva;
- sombras leves;
- pegadas temporárias;
- ondas na água;
- reflexo simples;
- indicadores de waypoint;
- painel de inspeção do animal.

UX:

- M abre mapa;
- clique cria waypoint;
- Shift + clique remove waypoint;
- painel lateral do mapa;
- filtros: água, fauna, recursos, construções, pontos de interesse.

---

## Implementação atual incluída

Arquivos planejados/alterados:

- `src/game/systems/living-world.js`
- `src/game/ui/fog-of-war-render-hook.js`
- `src/game/boot.js`
- `docs/LIVING_WORLD_ROADMAP.md`

Resumo da primeira entrega:

- perfis de comportamento animal;
- movimento animal menos aleatório;
- água procedural;
- tile renderer de água;
- colisão de água;
- crescimento natural diário;
- visitantes e mercadores simples;
- mapa global com tecla M;
- waypoints clicáveis;
- fog of war menos apagado.
