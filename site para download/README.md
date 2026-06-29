# Site para download — HavenFall Desktop

Esta pasta contém uma landing page simples para divulgar e baixar o HavenFall Desktop em formato Electron.

## Arquivos

```txt
site para download/
├─ index.html
├─ styles.css
├─ script.js
├─ README.md
└─ downloads/
   └─ HavenFall-Desktop-portable.exe
```

## Como usar localmente

Abra o arquivo:

```txt
site para download/index.html
```

Ou sirva a pasta com um servidor estático.

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

## Observação

O executável não foi incluído no repositório porque ele deve ser gerado localmente pelo Electron Builder.

## Personalização rápida

Para trocar versão ou nome do arquivo, edite:

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
