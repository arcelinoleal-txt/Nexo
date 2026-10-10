'use strict';

const { app, BrowserWindow, ipcMain, desktopCapturer, session, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// NEXO_USERDATA dá ao exemplar de teste a sua própria pasta de dados.
// Sem isso ele brigaria pela trava de instância única com a cópia que já
// está aberta — e fecharia em silêncio, sem nunca chegar ao servidor.
// Vem antes do primeiro registro, para o log já cair no lugar certo.
if (process.env.NEXO_USERDATA) {
  try {
    app.setPath('userData', process.env.NEXO_USERDATA);
  } catch (erro) {
    try { fs.appendFileSync(process.env.NEXO_LOG || path.join(app.getPath('userData'), 'nexo.log'), 'nao troquei a pasta de dados: ' + erro.message + '\n'); } catch { /* sem log */ }
  }
}

// primeiro registro possível: se o processo morrer cedo, ainda fica a pista.
registrar('[boot] main.js carregado');

// o video remoto tem audio e precisa tocar sem exigir outro clique do usuario
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// garante navigator.mediaDevices em origin file://
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'file://');

// modo de teste: janela pequena, fora do caminho e sem som nenhum,
// para poder validar sem atrapalhar quem esta usando o computador.
const MODO_TESTE = process.env.NEXO_TESTE === '1';
if (process.env.NEXO_MUDO === '1') app.commandLine.appendSwitch('mute-audio');

let janela = null;
let bandeja = null;
let fonteEscolhida = null; // id da janela/tela que o usuario escolheu
let capturarAudio = true;  // audio do sistema (loopback) - Windows
let rodandoEmFundo = false; // foi para a bandeja em vez de fechar
// O usuario escolhe em Configuracoes > Sistema. true = fechar esconde e deixa
// rodando na bandeja; false = fechar encerra o app de verdade.
let fecharParaBandeja = true;

function lerNumero(valor, padrao) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : padrao;
}

