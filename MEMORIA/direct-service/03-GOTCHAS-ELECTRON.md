# 🔨 ARMADILHAS DO ELECTRON NESTE COMPUTADOR

Tudo aqui já custou tempo. Não repita.

---

## 1. O Windows bloqueia o empacotador (O MAIOR PROBLEMA)

**Sintoma:**
```
app-builder.exe process failed ERR_ELECTRON_BUILDER_CANNOT_EXECUTE
```

O `electron-builder` chama o `app-builder.exe` para extrair o Electron,
e o Windows **recusa a execução quando vem de outro processo**. O mesmo
arquivo roda normal digitando direto no terminal — é proteção do
Defender contra binário extraído, não defeito do código.

**Já tentado e NÃO resolveu:** `--dir`, `Unblock-File`, baixar o
`.tgz` de novo do registry, copiar por cima, `npm install`.

### ✅ Solução: empacotar na mão

```bash
node _ferramentas\monta-pacote.js    # monta dist/ds-pkg
node _ferramentas\empacota-zip.js    # gera dist/Direct-Service-1.0.0.zip
```

`monta-pacote.js` faz: copia **todo** o runtime do
`node_modules/electron/dist` (menos `resources/`), copia `electron.exe`
como `Direct Service.exe`, e junta `main.js`, `preload.js`, `config.js`,
`package.json`, `app/` e `assets/` num `app.asar` com `@electron/asar`.

**O `.zip` substitui o instalador `.exe`.** Instala em 4 cliques,
funciona igual e não deixa lixo em "Apps instalados".

> O primeiro build passou antes do bloqueio começar. Quando parar de
> passar, é o Defender — o código estava certo.

---

## 2. Falta a pasta `resources/` e os `.pak` e as DLL

Na primeira tentativa de empacotar na mão, copiei só alguns arquivos e
o programa **abria e morria sem log nenhum**.

Faltava: `chrome_100_percent.pak`, `d3dcompiler_47.dll`, `ffmpeg.dll`,
`icudtl.dat`, `libEGL.dll`, `resources.pak`, `snapshot_blob.bin`,
`v8_context_snapshot.bin`, `vk_swiftshader.dll`, `vulkan-1.dll`,
`vk_swiftshader_icd.json`, `locales/`.

**Regra: copie TUDO da raiz do `electron/dist`, menos `resources/` e
menos o `electron.exe`.**

---

## 3. `rmSync` falha com EPERM

O Windows segura o `.exe` se o programa está aberto. Antes de limpar
pasta de build:

```powershell
taskkill /F /IM "Direct Service" /T
taskkill /F /IM electron.exe /T
```

Os processos do Electron não respondem ao `taskkill` normal às vezes:

```powershell
Get-Process | Where-Object { $_.ProcessName -match 'Direct|electron' } |
  ForEach-Object { Stop-Process -Id $_.Id -Force }
```

---

## 4. Caminho com espaço quebra o `--dados=`

O `main.js` lê:
```js
const i = process.argv.findIndex(a => a.startsWith('--dados='));
```

Com **Start-Process do PowerShell**, um caminho com espaço
(`C:\Users\Arcelino Leal\...`) chega **cortado** no espaço. O
`mkdirSync` cria `C:\Users\Arcelino` e a janela nunca abre — o app morre
com `UnhandledPromiseRejection` e **sem mensagem na tela**.

Ao passar argumentos com o PowerShell, use aspas dentro do array:
```powershell
$arg = '. --dados="{0}" --remote-debugging-port=9344' -f $copia
```

---

## 5. Erro de cache ao abrir

```
ERROR:disk_cache.cc(208)] Unable to create cache
ERROR:gpu_disk_cache.cc(713)] Gpu Cache Creation failed: -2
```

A pasta de usuário do `%APPDATA%` ficou corrompida de uma execução
anterior. **Solução:** passar `--user-data-dir=<pasta nova>`.

```powershell
$ud = Join-Path $env:TEMP "dsfinal"
New-Item -ItemType Directory -Force -Path $ud | Out-Null
Start-Process ".\Direct Service.exe" -ArgumentList "--user-data-dir=$ud"
```

Com isso o app funcionou na hora. **Não é bug do código.**

---

## 6. `app.whenReady().then()` sem `try/catch`

Se qualquer coisa dentro derrubar (como no caso do `--dados`), o app
**não abre janela nenhuma** e o usuário só vê "não funciona".

Se precisar blindar, coloque um `try/catch` no `whenReady` e mostre um
`dialog.showErrorBox`. Não foi necessário para o problema acima, mas é
a causa raiz do "app que não abre sem explicar nada".

---

## 7. npm novo trava a instalação de binários

```
npm warn allow-scripts ... electron@32.3.3 (install scripts present)
```

O `npm install` **não instala** o binário. O arquivo simplesmente não
aparece. Foi preciso baixar o `.tgz` do registry direto e copiar na mão.

```powershell
Invoke-WebRequest "https://registry.npmjs.org/app-builder-bin" | ConvertFrom-Json
# pega dist-tags.latest e dist.tarball
tar -xzf abb.tgz -C $tmp
# copia o conteúdo para node_modules/app-builder-bin
```

**Mas:** mesmo recopiado, o Defender continuou bloqueando (item 1).

---

## 8. Teste com CDP abre porta de depuração

Para testar o app de verdade (clicar, ler tela, medir):

```powershell
Start-Process ".\Direct Service.exe" `
  -ArgumentList "--remote-debugging-port=9344","--user-data-dir=$ud"
```

Depois conecte via `http://127.0.0.1:9344/json/list` e use
`Runtime.evaluate`. **Aguarde ~25 s** para a base de 4.648 carregar —
antes disso `/json/list` volta vazio e parece que o app não abriu.

Scripts prontos em `_ferramentas/`:
`diag-busca-real.js`, `diag-abordagens.js`, `diag-final.js`,
`diag-ramos-graves.js`.

---

## 9. Teste NUNCA pode tocar no banco real

O `main.js` tem o parâmetro `--dados=` exatamente para isso. Já houve
**19 clientes marcados como "Fechado" sem a pessoa ter falado com
ninguém**, porque teste abriu o banco de verdade.

Sempre copie os dados para uma pasta temporária antes de testar.