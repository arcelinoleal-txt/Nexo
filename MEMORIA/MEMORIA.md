# 📝 Guia de Transferência de Contexto para IAs
*Personalizado para **Arcelino** – Baseado em seu histórico real de projetos*  
*Última atualização: 11/10/2026 – Confirmado em sessão com a Mimo*

## 🎯 Objetivo
Este documento permite que qualquer I.A. compreenda rapidamente **seu estilo de trabalho, preferências técnicas e padrões de qualidade** ao iniciar uma nova sessão, evitando retrabalho e garantindo continuidade no desenvolvimento.

---

## 💻 Pilha Tecnológica Preferida
*(Baseada no que você já implementou e demonstrou preferir)*

| Categoria | Tecnologias/Ferramentas | Projetos de Exemplo | Observações |
|-----------|-------------------------|---------------------|-------------|
| **Frontend** | HTML5 semantic, CSS3 (variáveis, grid, flexbox), JavaScript ES6+ (modular, sem frameworks pesados) | Jhonnytur, Horizonte Viagens, Tempero da Terra, AC-Stream | Você prefere **puro HTML/CSS/JS** quando possível – só adiciona frameworks quando realmente necessário (como no starter React/Vite) |
| **CSS Avançado** | CSS Custom Properties (variáveis de tema), `clamp()` para tipografia fluida, animações com `@keyframes` e `requestAnimationFrame`, `prefers-reduced-motion` | Todos os projetos – especialmente evidente em `styles.css` de cada projeto | Você cria verdadeiros **design systems** com variáveis no `:root` |
| **Backend/Lógica** | Node.js/Express (para APIs e servidores locais), Go (para gateways de alta performance) | iptvnator-backend, Mimo AI Proxy, servir.js (local) | Você escolhe a tecnologia certa para o problema: Node para simplicidade, Go para performance/concorrência |
| **Automação** | Headless Chrome/Puppeteer (via exec), pdf-lib, Jimp (processamento de imagens) | APRESENTACAO-TAYNA/06-ferramentas (analisar.js, build.js) | Você automatiza tarefas repetitivas: geração de PDFs, análise de imagens, criação de apresentações |
| **Especializado** | Bibliotecas de parsing de mídia (`iptv-playlist-parser`, `epg-parser`), integração WhatsApp API, geração de QR Code Pix | iptvnator-backend, Tempero da Terra, convite-ana-paula | Você não tem medo de usar bibliotecas específicas quando resolvem problemas reais |
| **Deploy** | GitHub Pages, Docker, Vercel/Netlify (para frontends estáticos) | Todos os projetos têm instruções claras de deploy nos READMEs | Você valoriza **deploy simples e reproduzível** |

---

## 💡 Estilo de Codificação & Convenções
*(O que você já demonstrou consistentemente em seus projetos)*

### 1. **Organização de Arquivos**
```
projeto/
├── index.html          # Sempre o ponto de entrada
├── css/                # Estilos (com design system no :root)
│   └── styles.css
├── js/                 # Lógica de negócio (modular)
│   ├── main.js
│   └── [modules].js
├── assets/             # Imagens, fontes, médias (otimizadas)
└── README.md           # Documentação completa (sempre presente!)
```

### 2. **Nomenclatura**
- **Variáveis/funções**: `camelCase` (ex: `cartQty()`, `renderMenu()`)
- **Constantes**: `UPPER_SNAKE` (ex: `PORT = 3000`, `WA = "5511957046499"`)
- **Classes/IDs CSS**: `kebab-case` (ex: `.btn-primary`, `#cartModal`)
- **Arquivos**: `kebab-case` ou `snake_case` conforme contexto (você mistura, mas é consistente dentro do projeto)

### 3. **CSS – Seu Padrão de Design System**
*(Extraído diretamente dos seus arquivos `styles.css`)*
```css
:root {
  /* Variáveis de tema - SEMPRE definidas aqui primeiro */
  --primary:      #0A4D9C;   /* Azul - sua cor de confiança */
  --accent:       #FFC93C;   /* Amarelo - seus CTAs e destaques */
  --background:   #FBF8F2;   /* Papel quente - sua base neutra */
  --text:         #11223d;   /* Tinta escura - sua cor de texto principal */
  
  /* Espaçamento - Sua escala base */
  --r-sm: 12px; --r-md: 18px; --r-lg: 26px; --r-xl: 34px;
  
  /* Sombras - Seu conjunto pré-definido */
  --sh-sm: 0 6px 18px rgba(11,36,71,.07);
  --sh-md: 0 18px 42px rgba(11,36,71,.10);
  --sh-lg: 0 34px 80px rgba(11,36,71,.18);
  
  /* Raio de borda - Seu padrão */
  --radius: 18px;
  
  /* Fontes - Sua hierarquia tipográfica */
  --font-title: 'Fraunces', serif;      /* Para títulos impactantes */
  --font-body:  'DM Sans', sans-serif;  /* Para leitura confortável */
  --font-display: 'Manrope', sans-serif; /* Para elementos de interface */
}
```
*Você então usa essas variáveis em TODO o CSS – nunca valores hardcoded.*

