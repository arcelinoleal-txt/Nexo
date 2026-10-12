'use strict';

/**
 * Teste E2E de video + voz: captura de tela e WebRTC em malha.
 *
 *  - Transmissor: janela do Electron (porta 9222)
 *  - Espectador : Chrome headless    (porta 9333)
 *
 * Requer os dois rodando antes:
 *    node servidor/servidor.js
 *    npx electron . --remote-debugging-port=9222
 *    chrome --headless=new --remote-debugging-port=9333 \
 *        --use-fake-device-for-media-stream \
 *        --autoplay-policy=no-user-gesture-required http://localhost:3000
 */

const WebSocket = require('ws');
const http = require('http');

const PORTA_TX = 9222;
const PORTA_RX = 9333;
const SERVIDOR = 'ws://localhost:3000';

const falhas = [];
const errosDeConsole = [];

function conf(cond, texto) {
  console.log((cond ? '  OK   ' : '  FALHA ') + texto);
  if (!cond) falhas.push(texto);
}
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function pegarJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function conectar(url) {
  const ws = new WebSocket(url, { perMessageDeflate: false });
  let seq = 0;
  const esperando = new Map();

  ws.on('message', (bruto) => {
    const m = JSON.parse(bruto.toString());
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errosDeConsole.push('EXCECAO: ' + (d.exception?.description || d.text));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errosDeConsole.push('CONSOLE: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/i.test(m.params.entry.text)) {
      errosDeConsole.push('LOG: ' + m.params.entry.text);
    }
    if (m.id && esperando.has(m.id)) {
      const { resolve, reject, method } = esperando.get(m.id);
      esperando.delete(m.id);
      m.error ? reject(new Error(method + ' -> ' + m.error.message)) : resolve(m.result);
    }
  });

  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({
      ws,
      chamar: (method, params = {}) => new Promise((res, rej) => {
        const id = ++seq;
        esperando.set(id, { resolve: res, reject: rej, method });
        ws.send(JSON.stringify({ id, method, params }));
      })
    }));
    ws.on('error', reject);
  });
}

