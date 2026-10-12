'use strict';
/* Diagnóstico rápido por CDP. Uso: node ferramentas/_diag.js [porta]
   Padrão 9222 (Electron). Mostra o estado que os testes enxergam. */
const WebSocket = require('ws');
const http = require('http');

const PORTA = Number(process.argv[2] || 9222);

const expressao = [
  'JSON.stringify({',
  '  url: location.href,',
  '  titulo: document.title,',
  '  telaEntrada: !document.querySelector("#tela-entrada").hidden,',
  '  telaSala: !document.querySelector("#tela-sala").hidden,',
  '  tutorialExiste: !!document.querySelector("#tutorial-overlay"),',
  '  tutorialAberto: !!(document.querySelector("#tutorial-overlay") && !document.querySelector("#tutorial-overlay").hidden),',
  '  visto: localStorage.getItem("nexo.tutorialVisto"),',
  '  overlayFontes: !document.querySelector("#overlay-fontes").hidden,',
  '  itensFontes: document.querySelectorAll("#grade-fontes .item-fonte").length,',
  '  temStreamTela: !!(estado && estado.streamTela),',
  '  transmitindo: document.querySelector("#ctrl-tela") ? document.querySelector("#ctrl-tela").classList.contains("transmitindo") : null,',
  '  pessoas: document.querySelectorAll("#lista-pessoas li").length,',
  '  sino: !!document.querySelector("#btn-sino"),',
  '  abasConversa: document.querySelectorAll("#abas-conversa .aba-conversa").length,',
  '  gradeTemas: document.querySelectorAll("#grade-temas .tema-btn").length,',
  '  erroInicializar: window.__erroInicializar || null,',
  '  tema: document.documentElement.dataset.tema,',
  '  tela: { larg: screen.width, alt: screen.height, dpr: window.devicePixelRatio,',
  '          fisicaX: Math.round(screen.width * (window.devicePixelRatio || 1)),',
  '          fisicaY: Math.round(screen.height * (window.devicePixelRatio || 1)) },',
  '  resolucaoEscolhida: estado.resolucao,',
  '  microNoFone: estado.monitorMicro',
  '})'
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
        console.log('ERRO: ' + JSON.stringify(o.result.exceptionDetails));
      } else {
        console.log(o.result.result.value);
      }
      ws.close();
      process.exit(0);
    });
  });
}).on('error', (e) => { console.log('erro: ' + e.message); process.exit(1); });
