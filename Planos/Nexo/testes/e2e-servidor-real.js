/* E2E com o SERVIDOR REAL do Nexo:
   - sobe o servidor numa porta de teste com pasta de dados descartável
   - Leal cria a sala; Gustavo entra pelo codigo
   - Leal abre conversa privada e manda mensagem -> Gustavo recebe + badge
   - Leal sobe um ARQUIVO DE VERDADE e envia     -> Gustavo recebe o anexo
   - canal #arquivos mostra o anexo com URL real -> e a URL devolve os mesmos bytes
   Nada é simulado: tudo passa por WebSocket e HTTP de verdade. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RAIZ = 'C:\\Users\\Arcelino Leal\\Documents\\Projeto\\Planos\\Nexo';
const PORTA_SRV = 3999;
const URL_APP = `http://127.0.0.1:${PORTA_SRV}/`;
const DIR_DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-e2e-dados-'));
const DIR_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-e2e-tmp-'));

const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const resultados = [];
function verificar(nome, ok, detalhe) {
  resultados.push({ nome, ok: !!ok });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${nome}${detalhe ? '  -> ' + detalhe : ''}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
function getJson(host, port, rota) {
  return new Promise((resolve, reject) => {
    http.get({ host, port, path: rota }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function abrirCliente(nome, portaCDP) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-e2e-'));
  const proc = spawn(CHROME, [
    `--remote-debugging-port=${portaCDP}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,860', 'about:blank'
  ], { stdio: 'ignore' });

  let alvo = null;
  for (let i = 0; i < 50 && !alvo; i++) {
    try { const ts = await getJson('127.0.0.1', portaCDP, '/json/list'); alvo = ts.find(t => t.type === 'page'); } catch { }
    if (!alvo) await dormir(300);
  }
  if (!alvo) throw new Error(nome + ': Chrome nao subiu');

  const WebSocket = require(path.join(RAIZ, 'node_modules', 'ws'));
  const ws = new WebSocket(alvo.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const espera = new Map(); const erros = [];

  ws.on('message', (m) => {
    const msg = JSON.parse(m);
    if (msg.id && espera.has(msg.id)) { espera.get(msg.id)(msg); espera.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      erros.push((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      erros.push(msg.params.args.map(a => a.value || a.description || '').join(' '));
    }
  });
  await new Promise(r => ws.on('open', r));

  const envia = (metodo, params = {}) => new Promise((resolve) => {
    const i = ++id; espera.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method: metodo, params }));
  });
  async function avaliar(expr) {
    const r = await envia('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.exceptionDetails) {
      return { erro: (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || 'excecao' };
    }
    return { valor: r.result && r.result.result ? r.result.result.value : undefined };
  }
  await envia('Page.enable'); await envia('Runtime.enable'); await envia('DOM.enable');

  return { nome, proc, envia, avaliar, erros,
    fechar() { ws.close(); proc.kill(); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { } } };
}

/* leva um cliente do zero ate dentro da sala */
async function entrarNaSala(c, nome, codigo) {
  await c.envia('Page.navigate', { url: URL_APP }); await dormir(2000);
  await c.avaliar(`try{localStorage.setItem('nexo.tutorialVisto','1')}catch(e){}; 'ok'`);
  await c.envia('Page.navigate', { url: URL_APP }); await dormir(2200);
  await c.avaliar(`(function(){
    var pb=document.getElementById('tutorial-pular'); if(pb) pb.click();
    document.querySelectorAll('#tutorial, .tutorial-overlay').forEach(function(e){ if(e.parentNode) e.parentNode.removeChild(e); });
    return 'ok'; })()`);

  // servidor: garante que aponta para o de teste
  await c.avaliar(`(function(){ var s=document.getElementById('in-servidor'); if(s) s.value=${JSON.stringify(URL_APP.replace(/\/$/, ''))}; return 'ok'; })()`);

  const iNome = await c.avaliar(`(function(){ var i=document.getElementById('in-nome'); i.value=${JSON.stringify(nome)};
    i.dispatchEvent(new Event('input',{bubbles:true})); return i.value; })()`);
  if (iNome.valor !== nome) throw new Error(c.nome + ': nao consegui escrever o nome (' + iNome.erro + ')');

  if (codigo) {
    await c.avaliar(`(function(){ var i=document.getElementById('in-codigo'); i.value=${JSON.stringify(codigo)};
      i.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'; })()`);
    await c.avaliar(`document.getElementById('btn-entrar').click(); 'ok'`);
  } else {
    await c.avaliar(`document.getElementById('btn-criar').click(); 'ok'`);
  }

  // espera o servidor responder e a sala abrir
  for (let i = 0; i < 40; i++) {
    const e = await c.avaliar(`(function(){ return JSON.stringify({ meuId: estado.meuId||null, codigo: estado.codigo||null,
      salaAberta: !document.getElementById('tela-sala').hidden }); })()`);
    if (e.valor) { const o = JSON.parse(e.valor); if (o.meuId && o.codigo && o.salaAberta) return o; }
    await dormir(300);
  }
  throw new Error(c.nome + ': nao entrou na sala');
}

