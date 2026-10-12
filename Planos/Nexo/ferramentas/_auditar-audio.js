'use strict';
/* Audita todo elemento de mídia da página: o que está tocando, se está
   mudo, e se alguma trilha é o microfone LOCAL (que nunca deveria tocar).
   Uso: node ferramentas/_auditar-audio.js [porta] */
const WebSocket = require('ws');
const http = require('http');

const PORTA = Number(process.argv[2] || 9222);

const expressao = [
  '(() => {',
  '  const local = estado.streamMicro ? estado.streamMicro.getAudioTracks().map(t => t.id) : [];',
  '  const localTela = estado.streamTela ? estado.streamTela.getAudioTracks().map(t => t.id) : [];',
  '  const itens = [...document.querySelectorAll("video, audio")].map((el, i) => {',
  '    const s = el.srcObject;',
  '    const trilhas = s ? s.getTracks().map(t => t.kind + ":" + t.readyState + (t.enabled ? "" : "(mudo)")) : [];',
  '    const ehMinhaVoz = s ? s.getAudioTracks().some(t => local.includes(t.id)) : false;',
  '    const ehAudioSistemaLocal = s ? s.getAudioTracks().some(t => localTela.includes(t.id)) : false;',
  '    return {',
  '      i,',
  '      tag: el.tagName,',
  '      classe: el.className || "",',
  '      id: el.id || "",',
  '      muted: el.muted,',
  '      volume: el.volume,',
  '      tocando: !!(el.srcObject && !el.paused && !el.ended),',
  '      trilhas,',
  '      contemMinhaVoz: ehMinhaVoz,',
  '      contemAudioDoSistemaLocal: ehAudioSistemaLocal',
  '    };',
  '  });',
  '  return JSON.stringify({',
  '    microLigado: estado.microLigado,',
  '    monitorMicro: estado.monitorMicro,',
  '    audioSistema: estado.audioSistema,',
  '    temElementoMonitor: !!document.querySelector("audio"),',
  '    participantes: estado.participantes.map(p => ({ nome: p.nome, id: p.id, micro: p.micro, mudo: p.mudo })),',
  '    trilhasLocais: { voz: local.length, sistema: localTela.length },',
  '    tocandoMinhaVoz: itens.filter(x => x.contemMinhaVoz).length,',
  '    tocandoAudioSistemaLocal: itens.filter(x => x.contemAudioDoSistemaLocal).length,',
  '    itens,',
  '    erro: null',
  '  });',
  '})()'
].join('\n');

http.get('http://127.0.0.1:' + PORTA + '/json/list', (r) => {
  let d = '';
  r.on('data', (c) => { d += c; });
  r.on('end', () => {
    const t = JSON.parse(d).find((a) => a.type === 'page');
    if (!t) { console.log('sem página na porta ' + PORTA); process.exit(0); }

    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: expressao, returnByValue: true }
      }));
    });
    ws.on('message', (m) => {
      const o = JSON.parse(m.toString());
      if (o.id !== 1) return;
      if (o.result && o.result.exceptionDetails) {
        console.log('ERRO: ' + JSON.stringify(o.result.exceptionDetails, null, 2));
      } else {
        const v = JSON.parse(o.result.result.value);
        console.log('microfone local ligado : ' + v.microLigado);
        console.log('ouvir a si mesmo       : ' + v.monitorMicro);
        console.log('áudio do sistema       : ' + v.audioSistema);
        console.log('participantes          : ' + JSON.stringify(v.participantes));
        console.log('---');
        console.log('elementos tocando MINHA VOZ : ' + v.tocandoMinhaVoz);
        console.log('elementos tocando ÁUDIO DO SISTEMA local : ' + v.tocandoAudioSistemaLocal);
        console.log('---');
        for (const it of v.itens) {
          console.log(
            '#' + it.i + ' <' + it.tag + '> #' + it.id + ' .' + it.classe +
            ' | mudo=' + it.muted + ' vol=' + it.volume + ' tocando=' + it.tocando +
            ' | trilhas=[' + it.trilhas.join(', ') + ']' +
            (it.contemMinhaVoz ? '  <<< É O SEU MICROFONE' : '') +
            (it.contemAudioDoSistemaLocal ? '  <<< É O ÁUDIO DO SISTEMA' : '')
          );
        }
        ws.close();
        process.exit(0);
      }
    });
  });
}).on('error', (e) => { console.log('erro: ' + e.message); process.exit(1); });
