# Roadmap — Migração Definitiva para Electron

Status: **implementação inicial aplicada**  
Projeto: **HavenFall Desktop Edition**  
Objetivo: tornar o Electron o alvo principal do jogo, deixando o navegador apenas como fallback/preview.

---

## 1. Decisão técnica

O HavenFall passa a ser tratado como jogo desktop primeiro.

```txt
Alvo principal: Electron
Fallback: navegador local via server.js
Build futuro: portátil Windows via electron-builder
```

Motivos:

- simulação ficou pesada para navegador comum;
- mapas grandes, IA, fog of war, mobs, telhados e luz dinâmica pressionam o browser;
- localStorage sozinho é frágil para save grande;
- Electron permite save em arquivo local;
- Electron permite logs, pasta de usuário, diagnóstico e empacotamento;
- o projeto já é HTML/CSS/JS e encaixa bem em Electron.

---

## 2. Nova regra de plataforma

A partir desta migração:

```txt
npm start          -> abre Electron
npm run desktop   -> abre Electron
npm run web       -> abre preview navegador
npm run dev:web   -> abre servidor navegador
```

O navegador não precisa mais ser o alvo perfeito. Ele continua útil para teste rápido, mas o jogo final deve rodar no shell desktop.

---

## 3. Objetivos da migração

### 3.1. Desktop oficial

- criar `electron-main.cjs`;
- criar `electron-preload.cjs`;
- configurar `package.json` com `main` Electron;
- adicionar scripts desktop;
- adicionar empacotamento Windows;
- abrir `index.html` direto no app;
- manter servidor web separado apenas como fallback.

### 3.2. Save local robusto

- manter compatibilidade com `localStorage`;
- adicionar save em arquivo `.json` no userData do Electron;
- criar backup manual;
- escolher automaticamente o save mais recente entre navegador e arquivo desktop;
- gravar metadados de save;
- preparar listagem futura de saves.

### 3.3. Logs e diagnóstico

- criar pasta de logs;
- registrar boot do Electron;
- registrar erro de processo/render;
- criar script de diagnóstico desktop;
- permitir abrir pasta de saves/logs pelo menu.

### 3.4. Janela e experiência desktop

- janela mínima adequada para jogo;
- estado da janela persistente;
- suporte a tela cheia;
- menu desktop com ações principais;
- DevTools por tecla ou script;
- impedir navegação externa dentro do app;
- abrir links externos no navegador padrão.

### 3.5. Build Windows

- configurar `electron-builder`;
- gerar build portátil;
- preparar saída em `release/`;
- incluir arquivos corretos no pacote.

---

## 4. Arquitetura final esperada

```txt
HavenFall/
├─ electron-main.cjs
├─ electron-preload.cjs
├─ index.html
├─ package.json
├─ server.js
├─ src/
│  └─ game/
│     └─ save-load.js
├─ scripts/
│  └─ desktop-doctor.cjs
└─ docs/
   ├─ ELECTRON_DESKTOP_ROADMAP.md
   └─ ELECTRON_DESKTOP_RUNBOOK.md
```

---

## 5. `electron-main.cjs`

Responsável pelo processo principal do Electron.

Funções obrigatórias:

- criar `BrowserWindow`;
- carregar `index.html`;
- configurar preload;
- definir segurança básica;
- controlar janela;
- criar menu;
- expor caminhos via IPC;
- abrir pastas de saves/logs;
- registrar logs de crash;
- preservar estado da janela.

### Configuração esperada da janela

```js
new BrowserWindow({
  width: 1440,
  height: 900,
  minWidth: 1100,
  minHeight: 720,
  backgroundColor: '#080b10',
  webPreferences: {
    preload: 'electron-preload.cjs',
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    webSecurity: true,
    backgroundThrottling: false
  }
});
```

### Motivo de `backgroundThrottling: false`

O jogo depende de loop visual e simulação. No desktop, não queremos o Chromium reduzindo agressivamente a atividade quando a janela perde foco em alguns cenários.

