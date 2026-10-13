# MEMÓRIA --- Preferências de Design, Desenvolvimento e Ferramentas

> **Objetivo:** este arquivo registra minhas preferências permanentes de
> trabalho. Leia-o antes de iniciar qualquer projeto, tarefa de design,
> criação de site, animação, interface ou automação. Use estas
> orientações como padrão sem eu precisar repeti-las.

## 1. Minha preferência principal

Quero resultados de alta qualidade, modernos, profissionais, bem
acabados e pensados nos detalhes. Não entregue algo genérico só porque
funciona: procure elevar o visual, a usabilidade, a responsividade, a
acessibilidade e a qualidade técnica.

Use referências para entender o que funciona e criar uma solução
**original, inspirada e melhor adaptada ao projeto**. Não copie
literalmente um site, identidade visual, layout, ilustrações, textos,
código proprietário ou animações de terceiros. Recrie os princípios e a
sensação geral com escolhas próprias.

Antes de implementar, entenda o objetivo, o público, a marca e as
limitações do projeto. Se já existir código, preserve o que funciona e
evite reescrever tudo sem necessidade.

## 2. Referência de projeto

-   Site que desenvolvi: https://lionforceacademia.com.br
-   Use-o como uma referência do meu trabalho e de projetos reais, não
    como modelo obrigatório para todos os clientes.
-   A identidade visual da Lion Force usa uma linguagem forte de
    academia, com preto, vermelho, contraste alto, tipografia marcante e
    imagens impactantes. Aplique essa estética somente quando combinar
    com a marca do projeto atual.

## 3. Estilo visual que prefiro

Priorize, conforme o contexto:

-   Design moderno, premium, intencional e visualmente marcante.
-   Hierarquia tipográfica clara, títulos fortes e textos fáceis de ler.
-   Composição bem equilibrada, espaçamento consistente e alinhamento
    cuidadoso.
-   Paleta de cores coerente com a marca; contraste e legibilidade acima
    de efeitos decorativos.
-   Interfaces responsivas, com atenção real a celular, tablet e
    desktop.
-   Microinterações, transições suaves e animações bem coreografadas
    quando agregarem valor.
-   Efeitos de luz, profundidade, camadas, blur, partículas ou movimento
    apenas quando fizerem sentido e não prejudicarem desempenho ou
    leitura.
-   Imagens e mídia de boa qualidade, sem distorções ou elementos
    inventados que deturpem produtos, marcas ou pessoas.
-   Estados de carregamento, vazio, erro, sucesso e foco; acessibilidade
    e navegação por teclado.
-   Acabamento consistente em botões, formulários, cards, menus, ícones,
    bordas, sombras e estados de hover.

Evite: aparência de template genérico, excesso de gradientes e efeitos
sem propósito, texto ilegível, espaçamentos aleatórios, animações
exageradas, elementos desalinhados, conteúdo fictício apresentado como
real e layouts que funcionam apenas em uma largura de tela.

## 4. Ferramentas e referências que quero considerar

Verifique cada recurso antes de usá-lo. Entenda sua função, leia a
documentação e confirme se está disponível no ambiente atual.

1.  **Taste Skill** --- referência/skill de apoio ao processo de design,
    se estiver disponível no ambiente.
2.  **Web Design Guidelines** --- usar diretrizes e listas de
    verificação para revisar qualidade de interface, usabilidade,
    acessibilidade e responsividade, conforme a implementação
    disponível.
3.  **Awesome Design** --- usar como catálogo de referências e recursos
    de design, se o item exato estiver identificado e disponível.
4.  **Image to Code** --- considerar quando houver imagem, captura de
    tela ou referência visual a transformar em uma implementação;
    reproduzir a estrutura e a intenção visual com código próprio.
5.  **Playwright CLI** --- considerar para abrir/testar o projeto em
    navegador, verificar fluxos, tamanhos de tela, erros e regressões,
    se instalado e compatível.
6.  **REA --- https://github.com/morluto/rea** --- manter como
    referência técnica especializada. Antes de instalar ou executar, ler
    o README, verificar o propósito, requisitos, manutenção, permissões
    e riscos. Não presumir que seja uma ferramenta de design visual
    geral nem que seja necessária para todo site. Usá-la apenas quando a
    tarefa realmente corresponder ao que o projeto oferece.

Os nomes acima podem identificar skills, repositórios, extensões,
comandos ou ferramentas diferentes. **Não suponha que um nome esteja
instalado nem instale um pacote só por ter nome parecido.** Descubra
primeiro qual é o recurso exato e de onde vem.

## 5. Regra obrigatória: verificar antes de instalar

Antes de instalar qualquer ferramenta:

1.  Identifique o sistema operacional, terminal, ambiente e gerenciador
    de pacotes disponíveis.
2.  Verifique se a ferramenta já existe e qual versão está instalada.
3.  Procure configurações e skills já existentes para evitar
    duplicações.
4.  Consulte a documentação oficial e confirme os comandos corretos.
5.  Avalie permissões, origem, compatibilidade, dependências, custo,
    necessidade de credenciais e riscos.
6.  Prefira a instalação local do projeto quando for suficiente, em vez
    de alterar o sistema inteiro.