### 4. **JavaScript – Padrões que Você Segue**
- **Modularidade**: Funções pequenas e com responsabilidade única (ex: `photo()`, `dishCard()`, `renderMenu()`)
- **Early Returns**: Para evitar aninhamento profundo (ex: `if (!url) return res.status(400).send("Missing url");`)
- **Template Literals**: Para strings dinâmicas (ex: `` `Olá! Quero fazer um pedido...` ``)
- **Event Delegation**: Você costuma usar `document.addEventListener("click", e => { const btn = e.target.closest("[data-add]"); ... })`
- **Feedback Visual Imediato**: Estados de carregamento, toasts, mudanças de cor/escala ao interagir
- **Respeito a Preferências do Sistema**: Verifica `prefers-reduced-motion` e ajusta animações conforme necessário

### 5. **HTML – Boas Práticas que Você Mantém**
- **Semanticidade**: Uso correto de `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- **Accessibilidade**: 
  - `aria-label` em ícones e botões sem texto
  - `aria-expanded` em menus toggle
  - Labels associados a inputs via `for` ou wrapping
  - Contraste de cores sempre verificado
- **Performance**: 
  - `loading="lazy"` em imagens
  - Scripts no final do body ou com `defer`
  - Evita bloqueio de renderização

---

## 🎨 Princípios de Design que Você Segue
*(Observados em todos os seus projetos visuais)*

### 1. **Psicologia de Cores Intencional**
- **Azuis** (`#0A4D9C`, `#1565D8`): Transmite confiança, profissionalismo (usado em projetos corporativos/tecnológicos)
- **Amarelos/Laranjas** (`#FFC93C`, `#FFE27A`): CTAs, destaques, energia (usado em botões principais, preços, ofertas)
- **Tons Quentes** (vermelhos, marrons, dourados): Projetos relacionados à comida (Tempero da Terra) – estimula apetite
- **Tons Frios/Azul-claros** (`#A9DDF7`, `#D9F0FD`): Fundos de apoio, áreas de leitura – transmite calma e confiabilidade

### 2. **Tipografia com Hierarquia Clara**
- **Títulos**: Fontes serif ou display distintas (Fraunces, Manrope, Playfair Display, Sora) – para impacto e personalidade
- **Corpo**: Fontes sans-serif neutras e altamente legíveis (DM Sans, Inter, Poppins) – para leitura prolongada
- **Sempre Fluida**: Uso de `clamp(1rem, 2.5vw, 1.5rem)` para tamanhos que se adaptam a qualquer tela
- **Contraste**: Títulos em cores mais fortes (`var(--primary)`), corpo em tons mais suaves (`var(--muted)` ou `rgba(255,255,255,.8)` em fundos escuros)

### 3. **Espaçamento e Ritmo Visual**
- **Escala Base**: Múltiplos de 4px/8px (8px, 16px, 24px, 32px, 40px, 48px...)
- **Consistência**: Margens e paddings seguem a mesma escala em todo o projeto
- **Espaçamento em Componentes**: Interno de botões, cards, etc. sempre respeita a escala (ex: padding: 12px 24px)

### 4. **Animações com Propósito**
Você **nunca** adiciona animação só porque é legal. Sempre há um motivo:
- **Feedback de Ação**: Botão que escala/altera cor ao clicar (confirma que o clique foi registrado)
- **Guia de Atenção**: Elementos que surgem com delay escalonado conforme você rola (reveal-on-scroll)
- **Estado de Carregamento**: Skeleton screens ou spinners enquanto dados são buscados
- **Transição de Estado**: Menus que deslizam, modals que fade-in, cards que elevam levemente ao hover
- **Respeito ao Usuário**: Todas as animações podem ser desativadas se `prefers-reduced-motion: reduce` estiver ativo

