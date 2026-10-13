# 🗺️ A BUSCA E O SERVIDOR — a descoberta mais importante

Esta é a razão de a busca "não funcionar". Se você ler só um arquivo
deste projeto, leia este.

---

## O sintoma

O Arcelino clicava em **"Aumentar a base"**, o programa mostrava
*"Região 13 de 322…"*, ficava parado, e depois de ~2 minutos
desistia com *"O servidor do mapa está sobrecarregado"*.

A busca **inteira morria por causa de uma região só**.

---

## A causa

O Overpass API (`overpass-api.de`) é um servidor **público e gratuito**.
Ele tem **fila**: cada IP tem um número fixo de "vagas" (agora são 4).
Quando acaba, ele responde **504** imediatamente.

O código antigo fazia:

```
erro → espera 4 s → erro → espera 10 s → erro → espera 20 s
     → erro → espera 30 s → erro → espera 30 s → DESISTE
```

Com o servidor cheio, 6 tentativas de ~30 s **não dão tempo da vaga
liberar**. Resultado: sempre desiste antes da vez.

---

## A correção

O Overpass tem um endpoint que **diz quando a próxima vaga abre**:
`https://overpass-api.de/api/status`

```
Rate limit: 4
2 slots available now.
Slot available after: 2026-10-11T01:46:52Z, in 40 seconds.
Slot available after: 2026-10-11T01:47:10Z, in 58 seconds.
```

O programa agora **pergunta antes de tentar**:

- se tem vaga → espera 3 s e tenta
- se não tem → espera **exatamente** o tempo que o servidor prometeu
- **nunca desiste** — só para quando o Arcelino manda

### Antes e depois (medido)

| | Antes | Depois |
|---|---|---|
| 60 s de teste | travava na região 13, zero resultado | região 12 → 15 |
| 200 s de teste | — | região 23 → 32 |
| 300 s de teste | — | +9 regiões, **zero erro de tela** |

---

## Os espelhos (medido em 11/10/2026)

| Servidor | Resultado |
|---|---|
| `overpass-api.de` | ✅ **3 de 3 — o único confiável** |
| `maps.mail.ru` | ⚠️ instável (1 de 3) |
| `overpass.kumi.systems` | ❌ 500 sempre |
| `overpass.osm.jp` | ❌ sem rota |
| `overpass.private.coffee` | ❌ 500 sempre |
| `overpass.osm.ch` | ❌ responde vazio (é suíço) |
| `overpass.openstreetmap.ru` | ❌ sem rota |

**A ordem importa.** Os melhores vêm primeiro: se o primeiro dá certo,
os outros nem são incomodados — e cada consulta a menos num servidor
público é uma consulta a menos para o próximo.

---

## Detalhes técnicos que importam

**Cabeçalhos.** O Overpass recusa com **406** se o programa não se
identificar. Os que funcionam:

```
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
User-Agent: DirectService/1.0 (prospeccao; uso local)
Accept: */*
```

⚠️ **Não troque o User-Agent por um de navegador** — testado, dá 406.

**Timeout.** 90 s na consulta, 10 s no `/api/status`. O 504 vem rápido,
então não trava a tela.

**Erro 400 é nosso, não deles.** Se a consulta está malformada, nenhum
espelho vai aceitar — o programa para de tentar espelhos imediatamente
e mostra o erro. Sem isso, o `fetch failed` do último espelho escondia
o 400 do primeiro, que era a pista de verdade.

**Consulta agrupada.** O código junta os valores por chave com regex:

```
node["shop"~"^(bakery|barber|hairdresser|...)$"](bbox);
```

Com ~10 chaves são 20 linhas em vez de 150. Com 150 linhas o servidor
devolvia 504 — e o defeito era nosso, não do servidor.

---

## ⚠️ Erro 400 que導入imos por engano

Quando escrevi as mensagens novas, usei acentos dentro do texto e
**quebrei a consulta**: o Overpass devolveu

```
CONSULTA INVALIDA: ...Parse error: ... 1: unexpected "ç"
```

**A causa:** eu escrevi comentários e strings com acento dentro da
consulta que vai pro servidor. **A consulta do Overpass tem que ser
ASCII puro.** Comentários e textos de mensagem no JS podem ter acento;
a string `consulta` não.

Como só o último espelho falhava com `fetch failed`, o erro de verdade
ficava escondido. Nunca confie na mensagem do **último** espelho —
guarde o erro de **cada** um.