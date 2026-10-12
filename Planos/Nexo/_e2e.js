'use strict';

/**
 * Teste E2E do app Nexo.
 * Abre o Electron com --remote-debugging-port, dirige a interface pelo
 * protocolo Chrome DevTools e confere se a sala, o chat e a lista de
 * participantes funcionam de verdade.
 *
 * Uso:  npx electron . --remote-debugging-port=9222   (num terminal)
 *       node _e2e.js                                   (em outro)
 */

const WebSocket = require('ws');
const http = require('http');

const PORTA_CDP = 9222;
const SERVIDOR = 'ws://localhost:3000';

const falhas = [];
const errosDeConsole = [];

function conf(cond, texto) {
  const linha = (cond ? '  OK   ' : '  FALHA ') + texto;
  console.log(linha);
  if (!cond) falhas.push(texto);
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function pegarJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function conectarCdp(url) {
  const ws = new WebSocket(url, { perMessageDeflate: false });
  let seq = 0;
  const esperando = new Map();

  ws.on('message', (bruto) => {
    const msg = JSON.parse(bruto.toString());

    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errosDeConsole.push('EXCECAO: ' + (d.exception?.description || d.text));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      errosDeConsole.push('CONSOLE: ' + msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errosDeConsole.push('LOG: ' + msg.params.entry.text);
    }

    if (msg.id && esperando.has(msg.id)) {
      const { resolve, reject } = esperando.get(msg.id);
      esperando.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });

  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      const chamar = (method, params = {}) => new Promise((res, rej) => {
        const id = ++seq;
        esperando.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
      resolve({ ws, chamar });
    });
    ws.on('error', reject);
  });
}