async function avaliar(cdp, expressao) {
  const r = await cdp.chamar('Runtime.evaluate', {
    expression: expressao, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  const v = r.result.value;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/** clica de verdade (gera ativacao de usuario) */
async function clicar(cdp, seletor) {
  const bruto = await avaliar(cdp, `(() => {
    const e = document.querySelector(${JSON.stringify(seletor)});
    if (!e) return 'null';
    const r = e.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 && r.height > 0 });
  })()`);
  if (bruto === 'null') throw new Error('seletor nao encontrado: ' + seletor);
  const r = JSON.parse(bruto);
  if (!r.vis) throw new Error('seletor invisivel: ' + seletor);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await cdp.chamar('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  }
}

async function paginaEm(porta, filtro) {
  for (let i = 0; i < 40; i++) {
    try {
      const alvos = await pegarJson(`http://127.0.0.1:${porta}/json/list`);
      const alvo = alvos.find(filtro);
      if (alvo) return alvo;
    } catch { /* ainda subindo */ }
    await dormir(500);
  }
  return null;
}

(async () => {
  console.log('\n== Teste E2E de video + voz (captura + WebRTC em malha) ==\n');

  const alvoTx = await paginaEm(PORTA_TX, a => a.type === 'page' && a.url.startsWith('file:'));
  if (!alvoTx) { console.log('  FALHA Electron (porta 9222) nao respondeu'); process.exit(1); }

  const alvoRx = await paginaEm(PORTA_RX, a => a.type === 'page' && a.url.includes('localhost:3000'));
  if (!alvoRx) { console.log('  FALHA Chrome espectador (porta 9333) nao respondeu'); process.exit(1); }

  const tx = await conectar(alvoTx.webSocketDebuggerUrl);
  const rx = await conectar(alvoRx.webSocketDebuggerUrl);
  await tx.chamar('Runtime.enable');
  await tx.chamar('Log.enable');
  await rx.chamar('Runtime.enable');
  await rx.chamar('Log.enable');
  await dormir(1000);

  console.log('  transmissor : ' + alvoTx.title + ' (' + alvoTx.url.slice(0, 42) + '...)');
  console.log('  espectador  : ' + alvoRx.title + ' (' + alvoRx.url.slice(0, 42) + '...)');

  /* ---------------- transmissor: criar sala ---------------- */
  await avaliar(tx, `(() => {
    if (!document.querySelector('#tela-sala').hidden) document.querySelector('#btn-sair-som').click();
    return true;
  })()`);
  await dormir(900);
  await avaliar(tx, `(() => {
    document.querySelector('#in-nome').value = 'Ana';
    document.querySelector('#in-servidor').value = ${JSON.stringify(SERVIDOR)};
    document.querySelector('#btn-criar').click();
    return true;
  })()`);
  await dormir(1600);

  const codigo = await avaliar(tx, `document.querySelector('#codigo-sala').textContent`);
  conf(/^[A-Z0-9]{6}$/.test(codigo), 'transmissor criou a sala: ' + codigo);

  const noTxInicio = JSON.parse(await avaliar(tx, `JSON.stringify({
    pcs: estado.pcs.size,
    micro: !!estado.streamMicro,
    tiles: document.querySelectorAll('#grade-videos .tile').length
  })`));
  conf(noTxInicio.micro === true, 'microfone local ligado ao entrar (voz pronta para a malha)');
  conf(noTxInicio.pcs === 0, 'ninguem conectado ainda: ' + noTxInicio.pcs + ' pares');

  /* ---------------- abrir o seletor de telas ---------------- */
  await clicar(tx, '#btn-tela');
  await dormir(2500);

  const seletor = JSON.parse(await avaliar(tx, `JSON.stringify({
    aberto: !document.querySelector('#overlay-fontes').hidden,
    itens: document.querySelectorAll('#grade-fontes .item-fonte').length,
    miniaturas: Array.from(document.querySelectorAll('#grade-fontes img'))
      .filter(i => (i.src || '').startsWith('data:image')).length
  })`));
  conf(seletor.aberto, 'seletor de tela/janela abriu');
  conf(seletor.itens > 0, 'seletor oferece ' + seletor.itens + ' fontes');
  conf(seletor.miniaturas === seletor.itens && seletor.itens > 0, 'miniaturas renderizadas no seletor');

  if (!seletor.itens) { console.log('\n  Sem fontes. Abortando.\n'); process.exit(1); }

  /* ---------------- capturar ---------------- */
  await clicar(tx, '#grade-fontes .item-fonte');
  await dormir(4500);

  const captura = JSON.parse(await avaliar(tx, `(() => {
    const t = estado.streamTela ? estado.streamTela.getVideoTracks()[0] : null;
    const cfg = t && t.getSettings ? t.getSettings() : {};
    return JSON.stringify({
      temStream: !!estado.streamTela,
      traca: t ? t.readyState : 'nenhuma',
      aoVivo: !document.querySelector('#faixa-aovivo').hidden,
      transmitindo: document.querySelector('#ctrl-tela').classList.contains('transmitindo'),
      rotulo: document.querySelector('#rotulo-ctrl-tela').textContent,
      overlayFechado: document.querySelector('#overlay-fontes').hidden,
      tiles: document.querySelectorAll('#grade-videos .tile').length,
      largura: cfg.width || 0
    });
  })()`));
  conf(captura.temStream, 'getDisplayMedia devolveu o stream de tela');
  conf(captura.traca === 'live', 'trilha de video capturada: ' + captura.traca);
  conf(captura.largura > 0, 'frames capturados ao vivo (largura ' + captura.largura + 'px)');
  conf(captura.aoVivo, 'indicador AO VIVO ligado');
  conf(captura.transmitindo && captura.rotulo === 'Parar',
    'botao flutuante virou "Parar de transmitir"');
  conf(captura.overlayFechado, 'seletor fechou depois da escolha');
  conf(captura.tiles >= 1, 'previa local aparece no palco (' + captura.tiles + ' tile(s))');

  /* ---------------- espectador entra ---------------- */
  await avaliar(rx, `(() => {
    if (!document.querySelector('#tela-sala').hidden) document.querySelector('#btn-sair-som').click();
    return true;
  })()`);
  await dormir(900);
  await avaliar(rx, `(() => {
    document.querySelector('#in-nome').value = 'Bruno';
    document.querySelector('#in-servidor').value = ${JSON.stringify(SERVIDOR)};
    document.querySelector('#in-codigo').value = ${JSON.stringify(codigo)};
    document.querySelector('#btn-entrar').click();
    return true;
  })()`);

  let estado = null;
  for (let i = 0; i < 40; i++) {
    await dormir(700);
    estado = JSON.parse(await avaliar(rx, `(() => {
      const vids = Array.from(document.querySelectorAll('#grade-videos video'));
      return JSON.stringify({
        tiles: document.querySelectorAll('#grade-videos .tile').length,
        videos: vids.length,
        largura: vids.length ? vids[0].videoWidth : 0,
        altura: vids.length ? vids[0].videoHeight : 0,
        pcs: estado.pcs.size,
        conectados: [...estado.pcs.values()].filter(p => p.connectionState === 'connected').length
      });
    })()`));
    if (estado.tiles > 0 && estado.largura > 0) break;
    if (i % 5 === 0) console.log('    ... espectador aguardando: ' + JSON.stringify(estado));
  }

  const rxFim = JSON.parse(await avaliar(rx, `(() => {
    const vids = Array.from(document.querySelectorAll('#grade-videos video'));
    return JSON.stringify({
      sala: !document.querySelector('#tela-sala').hidden,
      codigo: document.querySelector('#codigo-sala').textContent,
      tiles: document.querySelectorAll('#grade-videos .tile').length,
      largura: vids.length ? vids[0].videoWidth : 0,
      altura: vids.length ? vids[0].videoHeight : 0,
      estado: document.querySelector('#info-conexao').textContent,
      titulo: document.querySelector('#titulo-transmissao').textContent,
      rotulo: document.querySelector('#grade-videos .rotulo-tile')?.textContent.trim() || '',
      participantes: document.querySelectorAll('#lista-pessoas li').length,
      placeholder: !document.querySelector('#placeholder').hidden
    });
  })()`));

  console.log('    espectador final: ' + JSON.stringify(rxFim));

  conf(rxFim.sala, 'espectador entrou na sala');
  conf(rxFim.codigo === codigo, 'espectador no mesmo codigo da sala');
  conf(rxFim.participantes === 2, 'espectador ve 2 participantes');
  conf(rxFim.tiles > 0, 'espectador montou ' + rxFim.tiles + ' tile(s) de video');
  conf(rxFim.largura > 0 && rxFim.altura > 0,
    'VIDEO FLUINDO no espectador: ' + rxFim.largura + 'x' + rxFim.altura);
  conf(rxFim.placeholder === false, 'placeholder some quando chega video');
  conf(/conectad/i.test(rxFim.estado), 'conexao WebRTC em: ' + rxFim.estado);
  conf(/Ana/.test(rxFim.titulo), 'titulo diz de quem e a tela: "' + rxFim.titulo + '"');
  conf(/Ana/.test(rxFim.rotulo), 'legenda do tile aponta o dono: "' + rxFim.rotulo + '"');

  /* ---------------- voz na malha ---------------- */
  const voz = JSON.parse(await avaliar(rx, `(() => {
    const remotos = [...estado.streams.values()];
    return JSON.stringify({
      microLocal: !!estado.streamMicro,
      microLocalAtivo: !!(estado.streamMicro && estado.streamMicro.getAudioTracks()[0]),
      audioRemoto: remotos.flatMap(s => s.getAudioTracks()).length,
      videoRemoto: remotos.flatMap(s => s.getVideoTracks()).length
    });
  })()`));

  const vozTx = JSON.parse(await avaliar(tx, `(() => {
    const remotos = [...estado.streams.values()];
    return JSON.stringify({
      microLocal: !!estado.streamMicro,
      pares: estado.pcs.size,
      conectados: [...estado.pcs.values()].filter(p => p.connectionState === 'connected').length,
      audioRemoto: remotos.flatMap(s => s.getAudioTracks()).length
    });
  })()`));

  console.log('    voz (espectador): ' + JSON.stringify(voz));
  console.log('    voz (transmissor): ' + JSON.stringify(vozTx));

  conf(vozTx.pares === 1, 'transmissor tem 1 par WebRTC aberto');
  conf(vozTx.conectados === 1, 'par WebRTC conectado de ponta a ponta');
  conf(voz.videoRemoto > 0, 'espectador recebeu ' + voz.videoRemoto + ' trilha(s) de video remota');

  if (voz.microLocal) {
    conf(voz.audioRemoto > 0, 'espectador RECEBEU o audio do transmissor (' + voz.audioRemoto + ' trilha(s))');
  } else {
    console.log('    AVISO sem microfone local no transmissor (audio nao verificado)');
  }

  if (voz.microLocalAtivo) {
    conf(vozTx.audioRemoto > 0, 'transmissor RECEBEU o audio do espectador (' + vozTx.audioRemoto + ' trilha(s))');
  } else {
    console.log('    AVISO sem microfone local no espectador (audio nao verificado)');
  }

  // sempre valida que a linha de audio foi negociada nos dois lados
  const trilhasAudio = JSON.parse(await avaliar(rx, `(() => {
    const txs = [...estado.pcs.values()].flatMap(p => p.getTransceivers());
    return JSON.stringify({
      audio: txs.filter(t => t.receiver.track && t.receiver.track.kind === 'audio').length,
      video: txs.filter(t => t.receiver.track && t.receiver.track.kind === 'video').length,
      mapa: txs.map(t => (t.receiver.track ? t.receiver.track.kind : 'sem-track') +
        ':' + t.direction + ':' + (t.currentDirection || 'none'))
    });
  })()`));
  console.log('    transceivers do espectador: ' + JSON.stringify(trilhasAudio.mapa));
  conf(trilhasAudio.audio >= 1, 'linha de audio (malha de voz) negociada no espectador (' + trilhasAudio.audio + ')');
  conf(trilhasAudio.video >= 1, 'linha de video negociada no espectador (' + trilhasAudio.video + ')');
  conf(trilhasAudio.audio === 1, 'apenas UMA linha de audio por par (sem duplicata)');

  const mapaTx = JSON.parse(await avaliar(tx, `(() => {
    const txs = [...estado.pcs.values()].flatMap(p => p.getTransceivers());
    return JSON.stringify(txs.map(t => (t.receiver.track ? t.receiver.track.kind : 'sem-track') +
      ':' + t.direction + ':' + (t.currentDirection || 'none')));
  })()`));
  console.log('    transceivers do transmissor: ' + JSON.stringify(mapaTx));
  conf(mapaTx.filter(t => t.startsWith('audio')).length === 1,
    'apenas UMA linha de audio no transmissor (' + mapaTx.filter(t => t.startsWith('audio')).length + ')');
  conf(mapaTx.filter(t => t.startsWith('audio')).some(t => /sendrecv:sendrecv|recvonly:recvonly/.test(t)),
    'linha de audio do transmissor aceita receber');

  /* ---------------- mute ---------------- */
  await clicar(tx, '#ctrl-micro');
  await dormir(600);
  const mudo = JSON.parse(await avaliar(tx, `JSON.stringify({
    microLigado: estado.microLigado,
    trilha: estado.streamMicro ? estado.streamMicro.getAudioTracks()[0].enabled : null,
    botaoDesligado: document.querySelector('#ctrl-micro').classList.contains('desligado'),
    selo: !!document.querySelector('#lista-pessoas .selo.mudo')
  })`));
  conf(mudo.botaoDesligado === true, 'botao flutuante mostra estado desligado');
  conf(mudo.selo === true, 'selo "mudo" aparece na lista de participantes');
  if (mudo.trilha !== null) {
    conf(mudo.microLigado === false && mudo.trilha === false, 'mudo desliga a trilha de verdade');
  }
  await clicar(tx, '#ctrl-micro');
  await dormir(400);

  /* ---------------- transmissor enxerga o espectador ---------------- */
  let qualidade = '';
  for (let i = 0; i < 10 && !/\d+[x×]\d+/.test(qualidade); i++) {
    await dormir(700);
    qualidade = await avaliar(tx, `document.querySelector('#info-qualidade').textContent`);
  }

  const txFim = JSON.parse(await avaliar(tx, `(() => JSON.stringify({
    participantes: document.querySelectorAll('#lista-pessoas li').length,
    qualidade: document.querySelector('#info-qualidade').textContent,
    aoVivo: !document.querySelector('#faixa-aovivo').hidden,
    titulo: document.querySelector('#titulo-transmissao').textContent,
    semAvisoLimite: document.querySelector('#aviso-limite').hidden
  }))()`));
  conf(txFim.participantes === 2, 'transmissor ve 2 participantes');
  conf(/\d+[x×]\d+/.test(txFim.qualidade), 'indicador de qualidade: "' + txFim.qualidade + '"');
  conf(txFim.aoVivo, 'transmissor segue ao vivo');
  conf(txFim.titulo === 'Você está transmitindo sua tela', 'titulo do transmissor: "' + txFim.titulo + '"');
  conf(txFim.semAvisoLimite, 'sem aviso de limite com 2 pessoas');

  /* ---------------- chat bidirecional ---------------- */
  await avaliar(rx, `(() => {
    const c = document.querySelector('#in-chat');
    c.value = 'consigo ver sua tela!';
    document.querySelector('#form-chat').dispatchEvent(new Event('submit', { cancelable: true }));
    return true;
  })()`);
  await dormir(900);

  const noTx = await avaliar(tx, `(() => {
    const m = Array.from(document.querySelectorAll('#lista-chat .msg:not(.sistema) .texto-msg'));
    return m.length ? m[m.length - 1].textContent : '';
  })()`);
  conf(noTx === 'consigo ver sua tela!', 'chat do espectador chegou no transmissor: "' + noTx + '"');

  /* ---------------- encerrar ---------------- */
  await clicar(tx, '#ctrl-tela');
  await dormir(2500);

  const fim = JSON.parse(await avaliar(rx, `JSON.stringify({
    semVideo: !document.querySelector('#placeholder').hidden,
    semAovivo: document.querySelector('#faixa-aovivo').hidden,
    tiles: document.querySelectorAll('#grade-videos .tile').length,
    texto: document.querySelector('#placeholder-texto').textContent,
    streamTela: !!estado.streamTela
  })`));
  conf(fim.semVideo, 'espectador foi avisado do fim da transmissao (placeholder volta)');
  conf(fim.semAovivo, 'faixa AO VIVO apagou');
  conf(fim.tiles === 0 && fim.streamTela === false, 'stream de tela limpo nos dois lados');
  console.log('    texto exibido: "' + fim.texto + '"');

  const limpos = errosDeConsole.filter(e => !/favicon/i.test(e));
  conf(limpos.length === 0, 'nenhum erro de console' + (limpos.length ? ':\n      ' + limpos.join('\n      ') : ''));

  console.log('\n---------------------------------------');
  console.log(falhas.length ? `${falhas.length} FALHA(S)` : 'Video + voz funcionando de ponta a ponta!');
  console.log('---------------------------------------\n');

  tx.ws.close();
  rx.ws.close();
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => {
  console.error('\nERRO NO TESTE DE VIDEO:', e.message);
  process.exit(1);
});
