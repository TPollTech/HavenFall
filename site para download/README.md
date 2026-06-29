# Site para download — HavenFall Desktop

Esta pasta contém uma landing page estática para divulgar e baixar o HavenFall Desktop.

Ela **não precisa de Electron** para abrir. É só um site normal feito com:

```txt
HTML
CSS
JavaScript simples
```

O Electron é apenas o formato do jogo baixado.

---

## Arquivos

```txt
site para download/
├─ index.html
├─ styles.css
├─ script.js
├─ README.md
└─ downloads/
   ├─ .gitkeep
   └─ HavenFall-Desktop-portable.exe
```

---

## Como abrir localmente

Pode abrir direto no navegador:

```txt
site para download/index.html
```

Ou, dentro da pasta do projeto, servir com qualquer servidor estático.

Exemplo simples com Node:

```powershell
npx serve "site para download"
```

---

## Como colocar o executável

Depois de gerar o build Electron:

```powershell
npm.cmd run dist:win
```

Copie o `.exe` gerado na pasta `release/` para:

```txt
site para download/downloads/HavenFall-Desktop-portable.exe
```

O botão principal da landing page já aponta para:

```txt
downloads/HavenFall-Desktop-portable.exe
```

---

## Como hospedar

A pasta pode ser hospedada em qualquer lugar que sirva arquivos estáticos:

```txt
GitHub Pages
Hostinger
Netlify
Vercel
Cloudflare Pages
Servidor próprio
```

Basta subir a pasta inteira:

```txt
site para download/
```

E manter o executável dentro de:

```txt
site para download/downloads/
```

---

## Observação

O executável não foi incluído no repositório porque ele deve ser gerado localmente pelo Electron Builder.

---

## Personalização rápida

Para trocar versão, nome do arquivo ou caminho do download, edite:

```txt
site para download/script.js
```

Campo principal:

```js
const RELEASE = {
  version: '1.7.0',
  fileName: 'HavenFall-Desktop-portable.exe',
  relativePath: 'downloads/HavenFall-Desktop-portable.exe'
};
```
