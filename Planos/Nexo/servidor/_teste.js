'use strict';
/* Teste automatizado do servidor Nexo: salas, chat, presenca, perfil,
   estado de midia, sinalizacao em malha, envio de arquivos e contas. */

const WebSocket = require('ws');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

/* O teste sobe o próprio servidor numa porta livre e com uma base de
   contas descartável, no próprio início — assim ele roda quantas vezes
   for preciso, não depende de nada já aberto e nunca suja a base real. */

let URL = '';
let BASE = '';
let processoServidor = null;
let arquivoContas = '';

function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function esperarServidor(base, tempoMs) {
  return new Promise((resolve, reject) => {
    const fim = Date.now() + tempoMs;
    const tentar = () => {
      const req = http.get(base + '/api/versao', (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() > fim) reject(new Error('o servidor não subiu a tempo'));
        else setTimeout(tentar, 250);
      });
    };
    tentar();
  });
}

function encerrarServidor() {
  if (processoServidor && !processoServidor.killed) {
    try { processoServidor.kill(); } catch { /* ignora */ }
  }
  if (arquivoContas) {
    try { fs.unlinkSync(arquivoContas); } catch { /* ignora */ }
  }
}

const falhas = [];
function conf(cond, texto) {
  if (cond) console.log('  OK   ' + texto);
  else { console.log('  FALHA ' + texto); falhas.push(texto); }
}

function novoCliente() {
  const ws = new WebSocket(URL);
  ws.buffer = [];
  ws.fila = [];
  ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    const espera = ws.fila.shift();
    if (espera) espera(msg);
    else ws.buffer.push(msg);
  });
  ws.proximo = () => new Promise((resolve) => {
    if (ws.buffer.length) return resolve(ws.buffer.shift());
    ws.fila.push(resolve);
  });
  ws.esperar = (tipo, tempo = 3000) => ws.esperarQuando(tipo, null, tempo);
  /* Espera por uma mensagem do tipo certo que tambem satisfaça a condicao.
     Evita pegar uma presenca antiga que ainda nao tinha todo mundo. */
  ws.esperarQuando = (tipo, cond, tempo = 4000) => new Promise((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error('tempo esgotado esperando: ' + tipo)), tempo);
    (async () => {
      for (let i = 0; i < 300; i++) {
        const m = await ws.proximo();
        if (m.tipo === tipo && (!cond || cond(m))) { clearTimeout(limite); return resolve(m); }
      }
      clearTimeout(limite);
      reject(new Error('sem mensagem: ' + tipo));
    })();
  });
  ws.enviar = (o) => ws.send(JSON.stringify(o));
  return new Promise((res, rej) => {
    ws.on('open', () => res(ws));
    ws.on('error', rej);
  });
}

/* GET bruto com timeout: preciso ver o status REAL de uma rota, inclusive
   quando ela devolve texto e nao JSON (e sem travar o teste se o servidor
   parar de responder). */
function httpTexto(caminho, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.request(BASE + caminho, { method: 'GET' }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, corpo: d.slice(0, 80) }));
    });
    req.on('error', () => resolve({ status: 0, corpo: 'erro de conexao' }));
    req.setTimeout(timeoutMs || 4000, () => {
      req.destroy();
      resolve({ status: -1, corpo: 'sem resposta (timeout)' });
    });
    req.end();
  });
}

function httpJson(caminho, corpo, token) {
  return new Promise((resolve) => {
    const dados = corpo ? JSON.stringify(corpo) : null;
    const req = http.request(BASE + caminho, {
      method: dados ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, corpo: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, corpo: d }); }
      });
    });
    req.on('error', () => resolve({ status: 0, corpo: null }));
    req.end(dados);
  });
}

function subirArquivo(nome, corpo, tipo) {
  return new Promise((resolve, reject) => {
    const req = http.request(BASE + '/api/upload?nome=' + encodeURIComponent(nome), {
      method: 'POST',
      headers: { 'Content-Type': tipo || 'application/octet-stream' }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, corpo: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, corpo: d }); }
      });
    });
    req.on('error', reject);
    req.end(corpo);
  });
}

