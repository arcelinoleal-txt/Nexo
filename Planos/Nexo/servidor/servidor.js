'use strict';

/**
 * Nexo - servidor de salas
 * -----------------------------------------------------------------
 *  1. Sinalizacao WebRTC (oferta / resposta / ICE) em malha entre todos
 *  2. Chat, lista de participantes, perfil e estado de midia
 *  3. Serve a interface para quem quiser abrir pelo navegador
 *
 * Rodar local:   npm run servidor
 * Online:        soba em qualquer hospedagem Node (Render, VPS) com a variavel PORT
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const contas = require('./contas');

const PORTA = Number(process.env.PORT || process.env.NEXO_PORTA || 3000);
const DIR_APP = path.join(__dirname, '..', 'app');
const MAX_HISTORICO = 60;
const MAX_TEXTO = 600;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* ------------------------------------------------------------------ */
/* Servidor HTTP                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* HTTP: API de contas, upload de arquivos e a interface               */
/* ------------------------------------------------------------------ */

/* Diretórios graváveis. Em desenvolvimento ficam ao lado do código; no app
   empacotado o .asar é somente leitura, então o main.js aponta
   NEXO_DIR_DADOS para a pasta de dados do usuário antes de subir tudo.
   No Railway o mesmo mecanismo recebe o volume persistente: se existir a
   variável NEXO_DIR_DADOS apontando para o volume montado, os arquivos
   enviados sobrevivem aos deploys; senão valem o padrão (efêmero). */
const DIR_DADOS = process.env.NEXO_DIR_DADOS || __dirname;
const DIR_ARQUIVOS = path.join(DIR_DADOS, 'arquivos');
const MAX_ARQUIVO = Number(process.env.NEXO_MAX_ARQUIVO) || 25 * 1024 * 1024; // 25MB padrão

if (!fs.existsSync(DIR_ARQUIVOS)) fs.mkdirSync(DIR_ARQUIVOS, { recursive: true });

/* Endereço que um outro computador da rede vai conseguir alcançar.
   Quem cria a sala manda esse endereço junto com o código, para a outra
   pessoa colar uma única vez e já cair na sala certa — sem precisar
   mexer em Configuração nem digitar IP na mão. */
function ipLocal() {
  const interfaces = os.networkInterfaces();
  const candidatos = [];
  for (const nome of Object.keys(interfaces)) {
    for (const e of interfaces[nome] || []) {
      if (e.family !== 'IPv4' && e.family !== 4) continue;
      if (e.internal) continue;
      candidatos.push(e.address);
    }
  }
  if (!candidatos.length) return '127.0.0.1';
  // Prefere as faixas caseiras (192.168.x, 10.x), depois o resto.
  const ordenados = candidatos.slice().sort((a, b) => peso(b) - peso(a));
  function peso(ip) {
    if (/^192\.168\./.test(ip)) return 3;
    if (/^10\./.test(ip)) return 2;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    return 1;
  }
  return ordenados[0];
}

/** e-mail: se houver SMTP configurado usa ele; senão registra no console.
 *  É o modo desenvolvimento — e por isso o código também volta na resposta. */
function enviarEmail(para, assunto, texto) {
  if (!process.env.NEXO_SMTP_HOST) {
    console.log('-------------------------------------------------------');
    console.log('  [nexo] E-MAIL NÃO CONFIGURADO — modo desenvolvimento');
    console.log(`  Para: ${para}`);
    console.log(`  Assunto: ${assunto}`);
    console.log(`  ${texto}`);
    console.log('-------------------------------------------------------');
    return false; // devolve o código na resposta
  }
  // Com SMTP configurado, o código NUNCA volta na resposta.
  try {
    const nodemailer = require('nodemailer');
    const transporte = nodemailer.createTransport({
      host: process.env.NEXO_SMTP_HOST,
      port: Number(process.env.NEXO_SMTP_PORT || 587),
      secure: process.env.NEXO_SMTP_PORT === '465',
      auth: process.env.NEXO_SMTP_USER
        ? { user: process.env.NEXO_SMTP_USER, pass: process.env.NEXO_SMTP_PASS }
        : undefined
    });
    transporte.sendMail({
      from: process.env.NEXO_EMAIL_DE || 'Nexo <nao-responda@nexo.app>',
      to: para, subject: assunto, text: texto
    }).catch(e => console.warn('[nexo] falha ao enviar e-mail:', e.message));
  } catch {
    console.warn('[nexo] nodemailer não instalado; código só no console.');
  }
  return true;
}

