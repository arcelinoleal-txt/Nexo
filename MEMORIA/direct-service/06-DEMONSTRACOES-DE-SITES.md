# 🎨 DEMONSTRAÇÕES DE SITES

Pasta: **`Projeto/DEMONSTRAÇÕES DE SITES/`**

Sites de exemplo para mostrar ao cliente na visita. **Não são
templates genéricos** — cada um foi desenhado para o tipo de negócio
que representa, e é exatamente o que o Direct Service acha no mapa.

---

## Os 6 modelos

| Pasta | Ramo | Identidade |
|---|---|---|
| `barbearia/` | Barbearia | Preto + dourado, preço à vista, nota do Google na capa |
| `restaurante/` | Restaurante | Capa grande, cardápio, localização no fim |
| `odontologia/` | Clínica odontológica | Claro + azul, seção **"Vai doer?"** |
| `academia/` | Academia | Preto + verde-lima, fonte condensada caixa alta |
| `petshop/` | Pet shop | Claro + laranja, a foto do bicho vendendo |
| `padaria/` | Padaria | Tons de trigo, três fornadas na capa |

`index.html` na raiz é a **vitrine** com os 6.

---

## A arquitetura: um motor, seis caras

```
base.css          ← o motor visual (uma vez só)
base.js           ← menu do celular, topo ao rolar, animação de entrada
barbearia/index.html   ← só o texto, as fotos e o bloco :root com as cores
```

**Cada site muda a identidade inteira trocando 4 linhas** no começo do
seu `<style>`:

```css
:root {
  --marca:       #c9a227;   /* cor da marca */
  --fundo:       #0c0b09;
  --fonte-titulo: 'Playfair Display', serif;
}
```

É o motivo de eles parecerem **6 briefings diferentes** e não 6
templates. E se precisar consertar algo, conserta em um lugar só.

---

## O que todo site tem

- Capa com foto grande + degradê (texto sempre legível)
- Selo com nota do Google
- Serviços com **preço visível**
- Depoimentos
- Chamada final com WhatsApp
- Botão flutuante de WhatsApp
- Menu que vira hambúrguer no celular
- `prefers-reduced-motion` respeitado
- `alt` e `loading="lazy"` nas imagens

**Fotos do Unsplash** (grátis, sem atribuição). Quando fechar o
cliente: **a foto dele substitui a do banco** — é o que separa
rascunho de site pago.

---

## A tarja de "demonstração"

Todo site tem, no topo:

> DEMONSTRAÇÃO — SITE DE EXEMPLO, NÃO É UM NEGÓCIO REAL

**É proposital.** Cliente que acha que o site já está no ar constrói
uma expectativa errada, e o estrago é grande.

Quando virar site de verdade: apague a `div.aviso-demo`. (Se preferir
menos poluição, existe a classe `.aviso-mini` no `base.css` — uma
tarja discreta no canto.)

---

## Ferramentas de conferência (rode sempre)

```bash
node verifica-texto.cjs   # erro de digitação e palavra em inglês
node tira-print.cjs       # prints de cada site em _prints/
```

O `verifica-texto` **achou 9 erros meus** antes de chegarem ao cliente
("fono", "conditioning", `赵9c8straight` numa cor, "Retrate
análise"...). Erro de digitação em texto que vai ser mostrado passa
batido e só aparece quando a pessoa lê — e aí já é constrangedor.

Depois de rodar o `tira-print`, **OLHE os PNG**. Foi olhando que
apareceram os dois defeitos que a validação de texto não pega:

1. **a tarja cobria o logo** e o menu em todos os sites
2. **a padaria ficou ilegível** — texto marrom sobre foto escura

### A correção dos dois

**A tarja empurra o topo.** O `.topo` é `position: fixed` e a tarja
também. Sem medir a tarja, o logo fica **atrás** dela. O `base.js`
mede e escreve em `--altura-aviso`, que o `.topo` soma no `padding-top`.

**A capa tem texto claro sempre.** Mesmo em site de fundo claro
(padaria, pet shop, clínica), a capa é **escura** porque tem foto. Por
isso `.capa h1` e `.capa .lead` têm cor fixa clara, e o
`.btn.secundario` precisa de uma variante clara dentro da capa:

```css
.capa .btn.secundario { border-color: #e8e2d8; color: #f2f4f5; }
.capa .btn.secundario:hover { background: rgba(255,255,255,.14); color: #fff; }
```

---

## Git

Repositório git **local, com 2 commits**. Não publicado — o `gh` não
está logado na conta do Arcelino.

Para publicar (grátis, com HTTPS):

```bash
gh auth login
gh repo create demonstracoes-sites --public --source=. --push
```

Depois: **Settings → Pages → Deploy from a branch → `main` / root**.

Com o link no ar, manda no WhatsApp:
*"olha como ficaria o site do seu negócio"* — o cliente abre no
próprio celular, sem instalar nada.

---

## Como mostrar ao cliente

1. **No celular, nunca no computador.** O dono do comércio decide
   olhando no celular.
2. **Comece pelo modelo do ramo dele.** Barbeiro não quer ver
   academia.
3. **Não diga "é só um exemplo".** Diga *"montei um site assim pro
   seu negócio"*.
4. **Troque os preços antes.** O cliente sempre pergunta, e a resposta
   *"é o valor de exemplo"* nesse momento derruba a conversa.
5. **Troque o WhatsApp** (`11999999999` → o número real dele).

---

## Referências de estilo que o Arcelino já aprovou

- `studiow.com.br` — salão de beleza premium, escuro, editorial
- `marioscabeleireiros.com.br` — barbearia tradicional, dourado
- `petmaxi.com.br` — pet shop
- `lionforceacademia.com.br` — o site real dele (ver estilo D da
  memória de design)

Todas seguem a mesma receita: **espaço vazio, foto grande e boa, um
botão que aparece uma vez só.** Efeito não faz site parecer caro —
espaço e hierarquia fazem.