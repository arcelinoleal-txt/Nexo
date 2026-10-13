# 📌 Estado Atual do Nexo — v1.12.0 (12/10/2026)

> **Resumo de uma linha:** O Nexo está PUBLICADO e FUNCIONANDO no Railway.
> App Electron estilo Discord (chat, canais, voz, tela, DMs, arquivos, amizades)
> com servidor Node na nuvem. 188 testes passando. Falta só o usuário instalar.

---

## 🟢 O que está pronto e no ar

| Item | Situação |
|------|----------|
| **Servidor Railway** | ✅ No ar, respondendo v1.12.0 — `https://nexo-production-0b47.up.railway.app` |
| **Build Windows** | ✅ `Planos/Nexo/versoes/v1.12.0/Nexo-Setup-1.12.0.exe` (76.7 MB) |
| **Git** | ✅ Commit `73069e4` no `main` (GitHub: `arcelinoleal-txt/Nexo`) |
| **Testes** | ✅ **188/188 passando** (4 suítes) |
| **Auto-atualização** | ✅ Cliente detecta, baixa, confere SHA-256 e instala sozinho |
| **Amizades (tela nova)** | ✅ Painel estilo Discord com 4 abas na coluna esquerda |
| **Chamada de voz** | ✅ Painel Discord com avatares + anel verde neon em quem fala |
| **Visual Discord** | ✅ Tokens oficiais (`#313338`, `#5865f2`, etc.) aplicados |
| **FCC (Free Claude Code)** | ✅ v6.16.0 instalado e funcionando (NVIDIA NIM) |

### Como testar agora
1. Instalar: `Planos/Nexo/versoes/v1.12.0/Nexo-Setup-1.12.0.exe`
2. Servidor já está no ar — o app conecta sozinho.
3. Ou rodar local: `npm run start` na pasta `Planos/Nexo`.

---

## 🧾 Histórico de versões (resumo)

| Versão | Data | O que trouxe |
|--------|------|-------------|
| **1.12.0** | 12/10/2026 | Tela de amizades estilo Discord, painel de voz redesenhado, anel verde neon, auto-atualização, visual Discord, 188 testes |
| **1.11.0** | 11/10/2026 | Correção de 401, encoding dos acentos, crash de `/arquivos/` |
| **1.10.0** | 11/10/2026 | (instalador nunca commitado — só em disco) |
| ≤1.9.x | antes | Chat, canais, voz, tela, DMs, arquivos, loja |

> **Aviso:** o repo do GitHub guarda ~1.1 GB de `.exe` antigos no histórico
> (aparece aviso `GH001` no push, não é erro). Pastas removidas do disco
> mas não commitadas de propósito: `versoes/v1.1.0` … `v1.8.0`.

---

## 📁 Onde está cada coisa

```
C:\Users\Arcelino Leal\Documents\Projeto\
├── Planos\Nexo\                  ← O PROJETO INTEIRO
│   ├── package.json              ← versão + script dist
│   ├── versao.json               ← versão que o SERVIDOR anuncia
│   ├── main.js                   ← processo principal Electron
│   ├── app\
│   │   ├── index.html            ← UI (muita coisa aqui)
│   │   ├── renderer.js           ← lógica da UI (gigante, ~5000 linhas)
│   │   ├── estilo.css            ← visual (tokens Discord no :root)
│   │   ├── preload.js            ← ponte main↔renderer
│   │   ├── notificacoes.js, icons.js, configuracoes.js, loja.js
│   ├── servidor\
│   │   ├── servidor.js           ← servidor Node + rotas + WebSocket
│   │   ├── contas.js             ← contas/amizades
│   │   ├── dados-contas.json     ← dados persistidos
│   │   └── _teste.js             ← 92 testes unitários
│   ├── testes\                   ← 3 suítes CDP (96 testes)
│   ├── versoes\vX.Y.Z\           ← instaladores por versão
│   └── VERSOES.md                ← tabela de versões
├── MEMORIA\                      ← ESTA documentação (nexo/)
├── backup\opencode-antes-fcc\    ← backup do OpenCode antes do FCC
└── nexo-secreto-backup.txt       ← tokens (GITIGNORED — não commitar)
```

