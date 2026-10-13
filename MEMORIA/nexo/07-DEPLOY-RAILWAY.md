# 🚀 Deploy no Railway — como publicar e como funciona a auto-atualização

> **Caminho principal (o que usamos e funciona):** commit + `git push`.
> O Railway faz deploy automático quando detecta push no `main`.

---

## Dados da conta (fixos)

| Item | Valor |
|------|-------|
| Servidor | `https://nexo-production-0b47.up.railway.app` |
| Projeto | `7b4d1d98-9ae8-41b1-abea-23c396f6f956` |
| Serviço | `52c126ae-6127-4489-bb5a-2a2ee9f0406a` |
| Ambiente | `production` |
| Root directory | `Planos/Nexo` |
| Volume | `nexo-volume` montado em `/dados` (`NEXO_DIR_DADOS=/dados`) |
| Git | GitHub `arcelinoleal-txt/Nexo`, branch **`main`** |

---

## Fluxo de publicação (passo a passo)

```powershell
# 1. Versionar os DOIS arquivos com a MESMA versão
#    Planos\Nexo\package.json   → "version"
#    Planos\Nexo\versao.json     → "versao"  (+ "novidades")

# 2. Rodar as 4 suítes (ver 08-TESTES.md) — 188/188

# 3. Build do instalador  (NPM.CMD, não npm)
C:\nvm4w\nodejs\npm.cmd run dist
#   → Planos\Nexo\versoes\v1.12.0\Nexo-Setup-1.12.0.exe

# 4. Commit
git add -A
git -c credential.helper= commit -F caminho\msg.txt
git -c credential.helper= push origin master:main

# 5. Railway auto-deploy (basta esperar)

# 6. Verificar
curl https://nexo-production-0b47.up.railway.app/api/versao
#   → deve devolver a versão nova + download/sha256/tamanho
```

> **Branch local é `master`; remoto é `main`** → sempre `push origin master:main`.

---

## 🤖 Auto-atualização (design aprovado)

O app **não precisa de usuário baixar à mão**. Fluxo:

1. Cliente chama **`GET /api/versao`**.
2. O **servidor** calcula `download`, `sha256`, `tamanho` localizando
   `versoes/v<versao>/Nexo-Setup-<versao>.exe`.
3. Se houver versão maior, o app mostra o aviso (sino de notificação).
4. Cliente baixa via **IPC** para a pasta temporária.
5. **Confere o SHA-256 ANTES de executar qualquer coisa.**
6. Se bater, executa o instalador (`spawn`) e fecha o app (`quit`).
7. Instalador roda → app volta atualizado.

### Rota de download `GET /atualizacao/<arquivo>`
Guardas obrigatórias:
- `path.basename()` do nome pedido (bloqueia `../` e `..\`).
- Regex `^nexo-setup-[\w.-]+\.exe$`.
- `fs.statSync(...).isFile()` (bloqueia diretório).
- **Resolve a subpasta da versão a partir do nome do arquivo**
  (`Nexo-Setup-1.12.0.exe` → `versoes/v1.12.0/`).

> 🐛 **Bug já corrigido:** antes procurava direto em `versoes/` (sem subpasta)
> → `/api/versao` anunciava um download que dava **404**. Foi o principal
> fix da 1.12.0. **Não re-introduza.** Teste de regressão: seção 11 de
> `servidor/_teste.js`.

### Headers corretos do download
`Content-Disposition: attachment` · `Cache-Control: no-store` · status 200.

---

## ⚠️ Avisos do Railway

- **`railway.json` com healthcheck `/health` está deprecado pelo Railway
  a partir de 2026-12-01** — precisa migrar para `.railway/railway.ts`.
- **Token do Railway está INVÁLIDO** (no `nexo-secreto-backup.txt`).
  Não afeta o deploy (é automático), mas o **CLI** não funciona até gerar um
  novo token.
- Deploy manual de artefato (método antigo e complicado) ainda é possível:
  pasta limpa → junção de `node_modules` → rodar testes → remover →
  reestruturar sob `Planos/Nexo/` → `railway up --project ... --service ...`.
  **Prefira o `git push`.**

---

## Checagem pós-deploy

```powershell
# Versão no ar
curl https://nexo-production-0b47.up.railway.app/api/versao
#  → "versao": "1.12.0", download, sha256, tamanho

# Download do instalador
curl -I https://nexo-production-0b47.up.railway.app/atualizacao/Nexo-Setup-1.12.0.exe
#  → 200, header MZ, Content-Disposition: attachment

# Guardas devem dar 404
/atualizacao/../../algo.exe
/atualizacao/%2fetc%2fpasswd
/atualizacao/algo.blockmap
/atualizacao/Nexo-Setup-9.9.9.exe   (versão inexistente)

# Raiz
curl https://nexo-production-0b47.up.railway.app/
#  → 200
```

---

## Build local (sem publicar)

```powershell
C:\nvm4w\nodejs\npm.cmd run dist
#  = electron-builder --win --x64 --publish never
```

- **`electron-builder` lê `package.json`** pra nomear o instalador.
- **O servidor lê `versao.json`** pra anunciar.
  → **Se divergirem, sai instalador com nome errado.**
- **`servidor/**/*` vai DENTRO do `.exe`** → qualquer mudança no servidor
  exige **novo build**.
