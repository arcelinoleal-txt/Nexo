/* Teste da UI de amizades do Nexo:
   1) sobe um servidor real (node servidor.js) numa porta limpa
   2) cria 2 contas via API
   3) abre o app no Chrome apontando pro servidor de teste
   4) loga como A (gravarSessao), abre a secao Amigos, busca B, envia pedido
   5) troca de sessao pra B: ve o pedido, aceita, ve a lista de amigos
   6) clica no amigo -> abre conversa privada
   Verifica DOM, estado e erros de JS - screenshot de cada etapa. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORTA_APP = 4771;
const PORTA_CHROME = 9355;
const URL_APP = `http://127.0.0.1:${PORTA_APP}/`;
const DIR_SHOTS = path.join(os.tmpdir(), 'nexo-teste-amizades');
const RAIZ = 'C:\\Users\\Arcelino Leal\\Documents\\Projeto\\Planos\\Nexo';

fs.mkdirSync(DIR_SHOTS, { recursive: true });

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function requisitar(opcoes, corpo) {
  return new Promise((resolve, reject) => {
    const req = http.request(opcoes, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let j = null;
        try { j = JSON.parse(d); } catch { }
        resolve({ status: res.statusCode, json: j, texto: d });
      });
    });
    req.on('error', reject);
    if (corpo) req.write(corpo);
    req.end();
  });
}

const resultados = [];
function verificar(nome, ok, detalhe) {
  resultados.push({ nome, ok: !!ok, detalhe: detalhe || '' });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${nome}${detalhe ? '  -> ' + detalhe : ''}`);
}


function parsar(t) {
  if (t && typeof t === 'object') return t;
  try { return JSON.parse(t); } catch { return {}; }
}
/* ------------------------------ servidor de teste ------------------------------ */
const dirDados = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-amiz-dados-'));
const srv = spawn(process.execPath, [path.join(RAIZ, 'servidor', 'servidor.js')], {
  env: { ...process.env, NEXO_PORTA: String(PORTA_APP), NEXO_DIR_DADOS: dirDados },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logServidor = '';
srv.stdout.on('data', c => logServidor += c);
srv.stderr.on('data', c => logServidor += c);

/* ------------------------------ chrome ------------------------------ */
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-chrome-amiz-'));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORTA_CHROME}`,
  `--user-data-dir=${perfil}`,
  '--no-first-run', '--no-default-browser-check',
  '--window-size=1600,900',
  'about:blank'
], { stdio: 'ignore' });