async function avaliar(cdp, expressao) {
  const r = await cdp.chamar('Runtime.evaluate', {
    expression: expressao,
    returnByValue: true,
    awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error('avaliacao falhou: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

(async () => {
  console.log('\n== Teste E2E do app Nexo ==\n');

  // --- 1. achar a pagina do Electron -------------------------------------
  let alvo = null;
  for (let i = 0; i < 30 && !alvo; i++) {
    try {
      const alvos = await pegarJson(`http://127.0.0.1:${PORTA_CDP}/json/list`);
      alvo = alvos.find(a => a.type === 'page' && a.url.startsWith('file:'));
    } catch { /* electron ainda subindo */ }
    if (!alvo) await dormir(500);
  }
  if (!alvo) {
    console.log('  FALHA nao consegui falar com o Electron (porta 9222)');
    process.exit(1);
  }
  console.log('  conectado ao Electron: ' + alvo.title);

  const cdp = await conectarCdp(alvo.webSocketDebuggerUrl);
  await cdp.chamar('Runtime.enable');
  await cdp.chamar('Log.enable');

  // zera a marca de "já viu o tutorial" e recarrega, para que o teste
  // verifique de verdade a abertura automática na primeira vez
  await avaliar(cdp, `(() => { try { localStorage.removeItem('nexo.tutorialVisto'); } catch (e) {} return true; })()`);
  await cdp.chamar('Page.reload', { ignoreCache: true });
  await dormir(4000);

  // se sobrou de um teste anterior, volta para a tela de entrada
  await avaliar(cdp, `(() => {
    if (!document.querySelector('#tela-sala').hidden) document.querySelector('#btn-sair-som').click();
    return true;
  })()`);
  await dormir(1000);

  // --- 2. pre-condicoes ---------------------------------------------------
  const preco = await avaliar(cdp, `JSON.stringify({
    titulo: document.title,
    desktop: typeof window.nexoDesktop,
    telaEntrada: !document.querySelector('#tela-entrada').hidden,
    temCaptura: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
    temWS: typeof WebSocket,
    temSeletorFps: !!document.querySelector('#sel-fps')
  })`);
  const p = JSON.parse(coerce(preco));
  conf(p.titulo === 'Nexo', 'janela carregou com titulo "Nexo"');
  conf(p.desktop === 'object', 'ponte Electron (preload) exposta');
  conf(p.telaEntrada === true, 'tela de entrada visivel no inicio');
  conf(p.temCaptura === true, 'navigator.mediaDevices.getDisplayMedia disponivel');
  conf(p.temWS === 'function', 'WebSocket disponivel');
  conf(p.temSeletorFps === true, 'seletor de fps existe na interface');

  // --- 2b. tutorial guiado abre sozinho na primeira vez --------------------
  const tutAuto = JSON.parse(coerce(await avaliar(cdp, `(() => {
    const ov = document.querySelector('#tutorial-overlay');
    const aberto = !!(ov && !ov.hidden);
    const passos = [];
    let guarda = 0;
    while (ov && !ov.hidden && guarda < 25) {
      passos.push(document.querySelector('#tutorial-titulo').textContent);
      document.querySelector('#tutorial-proximo').click();
      guarda++;
    }
    return JSON.stringify({
      aberto,
      total: passos.length,
      passos,
      primeiro: passos[0] || '',
      ultimo: passos[passos.length - 1] || '',
      fechou: ov ? ov.hidden : false,
      visto: localStorage.getItem('nexo.tutorialVisto')
    });
  })()`)));

  conf(tutAuto.aberto, 'tutorial guiado abre sozinho na primeira vez');
  conf(tutAuto.total === 8, 'tutorial tem ' + tutAuto.total + ' passos');
  conf(/Bem-vindo/i.test(tutAuto.primeiro), 'primeiro passo: ' + tutAuto.primeiro);
  conf(/Pronto para usar/i.test(tutAuto.ultimo), 'último passo: ' + tutAuto.ultimo);
  conf(tutAuto.fechou, 'clicar em Concluir fecha o tutorial');
  conf(tutAuto.visto === '1', 'tutorial fica marcado como visto');
  conf(tutAuto.passos.some(t => /sala/i.test(t)), 'tutorial ensina a entrar na sala');
  conf(tutAuto.passos.some(t => /microfone/i.test(t)), 'tutorial ensina o microfone');
  conf(tutAuto.passos.some(t => /transmitir/i.test(t)), 'tutorial ensina a transmitir a tela');
  conf(tutAuto.passos.some(t => /chat/i.test(t)), 'tutorial ensina o chat e a conversa individual');
  await dormir(300);

  // --- 3. criar sala ------------------------------------------------------
  await avaliar(cdp, `(() => {
    document.querySelector('#in-nome').value = 'Ana';
    document.querySelector('#in-servidor').value = ${JSON.stringify(SERVIDOR)};
    document.querySelector('#btn-criar').click();
    return true;
  })()`);

  await dormir(1800);

  const sala = JSON.parse(coerce(await avaliar(cdp, `JSON.stringify({
    salaAberta: !document.querySelector('#tela-sala').hidden,
    entradaEscondida: document.querySelector('#tela-entrada').hidden,
    codigo: document.querySelector('#codigo-sala').textContent,
    conexao: document.querySelector('#estado-conn').textContent.trim(),
    pessoas: document.querySelectorAll('#lista-pessoas li').length,
    btnTela: !!document.querySelector('#btn-tela'),
    caixaEspectador: !document.querySelector('#placeholder').hidden,
    controlesFlutuantes: !!document.querySelector('#controles-flutuantes'),
    ctrlTransmitir: document.querySelector('#rotulo-ctrl-tela')?.textContent || '',
    opcoesFps: Array.from(document.querySelectorAll('#sel-fps option')).map(o => o.value),
    fpsEscolhido: document.querySelector('#sel-fps').value,
    temModalConfig: !!document.querySelector('#modal-config'),
    temModalPerfil: !!document.querySelector('#modal-perfil'),
    temSelMicro: !!document.querySelector('#sel-micro'),
    temSelFone: !!document.querySelector('#sel-fone'),
    textoErro: document.querySelector('#erro-entrada').hidden ? '' : document.querySelector('#erro-entrada').textContent
  })`)));

  conf(sala.salaAberta && sala.entradaEscondida, 'sala aberta apos criar');
  conf(/^[A-Z0-9]{6}$/.test(sala.codigo), 'codigo gerado: ' + sala.codigo);
  conf(/conectado/.test(sala.conexao), 'indicador mostra "conectado"');
  conf(sala.pessoas === 1, '1 participante na lista (eu)');
  conf(sala.btnTela === true, 'botao de transmitir existe no painel');
  conf(sala.caixaEspectador === true, 'placeholder de "ninguem transmitindo" visivel no inicio');
  conf(sala.controlesFlutuantes === true, 'controles flutuantes existem sobre o video');
  conf(sala.ctrlTransmitir === 'Transmitir', 'rotulo inicial do controle: ' + sala.ctrlTransmitir);

  // --- 4b. mini-janela flutuante ------------------------------------------
  const mini = JSON.parse(coerce(await avaliar(cdp, `(() => {
    const btn = document.querySelector('#btn-mini');
    if (!btn) return JSON.stringify({ tem: false });
    btn.click();
    const p = document.querySelector('#mini-janela');
    const r = p.getBoundingClientRect();
    const dentroTela = r.left >= 0 && r.top >= 0 &&
      r.right <= window.innerWidth + 2 && r.bottom <= window.innerHeight + 2;

    let arrastou = false;
    try {
      const topo = p.querySelector('.mini-topo');
      const antes = p.getBoundingClientRect().left;
      topo.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: antes + 20, clientY: r.top + 5 }));
      topo.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: antes - 30, clientY: r.top - 20 }));
      topo.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const depois = p.getBoundingClientRect().left;
      arrastou = Math.abs(depois - antes) > 10;
    } catch (e) { arrastou = false; }

    const aberta = !p.hidden;
    document.querySelector('#mini-fechar').click();
    return JSON.stringify({
      tem: true, aberta, dentroTela, arrastou,
      fechou: p.hidden,
      botaoDesligou: !btn.classList.contains('ativo'),
      temTitulo: !!document.querySelector('#mini-titulo'),
      temCorpo: !!document.querySelector('#mini-corpo')
    });
  })()`)));

  conf(mini.tem, 'botão da mini-janela existe no palco');
  conf(mini.aberta, 'mini-janela abre');
  conf(mini.dentroTela, 'mini-janela abre dentro da tela');
  conf(mini.temTitulo, 'mini-janela mostra de quem é a transmissão');
  conf(mini.temCorpo, 'mini-janela tem área de vídeo');
  conf(mini.arrastou, 'mini-janela é arrastável');
  conf(mini.fechou, 'fechar a mini-janela esconde ela');
  conf(mini.botaoDesligou, 'botão da mini-janela volta ao normal');
  conf(sala.opcoesFps.join(',') === '30,60,120,144', 'opcoes de fps: ' + sala.opcoesFps.join(', '));
  conf(['30', '60', '120', '144'].includes(sala.fpsEscolhido), 'fps escolhido carregado: ' + sala.fpsEscolhido);
  conf(sala.temModalConfig && sala.temModalPerfil, 'modais de configurações e perfil presentes');
  conf(sala.temSelMicro && sala.temSelFone, 'seletores de microfone e fone presentes');
  conf(sala.textoErro === '', 'nenhum erro na tela de entrada' + (sala.textoErro ? ' -> ' + sala.textoErro : ''));

  // --- 4. chat ------------------------------------------------------------
  await avaliar(cdp, `(() => {
    const c = document.querySelector('#in-chat');
    c.value = 'ola, aqui e a Ana';
    document.querySelector('#form-chat').dispatchEvent(new Event('submit', { cancelable: true }));
    return true;
  })()`);
  await dormir(700);

  const chat = JSON.parse(coerce(await avaliar(cdp, `JSON.stringify({
    total: document.querySelectorAll('#lista-chat .msg').length,
    ultima: document.querySelector('#lista-chat .msg:last-child .texto-msg')?.textContent || '',
    autor: document.querySelector('#lista-chat .msg:last-child .autor-msg')?.textContent || '',
    contador: document.querySelector('#cont-chat').textContent
  })`)));

  conf(chat.total >= 1, 'mensagem apareceu no chat');
  conf(chat.ultima === 'ola, aqui e a Ana', 'texto da mensagem correto');
  conf(chat.autor === 'Ana', 'autor da mensagem correto');

  // --- 5. outro cliente entra na sala ------------------------------------
  const espectador = await new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVIDOR);
    ws.recebidos = [];
    ws.on('message', (d) => { try { ws.recebidos.push(JSON.parse(d.toString())); } catch { /* ignora */ } });
    ws.enviar = (o) => ws.send(JSON.stringify(o));
    ws.on('open', () => { ws.send(JSON.stringify({ tipo: 'entrar', codigo: sala.codigo, nome: 'Bruno' })); resolve(ws); });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('espectador nao conectou')), 5000);
  });

  await dormir(1200);

  const lista = JSON.parse(coerce(await avaliar(cdp, `JSON.stringify({
    pessoas: document.querySelectorAll('#lista-pessoas li').length,
    nomes: Array.from(document.querySelectorAll('#lista-pessoas .nome-pessoa')).map(e => e.textContent),
    sistema: Array.from(document.querySelectorAll('#lista-chat .msg.sistema .texto-msg')).map(e => e.textContent),
    limite: !document.querySelector('#aviso-limite').hidden
  })`)));

  conf(lista.pessoas === 2, 'lista atualizou para 2 participantes');
  conf(lista.nomes.includes('Bruno'), 'nome do espectador na lista: ' + lista.nomes.join(', '));
  conf(lista.sistema.some(t => /Bruno entrou/.test(t)), 'mensagem de sistema do entrance: ' + JSON.stringify(lista.sistema));
  conf(lista.limite === false, 'sem aviso de limite com 2 pessoas');

  // --- 6z. perfil de outra pessoa -----------------------------------------
  const perfilPessoa = JSON.parse(coerce(await avaliar(cdp, `(() => {
    const li = [...document.querySelectorAll('#lista-pessoas li')].find(x => !x.classList.contains('eu'));
    if (!li) return JSON.stringify({ tem: false });
    li.click();
    const m = document.querySelector('#modal-pessoa');
    return JSON.stringify({
      tem: true,
      aberto: !m.hidden,
      nome: (document.querySelector('#pessoa-nome') || {}).textContent || '',
      selos: document.querySelectorAll('#pessoa-selos .selo').length,
      temBotaoConversa: !document.querySelector('#btn-conversa-pessoa').hidden
    });
  })()`)));

  conf(perfilPessoa.tem, 'dá pra clicar numa pessoa da lista');
  conf(perfilPessoa.aberto, 'perfil do amigo abre');
  conf(perfilPessoa.nome === 'Bruno', 'perfil mostra o nome: "' + perfilPessoa.nome + '"');
  conf(perfilPessoa.selos >= 1, 'perfil mostra o estado da pessoa (' + perfilPessoa.selos + ' selo(s))');
  conf(perfilPessoa.temBotaoConversa, 'perfil tem atalho para conversa individual');
  await avaliar(cdp, `(() => { document.querySelector('#modal-pessoa').hidden = true; return true; })()`);
  await dormir(200);

  // --- 6a. conversa individual + sininho de notificações -------------------
  const dmAberta = JSON.parse(coerce(await avaliar(cdp, `(() => {
    const btn = document.querySelector('#lista-pessoas .btn-msg-pessoa');
    if (!btn) return JSON.stringify({ temBotao: false });
    btn.click();
    const abas = [...document.querySelectorAll('#abas-conversa .aba-conversa')].map(b => b.textContent.trim());
    return JSON.stringify({
      temBotao: true,
      abas,
      abriu: abas.length > 1,
      placeholder: (document.querySelector('#in-chat') || {}).placeholder || ''
    });
  })()`)));

  conf(dmAberta.temBotao, 'cada pessoa da lista tem botão de conversa individual');
  conf(dmAberta.abriu, 'aba de conversa individual abriu: ' + JSON.stringify(dmAberta.abas));
  conf(/privada/i.test(dmAberta.placeholder || ''), 'campo passa a pedir mensagem privada');

  await avaliar(cdp, `(() => {
    const c = document.querySelector('#in-chat');
    c.value = 'so pra voce, bruno';
    document.querySelector('#form-chat').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return true;
  })()`);
  await dormir(1000);

  const dmChegou = (() => {
    const privados = espectador.recebidos.filter(m => m.tipo === 'privado');
    const entrou = espectador.recebidos.find(m => m.tipo === 'entrou-sala');
    const ana = entrou ? (entrou.participantes || []).find(p => p.nome === 'Ana') : null;
    return {
      total: privados.length,
      texto: privados[0] && privados[0].msg ? privados[0].msg.texto : '',
      de: privados[0] && privados[0].msg ? privados[0].msg.de : '',
      idAna: ana ? ana.id : null
    };
  })();

  conf(dmChegou.total >= 1, 'espectador RECEBEU a conversa individual (' + dmChegou.total + ')');
  conf(dmChegou.texto === 'so pra voce, bruno', 'texto da conversa individual chegou inteiro: "' + dmChegou.texto + '"');
  conf(!!dmChegou.de, 'mensagem privada informa quem enviou');

  // Bruno responde só pra Ana
  espectador.enviar({ tipo: 'privado', para: dmChegou.idAna, texto: 'oi Ana, recebi aqui' });
  await dormir(1000);

  const resposta = JSON.parse(coerce(await avaliar(cdp, `(() => {
    const textos = [...document.querySelectorAll('#lista-chat .texto-msg')].map(e => e.textContent);
    const badge = document.querySelector('#sino-badge');
    const ponto = document.querySelector('#abas-conversa .ponto-nao-lido');
    return JSON.stringify({
      veuResposta: textos.some(t => t.includes('oi Ana, recebi aqui')),
      badge: badge && !badge.hidden ? badge.textContent : '',
      temPonto: !!ponto
    });
  })()`)));

  conf(resposta.veuResposta, 'transmissor viu a resposta da conversa individual');
  conf(resposta.badge !== '', 'sininho avisa mensagem recebida: ' + (resposta.badge || '?'));

  const dmLida = JSON.parse(coerce(await avaliar(cdp, `(() => {
    const voltar = [...document.querySelectorAll('#abas-conversa .aba-conversa')]
      .find(b => b.textContent.trim() === 'Sala');
    const privadasAntes = document.querySelectorAll('#lista-chat .msg').length;
    if (voltar) voltar.click();
    const textos = [...document.querySelectorAll('#lista-chat .texto-msg')].map(e => e.textContent);
    return JSON.stringify({
      voltou: !!voltar,
      salaTemSistema: textos.some(t => /entrou na sala|olá|ola/i.test(t)) || document.querySelectorAll('#lista-chat .msg').length > 0,
      naoVazouPrivada: !textos.some(t => t.includes('so pra voce, bruno')),
      privadasAntes
    });
  })()`)));

  conf(dmLida.voltou, 'dá pra voltar para a aba Sala');
  conf(dmLida.naoVazouPrivada, 'mensagem privada NÃO vaza para o chat da sala');

  // o sininho marca tudo como lido
  const sinoLimpo = JSON.parse(coerce(await avaliar(cdp, `(() => {
    document.querySelector('#btn-sino').click();
    const painelAberto = !document.querySelector('#painel-sino').hidden;
    const tinhaItem = document.querySelectorAll('.sino-item').length > 0;
    document.querySelector('#sino-limpar').click();
    const badge = document.querySelector('#sino-badge');
    document.querySelector('#btn-sino').click();
    return JSON.stringify({ painelAberto, tinhaItem, limpo: badge.hidden });
  })()`)));
  conf(sinoLimpo.painelAberto, 'painel do sininho abre');
  conf(sinoLimpo.tinhaItem, 'sininho tem o histórico de avisos');
  conf(sinoLimpo.limpo, 'sininho limpa ao marcar como lido');

  // --- 6. recado de erro para codigo invalido -----------------------------
  const erroCod = await avaliar(cdp, `(() => {
    document.querySelector('#btn-sair-som').click();
    document.querySelector('#in-nome').value = 'Zeca';
    document.querySelector('#in-codigo').value = 'ZZZZZZ';
    document.querySelector('#btn-entrar').click();
    return true;
  })()`);
  await dormir(1800);

  const erro = JSON.parse(coerce(await avaliar(cdp, `JSON.stringify({
    texto: document.querySelector('#erro-entrada').hidden ? '' : document.querySelector('#erro-entrada').textContent,
    entradaVisivel: !document.querySelector('#tela-entrada').hidden
  })`)));
  conf(erro.entradaVisivel === true, 'voltou para a tela de entrada ao sair');
  conf(/nao encontrada/i.test(erro.texto), 'erro exibido para codigo inexistente: "' + erro.texto + '"');

  // --- 6b. perfil: abrir, trocar avatar e salvar ---------------------------
  await avaliar(cdp, `(() => {
    document.querySelector('#in-nome').value = 'Zeca';
    document.querySelector('#btn-perfil').click();
    return true;
  })()`);
  await dormir(400);

  const perfil = JSON.parse(coerce(await avaliar(cdp, `(() => {
    const modal = document.querySelector('#modal-perfil');
    const aberto = !modal.hidden;
    const emojis = document.querySelectorAll('#grade-emojis button');
    const cores = document.querySelectorAll('#grade-cores button');
    if (emojis.length) emojis[1].click();
    if (cores.length) cores[3].click();
    document.querySelector('#in-perfil-nome').value = 'Zeca';
    document.querySelector('#btn-salvar-perfil').click();
    return JSON.stringify({
      aberto,
      emojis: emojis.length,
      cores: cores.length,
      fechou: modal.hidden,
      salvo: JSON.parse(localStorage.getItem('nexo.perfil') || '{}').nome
    });
  })()`)));

  conf(perfil.aberto, 'modal de perfil abre');
  conf(perfil.emojis >= 16, 'grade de avatares com ' + perfil.emojis + ' opções');
  conf(perfil.cores >= 8, 'grade de cores com ' + perfil.cores + ' opções');
  conf(perfil.fechou, 'modal de perfil fecha ao salvar');
  conf(perfil.salvo === 'Zeca', 'nome do perfil persistido: ' + perfil.salvo);

  // --- 6c. configurações ---------------------------------------------------
  await avaliar(cdp, `(() => { document.querySelector('#btn-config').click(); return true; })()`);

  let cfgAberto = false;
  for (let i = 0; i < 30 && !cfgAberto; i++) {
    cfgAberto = await avaliar(cdp, `!document.querySelector('#modal-config').hidden`);
    if (!cfgAberto) await dormir(150);
  }

  const cfg = JSON.parse(coerce(await avaliar(cdp, `(() => {
    const m = document.querySelector('#modal-config');
    const aberto = !m.hidden;
    const abas = document.querySelectorAll('.aba-modal').length;
    const micro = document.querySelector('#sel-micro');
    const fone = document.querySelector('#sel-fone');

    // Passa por TODA aba e anota se o painel dela apareceu. Isso trava a
    // tela inteira de configurações, não só a primeira aba que abriram.
    const paineis = {};
    ['conta', 'dados', 'voz-video', 'notificacoes', 'aparencia',
     'acessibilidade', 'sistema', 'idioma', 'criador'].forEach(k => {
      const b = document.querySelector('.aba-modal[data-aba="' + k + '"]');
      if (!b) { paineis[k] = 'sem este botão'; return; }
      b.click();
      const p = document.querySelector('#aba-' + k);
      paineis[k] = !!(p && !p.hidden);
    });
    const videoVisivel = paineis['voz-video'] === true;

    document.querySelector('.aba-modal[data-aba="aparencia"]').click();
    const aparenciaVisivel = !document.querySelector('#aba-aparencia').hidden;
    const botoesTema = [...document.querySelectorAll('#grade-temas .tema-btn')];
    const temas = botoesTema.length;

    const antes = document.documentElement.dataset.tema || 'meia-noite';
    // qual estava selecionado antes — é para ele que o teste tem que voltar
    // (não para o Meia-Noite: quem usa pode ter escolhido outro tema)
    const botaoAntes = botoesTema.find(b => b.classList.contains('sel'));
    const nomeAntes = botaoAntes ? botaoAntes.textContent : '';

    // Se o tema guardado já for o Zenitsu, trocar para o Zenitsu não seria
    // troca nenhuma. Sai dele primeiro para a comparação valer de verdade.
    if (antes === 'zenitsu') {
      const sai = botoesTema.find(b => b.textContent.includes('Meia-Noite'));
      if (sai) sai.click();
    }

    const zenitsu = botoesTema.find(b => b.textContent.includes('Zenitsu'));
    if (zenitsu) zenitsu.click();
    const trocou = document.documentElement.dataset.tema === 'zenitsu';

    const volta = (nomeAntes && botoesTema.find(b => b.textContent === nomeAntes))
      || botoesTema.find(b => b.textContent.includes('Meia-Noite'));
    if (volta) volta.click();
    const voltou = document.documentElement.dataset.tema === antes;

    document.querySelector('.aba-modal[data-aba="criador"]').click();
    const criador = !document.querySelector('#aba-criador').hidden;
    const criadorNome = (document.querySelector('#aba-criador h3') || {}).textContent || '';

    document.querySelector('.aba-modal[data-aba="voz-video"]').click();
    m.hidden = true;
    return JSON.stringify({
      aberto, abas, aparenciaVisivel, temas, trocou, voltou,
      criador, criadorNome, paineis,
      micro: micro.options.length,
      fone: fone.options.length,
      videoVisivel,
      fps: document.querySelector('#sel-fps').value
    });
  })()`)));

  conf(cfgAberto && cfg.aberto, 'modal de configurações abre');
  conf(cfg.abas === 9,
    '9 abas de configuração (conta/dados/voz+vídeo/notificações/aparência/acessibilidade/sistema/idioma/criador)');
  const abasQuebradas = Object.entries(cfg.paineis || {}).filter(([, v]) => v !== true);
  conf(abasQuebradas.length === 0,
    'todas as abas abrem o painel dela' +
    (abasQuebradas.length ? ' — falhou: ' + JSON.stringify(abasQuebradas) : ''));
  conf(cfg.criador, 'aba do criador abre');
  conf(!!cfg.criadorNome && cfg.criadorNome.includes('Leal'), 'criador creditado como: ' + cfg.criadorNome);
  conf(cfg.micro >= 1, 'microfone: ' + cfg.micro + ' opção(ões)');
  conf(cfg.fone >= 1, 'fone: ' + cfg.fone + ' opção(ões)');
  conf(cfg.videoVisivel, 'aba de voz e vídeo abre');
  conf(cfg.aparenciaVisivel, 'aba de aparência abre');
  conf(cfg.temas === 11, 'grade com ' + cfg.temas + ' temas (Meia-Noite + 10 de anime)');
  conf(cfg.trocou, 'tema Zenitsu aplicou na hora');
  conf(cfg.voltou, 'tema original restaurado');
  conf(['30', '60', '120', '144'].includes(cfg.fps), 'fps preservado: ' + cfg.fps);

  // --- 6t. botão de rever o tutorial ---------------------------------------
  const tutRefaz = JSON.parse(coerce(await avaliar(cdp, `(() => {
    document.querySelector('#btn-config').click();
    document.querySelector('#btn-tutorial').click();
    const ov = document.querySelector('#tutorial-overlay');
    const abriu = !!(ov && !ov.hidden);
    const titulo = (document.querySelector('#tutorial-titulo') || {}).textContent || '';
    const semVoltar = document.querySelector('#tutorial-voltar').style.visibility === 'hidden';
    const configFechou = document.querySelector('#modal-config').hidden;
    document.querySelector('#tutorial-pular').click();
    return JSON.stringify({ abriu, titulo, semVoltar, configFechou, fechou: ov.hidden });
  })()`)));

  conf(tutRefaz.abriu, 'dá para rever o tutorial pelo botão das configurações');
  conf(tutRefaz.configFechou, 'configurações fecham para não ficar um em cima do outro');
  conf(/Bem-vindo/i.test(tutRefaz.titulo), 'tutorial reinicia do primeiro passo: ' + tutRefaz.titulo);
  conf(tutRefaz.semVoltar, 'no primeiro passo o botão Voltar some');
  conf(tutRefaz.fechou, 'Pular tutorial fecha na hora');

  // --- 7. captura de tela (fontes do desktop) ----------------------------
  const listaFontes = await avaliar(cdp, `window.nexoDesktop.listarFontes().then(f => JSON.stringify(f))`);
  const f = JSON.parse(coerce(listaFontes));
  conf(Array.isArray(f) && f.length > 0, 'desktopCapturer devolveu ' + (Array.isArray(f) ? f.length : 0) + ' fontes');
  conf(Array.isArray(f) && f.every(x => typeof x.miniatura === 'string' && x.miniatura.startsWith('data:image')),
    'miniaturas das fontes em base64 (seletor visual funciona)');

  espectador.close();

  // --- 8. erros de console ------------------------------------------------
  const limpos = errosDeConsole.filter(e => !/favicon/i.test(e));
  conf(limpos.length === 0, 'nenhum erro de console' + (limpos.length ? ':\n      ' + limpos.join('\n      ') : ''));

  console.log('\n---------------------------------------');
  console.log(falhas.length ? `${falhas.length} FALHA(S)` : 'Todos os testes E2E passaram!');
  console.log('---------------------------------------\n');

  cdp.ws.close();
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => {
  console.error('\nERRO NO TESTE E2E:', e.message);
  process.exit(1);
});

function coerce(valor) {
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
}
