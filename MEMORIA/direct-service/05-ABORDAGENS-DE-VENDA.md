# 🎯 ABORDAGENS DE VENDA

As mensagens do Direct Service. Isto é estratégia, não texto decorado.

---

## O objetivo real

O Arcelino vende site para comércio local. Não é venda de software:
é venda para **dono de comércio pequeno**, que decide sozinho, tem
pouco tempo e desconfia de quem vende site.

Cada mensagem responde a uma pergunta: **"por que esse cara fala
COMIGO e não com mais 500 empresas?"**

---

## As 7 abordagens

O programa escolhe sozinha pela situação do lugar:

| # | Modelo | Quando | O ideia central |
|---|---|---|---|
| 1 | `local` | sem site, a até 1,2 km | "posso passar aí" |
| 2 | `primeiro-contato` | sem site, longe | "faço o rascunho de graça" |
| 3 | `so-rede-social` | só tem Instagram | "o Google não acha perfil" |
| 4 | `site-estacionado` | domínio à venda | "o domínio já é seu" |
| 5 | `site-fraco` | site não abre no celular | "a maioria entra pelo celular" |
| 6 | `retorno` | sumiu há 7–30 dias | "só passando pra saber" |
| 7 | `despedida` | sumiu há 30+ dias | última mensagem, sem insistir |

O seletor está em `modeloPara()` e a ordem importa: **quem está perto
E sumiu há muito tempo recebe a despedida, não o convite para passar
aí.**

---

## Por que cada uma funciona

### 🥇 `local` — "posso passar aí" (a mais forte)

**A única abordagem que nenhum site do Brasil está vendendo.**
Enquanto o concorrente está a 2.000 km, o Arcelino mora a 600 m.

```
Oi, {EMPRESA}! Aqui é o {EU}, moro aqui perto, a uns 10 minutos de vocês.

Vi que vocês não têm site, e hoje quem procura "{RAMO}" no celular
acha o concorrente antes de achar vocês.

Eu faço site para comércio da região. Um exemplo: {LINK}

Como é pertinho, posso passar aí qualquer dia pra você ver no meu
celular como fica — 5 minutos, sem compromisso. Ou, se preferir,
eu faço o rascunho primeiro e te mando.

O que é melhor pra você?
```

Cinquenta pessoas da base estão a até 1,5 km. Essa é a lista de
**visita presencial**, e é onde fecha mais rápido.

### 🥈 `primeiro-contato` — "o rascunho é grátis"

A oferta não é *"eu faço site"*. É **"eu faço o rascunho e você olha"**.

```
Pesquisei vocês no Google agora: quem procura "{RAMO}" pelo celular
encontra 4 ou 5 opções antes de chegar em vocês. Não é o serviço —
os outros é que têm site e vocês não.

Fiz o site de uma academia do bairro, com plano, horário e estrutura
toda: {LINK}

Se quiser, eu faço o rascunho do de vocês sem cobrar nada. Você olha
com calma e, se não gostar, o rascunho é seu e eu não te procuro
mais.

Me responde "quero" que eu começo.
```

**Por que é forte:** o cliente não está sendo vendido, está sendo
**presenteado**. E um rascunho pronto é muito difícil de ignorar
depois — ele já viu como fica.

### `despedida` — a última mensagem

```
Oi, {EMPRESA}! Última mensagem, prometo.

Entendo que o momento não é esse. Se um dia quiser dar uma arrumada
na presença online de vocês, é só me chamar — eu guardo seu contato
aqui.

Boa sorte com o negócio, e que vocês cresçam!
```

Sem pressão nenhuma, e ainda simpática. **Funciona porque a pessoa
não se sente perseguida** — e como não pediu nada, many vezes
responde. Nunca insista depois desta.

---

## As 6 regras de escrita

### 1. A primeira linha não pode parecer marketing

❌ *"Olá! Gostaria de apresentar nossos serviços..."*
✅ *"Oi, {EMPRESA}! Aqui é o Arcelino, moro aqui perto."*

O primeiro é lido por 500 empresas. O segundo é lido por **uma**.

### 2. Específico vence genérico

❌ *"vocês não têm site"*
✅ *"quem procura pizza no celular acha 4 opções antes de vocês"*

Ele pode conferir isso em 10 segundos. Quando é verdade e verificável,
vira conversa.

### 3. Prova, nunca adjetivo

❌ *"sou profissional e entrego qualidade"*
✅ `https://lionforceacademia.com.br`

Ninguém acredita em adjetivo. Todo mundo acredita num link que abre.
**Por isso a Lion Force entra em todas as mensagens** — site completo,
1.200 m², 4,9 no Google, planos, app, time.

### 4. Ofereça algo de graça

Inverte o jogo: ele não compra, ele recebe. E o rascunho é barato de
fazer e caro de jogar fora.

### 5. A resposta tem de ser fácil

Uma palavra (*"quero"*) ou sim/não. Quanto menos ele precisar pensar,
mais ele responde.

### 6. **ACENTO. SEMPRE.**

⚠️ **Já erramos isso.** A primeira versão saiu sem acento
(*"Ola!", "voce", "negocio"*) e teve que ser reescrita.

Para um dono de comércio brasileiro, isso faz ele pensar: *"esse cara
nem escreve direito, vai fazer meu site?"*. **Não é estética — é
credibilidade.** É o mesmo motivo pelo qual o telefone e o preço
têm que sair exatos.

---

## A Lion Force é a melhor carta do baralho

`lionforceacademia.com.br` não é uma academia — é **um site completo
que qualquer dono de comércio consegue abrir e conferir**: plano,
estrutura, avaliação no Google, app, time.

Quando fechar o primeiro cliente, **coloque o site dele em
`config.js` → `portfolio`**. Aí a mensagem passa a mostrar um exemplo
do **mesmo ramo** da pessoa que você está abordando. Barbeiro não
quer ver site de academia.

---

## Estrutura dos marcadores

```
{EMPRESA}   nome do lugar
{BAIRRO}    bairro real, ou a cidade como reserva
{RAMO}      ramo, em minúscula
{PROVA}     nome do portfólio  ("Lion Force Academia")
{LINK}      URL do portfólio
{EU}        assinatura — "Arcelino", NUNCA "Direct Service"
```

Marcador que sobra escrito na mensagem é desastre. Existe um teste
automático (`verifica-texto.js` no outro projeto + a checagem em
`diag-abordagens.js`) que falha se sobrar `{...}` ou `undefined`.

---

## Botão Wpp

Clicou, abre o WhatsApp com a mensagem **já escrita**, já com nome,
bairro, ramo e link no lugar.

Antes eram 4 passos e ~40 s por cliente. Numa lista de 25, quase
meia hora perdida por dia.

O link só aparece se o lugar tem telefone (`wa.me` exige número).
Numero com `+`, espaço ou sem o `55` é normalizado antes — sem isso
saía `wa.me/+5511...`, que o WhatsApp **rejeita**.