function responder(res, status, corpo) {
  const dados = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(dados);
}

function lerCorpo(req, limite) {
  return new Promise((resolve, reject) => {
    const pedacos = [];
    let total = 0;
    let grande = false;
    req.on('data', (c) => {
      total += c.length;
      if (total > limite) { grande = true; return; } // so descarta, segue lendo
      pedacos.push(c);
    });
    // So rejeita no fim: assim o 413 consegue ser entregue antes da
    // conexao cair, em vez de virar um ECONNRESET mudo.
    req.on('end', () => {
      if (grande) reject(Object.assign(new Error('muito grande'), { codigo: 413 }));
      else resolve(Buffer.concat(pedacos));
    });
    req.on('error', reject);
  });
}

async function lerJson(req) {
  const bruto = await lerCorpo(req, 64 * 1024);
  try { return JSON.parse(bruto.toString('utf8') || '{}'); }
  catch { return {}; }
}

function tokenDe(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/** remove qualquer caminho e deixa só um nome de arquivo seguro */
function nomeSeguro(nome) {
  const base = path.basename(String(nome || 'arquivo')).replace(/[^\w.\- ]+/g, '_');
  return (base || 'arquivo').slice(0, 120);
}

const servidor = http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const consulta = new URL(req.url || '/', 'http://local').searchParams;

  try {
    /* ------------------------------ contas ------------------------------ */

    if (url === '/api/conta/cadastrar' && req.method === 'POST') {
      const b = await lerJson(req);
      const r = contas.cadastrar(b);
      if (r.erro) return responder(res, r.status, { erro: r.erro });

      if (r.token) {
        // devolve o código de suporte uma única vez, no cadastro
        responder(res, 200, { token: r.token, usuario: contas.publico(r.usuario), suporte: r.usuario.suporte });
      } else {
        responder(res, r.status, { erro: r.erro });
      }
      return;
    }

    if (url === '/api/conta/entrar' && req.method === 'POST') {
      const b = await lerJson(req);
      const r = contas.entrar(b);
      if (r.erro) return responder(res, r.status, { erro: r.erro });
      return responder(res, 200, { token: r.token, usuario: contas.publico(r.usuario) });
    }

    if (url === '/api/conta/sessao') {
      const u = contas.usuarioDoToken(tokenDe(req));
      if (!u) return responder(res, 401, { erro: 'Sessão expirada.' });
      return responder(res, 200, { usuario: contas.publico(u) });
    }

    if (url === '/api/conta/esqueci' && req.method === 'POST') {
      const b = await lerJson(req);
      const u = contas.porEmail(b.email);
      // resposta igual nos dois casos, para não revelar quem tem conta
      if (!u) return responder(res, 200, { ok: true });

      const codigo = contas.gerarRecuperacao(u);
      const enviou = enviarEmail(
        u.email,
        'Seu código de recuperação do Nexo',
        `Olá ${u.nome}.\n\nSeu código de recuperação é: ${codigo}\n\n` +
        `Ele expira em 20 minutos. Se você não pediu isso, ignore.\n\n` +
        `Não conseguiu acessar o e-mail? Abra o Nexo e use o ` +
        `código de recuperação da sua conta, na tela de login.`
      );

      // só devolve o código quando não há e-mail configurado (dev)
      return responder(res, 200, enviou ? { ok: true } : { ok: true, codigo });
    }

    if (url === '/api/conta/redefinir' && req.method === 'POST') {
      const b = await lerJson(req);
      const r = contas.redefinir(b);
      if (r.erro) return responder(res, r.status, { erro: r.erro });
      return responder(res, 200, { token: r.token, usuario: contas.publico(r.usuario) });
    }

    if (url === '/api/conta/suporte' && req.method === 'POST') {
      const b = await lerJson(req);
      const u = contas.porEmail(b.email);
      // mesma mensagem em tudo: não revela quem tem conta
      if (!u) return responder(res, 404, { erro: 'Conta não encontrada.' });
      const sessao = contas.usuarioDoToken(tokenDe(req));
      if (!sessao || sessao.id !== u.id) {
        return responder(res, 403, { erro: 'Entre na conta para ver seu código de recuperação.' });
      }
      const r = contas.mostrarSuporte(u, b.senha);
      if (r.erro) return responder(res, r.status, { erro: r.erro });
      return responder(res, 200, { suporte: r.suporte });
    }

    if (url === '/api/conta/redefinir-suporte' && req.method === 'POST') {
      const b = await lerJson(req);
      const r = contas.redefinirComSuporte(b);
      if (r.erro) return responder(res, r.status, { erro: r.erro });
      return responder(res, 200, { token: r.token, usuario: contas.publico(r.usuario) });
    }

    /* ------------------------------ salas ------------------------------ */

    const mSala = url.match(/^\/api\/salas\/([A-Z0-9]{6})$/);
    if (mSala) {
      const sala = salas.get(mSala[1]);
      if (!sala) return responder(res, 404, { erro: 'Sala não encontrada.' });
      return responder(res, 200, {
        codigo: sala.codigo,
        pessoas: sala.pessoas.size,
        criadaEm: sala.criadaEm,
        mensagens: sala.historico.length
      });
    }

    /* ----------------------------- versao ---------------------------- */
    /* O "app base" edita versao.json e publica aqui. Quem tem o app
       instalado pergunta periodicamente e, se tiver mais novo, mostra
       o aviso no sininho com a lista do que mudou. */

    if (url === '/api/versao') {
      let dados = { versao: '0.0.0', novidades: [], atualizadoEm: null };
      try {
        const bruto = fs.readFileSync(path.join(__dirname, '..', 'versao.json'), 'utf8');
        const lido = JSON.parse(bruto);
        if (lido && typeof lido.versao === 'string') dados = lido;
      } catch { /* sem versao.json: devolve a padrao */ }
      return responder(res, 200, {
        versao: dados.versao,
        novidades: Array.isArray(dados.novidades) ? dados.novidades : [],
        atualizadoEm: dados.atualizadoEm || null,
        download: typeof dados.download === 'string' ? dados.download : null
      });
    }

    // Convite da sala: o endereço que outro computador precisa marcar.
    // Em produção (Railway, etc), defina NEXO_PUBLIC_URL=https://seu-app.up.railway.app
    if (url === '/api/convite') {
      const publicUrl = process.env.NEXO_PUBLIC_URL;
      if (publicUrl) {
        // Extrai host e porta da URL pública
        try {
          const u = new URL(publicUrl);
          return responder(res, 200, { 
            ip: u.hostname, 
            porta: u.port || (u.protocol === 'https:' ? 443 : 80),
            protocolo: u.protocol === 'https:' ? 'wss' : 'ws'
          });
        } catch {
          // URL inválida, cai para ipLocal
        }
      }
      return responder(res, 200, { ip: ipLocal(), porta: PORTA });
    }

    /* ---------------------------- health check -------------------------- */
    if (url === '/health') {
      return responder(res, 200, { 
        status: 'ok', 
        timestamp: Date.now(),
        uptime: process.uptime(),
        salas: salas.size,
        conexoes: wss.clients.size
      });
    }

    /* --------------------------- quem é gente ------------------------- */
    /* Busca por nome da aba "Adicionar amigo". Devolve SÓ o que já é
       público num perfil: id, nome, avatar e cor. Nunca e-mail, senha,
       token ou código de suporte. Exige 2 letras — menos que isso viraria
       um listão de todo mundo que tem conta no servidor. */
    if (url === '/api/pessoas') {
      const q = String(consulta.get('q') || '').trim();
      const pessoas = contas.procurar(q).map((u) => ({
        id: u.id,
        nome: u.nome,
        avatar: u.avatar || '',
        cor: u.cor || 0
      }));
      return responder(res, 200, { pessoas });
    }

    /* ---------------------------- amizades ---------------------------- */
    /* Todas exigem usuário logado (token no header Authorization). */

    const token = tokenDe(req);
    const usuario = token ? contas.usuarioDoToken(token) : null;
    if (!usuario) return responder(res, 401, { erro: 'Não autenticado.' });

    /* GET /api/amigos  -> { amigos: [...], pedidos: [...] } */
    if (url === '/api/amigos' && req.method === 'GET') {
      const r = contas.listarAmizades(usuario.id);
      if (r.erro) return responder(res, r.status || 400, { erro: r.erro });
      return responder(res, 200, r);
    }

    /* POST /api/amigos/pedir  { amigoId } -> envia pedido */
    if (url === '/api/amigos/pedir' && req.method === 'POST') {
      const corpo = await lerJson(req);
      const r = contas.pedirAmizade(usuario.id, corpo?.amigoId);
      if (r.erro) return responder(res, r.status || 400, { erro: r.erro });
      return responder(res, 200, r);
    }

    /* POST /api/amigos/aceitar  { amigoId } -> aceita pedido */
    if (url === '/api/amigos/aceitar' && req.method === 'POST') {
      const corpo = await lerJson(req);
      const r = contas.aceitarAmizade(usuario.id, corpo?.amigoId);
      if (r.erro) return responder(res, r.status || 400, { erro: r.erro });
      return responder(res, 200, r);
    }

    /* POST /api/amigos/recusar  { amigoId } -> recusa/cancela pedido */
    if (url === '/api/amigos/recusar' && req.method === 'POST') {
      const corpo = await lerJson(req);
      const r = contas.recusarAmizade(usuario.id, corpo?.amigoId);
      if (r.erro) return responder(res, r.status || 400, { erro: r.erro });
      return responder(res, 200, r);
    }

    /* POST /api/amigos/remover  { amigoId } -> remove amizade */
    if (url === '/api/amigos/remover' && req.method === 'POST') {
      const corpo = await lerJson(req);
      const r = contas.removerAmigo(usuario.id, corpo?.amigoId);
      if (r.erro) return responder(res, r.status || 400, { erro: r.erro });
      return responder(res, 200, r);
    }

    /* ----------------------------- upload ----------------------------- */

    if (url === '/api/upload' && req.method === 'POST') {
      const nome = nomeSeguro(consulta.get('nome'));
      let corpo;
      try {
        corpo = await lerCorpo(req, MAX_ARQUIVO);
      } catch (e) {
        return responder(res, e.codigo === 413 ? 413 : 400, { erro: 'Arquivo acima do limite de 25MB.' });
      }
      if (!corpo || !corpo.length) return responder(res, 400, { erro: 'Arquivo vazio.' });

      const id = crypto.randomBytes(9).toString('hex');
      const destino = path.join(DIR_ARQUIVOS, id + '-' + nome);
      fs.writeFileSync(destino, corpo);

      return responder(res, 200, {
        url: '/arquivos/' + id + '-' + encodeURIComponent(nome),
        nome,
        tamanho: corpo.length,
        tipo: req.headers['content-type'] || 'application/octet-stream'
      });
    }

    if (url.startsWith('/arquivos/')) {
      const nome = path.basename(url.slice('/arquivos/'.length));
      const alvo = path.join(DIR_ARQUIVOS, nome);
      if (!alvo.startsWith(DIR_ARQUIVOS) || !fs.existsSync(alvo)) {
        res.writeHead(404); res.end('Nao encontrado'); return;
      }
      const ext = path.extname(nome).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Disposition': 'inline; filename="' + encodeURIComponent(nome) + '"',
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(alvo).pipe(res);
      return;
    }

    /* --------------------------- interface ---------------------------- */

    // O navegador insiste em pedir /favicon.ico sozinho, e esse arquivo não
    // existe. Sem este aviso, a regra "caminho sem extensão vira index.html"
    // devolveria HTML no lugar de uma imagem. Mas o favicon.svg do app EXISTE
    // e tem que ser servido — por isso só corto quando o arquivo não está lá.
    if (req.url && req.url.includes('favicon')) {
      const fav = path.normalize(path.join(DIR_APP, url));
      if (!fs.existsSync(fav)) { res.writeHead(404); res.end(); return; }
    }

    let caminho = path.normalize(path.join(DIR_APP, url));
    if (!caminho.startsWith(DIR_APP)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Proibido');
      return;
    }
    if (url === '/' || !path.extname(caminho)) caminho = path.join(DIR_APP, 'index.html');

    fs.readFile(caminho, (erro, dados) => {
      if (erro) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Nao encontrado');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(caminho).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(dados);
    });
  } catch (erro) {
    console.error('[nexo] erro no http:', erro);
    responder(res, 500, { erro: 'Erro interno.' });
  }
});

