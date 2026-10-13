# 🧹 QUALIDADE DOS DADOS

O número bonito da tela só vale se a lista for boa. Aqui está o que foi
encontrado de errado e como foi corrigido.

---

## O problema dos 87 lugares com ramo errado

**Sintoma:**indsight. Analisando os 4.104 lugares da base, 87 estavam
classificados com o ramo errado:

```
"Clínica odontológica Aclimação"  ->  Restaurante
"Centro Odontológico Rossi"       ->  Restaurante
"Guimarães & Ruggiero Advogados"  ->  Dentista
"Advogado de Família"             ->  Dentista
"Barbearia 9 de Julho"            ->  Cabeleireiro
```

**Por que isso é grave:** o ramo entra na mensagem
(*"quem procura restaurante no celular..."*). Mandar isso para um
dentista é o pior jeito de entregar que é disparo automático.

### A causa

Em `ramoDe()`, a segunda volta comparava assim:

```js
for (const [tag, valor] of Object.entries(r.extra || {})) {
  if (g[tag]) return r.nome;     // ← perguntava SÓ se a etiqueta existe
}
```

O Dentista tem `extra: { office: 'dentist' }`. Então **qualquer lugar
com a etiqueta `office`** — inclusive `office=lawyer` — era classificado
como Dentista. A mesma falha com `healthcare:dentist`, `service:hairdresser`.

### A correção

Duas coisas:

**1. Valor `'*'`** = "tem a etiqueta, qualquer que seja o valor".
**Valor escrito** = "tem de ser IGUAL aquele valor".

```js
for (const [tag, valor] of Object.entries(r.extra || {})) {
  if (valor === '*') { if (g[tag]) return r.nome; }
  else if (g[tag] === valor) return r.nome;
}
```

**2. O nome do lugar manda mais que a etiqueta.**
*"Clínica Odontológica"* não deixa dúvida. Criei `RAMO_PELO_NOME`, em
ordem do **mais específico para o mais genérico** — `odont` é testado
antes de `clinica`, senão "clínica de estética" viraria dentista.

```js
[/(odont|dental|dentist)/,          'Dentista'],
[/(veterin|pet\s?shop)/,            'Veterinario'],
[/(advocac|advogad|juridic)/,       'Advogado'],
...
```

Também **removi** o terceiro laço, que fazia correspondência por
substring em qualquer tag (`v.includes('bar')` casava com "Barão").

**Resultado: erros graves = 0.** (Os 51 restantes do contador são
falso-positivo do meu próprio detector: pizzaria continuar "Pizzaria"
não é erro.)

### A migração

O banco **não guarda as etiquetas do mapa**, mas guarda o **nome**.
Então dá para corrigir sem refazer a busca: `arrumaRamos()` roda uma
vez na abertura e reescreve pelo nome.

⚠️ **A ordem importa:** as migrações (`arrumaEtapas`, `arrumaRamos`)
têm que rodar **antes** de montar o filtro `#b-ramo`. Se rodarem
depois, o filtro fica com os nomes velhos e a pessoa procura
"Restaurante" e não acha o dentista que estava escondido lá.

---

## O bairro quase não existe

**Medido:** só **2 dos 4.648** lugares têm bairro gravado
(`Rua X — Bairro`). O resto tem só a rua, ou `"endereço não cadastrado"`.

**Consequência:** a frase "morar aqui no Jardim das Fontes" seria
**falsa** na maioria dos casos. Um cliente que mora a 8 km percebe na
hora que você nem se deu ao trabalho de ver onde fica o negócio dele.

### O que fazer

1. As mensagens que citavam bairro foram reescritas para **"morar aqui
   perto"** ou "faço site para comércio da região".
2. O `{BAIRRO}` ainda existe como marcador e usa a cidade como
   reserva.
3. O botão **"Descobrir a rua"** (que já existia, usando o Nominatim)
   grava o endereço real. **Quanto mais o Arcelino usar, mais
   personalizada fica a abordagem.**

⚠️ O Nominatim é público e aceita **1 consulta por segundo**. Por isso
o botão só consulta quando o usuário abre o lugar, e uma vez só.

---

## Rede nacional e nome genérico

Já vêm escondidos: 246 rede nacional, ~50 nome genérico/curto demais.

O motivo importa na tela, não só no filtro — o programa mostra
*"rede nacional"* ou *"nome curto demais"* como selo, para o Arcelino
entender **por que** o lugar sumiu.

---

## Regras do que vale a pena (`config.js` → `qualidade`)

- **redes**: McDonald's, Starbucks, bancos, telefonia, redes varejistas
- **genericos**: "Lanchonete", "Restaurante", "Padaria" — nome que é
  só o tipo do negócio não permite escrever *"Olá, Lanchonete"*
- **nomeCurto: 3** — "Bar", "Pizz" não dá para chamar ninguém

Configurável. Se um dia sobrar prospect bom, **adicione o nome na
`redes`, não apague o filtro inteiro**.

---

## Base de referência

Com 4.104 lugares (antes da migração):

```
2.900 no total
2.556 sem site (tem a dor)
  266 sem site E com telefone  ← só esses dá para chamar
  180 rede nacional
   16 nome genérico
  255 realmente trabalháveis
```

**Não espere 4.000 clientes.** O mapa público tem pouco telefone. É por
isso que o número grande no alto é "dá para ligar" e não o total.