### 5. **Mobile-First como Mentalidade**
Seus breakpoints sempre começam do móvel para cima:
- Estilos básicos funcionam em 320px de largura
- Acréscimos são feitos em `@media (min-width: 768px)`, `(min-width: 1024px)`, etc.
- Nunca há `width: 100%` que quebra em telas pequenas – você usa `max-width` e containers fluidos

---

## 🔧 Ferramentas e Bibliotecas que Você Confia
*(Baseado nos seus `package.json`, imports e mencionados nos READMEs)*

### Frontend/JS
| Biblioteca | Para Que Você Usa | Projeto de Exemplo |
|------------|-------------------|---------------------|
| **WhatsApp API** (`wa.me/...`) | Integração direta para pedidos/contato | Jhonnytur, Tempero da Terra, Horizonte Viagens, AC-Stream |
| **Jimp** | Processamento e análise de imagens (detecção de bordas, cores, etc.) | APRESENTACAO-TAYNA/06-ferramentas (analisar.js, mede.js, etc.) |
| **pdf-lib** | Criação e manipulação de documentos PDF | APRESENTACAO-TAYNA/06-ferramentas (build.js) |
| **iptv-playlist-parser** | Parsing de playlists M3U/M3U8 | iptvnator-backend |
| **epg-parser** | Parsing de dados de guia eletrônico de programas (XMLTV) | iptvnator-backend |
| **axios** | Requisições HTTP modernas (promise-based) | iptvnator-backend, Mimo AI Proxy |
| **express** | Criação rápida de servidores e APIs REST | iptvnator-backend, servir.js (local) |
| **cors** | Middleware para habilitar CORS em APIs | iptvnator-backend |

### Backend/Especializado
| Tecnologia | Para Que Você Usa | Projeto de Exemplo |
|------------|-------------------|---------------------|
| **Go (Golang)** | Gateways de alta performance, concorrência eficiente | Mimo AI Proxy (gateway para Xiaomi AI → OpenAPI) |
| **Docker** | Containerização para deploy consistente e reproduzível | Mimo AI Proxy, iptvnator-backend (tem Dockerfile) |
| **SQLite** | Persistência local leve e confiável | Mimo AI Proxy (sessões e histórico de conversas) |
| **Headless Chrome** | Automação de navegador para screenshots e PDFs | APRESENTACAO-TAYNA/06-ferramentas (build.js usa chrome.exe --headless) |

---

## 🛠️ Seu Fluxo de Trabalho Típico
*(Como você costuma iniciar e desenvolver projetos, baseado nos READMEs e estrutura)*

### 1. **Início de Projeto**
- Começa com um `index.html` vazio e uma estrutura básica de pastas (`css/`, `js/`, `assets/`)
- Define o **design system primeiro** (variáveis de cor, espaçamento, tipografia no `:root` do CSS)
- Estrutura o HTML semântico antes de adicionar qualquer estilo ou lógica
- Adiciona um `README.md` **imediatamente** com instruções de como rodar/localmente

### 2. **Desenvolvimento**
- Trabalha em **camadas**: HTML → CSS → JS (ou alternando entre elas conforme necessário)
- Prefere **testar localmente primeiro** (abrir `index.html` diretamente ou usar um servidor local simples como `node servir.js` ou `python -m http.server`)
- Usa **console.log** estrategicamente para depuração (remove ou comenta antes do commit final, mas deixa rastros nos arquivos de análise como `cargo-test.log`)
- Implementa **features incrementais**: faz uma coisa funcionar bem antes de passar para a próxima
- **Documenta enquanto desenvolve**: o README é atualizado conforme novas funcionalidades são adicionadas

### 3. **Qualidade e Testes**
- Testa em **múltiplos dispositivos** (seus projetos têm media queries bem pensadas para mobile/tablet/desktop)
- Verifica **accessibilidade** navegação por teclado e leitores de tela (atua nos atributos `aria-*`)
- Respeita **prefers-reduced-motion** – sempre verifica se animações devem ser reduzidas ou desativadas
- Garante que o site **funcione sem JavaScript** para funcionalidades básicas (progressão gradual)
- Otimiza **imagens** (usa tamanhos apropriados, compressão, formatos modernos quando relevante)

### 4. **Deploy e Distribuição**
- Prefere **deploy estático simples** quando possível (GitHub Pages, Netlify Drop, Vercel)
- Para projetos com backend: fornece instruções claras de `npm start`, `docker run`, ou `go run main.go`
- Sempre inclui **variáveis de ambiente exemplos** em `.env.example` ou nas instruções
- O `README.md` tem uma seção explícita de "**Como abrir**" ou "**Rodar localmente**"