/* ------------------------------------------------------------------ */
/* Salas                                                               */
/* ------------------------------------------------------------------ */

const salas = new Map();

function gerarCodigo() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1
  let codigo;
  do {
    codigo = Array.from({ length: 6 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
  } while (salas.has(codigo));
  return codigo;
}

function enviar(alvo, msg) {
  if (alvo && alvo.readyState === alvo.OPEN) alvo.send(JSON.stringify(msg));
}

function clientes(sala) { return Array.from(sala.pessoas); }

function paraTodos(sala, msg, exceto) {
  for (const ws of sala.pessoas) if (ws !== exceto) enviar(ws, msg);
}

function perfilDe(ws) {
  return {
    id: ws.id,
    nome: ws.nome,
    avatar: ws.avatar,
    cor: ws.cor,
    tela: ws.tela || null,      // id da MediaStream da tela
    camera: ws.camera || null,  // id da MediaStream da camera
    micro: !!ws.micro,
    mudo: !!ws.mudo,
    conectadoEm: ws.conectadoEm
  };
}

function participantes(sala) { return clientes(sala).map(perfilDe); }

function anunciarPresenca(sala) {
  paraTodos(sala, { tipo: 'presenca', participantes: participantes(sala) });
}

function sistema(sala, texto) {
  paraTodos(sala, { tipo: 'sistema', texto, hora: Date.now() });
}

function alvoNaSala(de, paraId) {
  const sala = de.sala ? salas.get(de.sala) : null;
  if (!sala) return null;
  return clientes(sala).find(c => c.id === paraId && c !== de) || null;
}

function sairDaSala(ws) {
  const sala = ws.sala ? salas.get(ws.sala) : null;
  ws.sala = null;
  if (!sala) return;

  const era = sala.pessoas.delete(ws);
  if (!era) return;

  if (sala.pessoas.size === 0) {
    salas.delete(sala.codigo);
    return;
  }

  paraTodos(sala, { tipo: 'participante-saiu', id: ws.id });
  sistema(sala, `${ws.nome} saiu da sala`);
  anunciarPresenca(sala);
}

/* O avatar é uma de duas coisas: um emoji curto (o caso antigo) ou a foto
   que a pessoa escolheu, colada em base64 (data:image/...). Cortamos no
   limite de cada caso — cortar tudo em 8 caracteres apagava a foto. */
function normalizarAvatar(valor) {
  const s = String(valor || '').trim();
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(s)) return s.slice(0, 140000);
  return cortar(s, 8);
}