function criarJanela() {
  const largura = lerNumero(process.env.NEXO_LARGURA, MODO_TESTE ? 1120 : 1400);
  const altura = lerNumero(process.env.NEXO_ALTURA, MODO_TESTE ? 740 : 880);

  janela = new BrowserWindow({
    width: largura,
    height: altura,
    minWidth: 960,
    minHeight: 620,
    // posiciona num canto para nao cobrir o que a pessoa estiver assistindo
    ...(process.env.NEXO_X ? { x: Number(process.env.NEXO_X) } : {}),
    ...(process.env.NEXO_Y ? { y: Number(process.env.NEXO_Y) } : {}),
    backgroundColor: '#12131a',
    title: 'Nexo',
    frame: false, // barra de titulo propria, estilo Discord
    show: false,
    icon: icone(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  janela.loadFile(path.join(__dirname, 'index.html'));
  janela.once('ready-to-show', () => janela.show());

  janela.on('maximize', () => janela.webContents.send('janela:maximizada', true));
  janela.on('unmaximize', () => janela.webContents.send('janela:maximizada', false));

  // Fechar a janela nao encerra: o app segue em segundo plano, pronto
  // para voltar pelo icone da bandeja. Quem quiser sair de verdade,
  // sai pelo menu da bandeja (ou pelo botao "Sair").
  // Quem desligar a opcao em Configuracoes > Sistema, ai sim encerra.
  janela.on('close', (e) => {
    if (rodandoEmFundo) return;
    if (!fecharParaBandeja) return;
    e.preventDefault();
    janela.hide();
    janela.webContents.send('app:em-fundo', true);
  });
}

function icone() {
  try {
    const p = path.join(__dirname, 'icone.png');
    if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  } catch { /* sem icone: segue sem */ }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Bandeja (segundo plano)                                             */
/* ------------------------------------------------------------------ */

function criarBandeja() {
  const img = icone();
  if (!img || img.isEmpty()) return;
  try {
    bandeja = new Tray(img);
    bandeja.setToolTip('Nexo - rodando em segundo plano');
    bandeja.setContextMenu(Menu.buildFromTemplate([
      { label: 'Abrir o Nexo', click: mostrarJanela },
      { type: 'separator' },
      { label: 'Sair do Nexo', click: () => { rodandoEmFundo = true; app.quit(); } }
    ]));
    bandeja.on('click', mostrarJanela);
    bandeja.on('double-click', mostrarJanela);
  } catch (erro) {
    console.warn('[nexo] bandeja indisponivel:', erro.message);
  }
}

function mostrarJanela() {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.show();
  janela.focus();
  janela.webContents.send('app:em-fundo', false);
}

/* ------------------------------------------------------------------ */
/* Captura de tela                                                     */
/* ------------------------------------------------------------------ */

function montarHandlerCaptura() {
  session.defaultSession.setDisplayMediaRequestHandler(async (_requisicao, callback) => {
    try {
      const fontes = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      const alvo = fontes.find(f => f.id === fonteEscolhida) || fontes.find(f => f.id.startsWith('screen:')) || fontes[0];
      if (!alvo) { callback({}); return; }

      const opcoes = { video: alvo };
      // 'loopback' = capturar o audio do sistema. Suportado apenas no Windows.
      if (capturarAudio && process.platform === 'win32') opcoes.audio = 'loopback';
      callback(opcoes);
    } catch (erro) {
      console.error('[nexo] falha na captura:', erro);
      callback({});
    }
  });
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle('fontes:listar', async () => {
  const fontes = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: false
  });

  return fontes.map(f => ({
    id: f.id,
    nome: f.name || (f.id.startsWith('screen') ? 'Tela' : 'Janela'),
    tipo: f.id.startsWith('screen') ? 'tela' : 'janela',
    miniatura: f.thumbnail ? f.thumbnail.toDataURL() : null
  }));
});

ipcMain.handle('fontes:escolher', (_evento, id) => {
  fonteEscolhida = typeof id === 'string' ? id : null;
  return true;
});

ipcMain.handle('captura:configurar', (_evento, cfg) => {
  capturarAudio = !!(cfg && cfg.audio);
  return true;
});

ipcMain.handle('janela:controle', (_evento, acao) => {
  if (!janela) return false;
  switch (acao) {
    case 'minimizar': janela.minimize(); break;
    case 'maximizar':
      janela.isMaximized() ? janela.unmaximize() : janela.maximize();
      break;
    // fecha a janela mas mantem o app vivo (chamada continua no fundo)
    case 'fechar':
      if (bandeja) { rodandoEmFundo = false; janela.hide(); janela.webContents.send('app:em-fundo', true); }
      else janela.close();
      break;
    // fecha de verdade, encerrando o app
    case 'sair':
      rodandoEmFundo = true;
      app.quit();
      break;
    default: return false;
  }
  return true;
});

ipcMain.handle('janela:maximizada', () => (janela ? janela.isMaximized() : false));
ipcMain.handle('app:mostrar', () => { mostrarJanela(); return true; });

ipcMain.handle('app:info', () => ({
  versao: app.getVersion(),
  plataforma: process.platform,
  electron: process.versions.electron,
  emFundo: rodandoEmFundo,
  bandeja: !!bandeja
}));

// Preferências que o renderer decide e o processo principal precisa saber
// (a única hoje é se fechar esconde ou encerra).
ipcMain.handle('app:preferencia', (_evento, chave, valor) => {
  if (chave === 'fecharParaBandeja') fecharParaBandeja = !!valor;
  return { fecharParaBandeja };
});

// links externos abrem no navegador do sistema
app.on('web-contents-created', (_evento, conteudo) => {
  conteudo.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
});

/* ------------------------------------------------------------------ */
/* Log em arquivo                                                      */
/* ------------------------------------------------------------------ */
/* O console de um .exe de interface gráfica do Windows não vai para
   lugar nenhum. Guardamos o que importa num arquivo — o mesmo caminho
   fica visível na pasta de quem instalar, para conseguir ajeitar o
   computador de outra pessoa sem precisar adivinhar o que falhou. */
function arquivoLog() {
  if (process.env.NEXO_LOG) return process.env.NEXO_LOG;
  try { return path.join(app.getPath('userData'), 'nexo.log'); } catch { return null; }
}

function registrar(...args) {
  try {
    const alvo = arquivoLog();
    if (!alvo) return;
    const texto = args
      .map(a => (a instanceof Error ? (a.stack || a.message) : typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ');
    const hora = new Date().toISOString().replace('T', ' ').slice(0, 19);
    fs.appendFileSync(alvo, hora + '  ' + texto + '\n');
  } catch { /* sem log, seguimos */ }
}

/* ------------------------------------------------------------------ */
/* Servidor embutido                                                   */
/* ------------------------------------------------------------------ */
/* O Nexo vem com o próprio servidor dentro. Assim quem instala já
   consegue abrir sala sem configurar nada — e quem quiser entrar na
   sala de outra pessoa aponta o endereço dela em
   Configurações > Geral > Servidor.

   Sobe só se ainda não houver servidor na porta (evita briga com a
   instância que já está rodando na sua máquina em desenvolvimento). */

const PORTA_LOCAL = Number(process.env.NEXO_PORTA || 3000);

function jaTemServidorNaPorta() {
  return new Promise((resolve) => {
    let resolvido = false;
    const ok = (tem) => { if (!resolvido) { resolvido = true; resolve(tem); } };
    const req = http.get('http://127.0.0.1:' + PORTA_LOCAL + '/api/versao', (res) => {
      res.resume();
      ok(true);
    });
    req.on('error', () => ok(false));
    req.setTimeout(1200, () => { req.destroy(); ok(false); });
  });
}

async function subirServidorEmbutido() {
  registrar('[servidor] iniciando. porta pretendida=' + PORTA_LOCAL
    + ' | empacotado=' + __dirname.includes('app.asar')
    + ' | __dirname=' + __dirname);

  const tem = await jaTemServidorNaPorta();
  registrar('[servidor] ja ha alguem na porta ' + PORTA_LOCAL + '? ' + tem);
  if (tem) {
    console.info('[nexo] usando o servidor que ja esta rodando na porta ' + PORTA_LOCAL);
    registrar('[servidor] usando servidor externo; nao subo outro.');
    return true;
  }

  // No app instalado gravamos fora do .asar, que é somente leitura.
  const empacotado = __dirname.includes('app.asar');
  if (empacotado) {
    const dados = app.getPath('userData');
    if (!process.env.NEXO_DIR_DADOS) process.env.NEXO_DIR_DADOS = dados;
    if (!process.env.NEXO_DADOS_CONTAS) {
      process.env.NEXO_DADOS_CONTAS = path.join(dados, 'dados-contas.json');
    }
    registrar('[servidor] pasta de dados gravavel: ' + process.env.NEXO_DIR_DADOS);
  }

  const candidatos = [
    path.join(__dirname, '..', 'servidor', 'servidor.js'),
    path.join(process.resourcesPath || '', 'servidor', 'servidor.js')
  ];
  registrar('[servidor] candidatos: ' + candidatos.join('  ||  '));

  const alvo = candidatos.find(c => { try { return fs.existsSync(c); } catch { return false; } });
  registrar('[servidor] encontrado=' + (alvo || 'NENHUM'));

  if (!alvo) {
    console.warn('[nexo] servidor embutido nao encontrado (procurei em: ' + candidatos.join(' | ') + ')');
    return false;
  }

  try {
    require(alvo);
    console.info('[nexo] servidor embutido rodando na porta ' + PORTA_LOCAL);
    registrar('[servidor] require() aceito; listen chamado.');
    return true;
  } catch (erro) {
    console.warn('[nexo] nao consegui subir o servidor embutido:', erro.message);
    registrar('[servidor] ERRO no require:', erro);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Ciclo de vida                                                       */
/* ------------------------------------------------------------------ */

const jaAberto = !app.requestSingleInstanceLock();
if (jaAberto) {
  registrar('[app] outra instancia ja estava aberta — este exemplar vai embora.');
  app.quit();
} else {
  app.on('second-instance', () => mostrarJanela());

  app.whenReady().then(async () => {
    registrar('[app] processo pronto; subindo servidor.');
    // servidor primeiro: quando a janela abrir, o renderer já acha alguém
    await subirServidorEmbutido();
    registrar('[app] servidor tratado; seguindo para a interface.');

    // NEXO_SEM_JANELA: valida o app instalado sem aparecer nada na tela de
    // quem estiver usando o computador (usado nos testes de empacotamento).
    if (process.env.NEXO_SEM_JANELA === '1') {
      console.info('[nexo] modo sem janela: servidor de pé, sem interface.');
      return;
    }

    try {
      montarHandlerCaptura();
    } catch (erro) {
      console.warn('[nexo] setDisplayMediaRequestHandler indisponivel:', erro.message);
    }

    criarJanela();
    // em teste nao cria bandeja: menos janela na tela de quem esta assistindo
    if (!MODO_TESTE) criarBandeja();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela();
      else mostrarJanela();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
