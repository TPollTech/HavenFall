# HavenFall Desktop — Comandos PowerShell

Este arquivo é o guia direto para rodar o HavenFall como app desktop via Electron.

---

## 1. Abrir a pasta do projeto

No PowerShell:

```powershell
cd "C:\Projetos git\HavenFall"
```

Se a pasta do projeto tiver outro nome, ajuste o caminho.

---

## 2. Atualizar o projeto

```powershell
git fetch origin
git reset --hard origin/main
git clean -fd
```

---

## 3. Instalar dependências

Obrigatório depois da migração para Electron:

```powershell
npm.cmd install
```

Se o Electron falhar na instalação ou abrir erro dizendo que não instalou corretamente:

```powershell
Remove-Item .\node_modules -Recurse -Force
Remove-Item .\package-lock.json -Force
npm.cmd install
```

---

## 4. Diagnóstico desktop

Antes de abrir o jogo, rode:

```powershell
npm.cmd run desktop:diagnose
```

Resultado esperado:

```txt
Diagnóstico básico OK. Rode: npm.cmd run desktop
```

---

## 5. Abrir o jogo no Electron

Comando principal:

```powershell
npm.cmd start
```

Ou diretamente:

```powershell
npm.cmd run desktop
```

---

## 6. Abrir com DevTools

Use este comando quando precisar ver erros no console:

```powershell
npm.cmd run desktop:dev
```

Atalhos dentro do app:

```txt
F12              abre/fecha DevTools
Ctrl + R         recarrega
Ctrl + Shift + R recarrega ignorando cache
F11              tela cheia
```

---

## 7. Rodar fallback no navegador

O navegador fica apenas como fallback/preview:

```powershell
npm.cmd run web
```

Depois abrir:

```txt
http://localhost:5173
```

---

## 8. Onde ficam os saves

No Electron, o save principal fica na pasta de dados do app.

Caminho padrão no Windows:

```txt
%APPDATA%\HavenFall Desktop\saves\autosave.json
```

Backups manuais:

```txt
%APPDATA%\HavenFall Desktop\backups\
```

Logs:

```txt
%APPDATA%\HavenFall Desktop\logs\
```

Também dá para abrir essas pastas pelo menu do app:

```txt
Jogo -> Abrir pasta de saves
Jogo -> Abrir pasta de logs
```

---

## 9. Gerar build portátil Windows

Para gerar uma pasta empacotada sem instalador:

```powershell
npm.cmd run pack:win
```

Para gerar um executável portátil:

```powershell
npm.cmd run dist:win
```

Saída esperada:

```txt
release\
```

---

## 10. Comando completo recomendado do zero

Use este bloco quando quiser atualizar e rodar tudo limpo:

```powershell
cd "C:\Projetos git\HavenFall"
git fetch origin
git reset --hard origin/main
git clean -fd
npm.cmd install
npm.cmd run desktop:diagnose
npm.cmd start
```

---

## 11. Se abrir tela preta

Abra com DevTools:

```powershell
npm.cmd run desktop:dev
```

No Console, copie o erro vermelho completo.

Também verifique logs em:

```txt
%APPDATA%\HavenFall Desktop\logs\
```

---

## 12. Se o Electron não abrir

Tente limpar instalação:

```powershell
cd "C:\Projetos git\HavenFall"
Remove-Item .\node_modules -Recurse -Force
Remove-Item .\package-lock.json -Force
npm.cmd install
npm.cmd run desktop:diagnose
npm.cmd start
```

---

## 13. Se quiser voltar temporariamente para navegador

```powershell
npm.cmd run web
```

Mas o alvo oficial agora é:

```powershell
npm.cmd start
```
