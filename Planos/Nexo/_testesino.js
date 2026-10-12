// testa o fluxo do aviso de atualizacao no sininho
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 800, show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  await win.loadFile(path.resolve(__dirname, 'app', 'index.html'));
  await new Promise(r => setTimeout(r, 1500));

  // mock do fetch: 1a chamada = versao atual, 2a = versao nova
  await win.webContents.executeJavaScript(`(function(){
    localStorage.setItem('nexo.tutorialVisto','1');
    var ov = document.getElementById('tutorial-overlay'); if (ov) ov.remove();
    var chamadas = 0;
    window.fetch = function(url) {
      if (String(url).indexOf('/api/versao') >= 0) {
        chamadas++;
        var corpo = chamadas === 1
          ? { versao: '1.6.0', atualizadoEm: '2026-10-09', novidades: ['Versao base'], download: null }
          : { versao: '1.8.0', atualizadoEm: '2026-10-11', novidades: ['NOVO: botao de baixar no aviso', 'Correcao de audio'], download: 'https://exemplo.com/Nexo-Setup-1.8.0.exe' };
        return Promise.resolve({ ok: true, json: function(){ return Promise.resolve(corpo); } });
      }
      return Promise.reject(new Error('offline'));
    };
    window.__chamadas = function(){ return chamadas; };
  })()`);

  // primeiro ciclo: "ve" a 1.6.0
  await win.webContents.executeJavaScript(`Notificacoes.verificarAtualizacao()`);
  await new Promise(r => setTimeout(r, 700));
  const apos1 = await win.webContents.executeJavaScript(`JSON.stringify({
    badge: document.getElementById('sino-badge').hidden,
    badgeTexto: document.getElementById('sino-badge').textContent
  })`);
  console.log('APOS 1o CICLO (versao atual):', apos1);

  // segundo ciclo: servidor agora tem 1.8.0 -> deve avisar
  await win.webContents.executeJavaScript(`Notificacoes.verificarAtualizacao()`);
  await new Promise(r => setTimeout(r, 700));
  const apos2 = await win.webContents.executeJavaScript(`(function(){
    // mostra a sala para o painel do sininho ficar visivel
    document.getElementById('tela-entrada').hidden = true;
    document.getElementById('tela-sala').hidden = false;
    document.getElementById('tutorial-overlay') && document.getElementById('tutorial-overlay').remove();
    document.getElementById('btn-sino').click();
    var painel = document.getElementById('painel-sino');
    return JSON.stringify({
      badgeVisivel: !document.getElementById('sino-badge').hidden,
      badgeTexto: document.getElementById('sino-badge').textContent,
      painelAberto: !painel.hidden,
      botoes: Array.from(painel.querySelectorAll('button')).map(function(b){return b.textContent.trim();})
    });
  })()`);
  console.log('APOS 2o CICLO (versao nova):', apos2);

  // espera o repinte antes de fotografar
  await new Promise(r => setTimeout(r, 1500));

  const img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.resolve(__dirname, '_sino.png'), img.toPNG());
  console.log('SALVO _sino.png');
  app.exit(0);
});