(async () => {
  /* --- 0. servidor próprio, numa porta livre e com base de contas descartável */
  const porta = await portaLivre();
  URL = 'ws://127.0.0.1:' + porta;
  BASE = 'http://127.0.0.1:' + porta;
  arquivoContas = path.join(os.tmpdir(), 'nexo-teste-contas-' + process.pid + '-' + Date.now() + '.json');

  processoServidor = spawn(process.execPath, [path.join(__dirname, 'servidor.js')], {
    env: Object.assign({}, process.env, {
      NEXO_PORTA: String(porta),
      NEXO_DADOS_CONTAS: arquivoContas
    }),
    stdio: 'ignore',
    windowsHide: true
  });

  await esperarServidor(BASE, 20000);

  console.log('\n== Teste do servidor Nexo ==\n');

  /* ---------------------------------------------------------------- */
  /* 1. salas e participantes                                          */
  /* ---------------------------------------------------------------- */

  const A = await novoCliente();
  const B = await novoCliente();
  const C = await novoCliente();

  A.enviar({ tipo: 'criar', nome: 'Ana', avatar: '🦊', cor: 210 });
  const sala = await A.esperar('entrou-sala');
  conf(/^[A-Z0-9]{6}$/.test(sala.codigo), 'A criou sala com codigo de 6: ' + sala.codigo);
  conf(typeof sala.meuId === 'string' && sala.meuId.length > 5, 'servidor devolveu id proprio');
  conf(sala.participantes.length === 1, 'sala com 1 pessoa logo apos criar');
  conf(sala.participantes[0].nome === 'Ana', 'nome do criador registrado');
  conf(sala.participantes[0].avatar === '🦊', 'avatar do criador registrado');

  B.enviar({ tipo: 'entrar', codigo: sala.codigo, nome: 'Bruno' });
  const entrouB = await B.esperar('entrou-sala');
  conf(entrouB.participantes.length === 2, 'B entra e encontra 2 pessoas');
  conf(entrouB.participantes.some(p => p.nome === 'Ana'), 'B ve Ana na lista');
  const idDeB = entrouB.meuId;

  const presencaA = await A.esperarQuando('presenca', m => m.participantes.length === 2);
  conf(presencaA.participantes.length === 2, 'A foi avisada da entrada de B');

  // codigo errado
  const D = await novoCliente();
  D.enviar({ tipo: 'entrar', codigo: 'XXXXXX', nome: 'Zeca' });
  const erro = await D.esperar('erro');
  conf(/nao encontrada/i.test(erro.texto), 'sala inexistente rejeitada');
  D.close();

  /* ---------------------------------------------------------------- */
  /* 2. perfil                                                         */
  /* ---------------------------------------------------------------- */

  B.enviar({ tipo: 'perfil', nome: 'Brunão', avatar: '🐼', cor: 95 });
  const perfilA = await A.esperarQuando('presenca', m => m.participantes.some(p => p.nome === 'Brunão'));
  const alterado = perfilA.participantes.find(p => p.nome === 'Brunão');
  conf(!!alterado, 'mudanca de perfil propagou para A');
  conf(alterado && alterado.avatar === '🐼', 'avatar atualizado');
  conf(alterado && alterado.cor === 95, 'cor atualizada');

  /* ---------------------------------------------------------------- */
  /* 3. chat                                                           */
  /* ---------------------------------------------------------------- */

  B.enviar({ tipo: 'chat', texto: 'ola pessoal' });
  const chatA = await A.esperar('chat');
  conf(chatA.msg.texto === 'ola pessoal', 'chat chega no outro lado');
  conf(chatA.msg.nome === 'Brunão', 'chat carrega o nome atualizado');

  // historia entregue a quem entra depois
  C.enviar({ tipo: 'entrar', codigo: sala.codigo, nome: 'Carla' });
  const entrouC = await C.esperar('entrou-sala');
  conf(entrouC.historico.some(m => m.texto === 'ola pessoal'), 'historico do chat entregue a quem entra');

  /* ---------------------------------------------------------------- */
  /* 4. estado de midia (qualquer um pode transmitir)                  */
  /* ---------------------------------------------------------------- */

  A.enviar({ tipo: 'estado', tela: 'stream-tela-ana', micro: true, mudo: false });
  const presencaB = await B.esperarQuando('presenca', m => m.participantes.some(p => p.tela === 'stream-tela-ana'));
  const ana = presencaB.participantes.find(p => p.nome === 'Ana');
  conf(ana && ana.tela === 'stream-tela-ana', 'A anunciou que esta com a tela ligada');
  conf(ana && ana.micro === true, 'estado do microfone propagado');

  B.enviar({ tipo: 'estado', camera: 'stream-cam-bruno', mudo: true });
  const presencaA2 = await A.esperarQuando('presenca', m => m.participantes.some(p => p.camera === 'stream-cam-bruno'));
  const bruno = presencaA2.participantes.find(p => p.nome === 'Brunão');
  conf(bruno && bruno.camera === 'stream-cam-bruno', 'B pode ligar a camera tambem');
  conf(bruno && bruno.mudo === true, 'estado de mudo propagado');

  A.enviar({ tipo: 'estado', tela: null });
  const presencaB2 = await B.esperarQuando('presenca',
    m => m.participantes.some(p => p.nome === 'Ana' && p.tela === null));
  const ana2 = presencaB2.participantes.find(p => p.nome === 'Ana');
  conf(ana2 && ana2.tela === null, 'A desligou a tela e todos souberam');

  /* ---------------------------------------------------------------- */
  /* 5. sinalizacao em malha (sem papel fixo)                          */
  /* ---------------------------------------------------------------- */

  A.enviar({ tipo: 'oferta', para: idDeB, sdp: 'v=0 oferta-a-b' });
  const oferta = await B.esperar('oferta');
  conf(oferta.sdp === 'v=0 oferta-a-b' && !!oferta.de, 'oferta repassada com id de origem');

  B.enviar({ tipo: 'resposta', para: oferta.de, sdp: 'v=0 resposta' });
  const resposta = await A.esperar('resposta');
  conf(resposta.sdp === 'v=0 resposta', 'resposta voltou para quem ofereceu');

  const idDeC = entrouC.meuId;
  A.enviar({ tipo: 'ice', para: idDeC, candidate: { candidate: 'cand' } });
  const ice = await C.esperar('ice');
  conf(ice.candidate.candidate === 'cand', 'ICE repassado');
  conf(ice.de === sala.meuId, 'ICE tambem traz quem enviou');

  // sinalizacao para fora da sala e descartada
  A.enviar({ tipo: 'oferta', para: 'id-inexistente', sdp: 'x' });
  await new Promise(r => setTimeout(r, 250));
  conf(C.buffer.every(m => m.tipo !== 'oferta'), 'sinalizacao para id invalido e descartada');

  /* ---------------------------------------------------------------- */
  /* 6. conversa individual (mensagem privada entre duas pessoas)       */
  /* ---------------------------------------------------------------- */

  B.enviar({ tipo: 'privado', para: idDeC, texto: 'oi carla, so pra vc' });
  const privC = await C.esperar('privado');
  conf(privC.msg && privC.msg.texto === 'oi carla, so pra vc', 'mensagem privada chega no destinatario');
  conf(privC.msg.de === idDeB, 'mensagem privada traz quem enviou');
  conf(A.buffer.every(m => m.tipo !== 'privado'), 'mensagem privada nao vaza para terceiros');

  C.enviar({ tipo: 'privado', para: idDeB, texto: 'oi bruno' });
  const privB = await B.esperar('privado');
  conf(privB.msg.de === idDeC, 'resposta privada volta para quem enviou');

  // historico privado entregue a quem entra depois
  const E = await novoCliente();
  E.enviar({ tipo: 'entrar', codigo: sala.codigo, nome: 'Duda' });
  const entrouE = await E.esperar('entrou-sala');
  conf(!(entrouE.historico || []).some(m => m && m.texto === 'oi carla, so pra vc'),
    'historico privado nao aparece para quem nao participa');

  /* ---------------------------------------------------------------- */
  /* 7. saida                                                          */
  /* ---------------------------------------------------------------- */

  B.close();
  const saiu = await A.esperar('participante-saiu');
  conf(!!saiu.id, 'todos foram avisados da saida de B');

  const listaFinal = await A.esperarQuando('presenca',
    m => !m.participantes.some(p => p.nome === 'Brunão'));
  conf(!listaFinal.participantes.some(p => p.nome === 'Brunão'), 'B sumiu da lista');
  conf(listaFinal.participantes.length === 3, 'lista atualizada: ' + listaFinal.participantes.length + ' pessoas');

  /* ---------------------------------------------------------------- */
  /* 8. upload de arquivos                                             */
  /* ---------------------------------------------------------------- */

  const foto = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const up = await subirArquivo('print.png', foto, 'image/png');
  conf(up.status === 200 && up.corpo && up.corpo.url, 'upload aceito e devolveu url');

  if (up.corpo && up.corpo.url) {
    conf(/^\/arquivos\//.test(up.corpo.url), 'url servida em /arquivos/: ' + up.corpo.url);
    const baixado = await new Promise((resolve) => {
      http.get(BASE + up.corpo.url, (res) => {
        const pedacos = [];
        res.on('data', c => pedacos.push(c));
        res.on('end', () => resolve({ status: res.statusCode, corpo: Buffer.concat(pedacos) }));
      }).on('error', () => resolve({ status: 0 }));
    });
    conf(baixado.status === 200, 'arquivo baixa de volta');
    conf(baixado.corpo && baixado.corpo.equals(foto), 'conteudo do arquivo preservado byte a byte');

    A.enviar({ tipo: 'chat', texto: 'olha o print', anexo: { nome: 'print.png', url: up.corpo.url, tipo: 'image/png', tamanho: foto.length } });
    const chatAnexo = await C.esperar('chat');
    conf(chatAnexo.msg.anexo && chatAnexo.msg.anexo.nome === 'print.png', 'mensagem de chat com anexo repassada');

    /* URL absoluta nossa (como o navegador monta) chega guardada relativa */
    A.enviar({ tipo: 'chat', texto: 'url absoluta', anexo: {
      nome: 'print.png', url: BASE + up.corpo.url, tipo: 'image/png', tamanho: 12 } });
    const chatAbs = await C.esperar('chat');
    conf(!!chatAbs.msg.anexo && chatAbs.msg.anexo.url === up.corpo.url,
      'url absoluta normalizada para relativa: ' + (chatAbs.msg.anexo && chatAbs.msg.anexo.url));

    /* anexo de sitio externo NUNCA passa - viraria phishing na conversa */
    A.enviar({ tipo: 'chat', texto: 'link de fora', anexo: {
      nome: 'virus.png', url: 'https://evil.example.com/virus.png', tipo: 'image/png', tamanho: 9 } });
    const chatFora = await C.esperar('chat');
    conf(chatFora.msg.texto === 'link de fora' && !chatFora.msg.anexo,
      'anexo de sitio externo foi recusado (mensagem passou sem ele)');

    /* mensagem so de anexo, sem texto nenhum, e aceita */
    A.enviar({ tipo: 'chat', texto: '', anexo: {
      nome: 'so-imagem.png', url: up.corpo.url, tipo: 'image/png', tamanho: foto.length } });
    const chatSoAnexo = await C.esperar('chat');
    conf(!!chatSoAnexo.msg.anexo && chatSoAnexo.msg.texto === '',
      'mensagem SO com anexo (sem texto) passou pelo servidor');

    /* conversa individual tambem leva anexo */
    A.enviar({ tipo: 'privado', para: idDeC, texto: '', anexo: {
      nome: 'doc.pdf', url: up.corpo.url, tipo: 'application/pdf', tamanho: 40 } });
    const privAnexo = await C.esperar('privado');
    conf(!!privAnexo.msg.anexo && privAnexo.msg.anexo.nome === 'doc.pdf',
      'conversa individual com anexo repassada');
    conf(A.buffer.every(m => m.tipo !== 'privado'), 'anexo privado nao vaza para terceiros');

    /* mensagem vazia de verdade (sem texto e sem anexo) e descartada */
    const antes = C.buffer.filter(m => m.tipo === 'chat').length;
    A.enviar({ tipo: 'chat', texto: '   ', anexo: { nome: 'x.png', url: 'https://fora.com/x.png' } });
    await new Promise(r => setTimeout(r, 300));
    conf(C.buffer.filter(m => m.tipo === 'chat').length === antes,
      'mensagem vazia (texto em branco + anexo recusado) e descartada');
  }

  const malicioso = await subirArquivo('../../../etc/passwd', foto, 'text/plain');
  conf(!(malicioso.corpo && malicioso.corpo.url && malicioso.corpo.url.includes('..')),
    'nome de arquivo com ".." nao escapa do diretorio');

  const grande = Buffer.alloc(30 * 1024 * 1024, 7);
  const recusado = await subirArquivo('gigante.bin', grande, 'application/octet-stream');
  conf(recusado.status === 413, 'arquivo de 30MB e recusado (limite de 25MB)');

  /* ---------------------------------------------------------------- */
  /* 8b. emoji no nome nunca chega cortado no meio                     */
  /* ---------------------------------------------------------------- */
  /* Um .slice(0,24) cru em 'A' + 30 emojis cai no meio do par de
     surrogates do 12o emoji e o navegador exibiria mojibake.          */

  const semSolto = (s) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF) {
        const p = s.charCodeAt(i + 1);
        if (!(p >= 0xDC00 && p <= 0xDFFF)) return false;
        i++;
      } else if (c >= 0xDC00 && c <= 0xDFFF) return false;
    }
    return true;
  };

  const nomeEsperado = 'A' + '😀'.repeat(11);
  A.enviar({ tipo: 'perfil', nome: 'A' + '😀'.repeat(30) });

  let nomeRecebido = null;
  try {
    const pr = await A.esperarQuando('presenca', m =>
      (m.participantes || []).some(p => p.id === sala.meuId &&
        (p.nome || '') !== 'Ana' && (p.nome || '').length > 1), 3000);
    nomeRecebido = (pr.participantes.find(p => p.id === sala.meuId) || {}).nome;
  } catch (_e) { nomeRecebido = null; }

  conf(nomeRecebido === nomeEsperado,
    'nome com 30 emojis cortado sem deixar meio emoji: ' + JSON.stringify(nomeRecebido));
  conf(!!nomeRecebido && semSolto(nomeRecebido), 'nenhum surrogate solto no nome recebido');

  A.enviar({ tipo: 'perfil', nome: 'Ana' });
  await new Promise(r => setTimeout(r, 250));

  /* ---------------------------------------------------------------- */
  /* 9. autenticacao                                                   */
  /* ---------------------------------------------------------------- */

  const emailTeste = 'leal' + Date.now() + '@nexo.app';

  const cadastro = await httpJson('/api/conta/cadastrar', {
    nome: 'lealpoh', email: emailTeste, senha: 'segredo123'
  });
  conf(cadastro.status === 200 && cadastro.corpo.token, 'cadastro criou conta e devolveu token');
  conf(cadastro.corpo.usuario && cadastro.corpo.usuario.nome === 'lealpoh', 'cadastro devolve o usuario');
  conf(typeof cadastro.corpo.suporte === 'string' && cadastro.corpo.suporte.length > 10,
    'cadastro entrega o codigo de suporte ao dono');

  const login = await httpJson('/api/conta/entrar', { email: emailTeste, senha: 'segredo123' });
  conf(login.status === 200 && !!login.corpo.token, 'login com e-mail e senha funciona');

  const senhaErrada = await httpJson('/api/conta/entrar', { email: emailTeste, senha: 'errada' });
  conf(senhaErrada.status === 401, 'senha errada e recusada');

  const emailRepetido = await httpJson('/api/conta/cadastrar', {
    nome: 'outro', email: emailTeste, senha: 'qualquer123'
  });
  conf(emailRepetido.status === 409, 'e-mail repetido e recusado');

  const nomeRepetido = await httpJson('/api/conta/cadastrar', {
    nome: 'lealpoh', email: 'outro' + Date.now() + '@nexo.app', senha: 'qualquer123'
  });
  conf(nomeRepetido.status === 409, 'nome de usuario repetido e recusado');

  const senhaFraca = await httpJson('/api/conta/cadastrar', {
    nome: 'fraco', email: 'fraco@nexo.app', senha: '123'
  });
  conf(senhaFraca.status === 400, 'senha fraca e recusada no cadastro');

  // recuperacao por codigo enviado por e-mail
  const rec = await httpJson('/api/conta/esqueci', { email: emailTeste });
  conf(rec.status === 200, 'pedido de recuperacao aceito');
  conf(rec.corpo && typeof rec.corpo.codigo === 'string',
    'codigo de recuperacao disponivel (e-mail ou suporte)');

  const troca = await httpJson('/api/conta/redefinir', {
    email: emailTeste, codigo: rec.corpo.codigo, senha: 'novasenha456'
  });
  conf(troca.status === 200, 'codigo aceito e senha trocada');

  const loginNovo = await httpJson('/api/conta/entrar', { email: emailTeste, senha: 'novasenha456' });
  conf(loginNovo.status === 200, 'nova senha funciona no login');

  const codigoReusado = await httpJson('/api/conta/redefinir', {
    email: emailTeste, codigo: rec.corpo.codigo, senha: 'outra12345'
  });
  conf(codigoReusado.status === 400, 'codigo de recuperacao nao pode ser reusado');

  await httpJson('/api/conta/esqueci', { email: emailTeste });
  const trocaErrada = await httpJson('/api/conta/redefinir', {
    email: emailTeste, codigo: '000000', senha: 'qualquer123'
  });
  conf(trocaErrada.status === 400, 'codigo errado nao troca a senha');

  const sessao = await httpJson('/api/conta/sessao', {}, loginNovo.corpo.token);
  conf(sessao.status === 200 && sessao.corpo.usuario.nome === 'lealpoh', 'token devolve a sessao');

  const sessaoInvalida = await httpJson('/api/conta/sessao', {}, 'token-falso');
  conf(sessaoInvalida.status === 401, 'token falsificado e recusado');

  // recuperacao pelo codigo de suporte (caminho de atendimento)
  const semSessao = await httpJson('/api/conta/suporte', { email: emailTeste, senha: 'novasenha456' });
  conf(semSessao.status === 403, 'codigo de suporte so aparece para o dono logado');

  const verSuporte = await httpJson('/api/conta/suporte',
    { email: emailTeste, senha: 'novasenha456' }, loginNovo.corpo.token);
  conf(verSuporte.status === 200 && typeof verSuporte.corpo.suporte === 'string',
    'dono logado relendo o proprio codigo de suporte');

  const senhaErradaSuporte = await httpJson('/api/conta/suporte',
    { email: emailTeste, senha: 'errada' }, loginNovo.corpo.token);
  conf(senhaErradaSuporte.status === 401, 'sem senha atual atual nao revela o codigo');

  const trocaSuporte = await httpJson('/api/conta/redefinir-suporte', {
    email: emailTeste, suporte: verSuporte.corpo.suporte, senha: 'poresuporte1'
  });
  conf(trocaSuporte.status === 200, 'codigo de suporte troca a senha sem e-mail');

  const loginSuporte = await httpJson('/api/conta/entrar', { email: emailTeste, senha: 'poresuporte1' });
  conf(loginSuporte.status === 200, 'senha trocada por suporte funciona no login');

  const suporteErrado = await httpJson('/api/conta/redefinir-suporte', {
    email: emailTeste, suporte: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', senha: 'qualquer123'
  });
  conf(suporteErrado.status === 400, 'codigo de suporte errado nao troca a senha');

  /* ---------------------------------------------------------------- */
  /* 10. versao (para os clientes avisarem de atualizacao)             */
  /* ---------------------------------------------------------------- */

  const versao = await httpJson('/api/versao');
  conf(versao.status === 200 && typeof versao.corpo.versao === 'string',
    'servidor publica a versao atual');
  conf(Array.isArray(versao.corpo.novidades) && versao.corpo.novidades.length > 0,
    'servidor publica a lista de novidades');

  /* ---------------------------------------------------------------- */
  /* 10b. convite: o endereco que outro computador precisa marcar      */
  /* ---------------------------------------------------------------- */

  const convite = await httpJson('/api/convite');
  conf(convite.status === 200 && typeof convite.corpo.ip === 'string' && convite.corpo.ip,
    'servidor devolve o endereco para o convite');
  conf(/^\d{1,3}(\.\d{1,3}){3}$/.test(convite.corpo.ip || ''),
    'endereco do convite parece um ip valido: ' + convite.corpo.ip);
  conf(Number(convite.corpo.porta) > 0 && Number(convite.corpo.porta) <= 65535,
    'convite traz a porta certa: ' + convite.corpo.porta);

  /* ---------------------------------------------------------------- */
  /* 10c. /arquivos/ apontando pra DIRETORIO nao pode derrubar o server */
  /* ---------------------------------------------------------------- */

  /* Regressão: antes, pedir a pasta fazia createReadStream sobre um
     diretório, o stream soltava EISDIR sem tratamento e o processo MORRIA.
     Um único acesso a /arquivos/ derrubava o Nexo inteiro. */
  const p1 = await httpTexto('/arquivos/');
  conf(p1.status === 404, '/arquivos/ (pasta vazia) devolve 404, nao derruba: ' + p1.status);
  const p2 = await httpTexto('/arquivos/.');
  conf(p2.status === 404, '/arquivos/. devolve 404: ' + p2.status);
  const p3 = await httpTexto('/arquivos/subpasta/');
  conf(p3.status === 404, '/arquivos/subpasta/ devolve 404: ' + p3.status);

  /* o servidor precisa ter sobrevivido a todos os tres */
  const vivo = await httpTexto('/health');
  conf(vivo.status === 200, 'servidor continua de pe apos pedir pastas: ' + vivo.status);

  /* e o arquivo enviado la em cima ainda precisa ser servido normalmente */
  const deVolta = await httpTexto(up.corpo.url);
  conf(deVolta.status === 200, 'arquivo enviado ainda e servido: ' + up.corpo.url + ' -> ' + deVolta.status);

  /* ---------------------------------------------------------------- */
  /* 11. sala vazia some                                               */
  /* ---------------------------------------------------------------- */

  A.close();
  C.close();
  E.close();
  await new Promise(r => setTimeout(r, 500));
  const final = await httpJson('/api/salas/' + sala.codigo);
  conf(final.status === 404, 'sala vazia foi apagada do servidor');

  console.log('\n---------------------------------------');
  console.log(falhas.length ? falhas.length + ' FALHA(S)' : 'Todos os testes passaram!');
  console.log('---------------------------------------\n');
  encerrarServidor();
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => {
  console.error('\nERRO NO TESTE:', e.message);
  encerrarServidor();
  process.exit(1);
});