---

## 📂 Como Recuperar Trabalhos de Outras I.A.s (Estratégia Prática)
*(Baseado no que você já tem e pode fazer agora)*

Se você quiser transferir trabalho entre sessões de I.A. ou recuperar algo feito anteriormente:

### Opção 1: **Use sua própria estrutura como âncora**
Seus projetos já estão organizados de forma que qualquer I.A. pode entender rapidamente:
1. Abra o `README.md` do projeto – ele sempre tem:
   - Como rodar localmente
   - Tecnologias usadas
   - Estrutura de pastas
   - Onde encontrar coisas específicas (ex: "Os produtos ficam no começo do `script.js`...")
2. Leia o `styles.css` para entender o design system (variáveis no `:root`)
3. Examine o `index.html` para ver a estrutura semântica
4. Olhe o `js/main.js` ou equivalente para ver a lógica principal

### Opção 2: **Crie um "Snapshot de Contexto" para cada projeto**
Para cada projeto importante, mantenha um arquivo `CONTEXTO.md` na raiz com:
```markdown
# Contexto do Projeto: [Nome do Projeto]

## Objetivo Principal
[O que esse projeto resolve ou cria]

## Decisões Técnicas-Chave
- Frontend: [HTML/CSS/JS puro / React/Vite / etc.]
- Backend: [Node/Go / Nenhum / etc.]
- Integrações Chave: [WhatsApp API / iptv-playlist-parser / etc.]

## Seu Estilo Nesse Projeto
- [Ex: "Usei amarelo #FFC93C para todos os CTAs porque é o padrão de confiança do usuário"]
- [Ex: "Animação de reveal-on-scroll com delay escalonado para guiar a leitura"]
- [Ex: "Priorizei acessibilidade com aria-labels em todos os ícones"]

## Onde Coisas Importantes Estão
- Lógica principal: `caminho/para/o/arquivo.js`
- Design system: `css/styles.css` (variáveis no :root)
- Configurações: `arquivo de configuração específico`
- Assets: `pasta/assets/` (imagens otimizadas, fontes)

## Como Testar Localmente
[Instruções exatas do seu README.md]

## Próximos Passos / Melhorias Pendentes
[Liste o que você já marcou como TODO nos seus projetos]
```

### Opção 3: **Use Esta Própria Conversa como Backup**
Você pode salvar esta conversa inteira (ou este guia) e colá-la no início de qualquer nova sessão com uma I.A. para restaurar imediatamente o contexto.

---

## 🚀 Como Usar Este Guia com uma Nova I.A.
Quando iniciar uma nova sessão com qualquer I.A., simplesmente:

1. **Copie e cole todo este documento** (ou as partes relevantes) no início da conversa
2. **Diga algo como**:  
   *"Este é meu guia de transferência de contexto. Por favor, leia-o para entender como eu trabalho, minhas preferências técnicas e padrões de qualidade antes de prosseguirmos com qualquer tarefa relacionada aos meus projetos ou desenvolvimento em geral."*
3. **A I.A. agora terá acesso imediato** a:
   - Seu stack tecnológico preferido
   - Seu estilo de codificação e convenções
   - Seus princípios de design
   - Suas ferramentas de confiança
   - Seu fluxo de trabalho típico
   - Como recuperar trabalhos existentes dos seus projetos

---

## 💡 Dica Profissional: Seu "Kit de Sobrevivência para I.A.s"
Salve estes 3 itens em um local de fácil acesso (como uma nota fixada, documento no Google Drive, ou até mesmo um gist no GitHub):

1. **Este Guia de Transferência** (o que você está lendo agora)
2. **Um modelo de README.md padrão** baseado nos seus melhores projetos (ex: o do Tempero da Terra ou Horizonte Viagens)
3. **Um template de estrutura de pastas** com arquivos de exemplo vazios (index.html, css/styles.css, js/main.js, README.md)

Com estes três itens, qualquer I.A. poderá entrar imediatamente no seu modo de trabalho, economizando horas de explicação e retrabalho.

---

*Este guia foi gerado com base na análise real dos seus projetos na pasta `C:\Users\Arcelino Leal\Documents\Projeto` e representa fielmente seu estilo de trabalho estabelecido. Use-o como sua referência portátil para manter consistência independentemente de com qual I.A. você esteja trabalhando.*