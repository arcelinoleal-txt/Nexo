# 🎨 Tokens de design do Discord usados no Nexo

> Extraídos/confirmados por análise (REA) + conferência visual.
> O Nexo usa **essas cores exatas** no `:root` de `app/estilo.css`.
> Mantenha-as sincronizadas — elas são o que faz o app "parecer Discord".

---

## Cores oficiais aplicadas

| Token | Hex | Uso |
|-------|-----|-----|
| Rail / servidor | `#1e1f22` | Coluna extrema esquerda |
| Painéis (canais, membros) | `#2b2d31` | Painel de canais, DMs, membros |
| Chat / área principal | `#313338` | Fundo da conversa, titlebars |
| Painel do usuário | `#232428` | Bloco do usuário (avatar/nome) embaixo à esquerda |
| **Acento (blurple)** | `#5865f2` | Botões primários, links, foco |
| Acento hover | `#4752c4` | Hover/pressed do acento |
| Texto principal | `#f2f3f5` | Títulos |
| Texto normal | `#dbdee1` | Texto corrido |
| Texto suave | `#949ba4` | Placeholders, meta |
| Texto link | `#00a8fc` | Links |

### Status (oficiais)
| Status | Hex |
|--------|-----|
| Online (verde) | `#23a55a` |
| Ausente (amarelo) | `#f0b232` |
| Ocupado (vermelho) | `#f23f43` |
| Offline (cinza) | `#80848e` |

### Semânticos
| Uso | Hex |
|-----|-----|
| Perigo / destrutivo | `#da373c` |
| Sucesso | `#23a55a` |
| **Anel de fala (neon verde)** | `#23a55a` + glow `rgba(35,165,90,.55)` |

---

## O que foi trocado na 1.12.0

| Antes (genérico) | Depois (Discord) |
|------------------|------------------|
| `#6d5efc` (roxo) | **`#5865f2`** (blurple) |
| `rgba(109,94,252,...)` × 20 | **`rgba(88,101,252,...)`** |
| Titlebars com gradiente roxo | Chapadas `#313338` |
| Status genéricos | Oficiais (acima) |

---

## Tipografia

```css
font-family: "gg sans", "Helvetica Neue", Helvetica, Arial,
             "Lucida Grande", sans-serif;
```
- `gg sans` é a fonte do Discord (não obrigatória se não houver).
- Fallback da UI do sistema é aceitável e mantém o visual.

---

## Estrutura do layout (3 colunas)

```
┌──────┬─────────────┬──────────────────────┐
│ RAIL │ PAINEL      │  CONTEÚDO            │
│serv. │ esquerdo    │  (chat / amigos /    │
│ #1e1f│ #2b2d31     │   configurações)     │
│      │ + usuário   │  #313338             │
│      │   #232428   │                      │
└──────┴─────────────┴──────────────────────┘
```

- **Rail** `#rail-sala`, `#rail-amigos`, `#rail-loja` (+ badge `#rail-badge-amigos`).
- **Painel esquerdo** alterna entre `#painel-sala-visao` e `#painel-amigos`.
- **Amizades**: 4 abas com contadores (`.cont-aba`) —
  `Em linha` · `Pedidos` · `Sugestões` · `Adicionar`.

---

## ⚠️ Cuidados ao mexer no visual

1. **Anime themes funcionam** porque sobrescrevem as **mesmas** variáveis do
   `:root` — se você renomear a variável, quebra o tema.
2. Não recoloque gradiente roxo — foi reprovado ("genérico").
3. Todo container com `bg` novo precisa entrar também em
   `#sobreposicao-config`/`body` pra não "vazar" branco.
4. Depois de mudar CSS: **F5** e confirmar que abriu
   `Planos/Nexo/app/index.html`.
5. `node --check` **não serve pra CSS** (exit 1 é falso) — valide as chaves.