/* Corta texto sem deixar meio emoji. Um .slice() cru pode separar o par de
   surrogates de um emoji e o pedaço solto chega ao navegador como mojibake. */
function cortar(s, n) {
  const t = String(s || '');
  if (t.length <= n) return t;
  let c = t.slice(0, n);
  const ultimo = c.charCodeAt(c.length - 1);
  if (ultimo >= 0xD800 && ultimo <= 0xDBFF) c = c.slice(0, -1);
  return c;
}

/* Anexo de mensagem: so campos conhecidos passam, cada um com teto.
   Devolve undefined quando nao ha nada util - o chamador apaga a chave. */
function anexoSeguro(bruto) {
  if (!bruto || typeof bruto !== 'object') return undefined;
  const a = {
    nome: String(bruto.nome || '').slice(0, 120),
    url: String(bruto.url || '').slice(0, 400),
    tipo: String(bruto.tipo || '').slice(0, 100),
    tamanho: Math.max(0, Math.min(25 * 1024 * 1024, Number(bruto.tamanho) || 0))
  };
  // Guarda SEMPRE o caminho relativo: tira o dominio se vier absoluto e
  // so aceita se sobrar um /arquivos/ nosso. Assim nenhuma mensagem consegue
  // apontar uma imagem para sitio externo (phishing/espião).
  const caminho = a.url.replace(/^https?:\/\/[^/]+/i, '');
  if (!/^\/arquivos\//.test(caminho)) return undefined;
  a.url = caminho;
  return a;
}

function entrar(ws, sala, nome, avatar, cor) {
  ws.sala = sala.codigo;
  ws.nome = cortar(String(nome || 'Anonimo').trim(), 24) || 'Anonimo';
  ws.avatar = normalizarAvatar(avatar);
  ws.cor = Math.max(0, Math.min(360, Number(cor) || 0));
  ws.tela = null;
  ws.camera = null;
  ws.micro = false;
  ws.mudo = false;
  ws.conectadoEm = Date.now();
  sala.pessoas.add(ws);
}

/* ------------------------------------------------------------------ */
/* WebSocket                                                           */
/* ------------------------------------------------------------------ */

const wss = new WebSocketServer({ server: servidor });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.id = crypto.randomUUID();
  ws.nome = 'Anonimo';
  ws.avatar = '';
  ws.cor = 0;
  ws.sala = null;
  ws.tela = null;
  ws.camera = null;
  ws.micro = false;
  ws.mudo = false;

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => {});
  ws.on('close', () => sairDaSala(ws));

  ws.on('message', (bruto) => {
    let msg;
    try { msg = JSON.parse(bruto.toString()); } catch { return; }
    if (!msg || typeof msg.tipo !== 'string') return;
    try {
      processar(ws, msg);
    } catch (erro) {
      console.error('[nexo] erro ao processar:', erro);
      enviar(ws, { tipo: 'erro', texto: 'Ocorreu um erro no servidor.' });
    }
  });
});

