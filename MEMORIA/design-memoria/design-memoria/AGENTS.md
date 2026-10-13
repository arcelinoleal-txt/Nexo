# MEMÓRIA DE DESIGN DO ARCELINO

Este arquivo é lido sempre que o OpenCode abre nesta pasta. Siga TUDO aqui antes de criar qualquer arte.
Responda sempre em português do Brasil, em tom simples e direto.

## 0. O que eu faço aqui
Faço 3 tipos de trabalho, sempre com visual profissional e do meu gosto:
1. **Artes** para Instagram e WhatsApp (posts, carrosséis, status). Estilos A, B, C.
2. **Sites** de negócios locais (academia, salão, etc.). Estilo D.
3. **Aplicativos** de desktop e painéis (como o Direct Service, minha ferramenta de prospecção). Estilo E.
Você NÃO gera imagem por IA. Você escreve em código (HTML/CSS/JS) e, no caso das artes, exporta em PNG. Assim texto, preço e telefone saem exatos.
Meu objetivo é que cada trabalho novo fique MELHOR que o anterior. Veja a seção 7 (ciclo de melhoria).

## 1. Processo obrigatório (nesta ordem)
1. Leia a seção "Aprendizados" no fim deste arquivo.
2. Escolha o estilo (seção 4) conforme a marca/pedido. Se o pedido não disser, pergunte UMA vez qual marca.
3. Abra o modelo da pasta `modelos/` e COPIE ele em vez de começar do zero. Troque só textos, cores da marca e foto.
4. Se você consegue ver imagens, abra também a referência em `referencias/` e compare com o resultado.
5. Exporte o PNG com o script: `python render.py modelos/ARQUIVO.html saida/NOME.png LARGURA ALTURA`
   (se faltar Playwright: `pip install playwright` e depois `playwright install chromium`).
6. Confira: nada cortado, nada sobreposto, textos legíveis, telefone e preços iguais ao pedido.
   Se o render.py avisar "texto fora do quadro", corrija. (Elemento girado pode dar aviso falso, confira a olho.)
7. Entregue o caminho do PNG e pergunte: "Gostou? Quer que eu salve esse estilo ou alguma preferência na memória?"

### 1b. Processo para SITES e APPS (em vez dos passos 5 e 6)
1. Se o projeto já existe, leia os arquivos antes (estrutura, CSS, package.json). Não reescreva do zero.
2. Copie o modelo do estilo (D para site, E para app) e adapte.
3. Faça capturas de tela e olhe: `python render.py caminho.html saida/desktop.png 1440 900` e `... saida/celular.png 390 844`. (O aviso "texto fora do quadro" do render.py vale só para artes; em site e app a página pode ser maior que a tela.)
4. Faça a autocrítica da seção 7 e corrija antes de entregar.

## 2. Tamanhos
- Post de feed e slide de carrossel: 1080x1350
- Quadrado: 1080x1080
- Story e Status do WhatsApp: 1080x1920. Deixe ~200px livres no topo e ~200px embaixo (o app cobre essas áreas).
- Carrossel: um HTML por slide, mesmo estilo, numeração "01 / 05" no rodapé.

## 3. Regras de ouro (valem para todos os estilos)
- Texto, preço, telefone e @ exatamente como eu pedir. Nunca invente telefone, preço, endereço ou promessa.
- Telefone grande e legível (em Status o botão não clica, o número precisa aparecer).
- Foto de cliente/resultado real: NUNCA alterar cor, textura ou comprimento do cabelo/corpo. Só recortar, ampliar e escurecer o fundo.
- Uma cor de destaque por arte. Não pintar tudo da cor de destaque.
- Menos texto é melhor. Hierarquia clara: um elemento principal, o resto quieto.
- Sem emoji de fogo, estrelinhas decorativas, bordas duplas ou molduras grossas.
- Fonte: use as do estilo. Se estiver sem internet, não dependa de Google Fonts; use a fonte do sistema e o fallback do modelo. Teste se renderizou com a fonte esperada.
- Foto pequena: ampliar com suavização e esconder a baixa resolução com degradê escuro/vinheta. Pedir a foto original se ficar borrada.

## 4. Estilos aprovados