---

## 6. `electron-preload.cjs`

Responsável pela ponte segura entre jogo e sistema de arquivos.

Regras:

- renderer não recebe Node direto;
- `nodeIntegration` fica desligado;
- acesso ao sistema de arquivos passa por `contextBridge`;
- funções expostas ficam em `window.HavenfallDesktop`.

### API exposta

```js
window.HavenfallDesktop = {
  isElectron: true,
  platform,
  versions,
  paths,
  getSaveInfo(slot),
  readSaveSlot(slot),
  writeSaveSlot(slot, text, metadata),
  backupSaveSlot(slot, label),
  listSaves(),
  appendLog(message, details),
  exportDiagnostics(payload),
  openFolder(target),
  quit()
};
```

---

## 7. Save desktop

### Modelo adotado

O jogo continua salvando no `localStorage`, mas agora também salva em arquivo local quando está no Electron.

```txt
localStorage -> compatibilidade
arquivo desktop -> save principal do app
backup manual -> segurança extra
```

### Local dos saves

No Windows, o caminho fica dentro do userData do Electron, algo no padrão:

```txt
%APPDATA%/HavenFall Desktop/saves/autosave.json
```

Também existem:

```txt
%APPDATA%/HavenFall Desktop/backups/
%APPDATA%/HavenFall Desktop/logs/
```

### Escolha de save ao carregar

Ao carregar jogo:

1. lê save do navegador;
2. lê save desktop;
3. compara data de atualização;
4. usa o mais recente;
5. se usar desktop, sincroniza o `localStorage`.

---

## 8. Scripts NPM

### Scripts principais

```json
{
  "start": "npm run desktop",
  "desktop": "electron .",
  "electron": "electron .",
  "desktop:dev": "electron . --devtools",
  "desktop:diagnose": "node scripts/desktop-doctor.cjs",
  "web": "node server.js",
  "dev:web": "node server.js",
  "dist:win": "electron-builder --win portable",
  "pack:win": "electron-builder --win --dir"
}
```

### Interpretação

| Script | Uso |
|---|---|
| `npm start` | abrir o jogo no Electron |
| `npm run desktop` | abrir o jogo no Electron |
| `npm run desktop:dev` | abrir com DevTools |
| `npm run desktop:diagnose` | verificar instalação básica |
| `npm run web` | fallback navegador |
| `npm run dist:win` | gerar executável portátil |
| `npm run pack:win` | gerar pasta empacotada sem instalador |

---

## 9. Empacotamento

Configurado com `electron-builder`.

### Saída

```txt
release/
```

### Target inicial

```txt
Windows portable
```

Motivo: evita instalador complexo no começo e facilita testar em qualquer PC.

---

## 10. Menu desktop

Menu criado no Electron:

```txt
Jogo
├─ Recarregar
├─ Tela cheia
├─ Abrir pasta de saves
├─ Abrir pasta de logs
└─ Sair

Debug
├─ DevTools
└─ Recarregar ignorando cache
```

---

## 11. Diagnóstico

Criado script:

```txt
scripts/desktop-doctor.cjs
```

Ele verifica:

- `package.json`;
- `electron-main.cjs`;
- `electron-preload.cjs`;
- `index.html`;
- `src/game/save-load.js`;
- `node_modules/electron`.

Comando:

```powershell
npm.cmd run desktop:diagnose
```

---

## 12. Segurança básica

Configurações adotadas:

```txt
nodeIntegration: false
contextIsolation: true
webSecurity: true
sandbox: false apenas para permitir preload com Node controlado
```

Navegação externa é bloqueada dentro da janela. Links HTTP/HTTPS são abertos no navegador padrão.

---

## 13. Implementação aplicada

### Commit 1

```txt
55df4807c04b2b71e8360493378735ca3a121e89
chore: definir Electron como alvo desktop principal
```

Alterou:

```txt
package.json
```

Incluiu:

