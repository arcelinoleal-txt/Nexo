# 🧠 MEMÓRIA DO PROJETO NEXO — LEIA PRIMEIRO

> **Para a IA que estiver começando uma sessão nova:** este diretório guarda tudo
> o que já foi feito, errado, aprendido e decidido no projeto **Nexo**.
> Leia os arquivos nesta ordem antes de tocar em qualquer código.
>
> **Não recomece do zero.** O projeto já está funcional e publicado.
> Última sessão: **12/10/2026** — versão **1.12.0 publicada e no ar**.

---

## 📁 Ordem de leitura (obrigatória)

| # | Arquivo | O que tem | Importância |
|---|---------|-----------|-------------|
| 0 | **`01-ESTADO-ATUAL.md`** | Onde o projeto está AGORA, o que está pronto e o que falta | ⭐⭐⭐ |
| 1 | **`02-GOTCHAS-POWERSHELL.md`** | Armadilhas do PowerShell que já quebraram tudo | ⭐⭐⭐ |
| 2 | **`03-GOTCHAS-ENCODING.md`** | O bug de acento que corrompeu arquivos (NUNCA REPITA) | ⭐⭐⭐ |
| 3 | **`04-ARQUITETURA.md`** | Como o Nexo funciona por dentro | ⭐⭐ |
| 4 | **`05-REA-ANALISE.md`** | O que o REA analisou do Discord e o que descobrimos | ⭐⭐ |
| 5 | **`06-DESIGN-TOKENS.md`** | Cores/fontes oficiais do Discord usadas no app | ⭐⭐ |
| 6 | **`07-DEPLOY-RAILWAY.md`** | Como publicar e o fluxo de atualização automática | ⭐⭐ |
| 7 | **`08-TESTES.md`** | As 4 suítes (188 testes) e como rodar | ⭐⭐ |
| 8 | **`09-FCC-OPENCODE.md`** | Free Claude Code instalado e configurado | ⭐ |
| 9 | **`10-PENDENCIAS.md`** | O que ainda precisa ser feito/resolvido | ⭐⭐ |

---

## ⚡ As 5 regras que mais importam (resumo instantâneo)

1. **NUNCA use `Get-Content -Raw` + `WriteAllText` UTF-8** em arquivos de código.
   Isso corrompeu os acentos do app inteiro. Use Node.js ou as ferramentas
   de edição nativas (edit/write). Detalhe: `03-GOTCHAS-ENCODING.md`.

2. **Suba a versão nos DOIS lugares**: `package.json` (o electron-builder lê
   dele pra nomear o instalador) E `versao.json` (o servidor lê dele pra anunciar
   a atualização). Já geramos um instalador errado por causa disso.

3. **Antes de commitar, rode as 4 suítes de teste** (`08-TESTES.md`). Hoje são
   **188 testes**. Se algum falhar, não publique.

4. **O Discord é SÓ referência.** Nunca copie código do Discord. Análise com REA
   é permitida; cópia de código proprietário, não. Extrair tokens de design
   (cores/fontes) é seguro e foi feito.

5. **Toda alteração no `servidor.js` exige novo build do instalador** — o
   `servidor/**/*` vai DENTRO do `.exe`. Já erramos isso uma vez.

---

## 🚫 Erros que já cometi e você NÃO deve repetir

| Erro | Consequência | Como evitar |
|------|-------------|-------------|
| `Get-Content -Raw` + gravar UTF-8 | Acentos viraram `Ã§` pela interface inteira | Node.js ou tools edit/write |
| Só subir o `versao.json` | Instalador gerado chamado `1.11.0` em vez de `1.12.0` | Sync dos dois arquivos |
| Mudar `servidor.js` sem rebuild | O instalador enviado não tinha a correção | Sempre `npm run dist` depois |
| Rodar `npm` via `Start-Process` | "%1 não é um aplicativo Win32 válido" | Usar `npm.cmd` ou `node` |
| `node --check` em CSS | Exit 1 (não é erro de verdade) | Validar por balanceamento de chaves |
| `node -e` inline no PowerShell | Parser quebra com aspas escapadas | Gravar script em arquivo `.js` |
| Deixar teste desatualizado | Suite falhando por causa de fluxo antigo | Atualizar o teste junto com a UI |

---

## 📌 Avisos pendentes que precisam de VOCÊ

1. **Gire a chave da NVIDIA NIM** — ela foi colada no chat. Gere outra em
   `build.nvidia.com` e troque no Admin UI do FCC. Detalhe: `09-FCC-OPENCODE.md`.
2. **Issue #1 do GitHub** (`teste-permissao-1791824968256`) está aberta — o PAT
   atual só tem permissão de Contents. Só você pode fechá-la.
3. **Token do Railway está inválido** — não afeta nada (o deploy é automático no
   push), mas se precisar do CLI, gere um novo.

---

*Guia criado em 12/10/2026. Atualize este diretório a cada sessão importante,
igual você faz com `AGENTS.md` e `MEMORIA.md`.*