### A) Lion Force Academia: post motivacional (1080x1350). Referência: `referencias/A-lion-force-post.png`
- Foto da pessoa treinando em tela cheia, com degradê preto embaixo (de ~55% da altura até o fim) para dar leitura ao texto.
- Logo no canto superior esquerdo (x56, y44), ~85px de altura: ícone do leão + "LION FORCE" branco condensado + "ACADEMIA" minúsculo espaçado embaixo. Arquivo do logo: `marcas/lion-force-logo.png` (se não existir, peça).
- Texto em 3 linhas alinhado à ESQUERDA, no terço de baixo (começa ~y1000), fonte condensada bold em MAIÚSCULAS (Bebas Neue, Anton, Oswald 700; no Windows, Impact), com sombra preta forte (text-shadow: 4px 4px 0 #000, 0 0 18px rgba(0,0,0,.8)):
  - linha 1, vermelho #ff2a3a, ~160px: frase de impacto curta ("NÃO PARE")
  - linha 2, branco #ffffff, ~88px: complemento ("QUANDO ESTIVER CANSADO")
  - linha 3, vermelho #ff2a3a, ~88px: fecho ("E SIM QUANDO TERMINAR.")
- Barrinha vermelha fina (~85px x 4px) logo acima da linha 1.
- Cores: preto, vermelho #ff2a3a, branco. Nada além disso.

### B) Boreal Marketing: carrossel de dicas (1080x1350). Referência: `referencias/B-boreal-slide-gancho.png`. Modelo: `modelos/B-boreal-slide.html`
- Fundo roxo muito escuro em degradê (#291132 no topo até #140a20 embaixo).
- Foto no topo (altura ~380px), desfocada, escurecida e sumindo no roxo. Tema ligado ao assunto (cidade para SEO local etc.).
- Cabeçalho (y~70): "BOREAL MARKETING" à esquerda e "SEO · SITES · MARKETING" à direita, maiúsculas, letras bem espaçadas, pequeno.
- Linha de assunto centralizada (y~449), menta #68efc4, maiúsculas espaçadas: "DICA DA SEMANA · SEO LOCAL".
- Título centralizado, até 3 linhas, maiúsculas, fonte sans FINA (peso 300), ~70px, linha 82px, branco. Só UMA frase do título em verde #54f03e.
- Divisor curto centralizado: 160px x 2px, #96318a.
- Texto de apoio centralizado, 2 linhas, ~26px, cor #e3c2ec.
- Botão-pílula contornado (borda 2px #55346d, 72px de altura): "ARRASTA PRO LADO". No último slide troque por chamada de ação.
- Rodapé: ícone do Instagram menta #9bffc4 + "@borealmarketing.br" (y~1214, ~34px) e embaixo "01 / 05 · assunto" (y~1277, ~21px, #bb9ec5).
- Espaço vazio é proposital. Não encher.

### C) Salão: promoção de beleza (Status 1080x1920). Referência: `referencias/C-salao-status-liso-perfeito.png`. Modelo: `modelos/C-salao-status.html`
- Fundo marrom escuro quase preto (#1b110c a #0e0806) com brilho quente sutil.
- Título "LISO" enorme em serifada com degradê dourado-rosado (#f6dfc0 → #d1a070 → #8f5b3a) e a palavra seguinte em itálico/cursiva por cima, levemente girada.
- Foto do cabelo grande no lado direito, bordas se misturando no fundo escuro (máscara em degradê), sem moldura.
- Cartões bege (#f0e1d0 → #e2cdb6), cantos 34px, sombra suave, ícone redondo escuro à esquerda, nome do serviço em negrito, subtítulo, preço grande (R$ pequeno + número grande).
- Selo de prazo em pílula com contorno dourado e ícone de calendário.
- Assinatura "Com Cássia" em serifada dourada + ícone verde de WhatsApp com "AGENDE SEU HORÁRIO" e o número grande.
- Dourado só no título e na assinatura. Nunca em tudo (a primeira versão com dourado em tudo foi reprovada).

### D) Site de negócio local, escuro com vermelho. Referência: site da Lion Force (lionforceacademia.com.br). Modelo: `modelos/D-site-hero.html`
Uso: sites institucionais de academia, estúdio, loja, serviço local. A estrutura abaixo já funciona e deve ser a base; os novos sites precisam ficar MELHORES que o da Lion Force (seção 7).
- **Cores:** fundo #0a0a0b (theme-color #0a0a0a), vermelho de ação #e3212a, branco #fff, cinza de apoio ~#9a9a9f, linhas #1d1d20. Vermelho só em: botão principal, UMA palavra do título, linha de assunto, detalhes pequenos.
- **Tipografia:** título gigante em fonte condensada bold, MAIÚSCULAS, entrelinha ~0.93 (Bebas Neue ou Anton; fallback Oswald, Impact), até 4 linhas, ~124px no desktop com clamp() para mobile, UMA palavra em vermelho. Menu e botões em sans bold MAIÚSCULAS com letras levemente espaçadas. Texto corrido em sans (Inter/Poppins), 16-17px.
  Em site online, carregue a fonte do Google Fonts e sempre declare fallback. Se o CSS do site da Lion Force estiver no computador, leia ele para copiar as fontes exatas.
- **Estrutura do topo:** (1) faixa fina com endereço à esquerda e WhatsApp + horários à direita, texto 12-13px cinza; (2) cabeçalho de ~112px com logo redondo + nome, menu em maiúsculas (A unidade, Estrutura, Nossa história, Planos, App, Contato) e botão pílula vermelho "Quero treinar ↗" à direita; (3) hero.
- **Hero:** migalha de pão ("Início › Unidade ..."), linha de assunto vermelha com traço antes ("FORÇA · DISCIPLINA · RESULTADO"), título gigante, parágrafo curto (máx. 2 linhas), dois botões (principal vermelho cheio + secundário contornado), faixa de prova social (nota no Google, horários). Foto de fundo da própria academia escurecida com degradê da esquerda (texto sempre legível) e um cartão de foto com cantos arredondados (18px) saindo no canto inferior direito.
- **Ordem das seções:** A unidade (3 cartões: app, avaliação física, acompanhamento) → Estrutura (cartões com foto) → Planos (4 cartões: mensal, trimestral, semestral, anual; o do meio com selo "Mais escolhido"; lista de benefícios; botão em cada; preços claros "3x R$ 119,99/mês"; taxas em linha embaixo) → App → Avaliações (nota grande 4,9, barras de porcentagem por estrela, cartões de depoimentos reais) → Nossa história → Chamada final "Pronto para começar?" com WhatsApp → Rodapé em 4 colunas (unidade, planos, app, atendimento) com Instagram, WhatsApp e e-mail.
- **Sempre presentes:** botão flutuante de WhatsApp redondo com etiqueta "Fale com o suporte", aviso de cookies discreto, páginas separadas (unidade, estrutura, história, planos, app, contato) com o mesmo cabeçalho/rodapé.
- **SEO e técnica (obrigatório):** `<title>` e meta description com cidade + serviço + preço inicial, Open Graph (imagem 1200x630), dados estruturados JSON-LD LocalBusiness (endereço, telefone, horários, nota), geo meta, imagens com `alt` descritivo e `loading="lazy"`, links de WhatsApp com mensagem pronta (`wa.me/55DDDNUMERO?text=...`), semântica correta (um só h1), foco visível no teclado, `prefers-reduced-motion` respeitado.
- **Responsivo:** testar em 390px (celular), 768px e 1440px. No celular o menu vira botão (hambúrguer), o título cai para ~64px, cartões empilham e o botão de WhatsApp continua visível.
- **Fotos:** usar fotos REAIS do negócio. Foto de banco de imagens só como provisório e avisando; nunca com legenda dizendo que é o espaço do cliente.

### E) Aplicativo de desktop / painel, tema escuro verde. Referência: Direct Service. Modelo: `modelos/E-app-painel.html`
Uso: ferramentas internas, CRMs, painéis de prospecção, controle de clientes e financeiro. Janela de referência 1405x836.
- **Cores:** fundo #0b0e0e, barra lateral #080a0a, cartões #0f1313, linhas #1c2222, texto #edf2f0, texto apagado #5d6663, destaque verde #4ea882 (texto verde #7ec4a3), item ativo do menu #111f1a, alerta/negativo vermelho #d1706a. Verde = ação e número principal. Vermelho = só o que está ruim ou bloqueado.
- **Layout:** barra lateral fixa de 216px (marca no topo, seções em maiúsculas pequenas e apagadas, itens com contador alinhado à direita, rodapé com dado útil), faixa superior de 4 números-resumo (verde, com legenda minúscula), área de conteúdo com margem de ~31px e largura máxima ~1160px, barra de status fina embaixo (mensagem à esquerda, pasta dos dados à direita).
- **Tipografia:** sans do sistema (Segoe UI/Inter). Título da página 26px peso LEVE (300). Subtítulo 12px apagado explicando em uma frase para que serve a tela. Micro-rótulos 10px MAIÚSCULOS com letras espaçadas (.2em). Números grandes 28-30px peso leve; o número principal em verde. Botões 10,5px maiúsculos com letras espaçadas: primário verde cheio com texto escuro, secundários só com contorno.
- **Componentes:** painel de números em UM cartão dividido em colunas por linha fina; cartão de ação ("O lote de hoje") com título, explicação e botões à direita; cartão de resumo com números alinhados em coluna + frase explicando; cartão com linha verde de 2px embaixo para o que é mais importante; filtros em uma linha (busca, selects, checkbox). Cantos pequenos (4px). Quase sem sombra.
- **Tom do texto (importante):** português simples, falando com o usuário, explicando o que cada número significa ("7574 não têm telefone — aparecem na base, mas não dá para ligar"). Nada de jargão. Mostrar sempre "o que fazer agora".
- **Comportamento:** dados salvos localmente (pasta do usuário, ex.: AppData\Roaming\NomeDoApp\dados), nunca perder dados ao fechar, dizer isso na tela ("você pode fechar o programa e abrir quando quiser"). Listas que andam sozinhas conforme o usuário marca. Ações demoradas com botão de "Parar". Copiar com um clique (telefones, chave Pix).
- **Ao mexer num app que já existe:** leia o `package.json` e a estrutura do projeto primeiro e MANTENHA a mesma stack e a mesma organização. Não reescreva o que funciona.
- **Qualidade:** teclado e foco visíveis, contraste mínimo AA nos textos importantes (o cinza #5d6663 só em texto secundário), estados de vazio/carregando/erro em todas as telas (dizer o que aconteceu e como resolver), janela redimensionável sem quebrar a partir de 1100px.

## 5. Marcas (dados fixos)
- **Boreal Marketing**: Instagram @borealmarketing.br. Serviços: SEO, Sites, Marketing.
- **Lion Force Academia**: academia no Jardim Das Fontes, São Paulo. Rua Fonte Nova, 34A. WhatsApp (11) 94354-4884. Seg a Sex 06:00-22:00, Sáb 09:00-13:00. Instagram @lionforce_academia. Site lionforceacademia.com.br. Treino no app Next Fit. Nota 4,9 no Google. Logo em `marcas/lion-force-logo.png`.
- **Direct Service**: app de prospecção do Arcelino (estilo E). Serve para achar negócios sem site, chamar por telefone/WhatsApp e acompanhar fechamentos.
- **Cássia (salão)**: WhatsApp (11) 97592-9957. Assinatura "Com Cássia". Serviços atuais: Progressiva R$ 100 (liso absoluto), Botox R$ 75 (brilho + selagem). Preços só valem se eu confirmar na hora do pedido.

## 6. Como esta memória evolui (IMPORTANTE)
Quando eu disser "gostei", "não gostei", "sempre faça", "nunca faça", "salva isso" ou "lembra disso":
1. Adicione uma linha em "Aprendizados" com a data e a regra, curta e específica.
2. Se for um estilo novo que eu aprovei: copie o HTML final para `modelos/`, o PNG para `referencias/` e crie a seção do estilo na seção 4 (cores em hex, fontes, tamanhos, posições).
3. Se eu corrigir algo no estilo existente, atualize a seção do estilo em vez de só anotar.
4. Nunca apague aprendizados antigos sem me perguntar. Se duas regras brigarem, pergunte qual vale.
Ao fim de toda arte aprovada, pergunte se há algo para salvar.

## 7. Ciclo de melhoria (para ficar sempre melhor)
Antes de entregar QUALQUER trabalho:
1. Compare com a referência do estilo e liste 3 defeitos reais (espaçamento, hierarquia, contraste, texto longo, alinhamento, algo genérico). Corrija os 3.
2. Pergunte-se: "isso parece feito por um designer ou por um modelo padrão?" Se parecer padrão (cartões iguais, gradiente aleatório, tudo centralizado), mude uma decisão com intenção.
3. Os modelos em `modelos/` são ponto de partida, NÃO teto. Novo trabalho deve superar a referência em pelo menos um ponto (clareza, detalhe, acabamento, velocidade, acessibilidade, SEO).
Depois de entregar:
4. Escreva em `melhorias.md` até 3 ideias concretas do que ainda poderia melhorar neste trabalho, e diga ao Arcelino quais são.
5. Se o Arcelino disser "aplica as melhorias", faça as de `melhorias.md` e marque como feitas.
6. Quando uma melhoria funcionar e ele aprovar, atualize o modelo em `modelos/` e a receita do estilo na seção 4 para os próximos trabalhos já começarem melhores.

## 8. Aprendizados (o modelo adiciona aqui)
- IA de imagem erra telefone, preço e acento. Por isso fazemos em código (HTML → PNG).
- Arte com dupla moldura, selo com estrelinhas, emoji de fogo e muito texto foi chamada de "ridícula". Evitar.
- Estilo C (salão com cartões bege e título dourado) foi aprovado: "foi perfeito".
- Estilos A e B foram feitos com o modelo MiMo e eu gostei da organização: manter posições e hierarquia descritas acima.
- Quero sites e apps MELHORES que o site da Lion Force e que o app Direct Service, sempre evoluindo.
- Site da Lion Force: usei fotos de banco de imagens em algumas seções; nos próximos usar fotos reais do negócio.
