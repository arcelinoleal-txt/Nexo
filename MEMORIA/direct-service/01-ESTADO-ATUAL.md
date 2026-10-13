# 📊 ESTADO ATUAL — Direct Service

> Última medição: **12/10/2026**, com o app instalado e a base real.

---

## O que é o app

Programa de **desktop** (Electron) que prospecta comércio em São Paulo
através do mapa público (OpenStreetMap), organiza o trabalho de
vendas e mostra mensagens prontas com a prova de trabalho do dono.

---

## Números reais da base (medidos)

| Métrica | Valor |
|---|---|
| Lugares na base | **4.648** |
| **Dá para ligar** (tem contato + tem a dor) | **444** |
| Sem site (a dor que ele vende) | **4.152** |
| Com WhatsApp no mapa | **35** |
| A até 1,5 km de casa | **50** |
| Regiões varridas | **17 de 322** |
| Lote do dia | **25** |
| Rede nacional / nome genérico (escondidos) | ~87 |
| Sem telefone nenhum | ~924 |

> **Leia o número "dá para ligar", não o total.** A base tem 4.648, mas
> só 444 servem para trabalhar. Mostrar o total grande faz o Arcelino
> achar que tem 4.648 oportunidades e se frustrar.

---

## A busca hoje

- Divide São Paulo em **322 quadrantes** (~3,3 km).
- Começa **do centro para fora** (anéis), senão os primeiros minutos
  vêm vazios e a pessoa acha que o app quebrou.
- Salva o progresso a cada região → pode fechar e voltar depois.
- Ritmo medido: **~2 regiões por minuto** → **~2h40 para varrer tudo**.

---

## Arquitetura

| Arquivo | Papel |
|---|---|
| `main.js` | Janela, IPC, **toda a rede** (Overpass, checagem de site, geocodificação) |
| `preload.js` | Ponte segura (`window.ds`) |
| `config.js` | **Editável pelo dono**: Pix, oferta, portfólio, bairro, qualidade |
| `app/app.js` | Toda a tela: busca, lista, funil, painel, mensagens |
| `app/qualidade.js` | Regras do que vale a pena oferecer (rede, genérico, distância) |
| `app/base.js` | Utilitários (`$`, `esc`, `semAcento`, `dinheiro`) |
| `app/index.html` / `app.css` | Estrutura e visual (tema grafite + jade) |
| `dados/*.json` | Banco local — **nunca sai do computador** |

**Ordem de carregamento dos scripts importa:** `config` → `base` →
`qualidade` → `app`. O `qualidade.js` usa funções do `base.js`, e se a
ordem inverter o arquivo inteiro morre em silêncio e a tela fica sem
lista nenhuma.

---

## Mensagens

7 abordagens. O programa escolhe sozinho pela situação:

| Situação | Modelo |
|---|---|
| Sem site, a até 1,2 km | `local` — convida para **passar lá** |
| Sem site, longe | `primeiro-contato` — oferece **rascunho grátis** |
| Só Instagram | `so-rede-social` |
| Domínio à venda | `site-estacionado` |
| Site fraco | `site-fraco` |
| Sumiu 7–30 dias | `retorno` |
| Sumiu mais de 30 dias | `despedida` |

Detalhe completo em `05-ABORDAGENS-DE-VENDA.md`.

---

## Entregável

`Planos/Direct Service/dist/Direct-Service-1.0.0.zip` (108 MB)

Instalar: extrair → abrir `Direct Service.exe` → atalho na área de trabalho.

> **O `.exe` antigo foi renomeado** para `ANTIGO-nao-use-Setup-1.0.0.exe`
> para não clicar errado.

**Testado do zero**: extraí o zip numa pasta limpa, abri, carregou
4.648 lugares, todas as 10 abas sem erro.

---

## Dados do dono (`config.js`)

- Chave Pix: `11911053172`
- Assinatura nas mensagens: **Arcelino** (não "Direct Service" —
  ninguém responde a um logo)
- Portfólio: `lionforceacademia.com.br` (primeiro da lista)
- Bairro de trabalho: Jardim das Fontes, SP

Ao fechar um cliente, **coloque o site dele em `portfolio`**. Aí a
mensagem passa a mostrar um exemplo do **mesmo ramo** da pessoa que
está sendo abordada.