function getJson(rota) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORTA_CHROME, path: rota }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  /* espera o servidor de teste */
  let saudavel = false;
  for (let i = 0; i < 30 && !saudavel; i++) {
    try {
      const r = await requisitar({ host: '127.0.0.1', port: PORTA_APP, path: '/health', method: 'GET' });
      saudavel = r.status === 200;
    } catch { }
    if (!saudavel) await dormir(300);
  }
  if (!saudavel) { console.error('servidor de teste nao subiu:\n' + logServidor); encerrar(1); return; }
  console.log('servidor de teste no ar em :' + PORTA_APP);

  /* raiz precisa responder 200 SEM token (regressao do bug do 401) */
  const raiz = await requisitar({ host: '127.0.0.1', port: PORTA_APP, path: '/', method: 'GET' });
  verificar('raiz / responde 200 sem token (regressao do 401)', raiz.status === 200 && /index/i.test(raiz.texto) || raiz.status === 200, 'status=' + raiz.status);
  const rend = await requisitar({ host: '127.0.0.1', port: PORTA_APP, path: '/renderer.js', method: 'GET' });
  verificar('renderer.js responde 200 sem token', rend.status === 200, 'status=' + rend.status);
  const amizSemTok = await requisitar({ host: '127.0.0.1', port: PORTA_APP, path: '/api/amigos', method: 'GET' });
  verificar('GET /api/amigos sem token -> 401', amizSemTok.status === 401, 'status=' + amizSemTok.status);

  /* cria as 2 contas */
  const sfx = Date.now() % 100000;
  const nA = 'amizA' + sfx, nB = 'amizB' + sfx;
  const corpo = (n) => JSON.stringify({ nome: n, email: n + '@nexo.test', senha: 'SenhaForte123!' });
  const ca = await requisitar({ host: '127.0.0.1', port: PORTA_APP, path: '/api/conta/cadastrar', method: 'POST', headers: { 'Content-Type': 'application/json' } }, corpo(nA));
  const cb = await requisitar({ host: '127.0.0.1', port: PORTA_APP, path: '/api/conta/cadastrar', method: 'POST', headers: { 'Content-Type': 'application/json' } }, corpo(nB));
  verificar('conta A criada', ca.status === 200 && ca.json && ca.json.token, 'status=' + ca.status + ' ' + (ca.json && ca.json.erro));
  verificar('conta B criada', cb.status === 200 && cb.json && cb.json.token, 'status=' + cb.status + ' ' + (cb.json && cb.json.erro));
  if (!ca.json || !cb.json) { encerrar(1); return; }
  const tokA = ca.json.token, tokB = cb.json.token;
  const idA = ca.json.usuario.id, idB = cb.json.usuario.id;

  /* espera o chrome */
  let alvo = null;
  for (let i = 0; i < 40 && !alvo; i++) {
    try { const ts = await getJson('/json/list'); alvo = ts.find(t => t.type === 'page'); } catch { }
    if (!alvo) await dormir(300);
  }
  if (!alvo) { console.error('Chrome nao subiu'); encerrar(1); return; }

  const WebSocket = require(path.join(RAIZ, 'node_modules', 'ws'));
  const ws = new WebSocket(alvo.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0;
  const espera = new Map();
  const erros = [];
  const envia = (metodo, params = {}) => new Promise((resolve) => {
    const i = ++id;
    espera.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method: metodo, params }));
  });

  await new Promise(r => ws.on('open', r));
  ws.on('message', (m) => {
    const msg = JSON.parse(m);
    if (msg.id && espera.has(msg.id)) { espera.get(msg.id)(msg); espera.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      erros.push((d.exception && (d.exception.description || d.exception.value)) || d.text || 'excecao');
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      erros.push(msg.params.args.map(a => a.value || a.description || '').join(' '));
    }
  });

  async function avaliar(expr) {
    const r = await envia('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      return { erro: (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || 'excecao' };
    }
    return { valor: r.result && r.result.result ? r.result.result.value : undefined };
  }

  async function shot(nome) {
    const s = await envia('Page.captureScreenshot', { format: 'png' });
    if (s.result && s.result.data) {
      const p = path.join(DIR_SHOTS, nome + '.png');
      fs.writeFileSync(p, Buffer.from(s.result.data, 'base64'));
      console.log('  [screenshot] ' + p + ' (' + fs.statSync(p).size + ' bytes)');
    }
  }

  await envia('Page.enable');
  await envia('Runtime.enable');
  await envia('Page.navigate', { url: URL_APP });
  await dormir(1800);
  await avaliar(`try{localStorage.setItem('nexo.tutorialVisto','1')}catch(e){}; 'ok'`);
  await envia('Page.navigate', { url: URL_APP });
  await dormir(2200);

  /* ---------------------------------------------------------------
     prepara: sala aberta, sessao da conta A, aponta pro servidor
     --------------------------------------------------------------- */
  const inj = await avaliar(`
    (function(){
      try {
        document.querySelectorAll('#tutorial, .tutorial-overlay').forEach(e => { if(e.parentNode) e.parentNode.removeChild(e); });
        document.querySelectorAll('.overlay').forEach(e => { e.hidden = true; });
        var t = document.getElementById('tela-entrada'); if (t) t.hidden = true;
        var s = document.getElementById('tela-sala'); if (s) s.hidden = false;
        estado.servidor = 'http://127.0.0.1:${PORTA_APP}';
        estado.codigo = 'AMIZ01';
        estado.meuId = '${idA}';
        estado.canal = 'geral';
        estado.conversa = '';
        estado.perfil = estado.perfil || {};
        estado.perfil.nome = '${nA}';
        estado.participantes = [
          { id:'${idA}', nome:'${nA}', cor:330, mudo:false, camera:false, tela:false },
          { id:'${idB}', nome:'${nB}', cor:215, mudo:false, camera:false, tela:false }
        ];
        gravarSessao(${JSON.stringify(tokA)}, ${JSON.stringify(ca.json.usuario)});
        desenharParticipantes();
        irParaAmigos('todos');   // abre o painel de amigos (nova vista do rail)
        return 'ok';
      } catch(e) { return 'ERRO: ' + e.message + ' | ' + e.stack; }
    })()
  `);
  if (inj.valor !== 'ok') { console.log('INJECAO: ' + JSON.stringify(inj)); verificar('preparacao do app', false, inj.valor || inj.erro); }
  await dormir(500);

  /* ---------------------------------------------------------------
   1) secao Amigos existe e carrega lista vazia
     --------------------------------------------------------------- */
  console.log('\n== 1) Seccao Amigos no painel ==');

  let r = await avaliar(`(function(){
    var cab = document.querySelector('.cab-amigos');
    var rot = document.querySelector('.rot-cab-amigos');
    var btn = document.getElementById('btn-novo-amigo');
    var lista = document.getElementById('lista-amigos');
    var ped = document.getElementById('lista-pedidos');
    var painel = document.getElementById('painel-amigos');
    var abas = document.querySelectorAll('.aba-amigos');
    return JSON.stringify({ temCab: !!cab, rot: rot ? rot.textContent : null,
      temBtn: !!btn, temLista: !!lista, painelVisivel: painel ? !painel.hidden : null,
      abas: abas.length, pedidosHidden: ped ? ped.hidden : null });
  })()`);
  o = parsar(r.valor);
  verificar('seccao Amigos existe com cabecalho e botao', o.temCab && o.temBtn, r.valor);
  verificar('painel de amigos abre no lugar da sala', o.painelVisivel === true, r.valor);
  verificar('painel tem as 4 abas do Discord', o.abas === 4, r.valor);

  r = await avaliar(`(async function(){
    try {
      await carregarAmizades();
      return 'ok';
    } catch(e) { return 'ERRO: ' + e.message; }
  })()`);
  verificar('carregarAmizades() roda sem erro', r.valor === 'ok', r.valor || r.erro);
  await dormir(400);

  r = await avaliar(`(function(){
    var lista = document.getElementById('lista-amigos');
    var ped = document.getElementById('lista-pedidos');
    var rot = document.querySelector('.rot-aba-amigos');
    return JSON.stringify({ vazia: !!lista.querySelector('.amigo-vazio'),
      itens: lista.querySelectorAll('.item-amigo').length,
      pedidosHidden: ped.hidden, rot: rot ? rot.textContent : null,
      listaVisivel: !lista.hidden });
  })()`);
  o = parsar(r.valor);
  verificar('lista vazia mostra "Nenhum amigo ainda"', o.vazia && o.itens === 0, r.valor);
  verificar('pedidos comecam escondidos', o.pedidosHidden === true, r.valor);

  await shot('01-secao-amigos');

  /* ---------------------------------------------------------------
     2) painel Adicionar amigo + busca
     --------------------------------------------------------------- */
  console.log('\n== 2) Painel Adicionar amigo ==');

  r = await avaliar(`(async function(){
    document.getElementById('btn-novo-amigo').click();
    await new Promise(res => setTimeout(res, 300));
    var painel = document.getElementById('painel-adicionar');
    var aba = document.querySelector('.aba-amigos.ativa');
    return JSON.stringify({ aberto: painel ? !painel.hidden : null,
      abaAtiva: aba ? aba.dataset.aba : null,
      temInput: !!document.getElementById('in-busca-amigo'),
      temBtnBuscar: !!document.getElementById('btn-buscar-amigo') });
  })()`);
  o = parsar(r.valor);
  verificar('botao + abre o painel com input e botao buscar', o.aberto && o.temInput && o.temBtnBuscar, r.valor);
  verificar('botao + leva direto pra aba "adicionar"', o.abaAtiva === 'adicionar', r.valor);

  r = await avaliar(`(function(){
    var i = document.getElementById('in-busca-amigo');
    i.value = 'x';   // busca curta demais
    return 'ok';
  })()`);
  await avaliar(`buscarAmigo(); 'ok'`);
  await dormir(300);
  r = await avaliar(`document.getElementById('lista-resultado-amigo').textContent`);
  verificar('busca com 1 letra pede pelo menos 2', /pelo menos 2/i.test(r.valor || ''), r.valor);

  r = await avaliar(`(function(){
    var i = document.getElementById('in-busca-amigo');
    i.value = ${JSON.stringify(nB)};
    return 'ok';
  })()`);
  await avaliar(`(async function(){ await buscarAmigo(); return 'ok'; })()`);
  await dormir(700);
  r = await avaliar(`(function(){
    var box = document.getElementById('lista-resultado-amigo');
    var btns = box.querySelectorAll('.resultado-amigo .btn-pedido');
    return JSON.stringify({ itens: box.querySelectorAll('.resultado-amigo').length,
      temBotaoAdd: btns.length, texto: box.textContent.trim().slice(0,120) });
  })()`);
  o = parsar(r.valor);
  verificar('busca encontra a conta B no servidor', o.itens === 1, r.valor);
  verificar('resultado tem botao adicionar', o.temBotaoAdd === 1, r.valor);

  await shot('02-busca-amigo');

  /* ---------------------------------------------------------------
     3) envia pedido de amizade
     --------------------------------------------------------------- */
  console.log('\n== 3) Enviar pedido ==');

  r = await avaliar(`(async function(){
    var b = document.querySelector('#lista-resultado-amigo .btn-pedido');
    if(!b) return 'sem botao';
    b.click();
    await new Promise(r => setTimeout(r, 800));
    return 'ok';
  })()`);
  verificar('clica no botao adicionar', r.valor === 'ok', r.valor || r.erro);
  await dormir(300);

  /* confere no servidor que o pedido existe pra B */
  const listaB = await requisitar({ host: '127.0.0.1', port: PORTA_APP, path: '/api/amigos', method: 'GET', headers: { Authorization: 'Bearer ' + tokB } });
  verificar('servidor registrou o pedido pra B', listaB.status === 200 && listaB.json.pedidos.some(p => p.id === idA), JSON.stringify(listaB.json));

  await shot('03-pedido-enviado');

  /* ---------------------------------------------------------------
   4) troca pra B: ve o pedido e aceita
     --------------------------------------------------------------- */
  console.log('\n== 4) B ve e aceita o pedido ==');

  r = await avaliar(`(function(){
    gravarSessao(${JSON.stringify(tokB)}, ${JSON.stringify(cb.json.usuario)});
    estado.meuId = '${idB}';
    estado.perfil.nome = '${nB}';
    return 'ok';
  })()`);
  r = await avaliar(`(async function(){ await carregarAmizades(); return 'ok'; })()`);
  await dormir(500);

  /* o pedido só aparece na aba "Pendentes" — troca pra ela antes de conferir */
  r = await avaliar(`(async function(){
    mudarAbaAmigos('pedidos');
    await new Promise(res => setTimeout(res, 200));
    return 'ok';
  })()`);
  verificar('B troca pra aba Pendentes', r.valor === 'ok', r.valor || r.erro);

  r = await avaliar(`(function(){
    var ped = document.getElementById('lista-pedidos');
    var itens = ped.querySelectorAll('.item-pedido');
    var aceitar = ped.querySelectorAll('.btn-pedido.aceitar');
    var recusar = ped.querySelectorAll('.btn-pedido.recusar');
    var cont = document.getElementById('cont-aba-pedidos');
    var badgeRail = document.getElementById('rail-badge-amigos');
    return JSON.stringify({ hidden: ped.hidden, itens: itens.length,
      aceitar: aceitar.length, recusar: recusar.length,
      contAbas: cont ? { hidden: cont.hidden, txt: cont.textContent } : null,
      railBadge: badgeRail ? { hidden: badgeRail.hidden, txt: badgeRail.textContent } : null,
      nome: itens[0] ? itens[0].querySelector('.item-nome').textContent : null });
  })()`);
  o = parsar(r.valor);
  verificar('B ve o pedido pendente na lista', o.hidden === false && o.itens === 1, r.valor);
  verificar('pedido tem botao aceitar e recusar', o.aceitar === 1 && o.recusar === 1, r.valor);
  verificar('pedido mostra o nome de A', o.nome === nA, 'nome=' + o.nome);
  verificar('contador da aba Pendentes mostra (1)', o.contAbas && o.contAbas.txt === '1' && !o.contAbas.hidden, JSON.stringify(o.contAbas));
  verificar('badge vermelho no rail do Amigos', o.railBadge && !o.railBadge.hidden && o.railBadge.txt === '1', JSON.stringify(o.railBadge));

  await shot('04-pedido-recebido');

  r = await avaliar(`(async function(){
    document.querySelector('#lista-pedidos .btn-pedido.aceitar').click();
    await new Promise(r => setTimeout(r, 900));
    return 'ok';
  })()`);
  verificar('clica em aceitar', r.valor === 'ok', r.valor || r.erro);
  await dormir(400);

  r = await avaliar(`(function(){
    var ped = document.getElementById('lista-pedidos');
    var lista = document.getElementById('lista-amigos');
    var itens = lista.querySelectorAll('.item-amigo');
    var cont = document.getElementById('cont-aba-pedidos');
    var badgeRail = document.getElementById('rail-badge-amigos');
    return JSON.stringify({
      listaVaziaAindaVisivel: !ped.hidden && !!ped.querySelector('.pedido-vazio'),
      itensPedidos: ped.querySelectorAll('.item-pedido').length,
      amigos: itens.length,
      nome: itens[0] ? itens[0].querySelector('.item-nome').textContent : null,
      contEscondido: cont ? cont.hidden : null,
      railEscondido: badgeRail ? badgeRail.hidden : null });
  })()`);
  o = parsar(r.valor);
  verificar('apos aceitar, nao sobra nenhum pedido', o.itensPedidos === 0, r.valor);
  verificar('aba Pendentes mostra o estado vazio', o.listaVaziaAindaVisivel === true, r.valor);
  verificar('B agora tem A na lista de amigos', o.amigos === 1 && o.nome === nA, r.valor);
  verificar('contador da aba some quando nao ha pedido', o.contEscondido === true, r.valor);
  verificar('badge vermelho do rail some', o.railEscondido === true, r.valor);

  await shot('05-b-amigo');

  /* ---------------------------------------------------------------
     5) B clica no amigo -> abre conversa privada
     --------------------------------------------------------------- */
  console.log('\n== 5) Clicar no amigo abre conversa ==');

  r = await avaliar(`(async function(){
    mudarAbaAmigos('todos');   // a lista de amigos so aparece nesta aba
    await new Promise(r => setTimeout(r, 250));
    document.querySelector('#lista-amigos .amigo-abrir').click();
    await new Promise(r => setTimeout(r, 600));
    return JSON.stringify({ conversa: estado.conversa, canal: estado.canal });
  })()`);
  o = parsar(r.valor);
  verificar('clique abre conversa privada com A', o.conversa === idA, r.valor);

  await shot('06-conversa-amigo');

  /* ---------------------------------------------------------------
     6) A recarrega e tambem ve B como amigo
     --------------------------------------------------------------- */
  console.log('\n== 6) A tambem ve B ==');

  r = await avaliar(`(async function(){
    gravarSessao(${JSON.stringify(tokA)}, ${JSON.stringify(ca.json.usuario)});
    estado.meuId = '${idA}';
    await carregarAmizades();
    mudarAbaAmigos('todos');   // garante a aba que mostra a lista inteira
    await new Promise(r => setTimeout(r, 400));
    var lista = document.getElementById('lista-amigos');
    var itens = lista.querySelectorAll('.item-amigo');
    return JSON.stringify({ amigos: itens.length, nome: itens[0] ? itens[0].querySelector('.item-nome').textContent : null });
  })()`);
  o = parsar(r.valor);
  verificar('A ve B como amigo (amizade confirmada dos 2 lados)', o.amigos === 1 && o.nome === nB, r.valor);

  /* remover amizade */
  r = await avaliar(`(async function(){
    var ok = await (async function(){
      var resp = await fetch(origemHttp() + '/api/amigos/remover', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer ' + estado.token},
        body: JSON.stringify({ amigoId: ${JSON.stringify(idB)} })
      });
      return resp.ok;
    })();
    await carregarAmizades();
    mudarAbaAmigos('todos');
    await new Promise(r => setTimeout(r, 400));
    var lista = document.getElementById('lista-amigos');
    return JSON.stringify({ removido: ok, restam: lista.querySelectorAll('.item-amigo').length,
      vazia: !!lista.querySelector('.amigo-vazio') });
  })()`);
  o = parsar(r.valor);
  verificar('remover amizade volta ao estado vazio', o.removido && o.restam === 0 && o.vazia, r.valor);

  /* ---------------------------------------------------------------
     erros de JS + resumo
     --------------------------------------------------------------- */
  console.log('\n== fim ==');
  const errosFiltrados = erros.filter(e => !/favicon/i.test(e));
  verificar('nenhum erro de JS', errosFiltrados.length === 0, errosFiltrados.slice(0, 3).join(' | '));

  const passou = resultados.filter(x => x.ok).length;
  console.log('\n=========================================');
  console.log('RESULTADO: ' + passou + '/' + resultados.length + ' testes passaram');
  if (passou < resultados.length) {
    console.log('FALHAS:');
    resultados.filter(x => !x.ok).forEach(x => console.log('  - ' + x.nome + ' ' + x.detalhe));
  }
  encerrar(passou === resultados.length ? 0 : 1);

})().catch(e => { console.error('ERRO FATAL: ' + (e.stack || e)); encerrar(1); });

function encerrar(cod) {
  try { chrome.kill(); } catch { }
  try { srv.kill(); } catch { }
  try { fs.rmSync(dirDados, { recursive: true, force: true }); } catch { }
  setTimeout(() => process.exit(cod), 500);
}
