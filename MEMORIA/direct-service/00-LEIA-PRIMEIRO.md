# 🧠 MEMÓRIA DO DIRECT SERVICE — LEIA PRIMEIRO

> **Para a IA que estiver começando uma sessão nova:** esta pasta guarda tudo
> o que foi feito, quebrado, consertado e aprendido no **Direct Service**
> (app de prospecção) e nas **Demonstrações de Sites**.
>
> Leia nesta ordem antes de mexer em qualquer arquivo.
>
> **Não recomece do zero.** O app funciona e está empacotado.
> Última sessão: **12/10/2026**.

---

## 📁 Ordem de leitura

| # | Arquivo | O que tem | Prioridade |
|---|---------|-----------|-----------|
| 0 | **`01-ESTADO-ATUAL.md`** | Onde o app está AGORA, números reais, o que falta | ⭐⭐⭐ |
| 1 | **`02-A-BUSCA-E-O-SERVIDOR.md`** | A descoberta do Overpass (por que a busca morria) | ⭐⭐⭐ |
| 2 | **`03-GOTCHAS-ELECTRON.md`** | Windows bloqueia o empacotador; como empacotar à mão | ⭐⭐⭐ |
| 3 | **`04-QUALIDADE-DOS-DADOS.md`** | 87 lugares com ramo errado e a migração que corrigiu | ⭐⭐ |
| 4 | **`05-ABORDAGENS-DE-VENDA.md`** | As 7 abordagens e por que funcionam | ⭐⭐⭐ |
| 5 | **`06-DEMONSTRACOES-DE-SITES.md`** | Os 6 modelos prontos e como mudar a paleta | ⭐⭐ |
| 6 | **`07-COMUNICACAO.md`** | Como o Arcelino gosta de trabalhar | ⭐⭐⭐ |
| 7 | **`08-PENDENCIAS.md`** | O que ainda falta resolver | ⭐⭐ |

---

## ⚡ As 7 regras que mais importam

1. **A busca consulta um servidor público com fila.** Ela pergunta
   `/api/status` para saber QUANDO abre vaga e espera. **NUNCA volte
   para o código antigo que desistia na 6ª tentativa** — foi exatamente
   isso que travava a busca na região 13. Detalhe: `02`.

2. **Mensagem sem acento vende menos.** `"voce"`, `"nao"`, `"negocio"`
   na frente de um dono de comércio faz ele pensar *"nem escreve
   direito, vai fazer meu site?"*. **Sempre com acento.** Já erramos
   uma vez e reescrevi tudo.

3. **Nunca invente bairro.** Só 2 dos 4.648 lugares têm bairro gravado
   no mapa. Dizer "morar aqui no Jardim das Fontes" para quem está a
   8 km entrega a conversa. A mensagem usa "morar aqui perto".

4. **O Windows bloqueia o `app-builder.exe`** (Defender), então
   `electron-builder` falha com `ERR_ELECTRON_BUILDER_CANNOT_EXECUTE`.
   Use `node _ferramentas\monta-pacote.js` + `empacota-zip.js`.
   Detalhe: `03`.

5. **Rode `node verifica-texto.cjs` antes de mostrar site a alguém.**
   Ele acha erro de digitação e palavra em inglês. Achou **9 erros
   meus** antes de chegarem ao cliente.

6. **Não reinstale o npm.** A versão nova do npm trava a instalação de
   binários (`allow-scripts`). Se precisar, baixe o `.tgz` direto do
   registry e copie na mão.

7. **Teste antes de dizer que funciona.** Sempre: rodar o app, clicar
   de verdade, olhar print. "Passou no teste de sintaxe" ≠ funciona.

---

## 🗂️ Onde ficam as coisas

| O quê | Onde |
|---|---|
| Código do app | `Planos/Direct Service/` |
| Gerenciador de dados | `Planos/Direct Service/dados/*.json` |
| Ferramentas de teste | `Planos/Direct Service/_ferramentas/` |
| **Instalador pronto** | `Planos/Direct Service/dist/Direct-Service-1.0.0.zip` |
| **Modelos de site** | `DEMONSTRAÇÕES DE SITES/` |
| Manual do usuário | `Planos/Direct Service/COMO-USAR.md` |

---

## 👤 Quem é o dono

**Arcelino Leal.** Faz site para comércio local na região do Jardim das
Fontes, São Paulo. Tem a **Lion Force Academia** (site próprio:
lionforceacademia.com.br), que é a prova de trabalho que ele mostra
para todo cliente.

Trabalha **prospectando**: acha negócio sem site, manda mensagem e
vende. Por isso cada decisão técnica precisa responder: *"isso faz
ele fechar mais venda?"*