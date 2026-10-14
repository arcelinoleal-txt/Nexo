'use strict';

/**
 * Nexo - sininho de notificações
 * ------------------------------------------------------------------
 * Dois assuntos dentro do mesmo sininho:
 *   1. mensagens que chegaram enquanto você não estava olhando;
 *   2. atualizações do app, com a lista do que mudou.
 *
 * Sem dependência nenhuma e sem tocar no renderer: o renderer só chama
 * Notificacoes.mensagem(...) quando chega conversa.
 */

const Notificacoes = (() => {
  const itens = [];
  let seq = 1;
  // Configurações > Sistema desliga a busca de atualização escrevendo
  // direto em api.semAtualizacao — por isso o objeto, e não uma variável
  // solta: quem muda é quem recebe a atribuição do renderer.
  const api = { semAtualizacao: false };

  /* ---------- persistência local ---------- */
  function carregar(chave, padrao) {
    try {
      const v = localStorage.getItem('nexo.' + chave);
      return v === null ? padrao : JSON.parse(v);
    } catch { return padrao; }
  }
  function salvar(chave, valor) {
    try { localStorage.setItem('nexo.' + chave, JSON.stringify(valor)); } catch { /* ignora */ }
  }

  /* ---------- endereço do servidor ---------- */
  function baseHttp() {
    let s = null;
    try {
      const v = localStorage.getItem('nexo.servidor');
      if (v) s = JSON.parse(v);
    } catch { /* ignora */ }

    if (!s) {
      s = (location.protocol === 'http:' || location.protocol === 'https:')
        ? location.protocol + '//' + location.host
        : 'http://localhost:3000';
    }
    return String(s).replace(/^ws/, 'http').replace(/\/+$/, '');
  }

  /* ---------- elementos ---------- */
  const el = (id) => document.getElementById(id);

  function naoLidas() { return itens.filter(i => !i.lida).length; }

  function atualizarBadge() {
    const badge = el('sino-badge');
    const btn = el('btn-sino');
    if (!badge || !btn) return;
    const n = naoLidas();
    badge.hidden = n === 0;
    badge.textContent = n > 9 ? '9+' : String(n);
    btn.classList.toggle('novo', n > 0);
  }

  function horaDe(ts) {
    const d = new Date(ts || Date.now());
    const hoje = new Date();
    const mesmoDia = d.toDateString() === hoje.toDateString();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return mesmoDia ? `${h}:${m}` : `${d.getDate()}/${d.getMonth() + 1} ${h}:${m}`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function desenhar() {
    const lista = el('sino-lista');
    if (!lista) return;

    if (!itens.length) {
      lista.innerHTML = '<p class="sino-vazio">Nada por aqui ainda.</p>';
      atualizarBadge();
      return;
    }

    lista.innerHTML = itens.map(i => {
      const corpo = i.corpo ? `<p>${escapeHtml(i.corpo)}</p>` : '';
      const listaItens = Array.isArray(i.itens) && i.itens.length
        ? `<ul>${i.itens.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`
        : '';
      const acao = i.acao
        ? `<button class="link-btn sino-acao" type="button" data-id="${i.id}">${escapeHtml(i.acao)}</button>`
        : '';
      return `<button class="sino-item${i.lida ? '' : ' nao-lido'}" type="button" data-id="${i.id}">
        <h4>${escapeHtml(i.titulo)}</h4>
        ${corpo}${listaItens}
        <span class="sino-hora">${horaDe(i.hora)}${acao ? ' · ' : ''}</span>${acao}
      </button>`;
    }).join('');

    lista.querySelectorAll('.sino-item').forEach(b => {
      b.addEventListener('click', () => marcarLido(Number(b.dataset.id)));
    });
    lista.querySelectorAll('.sino-acao').forEach(b => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const item = itens.find(x => x.id === Number(b.dataset.id));
        if (item && typeof item.executar === 'function') item.executar();
      });
    });

    atualizarBadge();
  }

  function adicionar(n) {
    const item = Object.assign({
      id: seq++,
      tipo: 'geral',
      titulo: '',
      corpo: '',
      itens: null,
      lida: false,
      hora: Date.now()
    }, n);

    // junta avisos do mesmo assunto em vez de empilhar um embaixo do outro
    const igual = itens.find(i => i.tipo === item.tipo && i.chave && i.chave === item.chave);
    if (igual) {
      igual.lida = false;
      igual.hora = item.hora;
      igual.corpo = item.corpo;
      igual.itens = item.itens;
      itens.splice(itens.indexOf(igual), 1);
    }

    itens.unshift(item);
    while (itens.length > 30) itens.pop();
    desenhar();
    return item;
  }

  function marcarLido(id) {
    const i = itens.find(x => x.id === id);
    if (i) { i.lida = true; desenhar(); }
  }

  function limparTudo() {
    itens.forEach(i => { i.lida = true; });
    desenhar();
  }

  function alternar() {
    const p = el('painel-sino');
    if (p) p.hidden = !p.hidden;
  }

  function fechar() {
    const p = el('painel-sino');
    if (p) p.hidden = true;
  }

  /* ---------- mensagens ---------- */
  /** Chama quando chega conversa. Só avisa se a pessoa não está olhando. */
  function mensagem(autor, texto, privada) {
    const chatVisivel = !document.getElementById('lista-chat')?.closest('[hidden]');
    const olhando = !document.hidden && document.hasFocus() && chatVisivel;
    if (olhando && !privada) return;      // já está vendo, não incomoda

    adicionar({
      tipo: privada ? 'privada' : 'mensagem',
      chave: (privada ? 'p:' : 'm:') + autor,
      titulo: privada ? `Mensagem privada de ${autor}` : `Nova mensagem de ${autor}`,
      corpo: String(texto || '').slice(0, 160)
    });
  }

  /* ---------- atualização ---------- */
  /* Compara de verdade os números. Sem isto o app avisaria de versão nova
     até para quem JÁ está nela — o aviso passaria a depender de ter alguém
     mexendo no texto das novidades, e não de existir versão mais nova. */
  function compararVersoes(a, b) {
    const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  let _versaoLocal = null;
  async function versaoLocal() {
    if (_versaoLocal) return _versaoLocal;
    try {
      if (window.nexoDesktop && window.nexoDesktop.info) {
        const i = await window.nexoDesktop.info();
        if (i && i.versao) { _versaoLocal = String(i.versao); return _versaoLocal; }
      }
    } catch { /* sem desktop: é o navegador aberto no site */ }
    _versaoLocal = '0.0.0';
    return _versaoLocal;
  }

  /* O fluxo inteiro da atualização, do clique até o instalador abrir.
     A barra de progresso mora DENTRO da própria notificação: nada de janela
     nova nem de popup do sistema — é o sininho, que já está aberto, que
     conta o que está acontecendo. Se algo falhar, a mesma notificação vira
     o caminho de tentar de novo. */
  async function executarAtualizacao(item, info) {
    const desktop = window.nexoDesktop;
    if (!desktop || !desktop.baixarAtualizacao) return;
    // clique duplo não pode pôr dois downloads no ar ao mesmo tempo
    if (item.atualizando) return;
    item.atualizando = true;

    const textoBaixando = (pct) => pct
      ? 'Baixando… ' + pct + '%'
      : 'Baixando…';

    item.acao = textoBaixando(0);
    item.executar = null;
    item.corpo = 'Baixando a versão ' + info.versao + '. Pode levar um minuto — não feche o app.';
    desenhar();

    let ultimo = '';
    if (desktop.sobreProgressoAtualizacao) {
      desktop.sobreProgressoAtualizacao((d) => {
        const texto = textoBaixando(d && d.pct ? d.pct : 0);
        if (texto === ultimo) return;    // só redesenha quando o número muda
        ultimo = texto;
        item.acao = texto;
        desenhar();
      });
    }

    let r;
    try {
      r = await desktop.baixarAtualizacao(info.download, info.sha256);
    } catch (e) {
      r = { ok: false, erro: (e && e.message) || 'falha inesperada' };
    }

    if (!r || !r.ok) {
      item.atualizando = false;
      item.acao = 'Tentar de novo';
      item.executar = () => executarAtualizacao(item, info);
      item.corpo = 'Não consegui baixar a atualização: ' +
        ((r && r.erro) || 'erro desconhecido') + '. O app continua funcionando normalmente.';
      desenhar();
      return;
    }

    item.acao = 'Instalando…';
    item.corpo = 'Instalador conferido. O Nexo vai fechar e a instalação começa agora — ' +
      'é só confirmar a janela do Windows quando aparecer.';
    desenhar();

    try { await desktop.instalarAtualizacao(r.arquivo); } catch { /* o app sai mesmo assim */ }
  }

  async function verificarAtualizacao() {
    if (api.semAtualizacao) return;   // desligado em Configurações > Sistema

    let d;
    try {
      const r = await fetch(baseHttp() + '/api/versao', { cache: 'no-store' });
      if (!r.ok) return;
      d = await r.json();
    } catch { return; } // sem rede: fica quieto em vez de incomodar

    if (!d || typeof d.versao !== 'string' || !d.versao) return;

    const vista = carregar('versaoVista', null);        // assinatura do conteúdo
    const numeroVisto = carregar('ultimaVersao', null); // só o "1.0.0"
    const novidades = Array.isArray(d.novidades) ? d.novidades : [];
    /* O servidor manda o download ABSOLUTO (senão o desktop recusa e o
       aviso aparece sem o botão de instalar). Se algum dia vier relativo
       (/atualizacao/...), completa com o próprio servidor — o mesmo que
       acabou de responder a /api/versao. */
    let link = null;
    if (typeof d.download === 'string' && d.download) {
      if (/^https?:\/\//i.test(d.download)) link = d.download;
      else if (d.download.charAt(0) === '/') link = baseHttp() + d.download;
    }

    const local = await versaoLocal();
    const temMaisNova = compararVersoes(d.versao, local) > 0;
    const rodaNoApp = !!(window.nexoDesktop && window.nexoDesktop.baixarAtualizacao);
    const podeAtualizarSozinho = rodaNoApp && temMaisNova && !!link;

    /* Assinatura de TODO o conteúdo. Se mudar o número da versão, a data
       ou qualquer item das novidades, o aviso aparece. Sem isso, quem só
       editar o texto das novidades não avisaria ninguém — e é justamente
       o "o que mudou" que as pessoas precisam conseguir enxergar. */
    const assinatura = [d.versao, d.atualizadoEm || '', novidades.join('|'), link || ''].join('#');

    if (vista !== null && vista !== assinatura) {
      const trocouDeNumero = numeroVisto !== null && numeroVisto !== d.versao;
      const noNavegador = location.protocol === 'http:' || location.protocol === 'https:';

      const info = {
        versao: d.versao,
        download: link,
        sha256: (typeof d.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(d.sha256)) ? d.sha256 : null,
        novidades
      };

      const novo = adicionar({
        tipo: 'atualizacao',
        chave: 'versao',
        titulo: trocouDeNumero ? `Nexo ${d.versao} disponível` : `O Nexo foi atualizado`,
        corpo: podeAtualizarSozinho
          ? `Você está na ${local}. O que mudou:`
          : (temMaisNova
            ? `Você está na ${local}. Instale a ${d.versao} para ter o que mudou:`
            : 'Tem novidade nova. O que mudou:'),
        itens: novidades.slice(0, 8),
        acao: podeAtualizarSozinho
          ? 'Atualizar agora'
          : (link ? 'Baixar' : (noNavegador ? 'Atualizar agora' : null)),
        executar: podeAtualizarSozinho
          ? null
          : (link
            ? () => window.open(link, '_blank')
            : (noNavegador ? () => location.reload() : null))
      });

      // o item novo é o próprio alvo do progresso — amarrado aqui em cima,
      // sem depender de `this` nem de como o botão vem a chamar a função
      if (podeAtualizarSozinho && novo) {
        novo.executar = () => executarAtualizacao(novo, info);
      }
    }

    if (vista !== assinatura) salvar('versaoVista', assinatura);
    if (numeroVisto !== d.versao) salvar('ultimaVersao', d.versao);
  }

  /* ---------- início ---------- */
  function iniciar() {
    const btn = el('btn-sino');
    if (btn) btn.addEventListener('click', (ev) => { ev.stopPropagation(); alternar(); });

    const limpar = el('sino-limpar');
    if (limpar) limpar.addEventListener('click', limparTudo);

    // fecha ao clicar fora
    document.addEventListener('click', (ev) => {
      const p = el('painel-sino');
      if (!p || p.hidden) return;
      if (p.contains(ev.target) || (btn && btn.contains(ev.target))) return;
      p.hidden = true;
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') fechar();
    });

    desenhar();
    verificarAtualizacao();
    setInterval(verificarAtualizacao, 60000);
  }

  Object.assign(api, { iniciar, mensagem, adicionar, verificarAtualizacao, alternar, fechar });
  return api;
})();