7.  Explique brevemente o que pretende instalar e por quê. Não faça
    alterações destrutivas, não sobrescreva configurações pessoais e não
    exponha segredos.
8.  Depois de instalar, confirme que funciona e documente o resultado.

Não diga que verificou ou instalou algo sem realmente executar a
verificação. Se não tiver acesso ao computador ou terminal, forneça os
comandos de diagnóstico e deixe claro que a execução depende de mim.

## 6. Fluxo de trabalho padrão para projetos

### Etapa A --- Entender

-   Leia este arquivo e as instruções existentes do repositório (por
    exemplo, `AGENTS.md`, README e documentação).
-   Examine a estrutura, as tecnologias, os componentes, as dependências
    e o estado atual do projeto.
-   Identifique o objetivo e as referências fornecidas pelo usuário.
-   Se faltar informação essencial, faça uma pergunta curta; não
    bloqueie por detalhes que possam ser resolvidos com boas escolhas
    padrão.

### Etapa B --- Pesquisar e planejar

-   Escolha referências relevantes sem copiar literalmente.
-   Selecione paleta, tipografia, hierarquia, grid, componentes,
    comportamento responsivo e linguagem de animação.
-   Defina o que cada ferramenta realmente acrescentará.
-   Preserve a identidade da marca e os requisitos existentes.

### Etapa C --- Construir

-   Implemente uma solução completa e coesa, não apenas uma tela bonita
    sem funcionalidade.
-   Reutilize componentes e padrões existentes quando apropriado.
-   Escreva código legível e mantenível; evite dependências
    desnecessárias.
-   Considere desempenho, SEO, acessibilidade, segurança e dispositivos
    móveis.
-   Use conteúdo e imagens fornecidos pelo usuário corretamente; não
    invente resultados, avaliações, preços ou especificações.

### Etapa D --- Verificar

-   Execute os testes e verificações que forem possíveis no ambiente.
-   Use Playwright ou ferramenta equivalente quando disponível e útil.
-   Teste os principais fluxos, links, botões, formulários e navegação.
-   Revise console, erros de execução, layout responsivo, contraste,
    foco e estados da interface.
-   Corrija os problemas encontrados antes de dizer que está pronto.
-   Se algo não puder ser testado, informe claramente o que ficou
    pendente.

### Etapa E --- Entregar

-   Resuma o que foi feito e as principais decisões.
-   Informe arquivos alterados, comandos de teste executados e
    resultados reais.
-   Liste limitações ou ações pendentes sem alegar que algo foi
    concluído quando não foi.
-   Se descobrir uma preferência duradoura nova, proponha acrescentá-la
    a esta memória ou atualize-a somente quando houver autorização e
    acesso para editar o arquivo.

## 7. Uso das referências

Quando eu fornecer um site, imagem, vídeo, captura de tela ou
repositório:

-   Analise os aspectos relevantes para a tarefa: composição, ritmo,
    tipografia, cores, hierarquia, interações e organização.
-   Separe inspiração visual de código, marca, conteúdo e ativos
    protegidos.
-   Crie uma interpretação própria adequada à marca e ao objetivo atual.
-   Não reutilize dados pessoais, credenciais, arquivos privados ou
    conteúdo que não tenha autorização para usar.
-   Cite ou registre as referências relevantes quando isso for útil para
    o projeto.

## 8. Comportamento esperado da IA

-   Trabalhe com iniciativa e pensamento crítico, não apenas obedeça
    mecanicamente.
-   Escolha ferramentas com base no benefício real, não por novidade.
-   Antes de pedir para instalar algo, confirme se já está instalado.
-   Não repita verificações desnecessárias quando houver evidência
    confiável e atual no projeto.
-   Não altere o sistema, apague arquivos ou substitua configurações sem
    necessidade e autorização.
-   Não exponha chaves, tokens, senhas ou informações privadas nos logs,
    no código ou nas respostas.
-   Se uma ferramenta estiver indisponível, continue com a melhor
    alternativa possível e explique a limitação.
-   Estas preferências são um padrão de trabalho, mas os requisitos
    explícitos de cada projeto têm prioridade quando forem diferentes.

## 9. Como usar esta memória no OpenCode e em outras IAs

-   Mantenha este arquivo como `MEMORIA.md` em uma pasta estável do
    computador.
-   Para que a IA de um projeto o leia automaticamente, coloque uma
    cópia na raiz do projeto e instrua o agente a ler `MEMORIA.md` antes
    de trabalhar.
-   Quando o ambiente aceitar instruções de projeto, crie ou atualize
    também um `AGENTS.md` curto dizendo para consultar `MEMORIA.md` no
    início de cada tarefa.
-   A existência deste arquivo, sozinha, não garante que toda IA o leia
    automaticamente. A leitura automática depende das regras e
    configurações do ambiente. Confirme isso no OpenCode/Claude e em
    cada projeto.
-   Não inclua senhas, tokens ou outras credenciais nesta memória.

**Instrução curta para o agente:** "Antes de começar, leia `MEMORIA.md`
e as instruções do projeto. Siga minhas preferências de qualidade e
ferramentas, verifique o que já está instalado antes de instalar
qualquer coisa, use referências sem copiar literalmente e teste o
resultado sempre que possível."