---

## 🆕 O que mudou na 1.12.0 (detalhe)

### Tarefa 1 — Tela de amizades estilo Discord
- Removido `#modal-novo-amigo` (IDs duplicados quebravam).
- Criados `#painel-sala-visao` e `#painel-amigos` como views irmãs.
- Nova CSS: `.visao-painel`, `.cab-amigos`, `.abas-amigos`, `.cont-aba`,
  `.rail-badge`, `.corpo-amigos`, `.painel-adicionar`, etc.
- JS: `irParaAmigos(aba)`, `irParaSala()`, `mudarAbaAmigos(aba)`,
  `amigosEmLinha()`, estado `_abaAmigos`.
- Botões do rail esquerdo (`#rail-sala`, `#rail-amigos`, `#rail-loja`) trocam a view.
- `desenharListaAmigos()`/`desenharListaPedidos()` agora respeitam a aba.
- `presenca` atualiza a aba "Em linha" ao vivo.

### Tarefa 2 — Avatar `<img>`
- Base64 branco (glitch do avatar) corrigido usando `<img>` real.
- CSP do `index.html` teve `img-src` e `media-src` liberados.

### Tarefa 3 — Painel de voz estilo Discord
- Info de voz tirada da barra inferior para o `.barra-voz`.
- Dropdowns de dispositivo de áudio/vídeo.

### Tarefa 4 — Auto-atualização
- IPC do preload (`baixarAtualizacao`), verificação de SHA-256 **antes** de rodar,
  executa o instalador e fecha o app.

### Tarefa 5 — Anel verde neon em quem fala
- Linha de avatares + anel verde neon via **WebAudio VAD** (RMS do analyser).

### Tarefa 6 — Visual Discord
- Acento roxo `#6d5efc` → blurple `#5865f2`.
- 20 `rgba(109,94,252,...)` → `rgba(88,101,252,...)`.
- Cores de status oficiais; titlebars chapadas `#313338`.
- Base `:root` com tokens Discord reais (ver `06-DESIGN-TOKENS.md`).

---

## 🔧 Comandos que funcionam (testados)

```powershell
# Rodar os testes
node "C:\Users\Arcelino Leal\Documents\Projeto\Planos\Nexo\servidor\_teste.js"
node "C:\Users\Arcelino Leal\Documents\Projeto\Planos\Nexo\testes\amizades-ui.js"
node "C:\Users\Arcelino Leal\Documents\Projeto\Planos\Nexo\testes\e2e-servidor-real.js"
node "C:\Users\Arcelino Leal\Documents\Projeto\Planos\Nexo\testes\canal-arquivos-e-conversas.js"

# Subir servidor local
node "C:\Users\Arcelino Leal\Documents\Projeto\Planos\Nexo\servidor\servidor.js"

# Rodar o app Electron
npm run start

# Build do instalador  (usa npm.cmd — NÃO npm)
C:\nvm4w\nodejs\npm.cmd run dist
```

> ⚠️ **Nunca use `npm` puro no PowerShell** — é `.ps1` e o `Start-Process` falha.
> Veja `02-GOTCHAS-POWERSHELL.md`.

---

## 📊 Checklist de qualidade antes de publicar

- [ ] `versao.json` E `package.json` com a MESMA versão nova
- [ ] `servidor/_teste.js` — 92 passando
- [ ] `testes/amizades-ui.js` — 34 passando
- [ ] `testes/e2e-servidor-real.js` — 28 passando
- [ ] `testes/canal-arquivos-e-conversas.js` — 34 passando
- [ ] `npm run dist` gerou `versoes\v<ver>\Nexo-Setup-<ver>.exe`
- [ ] Commit + `git -c credential.helper= push origin master:main`
- [ ] Railway auto-deploy → checar `GET /api/versao`
- [ ] Download do `/atualizacao/` retorna 200 (regressão da 1.12.0)
