# 📋 PENDÊNCIAS

O que ainda falta. Nada aqui é urgente para ele começar a trabalhar —
o app está funcional.

---

## 🔴 Precisa do Arcelino

### 1. Login no GitHub (para publicar as demonstrações)

```bash
gh auth login
```

Depois eu publico e ativo o GitHub Pages. Sem isso, os modelos só
funcionam abrindo o `index.html` com dois cliques — o que já serve
para mostrar no computador dele, mas não gera link para mandar no
WhatsApp.

**Enquanto isso:** mande os modelos como arquivo, ou mostre abrindo
no navegador.

---

## 🟡 Importante (mas não bloqueia)

### 2. Trocar telefone e preços nas demonstrações

Hoje está `11999999999` e preços de exemplo em todos os 6 sites.

**O cliente sempre pergunta o preço.** A resposta *"é o valor de
exemplo"* nesse momento derruba a conversa.

Onde trocar:
- Telefone: buscar por `wa.me/5511999999999` e `tel:+5511999999999`
- Preços: nas seções `cartao-preco` e `servico`

### 3. Deixar a busca varrer São Paulo inteiro

17 de 322 regiões. ~2h40 no ritmo atual. Quanto mais rodar, mais
"dá para ligar" (hoje 444).

Roda em segundo plano, salva a cada região. Pode fechar o programa.

### 4. Aba de quem só tem Instagram

**424 lugares** da base não têm telefone, mas têm Instagram ou
Facebook cadastrado. Hoje são invisíveis para o Arcelino porque o
filtro `valeTrabalho` exige telefone.

São a maior fatia de prospect que o mapa tem e que ele não consegue
usar. Precisaria de uma aba à parte, com mensagem adaptada para DM
(a de WhatsApp não serve — não tem número).

**Decidir com ele antes:** vale a pena ou polui a lista?

---

## 🟢 Quando der

### 5. `try/catch` no `app.whenReady()`

Se algo dentro derrubar, hoje o app **não abre janela nenhuma** e
não mostra erro. Foi o que aconteceu com o `--dados=` quebrado.
Blindar com `dialog.showErrorBox`.

### 6. Recalcular o bairro da base

Só 2 de 4.648 têm bairro. Dá para rodar o Nominatim em lote, mas é
1 consulta por segundo → **~1h20 para 4.648**. Precisa de um botão
"descobrir rua de todos da fila do dia", não de tudo de uma vez.

### 7. Migração do ramo nos lugares novos

`arrumaRamos()` roda na abertura e corrigiu os 87 antigos. Os **novos**
que a busca achar já saem certos pelo `ramoDe()`. Está OK — só não
esqueça de rodar `arrumaRamos()` se mexer no `ramoDe()` de novo.

---

## ❌ Não é pendência (só um registro)

**O instalador `.exe` não sai.** O Defender bloqueia o
`app-builder.exe`. O `.zip` substitui e funciona igual — se um dia o
Antivírus liberar, dá para voltar ao `.exe`. Detalhe em
`03-GOTCHAS-ELECTRON.md`.

---

## Como saber o que já está feito

| Onde | O quê |
|---|---|
| `01-ESTADO-ATUAL.md` | Números medidos, arquitetura |
| `02-A-BUSCA-E-O-SERVIDOR.md` | A correção do Overpass |
| `03-GOTCHAS-ELECTRON.md` | Windows bloqueando build |
| `04-QUALIDADE-DOS-DADOS.md` | Os 87 ramos errados |
| `05-ABORDAGENS-DE-VENDA.md` | As 7 mensagens |
| `06-DEMONSTRACOES-DE-SITES.md` | Os 6 modelos |
| `07-COMUNICACAO.md` | Como trabalhar com ele |