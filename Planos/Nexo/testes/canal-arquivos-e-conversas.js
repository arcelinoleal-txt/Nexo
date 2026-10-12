/* Teste das funcionalidades novas do Nexo:
   1) canal #arquivos (galeria de anexos com filtros)
   2) conversas privadas no painel esquerdo (lista, badge, seletor)
   Verifica DOM, estado e erros de JS — e tira screenshot de cada etapa. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9344;
const URL_APP = 'file:///C:/Users/Arcelino%20Leal/Documents/Projeto/Planos/Nexo/app/index.html';
const DIR_SHOTS = path.join(os.tmpdir(), 'nexo-teste-novo');

fs.mkdirSync(DIR_SHOTS, { recursive: true });

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-chrome-'));
const proc = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${perfil}`,
  '--no-first-run', '--no-default-browser-check',
  '--window-size=1600,900',
  'about:blank'
], { stdio: 'ignore' });

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function getJson(rota) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: rota }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

const resultados = [];
function verificar(nome, ok, detalhe) {
  resultados.push({ nome, ok: !!ok, detalhe: detalhe || '' });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${nome}${detalhe ? '  -> ' + detalhe : ''}`);
}

(async () => {
  let alvo = null;
  for (let i = 0; i < 40 && !alvo; i++) {
    try { const ts = await getJson('/json/list'); alvo = ts.find(t => t.type === 'page'); } catch { }
    if (!alvo) await dormir(300);
  }
  if (!alvo) { console.error('Chrome nao subiu'); proc.kill(); process.exit(1); }

  const WebSocket = require('C:\\Users\\Arcelino Leal\\Documents\\Projeto\\Planos\\Nexo\\node_modules\\ws');
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

  /* avalia JS no app e devolve o valor (ou o erro, que tambem interessa) */
  async function avaliar(expr) {
    const r = await envia('Runtime.evaluate', { expression: expr, returnByValue: true });
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
     monta um estado realista e deixa o proprio app desenhar tudo
     --------------------------------------------------------------- */
  const inj = await avaliar(`
    (function(){
      try {
        document.querySelectorAll('#tutorial, .tutorial-overlay').forEach(e => { if(e.parentNode) e.parentNode.removeChild(e); });
        document.querySelectorAll('.overlay').forEach(e => { e.hidden = true; });
        var t = document.getElementById('tela-entrada'); if (t) t.hidden = true;
        var s = document.getElementById('tela-sala'); if (s) s.hidden = false;

        estado.codigo = 'NKT9RU';
        estado.meuId = 'eu-1';
        estado.conversa = '';
        estado.canal = 'geral';
        estado.filtroArquivos = 'tudo';
        estado.perfil = estado.perfil || {};
        estado.perfil.nome = 'Leal';
        estado.perfil.cor = 330;
        estado.privados = new Map();
        estado.naoLidas = new Map();
        estado.nomes = new Map();
        estado.historico = [];
        estado.participantes = [
          { id:'eu-1', nome:'Leal',     cor:330, mudo:false, camera:true,  tela:false },
          { id:'p2',   nome:'Gustavo',  cor:215, mudo:false, camera:false, tela:false },
          { id:'p3',   nome:'Fernanda', cor:28,  mudo:true,  camera:true,  tela:true  },
          { id:'p4',   nome:'Priminho', cor:150, mudo:false, camera:false, tela:false }
        ];
        var cl = document.getElementById('codigo-sala-painel'); if (cl) cl.textContent = 'NKT9RU';
        desenharParticipantes();
        document.getElementById('lista-chat').innerHTML = '';

        // anexos de verdade (miniaturas reais) para a galeria nao ficar vazia
        var PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        anexarMensagem({ de:'p2', nome:'Gustavo',  cor:215, texto:'print do setup', hora: Date.now()-400000,
                         anexo:{ nome:'setup.png',  url:PNG, tipo:'image/png', tamanho: 184320 } });
        anexarMensagem({ de:'p3', nome:'Fernanda', cor:28,  texto:'gravacao do jogo', hora: Date.now()-300000,
                         anexo:{ nome:'partida.mp4', url:'data:video/mp4;base64,', tipo:'video/mp4', tamanho: 52428800 } });
        anexarMensagem({ de:'eu-1', nome:'Leal',   cor:330, texto:'audio do rolê', hora: Date.now()-200000,
                         anexo:{ nome:'recado.mp3', url:'data:audio/mpeg;base64,', tipo:'audio/mpeg', tamanho: 2457600 } });
        anexarMensagem({ de:'p4', nome:'Priminho', cor:150, texto:'a lista', hora: Date.now()-100000,
                         anexo:{ nome:'lista.txt', url:'/arquivos/abc123-lista.txt', tipo:'text/plain', tamanho: 4096 } });
        anexarMensagem({ nome:'Leal', cor:330, texto:'bora hoje?', hora: Date.now() });
        return 'ok';
      } catch(e) { return 'ERRO: ' + e.message + ' | ' + e.stack; }
    })()
  `);
  if (inj.valor && inj.valor !== 'ok') console.log('INJECAO: ' + inj.valor);
  await dormir(700);

  /* ---------------------------------------------------------------
     1) painel esquerdo: lista de conversas
     --------------------------------------------------------------- */
  console.log('\n== 1) Lista de conversas no painel esquerdo ==');

  let r = await avaliar(`(function(){
    var box = document.getElementById('lista-dms');
    if(!box) return 'sem #lista-dms';
    var itens = box.querySelectorAll('.dm-item');
    return JSON.stringify({ total: itens.length, primeiro: itens[0] ? itens[0].textContent.trim() : null,
                             temVazia: !!box.querySelector('.dm-vazia') });
  })()`);
  verificar('lista de conversas existe e mostra "Sala"', r.valor && JSON.parse(r.valor).total === 1 && /Sala/.test(JSON.parse(r.valor).primeiro), r.valor);

  r = await avaliar(`(function(){ return !!document.getElementById('btn-nova-dm'); })()`);
  verificar('botao "+" de nova conversa existe', r.valor === true);

  r = await avaliar(`(function(){
    var gal = document.getElementById('painel-arquivos');
    var chat = document.getElementById('lista-chat');
    var form = document.getElementById('form-chat');
    return JSON.stringify({ galHidden: gal.hidden, chatHidden: chat.hidden, formHidden: form.hidden });
  })()`);
  verificar('galeria comeca escondida, chat e campo visiveis',
    r.valor && JSON.parse(r.valor).galHidden === true && JSON.parse(r.valor).chatHidden === false && JSON.parse(r.valor).formHidden === false, r.valor);

  await shot('01-painel-dms');

  /* ---------------------------------------------------------------
     2) canal #arquivos
     --------------------------------------------------------------- */
  console.log('\n== 2) Canal # arquivos ==');

  r = await avaliar(`(function(){
    var c = document.querySelector('.canal[data-canal="arquivos"]');
    if(!c) return 'sem canal arquivos';
    c.click();
    return 'ok';
  })()`);
  await dormir(500);

  r = await avaliar(`(function(){
    var gal = document.getElementById('painel-arquivos');
    var chat = document.getElementById('lista-chat');
    var form = document.getElementById('form-chat');
    var cab  = document.querySelector('.chat-cabecalho');
    var cards = document.querySelectorAll('#arq-grade .arq-card');
    var vazio = document.querySelector('#arq-grade .arq-vazio');
    var resumo = document.getElementById('arq-resumo').textContent.trim();
    return JSON.stringify({
      galVisible: !gal.hidden, chatHidden: chat.hidden, formHidden: form.hidden,
      cabecalhoArquivos: cab.classList.contains('em-arquivos'),
      cards: cards.length, temVazio: !!vazio, resumo: resumo,
      canalAtivo: document.querySelector('.canal[data-canal="arquivos"]').classList.contains('ativo'),
      geralAtivo: document.querySelector('.canal[data-canal="geral"]').classList.contains('ativo')
    });
  })()`);
  let o = JSON.parse(r.valor);
  verificar('abrir #arquivos mostra a galeria e esconde chat e campo', o.galVisible && o.chatHidden && o.formHidden, r.valor);
  verificar('cabecalho muda para "arquivos" e abas somem', o.cabecalhoArquivos === true);
  verificar('canal #arquivos fica ativo e #geral desativa', o.canalAtivo === true && o.geralAtivo === false);
  verificar('galeria monta 4 cartoes (uma por anexo)', o.cards === 4, 'cards=' + o.cards);
  verificar('resumo mostra a contagem', /4/.test(o.resumo), 'resumo="' + o.resumo + '"');

  await shot('02-canal-arquivos');

  /* filtros */
  r = await avaliar(`(function(){
    var saida = {};
    document.querySelectorAll('.arq-filtro').forEach(function(b){
      b.click();
      saida[b.dataset.tipo] = document.querySelectorAll('#arq-grade .arq-card').length;
    });
    document.querySelector('.arq-filtro[data-tipo="tudo"]').click();
    saida.depoisTudo = document.querySelectorAll('#arq-grade .arq-card').length;
    return JSON.stringify(saida);
  })()`);
  o = JSON.parse(r.valor);
  verificar('filtro Imagens -> 1', o.imagem === 1, r.valor);
  verificar('filtro Videos -> 1', o.video === 1);
  verificar('filtro Audios -> 1', o.audio === 1);
  verificar('filtro Docs -> 1', o.arquivo === 1);
  verificar('voltar para Tudo -> 4', o.depoisTudo === 4);

  /* tipo de cada cartao */
  r = await avaliar(`(function(){
    return [].map.call(document.querySelectorAll('#arq-grade .arq-card'), function(c){
      var m = c.querySelector('.arq-miniatura');
      var nome = c.querySelector('.arq-nome').textContent;
      var meta = c.querySelector('.arq-meta').textContent;
      return nome + ' [' + (m.className.replace('arq-miniatura','').trim() || 'doc') + '] meta=' + meta;
    }).join(' || ');
  })()`);
  console.log('  cartoes: ' + r.valor);
  verificar('cartao de imagem tem <img>', /setup\.png \[imagem\]/.test(r.valor), r.valor);
  verificar('cartao de video tem <video>', /partida\.mp4 \[video\]/.test(r.valor));
  verificar('cartao de audio tem icone', /recado\.mp3 \[audio\]/.test(r.valor));
  verificar('cartao de documento tem sigla', /lista\.txt/.test(r.valor));
  verificar('cartoes mostram quem enviou', /Gustavo/.test(r.valor) && /você/.test(r.valor), r.valor);

  /* estado vazio de um filtro */
  r = await avaliar(`(function(){
    estado.historico = estado.historico.filter(function(m){ return !m.anexo || !/\\.(png)$/i.test(m.anexo.nome||''); });
    document.querySelector('.arq-filtro[data-tipo="imagem"]').click();
    var v = document.querySelector('#arq-grade .arq-vazio');
    return v ? v.textContent.trim() : 'SEM VAZIO';
  })()`);
  verificar('filtro sem resultado mostra aviso', r.valor !== 'SEM VAZIO' && /Nada em/.test(r.valor), r.valor);

  /* ---------------------------------------------------------------
     3) seletor de nova conversa
     --------------------------------------------------------------- */
  console.log('\n== 3) Nova conversa privada ==');

  r = await avaliar(`(function(){
    document.querySelector('.canal[data-canal="geral"]').click();
    document.getElementById('btn-nova-dm').click();
    var m = document.getElementById('modal-nova-dm');
    var ps = document.querySelectorAll('#lista-escolher-pessoa .escolha-pessoa');
    return JSON.stringify({ aberto: !m.hidden, pessoas: ps.length,
      nomes: [].map.call(ps, function(b){ return b.querySelector('.escolha-nome').textContent; }).join(', ') });
  })()`);
  o = JSON.parse(r.valor);
  verificar('modal abre', o.aberto === true, r.valor);
  verificar('lista so quem esta na sala (3, sem eu)', o.pessoas === 3, 'pessoas=' + o.pessoas);
  verificar('nomes corretos', /Gustavo/.test(o.nomes) && /Fernanda/.test(o.nomes) && /Priminho/.test(o.nomes) && !/Leal,/.test(o.nomes), o.nomes);

  await shot('03-modal-nova-conversa');

  /* fechar pelo X */
  r = await avaliar(`(function(){
    document.querySelector('#modal-nova-dm .fecha-modal').click();
    return document.getElementById('modal-nova-dm').hidden;
  })()`);
  verificar('botao X fecha o modal', r.valor === true);

  /* abrir conversa pelo seletor */
  r = await avaliar(`(function(){
    document.getElementById('btn-nova-dm').click();
    document.querySelector('#lista-escolher-pessoa .escolha-pessoa[data-com="p2"]').click();
    return JSON.stringify({ conversa: estado.conversa, modalFechado: document.getElementById('modal-nova-dm').hidden,
                             canal: estado.canal });
  })()`);
  verificar('escolher pessoa abre a conversa', r.valor && JSON.parse(r.valor).conversa === 'p2' && JSON.parse(r.valor).modalFechado === true, r.valor);

  /* ---------------------------------------------------------------
     4) conversa aparece na lista do painel + badge
     --------------------------------------------------------------- */
  console.log('\n== 4) Conversa na lista e badge de nao-lidas ==');

  r = await avaliar(`(function(){
    var itens = document.querySelectorAll('#lista-dms .dm-item');
    return JSON.stringify({ total: itens.length,
      rotulo: document.querySelector('.rot-cat-dms').textContent,
      nomes: [].map.call(itens, function(b){ return b.querySelector('.dm-nome').textContent; }).join(' | ') });
  })()`);
  o = JSON.parse(r.valor);
  verificar('conversa privada entra na lista do painel', o.total === 2, r.valor);
  verificar('mostra "Sala" e o nome da pessoa', /Sala/.test(o.nomes) && /Gustavo/.test(o.nomes), o.nomes);

  /* mensagem privada recebida enquanto estou noutra conversa */
  r = await avaliar(`(function(){
    abrirConversa('p3');                        // estou olhando Fernanda
    anexarMensagemPrivada({ de:'p2', para:'eu-1', nome:'Gustavo', cor:215, texto:'e ai', hora: Date.now() });
    var btn = document.querySelector('#lista-dms .dm-item[data-com="p2"]');
    var badge = btn ? btn.querySelector('.ponto-nao-lido') : null;
    return JSON.stringify({ naoLida: estado.naoLidas.get('p2'), badge: badge ? badge.textContent : null,
                             rotulo: document.querySelector('.rot-cat-dms').textContent,
                             abaTopo: !!document.querySelector('#abas-conversa .aba-conversa[data-com="p2"] .ponto-nao-lido') });
  })()`);
  o = JSON.parse(r.valor);
  verificar('mensagem privada contabiliza nao-lida', o.naoLida === 1, r.valor);
  verificar('badge aparece na lista do painel', o.badge === '1', 'badge=' + o.badge);
  verificar('cabecalho da secao mostra total', /\(1\)/.test(o.rotulo), 'rotulo=' + o.rotulo);

  await shot('04-badge-nao-lida');

  /* clicar na conversa limpa o badge */
  r = await avaliar(`(function(){
    document.querySelector('#lista-dms .dm-item[data-com="p2"]').click();
    return JSON.stringify({ conversa: estado.conversa, naoLida: estado.naoLidas.get('p2') || 0,
                             badgeSome: !document.querySelector('#lista-dms .dm-item[data-com="p2"] .ponto-nao-lido'),
                             ativa: document.querySelector('#lista-dms .dm-item[data-com="p2"]').classList.contains('ativa') });
  })()`);
  o = JSON.parse(r.valor);
  verificar('clicar abre a conversa e limpa o badge', o.conversa === 'p2' && o.naoLida === 0 && o.badgeSome === true, r.valor);
  verificar('conversa aberta fica destacada na lista', o.ativa === true);

  /* item "Sala" volta para o chat */
  r = await avaliar(`(function(){
    document.querySelector('#lista-dms .dm-item[data-com=""]').click();
    return JSON.stringify({ conversa: estado.conversa, canal: estado.canal,
                             chatVisivel: !document.getElementById('lista-chat').hidden });
  })()`);
  verificar('item "Sala" volta para o chat da sala', r.valor && JSON.parse(r.valor).conversa === '' && JSON.parse(r.valor).chatVisivel === true, r.valor);

  /* ---------------------------------------------------------------
     5) galeria enche sozinha quando chega anexo novo
     --------------------------------------------------------------- */
  console.log('\n== 5) Galeria acompanha anexos novos ==');

  r = await avaliar(`(function(){
    document.querySelector('.canal[data-canal="arquivos"]').click();
    var antes = document.querySelectorAll('#arq-grade .arq-card').length;
    anexarMensagem({ de:'p3', nome:'Fernanda', cor:28, texto:'outro print', hora: Date.now(),
                     anexo:{ nome:'novo.jpeg', url:'data:image/jpeg;base64,', tipo:'image/jpeg', tamanho: 999 } });
    return JSON.stringify({ antes: antes, depois: document.querySelectorAll('#arq-grade .arq-card').length });
  })()`);
  o = JSON.parse(r.valor);
  verificar('anexo novo aparece na galeria sem trocar de canal', o.depois === o.antes + 1, r.valor);

  /* abrir conversa a partir do painel estando na galeria volta ao chat */
  r = await avaliar(`(function(){
    document.querySelector('#lista-dms .dm-item[data-com="p3"]').click();
    return JSON.stringify({ conversa: estado.conversa, canal: estado.canal,
                             chatVisivel: !document.getElementById('lista-chat').hidden,
                             formVisivel: !document.getElementById('form-chat').hidden });
  })()`);
  o = JSON.parse(r.valor);
  verificar('abrir conversa estando na galeria volta ao chat', o.conversa === 'p3' && o.canal === 'geral' && o.chatVisivel && o.formVisivel, r.valor);

  /* ---------------------------------------------------------------
     resumo
     --------------------------------------------------------------- */
  await shot('05-estado-final');

  const falhas = resultados.filter(x => !x.ok);
  console.log('\n=========================================');
  console.log(`RESULTADO: ${resultados.length - falhas.length}/${resultados.length} testes passaram`);
  if (falhas.length) {
    console.log('FALHAS:');
    falhas.forEach(f => console.log('  - ' + f.nome + '  ' + f.detalhe));
  }

  if (erros.length) {
    console.log('\nERROS DE JS (' + erros.length + '):');
    erros.forEach(e => console.log('  - ' + e));
  } else {
    console.log('\nERROS DE JS: nenhum');
  }

  ws.close();
  proc.kill();
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { }
  process.exit(falhas.length || erros.length ? 1 : 0);
})().catch(e => { console.error(e); proc.kill(); process.exit(1); });
