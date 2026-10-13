# 🏗️ Arquitetura do Nexo — como funciona por dentro

> O Nexo é um **clone do Discord** feito de propósito: Electron (Node + Chromium)
> no cliente, servidor Node puro na nuvem. **Nada de framework pesado** —
> HTML/CSS/JS puro, seguindo a preferência do Arcelino.

---

## Visão geral

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  APP ELECTRON (Windows)     │        │  SERVIDOR (Railway)          │
│  main.js ── janela          │  WSS   │  servidor/servidor.js        │
│  app/index.html (UI)        │◄──────►│   ├── contas.js (contas)     │
│  app/renderer.js (lógica)   │  REST  │   └── dados-contas.json      │
│  app/preload.js (ponte)     │◄──────►│                              │
└─────────────────────────────┘        └──────────────────────────────┘
```

- **Sinalização WebRTC** via WebSocket no servidor (troca de SDP/ICE).
- **Áudio/vídeo/chamada** via WebRTC p2p entre clientes.
- **Persistência** no servidor: JSON em `NEXO_DIR_DADOS`
  (em produção = volume `/dados` no Railway).

---

## Cliente (Electron)

| Arquivo | Papel |
|---------|-------|
| `main.js` | Cria a janela. **~L78 `janela.loadFile(...)`** → roda de `file://`, **NÃO** de `http://127.0.0.1:3000`. **~L32** já tem `app.commandLine.appendSwitch('disable-web-security')`. |
| `preload.js` | Expõe IPC seguro ao renderer (inclui `baixarAtualizacao` da auto-update). |
| `app/index.html` | Toda a UI. CSP meta com `img-src`/`media-src` liberados. Views: `#painel-sala-visao`, `#painel-amigos`. Rail: `#rail-sala`, `#rail-amigos`, `#rail-loja` + `#rail-badge-amigos`. Tema: botão de sino (`#btn-sino-atualizacao`) pra auto-update. |
| `app/renderer.js` | Toda a lógica (~5000 linhas). Objeto **`estado`** (L~24) guarda tudo. |
| `app/estilo.css` | Visual. `:root` (L5-47) tem os **tokens do Discord**. |
| `notificacoes.js`, `icons.js`, `configuracoes.js`, `loja.js` | Módulos auxiliares. |

### Funções-chave em `renderer.js` (procure por esses nomes)

| Função | O que faz |
|--------|-----------|
| `estado` | Fonte da verdade (usuário, sala, participantes, mídia) |
| `estado.participantes` | Lista de presença vinda do servidor (evento `presenca`, ~L372) |
| `abrirConversa()` (L~2369) | Abre uma DM |
| `abrirConfig()` (L~1562) | Abre as configurações |
| `carregarAmizades()` | Busca `/api/amigos*` |
| `desenharListaAmigos()` / `desenharListaPedidos()` | Renderizam as abas (respeitam a aba ativa) |
| `atualizarBadgesAmigos()` | Alimenta `#cont-aba-linha`, `#cont-aba-pedidos`, `#rail-badge-amigos` |
| `irParaAmigos(aba)` / `irParaSala()` | Trocam a view do painel esquerdo |
| `mudarAbaAmigos(aba)` | Abas "Em linha" / "Pedidos" / "Sugestões" / "Adicionar" |
| `abrirBuscaAmigo()`, `inicializarAmigos()` | (L~4129+) |
| `desenharFilaVoz()` + VAD | Linha de avatares + anel verde em quem fala |

### Regras da UI (padrão Discord)
- **Rail de servidores** (esquerda) → **painel de canais/amigos** → **chat**.
- Amizade tem **4 abas** com contadores (`.cont-aba`) e badge no rail.
- Avatares são **`<img>`**, não `<img>` base64 branco (foi bug da 1.11).
- **Anel verde neon** só em quem está falando (VAD por RMS do WebAudio).
  O analyser conecta **SÓ na `MediaStreamSource`**, **NUNCA em
  `ctx.destination`** (senão ecoa/duplica o áudio).

---

## Servidor

| Arquivo | Papel |
|---------|-------|
| `servidor/servidor.js` | HTTP + WebSocket + rotas REST + lógica de sala. |
| `servidor/contas.js` | CRUD de contas, amizades, tokens. |
| `servidor/dados-contas.json` | Persistência (em prod: `/dados/dados-contas.json`). |
| `servidor/_teste.js` | 92 testes unitários (rodam com `node`). |

### Rotas importantes

| Rota | Detalhe |
|------|---------|
| `GET /api/versao` | Servidor calcula `download`, `sha256`, `tamanho` localizando `versoes/v<versao>/Nexo-Setup-<versao>.exe` |
| `GET /atualizacao/<arquivo>` | Serve o `.exe`. Guardas: `basename` + regex `^nexo-setup-[\w.-]+\.exe$` + `isFile()` + **resolve a subpasta da versão pelo nome do arquivo** |
| `GET /api/pessoas?q=` | Precisa de **2+ letras** |
| `GET/POST /api/amigos*` | Precisa de `Authorization: Bearer <token>`; corpo usa **`amigoId`** |
| Rotas estáticas | **NUNCA** exigem auth |
| `POST /api/registro` | Username regex `^[a-zA-Z0-9_.-]{3,24}$`; corpo via `--data @arquivo` |

---

## 🐛 O bug da 1.12.0 (aprendizado importante)

**O que foi:** a rota `/atualizacao/` procurava o `.exe` **direto em `versoes/`**,
mas o instalador fica em `versoes/v1.12.0/`. O `/api/versao` anunciava um
download que respondia **404**.

**Correção:** resolver a subpasta da versão a partir do nome do arquivo,
mantendo **todas as guardas** (basename, regex, `isFile()`).

**Teste de regressão adicionado:** seção 11 de `servidor/_teste.js`.

**Lição pra sempre:** toda rota que serve arquivo precisa bater o caminho
**real** em disco, e precisa de teste que pegue isso.

---

## Variáveis de ambiente

| Var | Valor |
|-----|-------|
| `NEXO_DIR_DADOS` | `/dados` (Railway, volume `nexo-volume`) |
| `NEXO_PORTA` | porta do servidor |
| `NEXO_URL_BASE` | URL pública do app |

---

## Segurança / decisões registradas

- **REA só pra referência** — nunca copiar código do Discord (ver `05-REA-ANALISE.md`).
- **`deleteAppDataOnUninstall: false`** (app guarda contas ao reinstalar).
- **Nunca commitar** `nexo-secreto-backup.txt` (tokens) — está no `.gitignore`.
- **CSP** do `index.html` liberou `img-src`/`media-src` para avatares mídia.