/* ------------------------------------------------------------------ */

const srv = spawn('node', ['servidor/servidor.js'], {
  cwd: RAIZ,
  env: { ...process.env, NEXO_PORTA: String(PORTA_SRV), NEXO_DIR_DADOS: DIR_DADOS },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logSrv = '';
srv.stdout.on('data', d => { logSrv += d.toString(); });
srv.stderr.on('data', d => { logSrv += d.toString(); });

const clientes = [];

(async () => {
  let noAr = false;
  for (let i = 0; i < 40 && !noAr; i++) {
    try { const h = await getJson('127.0.0.1', PORTA_SRV, '/health'); noAr = h && h.status === 'ok'; } catch { }
    if (!noAr) await dormir(250);
  }
  if (!noAr) { console.error('Servidor nao subiu:\n' + logSrv); srv.kill(); process.exit(1); }
  console.log('Servidor de teste no ar em ' + URL_APP);

  /* ---- arquivo de verdade para subir ---- */
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const arquivoSubir = path.join(DIR_TMP, 'print-do-priminho.png');
  fs.writeFileSync(arquivoSubir, PNG);
  console.log('Arquivo de teste: ' + PNG.length + ' bytes\n');

  /* ---- dois clientes entram na mesma sala ---- */
  const A = await abrirCliente('Leal', 9401); clientes.push(A);
  const B = await abrirCliente('Gustavo', 9402); clientes.push(B);

  const sa = await entrarNaSala(A, 'Leal', null);
  console.log('Leal criou a sala ' + sa.codigo);
  const sb = await entrarNaSala(B, 'Gustavo', sa.codigo);
  console.log('Gustavo entrou (' + sb.codigo + ')');
  await dormir(1200);

  console.log('\n== 1) Os dois se veem na sala ==');
  let r = await A.avaliar(`(function(){
    return JSON.stringify({ total: estado.participantes.length,
      nomes: estado.participantes.map(function(p){ return p.nome; }).sort().join(', '),
      naTela: document.querySelectorAll('#lista-pessoas li').length }); })()`);
  let o = JSON.parse(r.valor);
  verificar('Leal ve 2 pessoas na sala', o.total === 2 && o.naTela === 2, r.valor);
  verificar('nomes corretos', /Gustavo/.test(o.nomes) && /Leal/.test(o.nomes), o.nomes);

  r = await B.avaliar(`JSON.stringify({ total: estado.participantes.length, nomes: estado.participantes.map(function(p){return p.nome;}).sort().join(', ') })`);
  verificar('Gustavo tambem ve as 2 pessoas', JSON.parse(r.valor).total === 2, r.valor);

  const idB = JSON.parse((await A.avaliar(`JSON.stringify(estado.participantes.find(function(p){return p.nome==='Gustavo';}).id)`)).valor);

  console.log('\n== 2) Conversa privada de verdade (WebSocket) ==');
  r = await A.avaliar(`(function(){
    abrirConversa(${JSON.stringify(idB)});
    enviarParaConversa({ texto: 'e ai primo, chama no zap', anexo: null });
    return 'ok'; })()`);
  await dormir(1000);

  // confere ANTES de abrir a conversa, porque abrir limpa o badge
  r = await B.avaliar(`(function(){
    var itens = document.querySelectorAll('#lista-dms .dm-item');
    var comBadge = null;
    itens.forEach(function(b){ if(b.querySelector('.ponto-nao-lido')) comBadge = b.querySelector('.dm-nome').textContent; });
    return JSON.stringify({ itens: itens.length, comBadge: comBadge,
      naoLidas: Array.from(estado.naoLidas.keys()).length,
      rotulo: document.querySelector('.rot-cat-dms').textContent }); })()`);
  o = JSON.parse(r.valor);
  verificar('Gustavo ganhou badge de nao-lida no painel', o.comBadge === 'Leal', r.valor);
  verificar('cabecalho da secao mostra (1)', /\(1\)/.test(o.rotulo), o.rotulo);

  // agora abre a conversa e confere o texto entregue pelo servidor
  const idA = JSON.parse((await B.avaliar(`JSON.stringify(estado.participantes.find(function(p){return p.nome==='Leal';}).id)`)).valor);
  r = await B.avaliar(`(function(){
    abrirConversa(${JSON.stringify(idA)});
    var caixa = estado.privados.get(${JSON.stringify(idA)}) || [];
    var ultima = caixa[caixa.length-1] || {};
    var lida = document.querySelector('#lista-dms .dm-item[data-com="${idA}"]');
    return JSON.stringify({ total: caixa.length, texto: ultima.texto,
      badgeSome: !!(lida && !lida.querySelector('.ponto-nao-lido')) }); })()`);
  o = JSON.parse(r.valor);
  verificar('Gustavo recebeu a mensagem privada', o.total === 1 && /e ai primo/.test(o.texto), r.valor);
  verificar('abrir a conversa limpa o badge', o.badgeSome === true, r.valor);

  console.log('\n== 3) Upload de arquivo de verdade ==');
  // volta ao chat da sala nos dois: o envio de arquivo vai para a sala
  await A.avaliar(`abrirConversa(''); 'ok'`);
  await B.avaliar(`abrirConversa(''); 'ok'`);
  await dormir(400);

  const doc = await A.envia('DOM.getDocument', { depth: -1 });
  const q = await A.envia('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#in-anexo' });
  verificar('campo de arquivo encontrado no DOM', !!(q.result && q.result.nodeId));

  await A.envia('DOM.setFileInputFiles', { files: [arquivoSubir], nodeId: q.result.nodeId });
  await A.avaliar(`document.getElementById('in-anexo').dispatchEvent(new Event('change',{bubbles:true})); 'ok'`);

  let urlAnexo = null;
  for (let i = 0; i < 40 && !urlAnexo; i++) {
    const u = await A.avaliar(`estado.anexo && estado.anexo.url ? estado.anexo.url : null`);
    if (u.valor) urlAnexo = u.valor;
    else await dormir(250);
  }
  verificar('arquivo subiu para o servidor e ganhou URL', !!urlAnexo, urlAnexo || 'sem url');
  // o cliente guarda a URL absoluta (absolvaUrl) para a <img> funcionar;
  // o servidor grava o caminho relativo /arquivos/ na mensagem.
  verificar('URL aponta para o nosso /arquivos/', /\/arquivos\//.test(urlAnexo || ''), urlAnexo || '');

  // envia a mensagem com o anexo
  await A.avaliar(`(function(){
    var campo = document.getElementById('in-chat'); campo.value = 'olha o print';
    document.getElementById('form-chat').requestSubmit(); return 'ok'; })()`);
  await dormir(1200);

  r = await B.avaliar(`(function(){
    var imgs = document.querySelectorAll('#lista-chat .anexo-caixa img');
    return JSON.stringify({ imgs: imgs.length, src: imgs[0] ? imgs[0].getAttribute('src') : null,
      temTexto: /olha o print/.test(document.getElementById('lista-chat').textContent) }); })()`);
  o = JSON.parse(r.valor);
  verificar('Gustavo recebeu o anexo no chat', o.imgs === 1, r.valor);
  verificar('Gustavo recebeu o texto junto', o.temTexto === true);
  verificar('anexo aponta para o nosso /arquivos/', /\/arquivos\//.test(o.src || ''), o.src || '');

  console.log('\n== 4) A URL do anexo devolve os mesmos bytes ==');
  const urlBaixar = /^https?:/i.test(urlAnexo) ? urlAnexo : 'http://127.0.0.1:' + PORTA_SRV + urlAnexo;
  const corpo = await httpGet(urlBaixar);
  verificar('bytes baixados == bytes enviados', corpo.equals(PNG), corpo.length + ' vs ' + PNG.length + ' bytes');

  console.log('\n== 5) Canal #arquivos mostra o anexo com URL real ==');
  for (const c of [A, B]) {
    const antes = await c.avaliar(`(function(){ document.querySelector('.canal[data-canal="arquivos"]').click();
      var cards = document.querySelectorAll('#arq-grade .arq-card');
      var href = cards[0] ? cards[0].getAttribute('href') : null;
      return JSON.stringify({ cards: cards.length, href: href,
        nome: cards[0] ? cards[0].querySelector('.arq-nome').textContent : null,
        classe: cards[0] ? cards[0].querySelector('.arq-miniatura').className : null,
        meta: cards[0] ? cards[0].querySelector('.arq-meta').textContent : null,
        resumo: document.getElementById('arq-resumo').textContent.trim() }); })()`);
    const a = JSON.parse(antes.valor);
    verificar(c.nome + ': galeria tem 1 anexo real', a.cards === 1, antes.valor);
    verificar(c.nome + ': cartao abre a URL do nosso /arquivos/', /\/arquivos\//.test(a.href || ''), a.href || '');
    verificar(c.nome + ': identificado como imagem', /imagem/.test(a.classe || ''), a.classe || '');
    verificar(c.nome + ': cartao mostra o remetente', c.nome === 'Leal' ? /você/.test(a.meta || '') : /Leal/.test(a.meta || ''), a.meta || '');
    const voltar = await c.avaliar(`(function(){ document.querySelector('.canal[data-canal="geral"]').click();
      return !document.getElementById('lista-chat').hidden && !document.getElementById('form-chat').hidden; })()`);
    verificar(c.nome + ': volta para o chat com campo visivel', voltar.valor === true);
  }

  console.log('\n== 6) Conexao e erros ==');
  for (const c of clientes) {
    const conn = await c.avaliar(`document.getElementById('info-conexao').textContent`);
    verificar(c.nome + ': conectado ao servidor real', /conectado|Servidor/i.test(conn.valor || ''), conn.valor);
    verificar(c.nome + ': sem erros de JS', c.erros.length === 0, c.erros.slice(0, 2).join(' | '));
  }

  /* ---- resumo ---- */
  const falhas = resultados.filter(x => !x.ok);
  console.log('\n=========================================');
  console.log(`RESULTADO E2E: ${resultados.length - falhas.length}/${resultados.length} testes passaram`);
  if (falhas.length) { console.log('FALHAS:'); falhas.forEach(f => console.log('  - ' + f.nome)); }
  console.log('log do servidor (ultimas linhas):');
  console.log(logSrv.split('\n').slice(-6).join('\n'));

  clientes.forEach(c => c.fechar()); srv.kill();
  try { fs.rmSync(DIR_DADOS, { recursive: true, force: true }); } catch { }
  try { fs.rmSync(DIR_TMP, { recursive: true, force: true }); } catch { }
  process.exit(falhas.length ? 1 : 0);
})().catch(e => {
  console.error('\nERRO FATAL: ' + (e && e.stack || e));
  console.error('log do servidor:\n' + logSrv);
  clientes.forEach(c => c.fechar()); try { srv.kill(); } catch { }
  process.exit(1);
});
