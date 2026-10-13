# ✅ Testes do Nexo — 188 testes em 4 suítes

> **Regra:** antes de commitar/publicar, TODAS as suítes precisam passar.
> Nenhuma versão sai com teste falhando.

---

## As 4 suítes (188/188)

| Suítes | Testes | Comando | O que cobre |
|--------|--------|---------|-------------|
| `servidor/_teste.js` | **92** | `node ...\servidor\_teste.js` | Servidor: rotas, contas, amizades, **download da atualização (seção 11)** |
| `testes/amizades-ui.js` | **34** | `node ...\testes\amizades-ui.js` | UI de amizades via CDP (rail → painel → abas) |
| `testes/e2e-servidor-real.js` | **28** | `node ...\testes\e2e-servidor-real.js` | E2E contra servidor real |
| `testes/canal-arquivos-e-conversas.js` | **34** | `node ...\testes\canal-arquivos-e-conversas.js` | Canais, upload de arquivos, conversas |
| **TOTAL** | **188** | | |

### Caminhos absolutos (copie e cole)

```powershell
$N = "C:\Users\Arcelino Leal\Documents\Projeto\Planos\Nexo"
node "$N\servidor\_teste.js"
node "$N\testes\amizades-ui.js"
node "$N\testes\e2e-servidor-real.js"
node "$N\testes\canal-arquivos-e-conversas.js"
```

---

## Como funcionam as suítes CDP

1. **Abrem um Chrome de verdade** (headless/CDP) apontando pro app.
2. Falam com a página via `Runtime.evaluate`.
   - Com `awaitPromise: true`, o valor vem em **`msg.result.result.value`**.
3. Pula o tutorial gravando no localStorage:
   ```js
   localStorage.setItem('nexo.tutorialVisto','1')
   ```

> **Dica:** se um teste de UI falhar depois de mexer na interface,
> quase sempre é o **fluxo antigo do teste**, não a UI.
> Na 1.12.0 o `amizades-ui.js` **precisou ser reescrito** porque o fluxo
> mudou de modal para painel lateral.

---

## Detalhes importantes

### Seção 11 de `_teste.js` (regressão da 1.12.0)
Garante que `/atualizacao/Nexo-Setup-<ver>.exe`:
- resolve em `versoes/v<ver>/` (não em `versoes/`),
- retorna **200** com `MZ` + `Content-Disposition`,
- e continua dando **404** nas guardas (path traversal, `%2f`,
  `.blockmap`, versão inexistente, diretório).

### Servidor que os testes usam
- `_teste.js` sobe um servidor **em porta aleatória própria**.
- `e2e-servidor-real.js` usa um servidor de teste real em temp.
- **Não** dependem do Railway.

### Erros comuns nos testes
| Sintoma | Causa provável |
|---------|----------------|
| Timeout no launch do Chrome | Chrome de teste travado (mata processo) |
| `msg.result.result.value` undefined | Falta `awaitPromise: true` |
| Falha em campo de login | Tutorial não pulado |
| Falha 401/403 | Faltou `Authorization: Bearer <token>` |
| Falha em `/api/pessoas` | Query com < 2 letras |

---

## Comando de verificação completa (recomendado)

```powershell
$N = "C:\Users\Arcelino Leal\Documents\Projeto\Planos\Nexo"
$r = @(
  node "$N\servidor\_teste.js"
  node "$N\testes\amizades-ui.js"
  node "$N\testes\e2e-servidor-real.js"
  node "$N\testes\canal-arquivos-e-conversas.js"
)
$r
```

> **Não use `$ErrorActionPreference="Stop"` + `2>&1` aqui** —
> o PS 5.1 transforma warnings nativos em erro e "aborta" tudo.
> (ver `02-GOTCHAS-POWERSHELL.md`, seção 3)

---

## Novo teste = nova funcionalidade

Se você criar uma feature nova, **crie teste junto**.
Exemplo: o bug do `/atualizacao/` só foi pegue porque adicionamos
a seção 11 de regressão.
