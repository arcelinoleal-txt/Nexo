# 🔬 Análise do Discord com REA — o que foi feito e o que aprendemos

> **Regra do projeto:** o REA serve **só como referência técnica**.
> **NUNCA copie código proprietário do Discord.**
> Extrair *tokens de design* (cores, fontes, métricas de layout) é seguro e
> foi o que fizemos. Reimplementar a funcionalidade com código próprio é o
> caminho.

---

## Ferramenta usada

- **`tools.rea.analyze_javascript_application`**
  Análise de gráfico de dígrafos/deps de apps JS empacotados (ASAR, diretórios).
  Serve pra reconstruir estrutura, listar ícones, achar rotas e montar árvore
  de dependências — **não pra copiar código**.

---

## O que foi analisado

### 1. Instalação local do Discord (Windows)

- **Caminho:** `C:\Users\Arcelino Leal\AppData\Local\Discord\app-1.0.9261\`
- **`resources\app.asar`** — ~3,5 MB, arquivo ASAR.
- Ferramentas de ASAR prontas (`asar list`) só listingaram a raiz (limitação
  do tooling local), mas o arquivo é legível.

### 2. O que foi extraído com segurança

| Achado | Valor | Serve pra quê |
|--------|-------|----------------|
| **Fonte oficial** | `gg sans, "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif` | Tipografia do app |
| **Cor de marca (blurple)** | `#5865f2` | Botões, acento |
| **Azul mais escuro (hover)** | `#4752c4` | Hover/pressed |
| **Estrutura de pastas do cliente** | lista de rotas/ícones | Layout |

### 3. O que NÃO estava lá

- **As CSS variables** (`--background-primary` etc.) **não estão no ASAR** —
  o Discord carrega o CSS principal de um bundle remoto (CDN), não do pacote local.
- **Análise de hex** retornou sobretudo cores de teste/placeholder, não os
  tokens reais de design. Foi preciso usar conhecimento público + conferência
  visual na própria UI.

> **Lição:** não espere achar tudo num artefato empacotado. Parte do design
> vem da rede. Nesse caso, os valores conhecidos foram suficientes.

---

## Tokens que saíram da análise e entraram no Nexo

Ver **`06-DESIGN-TOKENS.md`** para a lista completa.
Resumo: fundo de chat `#313338`, painéis `#2b2d31`, rail `#1e1f22`,
acento `#5865f2`, status verde `#23a55a` / vermelho `#f23f43` /
amarelo `#f0b232`, perigo `#da373c`.

---

## Decisões de design tomadas com base na análise

1. **Layout em 3 colunas** (rail de servidores → painel esquerdo → conteúdo),
   exatamente como o Discord — não é um "chat genérico".
2. **Painel de usuário** embaixo à esquerda (avatar, nome, botões de voz).
3. **Fila de voz** como painel próprio com avatares, não barra de status.
4. **Aba de Amizades** dentro do painel esquerdo (padrão Discord), com
   contadores e badge no rail.
5. **Titlebars chapadas** `#313338` (sem gradiente roxo — o roxo era "genérico").
6. **Acento roxo → blurple**: `#6d5efc` virou `#5865f2`, e 20 ocorrências de
   `rgba(109,94,252,...)` viraram `rgba(88,101,252,...)`.

---

## Limitações e cuidados registrados

- ⚠️ **Nunca abrir/decodificar binários do Discord pra copiar lógica interna.**
- ⚠️ Extração de imagem/sprite proprietária é **fora do escopo**.
- ✅ Cores/fontes/métricas são **fatos de design** — usar é ok.
- ✅ Se precisar de mais detalhe visual, o caminho é **olhar a UI do Discord
  rodando** (ou screenshot), não descompilar.
- ✅ Todo código do Nexo é **original** — se parecer com o Discord, é porque
  foi reconstruído, não copiado.

---

## Como repetir a análise (se precisar)

```text
1. Localizar o app.asar do Discord em
   %LOCALAPPDATA%\Discord\app-<versão>\resources\app.asar
2. Usar tools.rea.analyze_javascript_application para mapear estrutura.
3. Extrair SÓ tokens de design (fonte, cores).
4. Reimplementar no estilo.css do Nexo.
5. Conferir visualmente na UI (F5) e validar com os testes.
```