- `main: electron-main.cjs`;
- scripts desktop;
- scripts web fallback;
- scripts de build Windows;
- `electron`;
- `electron-builder`;
- configuração de build.

### Commit 2

```txt
19cb4c6ccb0560f36215c5b9eba1bb569c2ab5c3
feat: adicionar shell desktop Electron
```

Criou:

```txt
electron-main.cjs
```

Incluiu:

- janela principal;
- menu;
- estado de janela;
- logs;
- proteção de segunda instância;
- abertura de pastas;
- DevTools;
- carregamento de `index.html`.

### Commit 3

```txt
342ce1314aaa6d612b0fc0e1f81afa515d7445f9
feat: adicionar ponte desktop segura para saves
```

Criou:

```txt
electron-preload.cjs
```

Incluiu:

- `window.HavenfallDesktop`;
- save em arquivo;
- backup;
- logs;
- listagem de saves;
- diagnóstico exportável;
- abertura de pastas.

### Commit 4

```txt
d852aa27bc36e68c872ba6b4bd5f84d5ae341999
feat: integrar save com armazenamento desktop
```

Alterou:

```txt
src/game/save-load.js
```

Incluiu:

- save em arquivo desktop;
- backup manual;
- comparação entre localStorage e save desktop;
- sincronização do localStorage quando desktop é mais recente;
- metadados de save;
- migração preservando dados novos de telhado/luz.

### Commit 5

```txt
f10daa2ac03588824a621e1900aef4dd36778e4e
chore: adicionar diagnóstico desktop
```

Criou:

```txt
scripts/desktop-doctor.cjs
```

---

## 14. Checklist de validação

### Instalação

```txt
[ ] npm install baixa electron
[ ] npm run desktop:diagnose passa
[ ] npm start abre Electron
[ ] npm run desktop:dev abre com DevTools
```

### Jogo

```txt
[ ] menu abre
[ ] novo jogo abre
[ ] canvas aparece
[ ] jogo roda sem depender do navegador
[ ] DevTools abre com F12
[ ] tela cheia funciona com F11
```

### Save

```txt
[ ] salvar manual mostra mensagem de desktop
[ ] pasta de saves contém autosave.json
[ ] pasta de backups recebe backup manual
[ ] fechar e abrir carrega save
[ ] se localStorage estiver vazio, desktop save carrega
```

### Logs

```txt
[ ] pasta de logs existe
[ ] desktop.log registra boot
[ ] renderer.log registra erros da ponte quando ocorrerem
```

### Build

```txt
[ ] npm run pack:win cria pasta empacotada
[ ] npm run dist:win cria portable em release
```

---

## 15. Próximas etapas recomendadas

### Curto prazo

- botão de menu interno para abrir pasta de saves;
- tela de configuração gráfica desktop;
- modo performance baixo/médio/alto;
- salvar múltiplos slots;
- botão exportar diagnóstico dentro do jogo;
- comando interno para resetar cache/localStorage sem apagar saves desktop.

### Médio prazo

- auto-backup rotativo por dia;
- tela de carregamento de slots;
- compactação de save grande;
- logs de performance;
- build com ícone `.ico` dedicado;
- instalador Windows opcional.

### Longo prazo

- launcher de configuração antes do jogo;
- atualização automática;
- relatório de crash amigável;
- separar render/simulação em workers;
- build Linux/macOS se necessário.

---

## 16. Regra de manutenção

Não recriar versões paralelas tipo:

```txt
electron-main-v2.cjs
save-load-v2.js
desktop-v2.js
```

A evolução deve ser feita nos arquivos reais:

```txt
electron-main.cjs
electron-preload.cjs
src/game/save-load.js
package.json
```

---

## 17. Resultado final esperado

Fluxo de desenvolvimento após a migração:

```txt
1. Abrir PowerShell na pasta do projeto.
2. Rodar npm install quando dependências mudarem.
3. Rodar npm start.
4. Jogar no Electron.
5. Salvar em arquivo desktop.
6. Usar navegador apenas como fallback.
7. Gerar build Windows quando necessário.
```