function processar(ws, msg) {
  switch (msg.tipo) {

    case 'criar': {
      sairDaSala(ws);
      const codigo = gerarCodigo();
      const sala = { codigo, pessoas: new Set(), historico: [], criadaEm: Date.now() };
      salas.set(codigo, sala);
      entrar(ws, sala, msg.nome, msg.avatar, msg.cor);

      enviar(ws, {
        tipo: 'entrou-sala',
        codigo,
        meuId: ws.id,
        participantes: participantes(sala),
        historico: sala.historico
      });
      anunciarPresenca(sala);
      break;
    }

    case 'entrar': {
      const codigo = String(msg.codigo || '').trim().toUpperCase();
      const sala = salas.get(codigo);
      if (!sala) {
        enviar(ws, { tipo: 'erro', texto: 'Sala nao encontrada. Confira o codigo.' });
        return;
      }
      sairDaSala(ws);
      entrar(ws, sala, msg.nome, msg.avatar, msg.cor);

      enviar(ws, {
        tipo: 'entrou-sala',
        codigo,
        meuId: ws.id,
        participantes: participantes(sala),
        historico: sala.historico
      });
      sistema(sala, `${ws.nome} entrou na sala`);
      anunciarPresenca(sala);
      break;
    }

    case 'perfil': {
      if (msg.nome !== undefined) ws.nome = cortar(String(msg.nome).trim(), 24) || ws.nome;
      if (msg.avatar !== undefined) ws.avatar = normalizarAvatar(msg.avatar);
      if (msg.cor !== undefined) ws.cor = Math.max(0, Math.min(360, Number(msg.cor) || 0));
      const sala = salas.get(ws.sala);
      if (sala) anunciarPresenca(sala);
      enviar(ws, { tipo: 'perfil-ok' });
      break;
    }

    // estado de midia (transmitindo tela? camera ligada? com micro?)
    case 'estado': {
      if ('tela' in msg) ws.tela = msg.tela ? String(msg.tela).slice(0, 64) : null;
      if ('camera' in msg) ws.camera = msg.camera ? String(msg.camera).slice(0, 64) : null;
      if ('micro' in msg) ws.micro = !!msg.micro;
      if ('mudo' in msg) ws.mudo = !!msg.mudo;
      const sala = salas.get(ws.sala);
      if (sala) anunciarPresenca(sala);
      break;
    }

    case 'oferta':
    case 'resposta':
    case 'ice': {
      const destino = alvoNaSala(ws, msg.para);
      if (!destino) return;
      enviar(destino, { tipo: msg.tipo, de: ws.id, sdp: msg.sdp, candidate: msg.candidate });
      break;
    }

    case 'chat': {
      const sala = salas.get(ws.sala);
      if (!sala) return;
      const texto = String(msg.texto || '').trim().slice(0, MAX_TEXTO);
      const anexo = anexoSeguro(msg.anexo);
      // Aceita texto, anexo ou os dois — so recusa a mensagem vazia de verdade.
      if (!texto && !anexo) return;

      const item = { de: ws.id, nome: ws.nome, avatar: ws.avatar, cor: ws.cor, texto, hora: Date.now() };
      if (anexo) item.anexo = anexo;

      sala.historico.push(item);
      if (sala.historico.length > MAX_HISTORICO) sala.historico.shift();

      paraTodos(sala, { tipo: 'chat', msg: item });
      break;
    }

    /* Conversa individual: vai so pra quem foi enderecada.
       O historico privado fica num balde separado do chat da sala,
       entao quem entra depois nunca desvia as conversas dos outros. */
    case 'privado': {
      const sala = salas.get(ws.sala);
      if (!sala) return;
      const destino = alvoNaSala(ws, msg.para);
      if (!destino) return;
      const texto = String(msg.texto || '').trim().slice(0, MAX_TEXTO);
      const anexo = anexoSeguro(msg.anexo);
      if (!texto && !anexo) return;

      const item = {
        de: ws.id, para: destino.id,
        nome: ws.nome, avatar: ws.avatar, cor: ws.cor,
        texto, hora: Date.now()
      };
      if (anexo) item.anexo = anexo;

      if (!sala.privado) sala.privado = [];
      sala.privado.push(item);
      if (sala.privado.length > MAX_HISTORICO * 4) sala.privado.shift();

      enviar(destino, { tipo: 'privado', msg: item });
      break;
    }

    /* Devolve a conversa individual entre eu e outra pessoa.
       So devolve se eu fizer parte do par - nunca a conversa dos outros. */
    case 'historico-privado': {
      const sala = salas.get(ws.sala);
      if (!sala) return;
      const outro = alvoNaSala(ws, msg.para);
      if (!outro) return;
      const par = [ws.id, outro.id].sort().join('|');
      const filtrado = (sala.privado || []).filter(m => {
        const doPar = [m.de, m.para].sort().join('|');
        return doPar === par;
      });
      enviar(ws, { tipo: 'historico-privado', com: outro.id, mensagens: filtrado });
      break;
    }

    case 'sair':
      sairDaSala(ws);
      break;

    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Limpeza de conexoes mortas                                          */
/* ------------------------------------------------------------------ */

const batida = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => clearInterval(batida));

servidor.listen(PORTA, '0.0.0.0', () => {
  // Onde os anexos ficam salvos é a diferença entre um deploy e o próximo:
  // com NEXO_DIR_DADOS num volume do Railway os arquivos sobrevivem; sem
  // volume (ou em dev) o diretório é efêmero e some no próximo start. Deixar
  // isso no log evita ficar caçando por que a imagem do primo não abre.
  const persistente = !!process.env.NEXO_DIR_DADOS;
  console.log('-------------------------------------------------------');
  console.log('  Nexo servidor online');
  console.log(`  Interface : http://localhost:${PORTA}`);
  console.log(`  WebSocket : ws://localhost:${PORTA}`);
  console.log(`  Arquivos  : ${DIR_ARQUIVOS}  (${persistente ? 'pasta configurada' : 'efêmero - some ao reiniciar'})`);
  console.log('-------------------------------------------------------');
});
