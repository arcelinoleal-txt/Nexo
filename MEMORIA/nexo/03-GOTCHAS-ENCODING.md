# 🔐 Encoding — o bug que corrompeu o Nexo (NÃO REPITA)

> **Esta é a regra número 1 do projeto.** Ela quebrou a interface inteira
> uma vez e foi bem chata de arrumar.

---

## O que aconteceu

1. Algum processo leu arquivos `.js`/`.html`/`.css` do Nexo usando
   **`[IO.File]::ReadAllText()` ou `Get-Content -Raw`** (ambos assumem ANSI
   aqui).
2. Os acentos UTF-8 (`ç`, `ã`, `á`...) foram lidos como bytes latin-1 →
   viraram strings tipo `Ã§`.
3. O arquivo foi gravado de volta com `WriteAllText(..., UTF8)`.
4. Resultado: a interface mostrava **`Ã§Ã£`** em tudo.

---

## Como verificar a corrupção

Contagem do byte-sequence **`C3 83`** (é o `Ã` malformado) por arquivo:

| Arquivo | Valor limpo (baseline) |
|----------|------------------------|
| `app/renderer.js` | `1` (legítimo, texto "Ã" real) |
| `app/index.html` | `0` |
| `app/estilo.css` | `0` |
| `servidor/servidor.js` | `1` (legítimo) |
| `servidor/_teste.js` | `0` |
| `servidor/contas.js` | `0` |
| `versao.json` | `0` |

> Observação: um valor **não-zero** só é problema se **aumentar** em relação
> a esse baseline. `renderer.js = 1` e `servidor.js = 1` são normais.

**Script de checagem (grave em `.js` e rode com `node`, nunca inline no PS):**

```js
// checar-encoding.js
const fs = require("fs");
const alvos = [
  "app/renderer.js", "app/index.html", "app/estilo.css",
  "servidor/servidor.js", "servidor/_teste.js", "servidor/contas.js",
  "versao.json",
];
for (const a of alvos) {
  const b = fs.readFileSync(a);
  const s = b.toString("latin1");            // conta bytes crús
  const n = (s.match(/\xC3\x83/g) || []).length;
  console.log(String(n).padStart(4), a);
}
```

---

## ✅ Regras permanentes

1. **NUNCA** use `Get-Content -Raw` nem `[IO.File]::ReadAllText()` em
   arquivos do projeto para depois regravar.
2. **Use a ferramenta nativa `edit`/`write`** para mudanças pontuais.
3. **Use Node.js** para qualquer transformação programática
   (`fs.readFileSync`/`writeFileSync` — lê/grava UTF-8 corretamente).
4. Os fontes do Nexo são **UTF-8 com BOM**. Se gravar UTF-8 puro sem BOM,
   pode mexer em como o Electron/`require` enxerga o arquivo.
5. Depois de qualquer edição grande, **rode o script de checagem acima** e
   compare com os valores da tabela.

---

## Outras regras de texto do projeto

- Toda string da interface é **pt-BR** ("Adicionar amigo", "Em linha", ...).
- Nunca inventar telefone/preço/endereço (regra herdada do `AGENTS.md`).
- Se aparecer mojibake na tela: o usuário aperta F5 e reabre
  `Planos/Nexo/app/index.html` pra conferir.
