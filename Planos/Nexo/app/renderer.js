'use strict';

/* ==================================================================
   Nexo — interface, mídia e WebRTC em malha
   ================================================================== */

const $ = (sel) => document.querySelector(sel);

const DESKTOP = typeof window.nexoDesktop !== 'undefined';
const LIMITE_CONFORTAVEL = 8;

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const EMOJIS = ['😀', '😎', '🤖', '👻', '🔥', '⭐', '🎧', '🎮', '🦊', '🐱', '🐼', '🦉',
  '🚀', '💬', '🎬', '🎯', '🦄', '🌟', '💜', '⚡', '🌈', '🍩', '🧠', '🛠️'];

const CORES = [258, 210, 175, 140, 95, 45, 20, 340, 300, 275, 235, 0];

const estado = {
  ws: null,
  servidor: '',
  meuId: null,
  codigo: null,
  convite: null,
  conectado: false,

  perfil: { nome: '', avatar: '😀', cor: 258 },
  participantes: [],

  // conta: preenchido por carregarSessao(); null = sem sessão nenhuma
  token: null,
  usuario: null,

  // amizades: preenchido por carregarAmizades()
  amigos: [],
  pedidosAmizade: [],

  // mídia local
  streamMicro: null,
  streamTela: null,
  streamCamera: null,
  microLigado: true,
  analisador: null,

  // mídia remota: streamId -> MediaStream / elemento
  streams: new Map(),
  els: new Map(),
  tilesVisiveis: '',

  // WebRTC
  pcs: new Map(),
  filaIce: new Map(),

  // dispositivos / preferências
  disp: { micro: '', fone: '', camera: '' },
  eco: true,
  volume: 100,
  fps: 60,
  resolucao: 0,         // 0 = nativa do monitor, sem rebaixar
  audioSistema: false,
  monitorMicro: false,  // ouvir a si mesmo (padrao: nao - so quem assiste ouve)
  tema: 'meia-noite',

  // conversas
  historico: [],        // chat da sala
  privados: new Map(),  // id -> mensagens de conversa individual
  naoLidas: new Map(),  // id -> quantas não li ainda
  nomes: new Map(),     // id -> nome (guardo mesmo se a pessoa sair)
  conversa: '',         // '' = chat da sala; senao id da outra pessoa
  anexo: null,          // arquivo escolhido, ainda nao enviado
  entrando: false,      // esperando o servidor responder "entrou-sala"
  canal: 'geral',       // canal de texto ativo: 'geral' ou 'arquivos'
  filtroArquivos: 'tudo',
  lembrar: false        // "Lembrar de mim" na tela de entrada
};

/* ------------------------------------------------------------------ */
/* Persistência                                                        */
/* ------------------------------------------------------------------ */

/* Endereço padrão do servidor. Se o app estiver servido por um endereço
   (local ou publicado) ele reaproveita o próprio endereço — é o caso do
   navegador e do servidor local. Quando abre direto do arquivo (desktop ou
   duplo clique no index.html) não há host, então ele já vem apontando para a
   instância publicada no Railway, que atende igual quem está na sua rede e
   quem está do outro lado da internet. Quem rodar um servidor local troca o
   endereço na tela de entrada ou em Configurações. */
const SERVIDOR_PRODUCAO = 'wss://nexo-production-0b47.up.railway.app';

const padraoServidor = location.host
  ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  : SERVIDOR_PRODUCAO;

function carregar(chave, padrao) {
  try {
    const v = localStorage.getItem('nexo.' + chave);
    return v === null ? padrao : JSON.parse(v);
  } catch { return padrao; }
}

function salvar(chave, valor) {
  try { localStorage.setItem('nexo.' + chave, JSON.stringify(valor)); } catch { /* ignora */ }
}

function carregarPreferencias() {
  estado.perfil = Object.assign({ nome: '', avatar: '😀', cor: 258 }, carregar('perfil', {}));
  estado.disp = Object.assign({ micro: '', fone: '', camera: '' }, carregar('disp', {}));
  estado.eco = carregar('eco', true);
  estado.volume = carregar('volume', 100);
  estado.fps = carregar('fps', 60);
  estado.resolucao = carregar('resolucao', 0);
  estado.audioSistema = carregar('audioSistema', false);
  estado.monitorMicro = carregar('monitorMicro', false);
  estado.tema = carregar('tema', 'meia-noite');
  document.body.dataset.tema = estado.tema;
  estado.servidor = carregar('servidor', padraoServidor);
  estado.lembrar = carregar('lembrar', false);
}

/* ------------------------------------------------------------------ */
/* Utilitários de interface                                            */
/* ------------------------------------------------------------------ */

let relogioAviso = null;

function aviso(texto, tipo = '') {
  const el = $('#aviso');
  el.textContent = texto;
  el.className = 'aviso-flutuante ' + tipo;
  el.hidden = false;
  clearTimeout(relogioAviso);
  relogioAviso = setTimeout(() => { el.hidden = true; }, 4500);
}

function horaDe(ms) {
  /* Sempre 24 horas — é o formato do Brasil e o que você pediu. */
  try { return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ''; }
}

function iniciais(nome) {
  const p = String(nome || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
}

function corDe(h) { return `hsl(${h}, 62%, 50%)`; }

function textoSobreFundo(h) {
  // hsl com luminosidade 50% sempre pede texto branco
  return '#fff';
}

function desconectarEstado(texto) {
  const el = $('#estado-conn');
  el.className = 'estado-conn ' + (texto === 'conectado' ? 'on' : texto === 'desconectado' ? 'off' : '');
  const rotulo = texto === 'conectado' ? 'conectado'
    : texto === 'desconectado' ? 'desconectado' : 'conectando…';
  el.innerHTML = '<i class="ponto"></i> ' + rotulo;
}

function definirStatusEntrada(t) { $('#status-entrada').hidden = !t; $('#status-entrada').textContent = t || ''; }
function definirErroEntrada(t) { $('#erro-entrada').hidden = !t; $('#erro-entrada').textContent = t || ''; }

function participante(id) { return estado.participantes.find(p => p.id === id) || null; }
function eu() { return participante(estado.meuId); }

/* ------------------------------------------------------------------ */
/* WebSocket                                                           */
/* ------------------------------------------------------------------ */

function enviar(msg) {
  if (estado.ws && estado.ws.readyState === WebSocket.OPEN) {
    estado.ws.send(JSON.stringify(msg));
  }
}

function abrirConexao(url) {
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(url); } catch { reject(new Error('Endereço de servidor inválido.')); return; }

    let feito = false;
    const limite = setTimeout(() => {
      if (feito) return;
      feito = true;
      try { ws.close(); } catch { /* ignora */ }
      reject(new Error('Tempo esgotado ao conectar no servidor.'));
    }, 9000);

    ws.onopen = () => { if (feito) return; feito = true; clearTimeout(limite); resolve(ws); };
    ws.onerror = () => { if (feito) return; feito = true; clearTimeout(limite); reject(new Error('Não foi possível conectar ao servidor.')); };
    ws.onclose = () => { if (feito) return; feito = true; clearTimeout(limite); reject(new Error('O servidor fechou a conexão.')); };
  });
}

/* ------------------------------------------------------------------ */
/* Convite da sala                                                     */
/* ------------------------------------------------------------------ */
/* Um código de 6 letras só encontra sala dentro do MESMO computador,
   porque o app instalado tem servidor próprio. Para alguém entrar de
   outro PC, o convite carrega o endereço junto:

        ABCDEF@192.168.0.15:3000

   A pessoa cola esse texto inteiro no campo de código e já cai na sala
   certa — sem abrir Configuração nem digitar IP na mão. Sem endereço
   alcançável, volta o código puro e o app segue pelo servidor padrão. */

/** Aceita "ABCDEF", "ABCDEF@ip", "ABCDEF@ip:porta" e "nexo://ABCDEF@ip".
 *  Sobrevive a maiúsculas/minúsculas e a espaços soltos, porque o que vem
 *  de gente colando mensagem costuma vir bagunçado. */
function lerConvite(texto) {
  const t = String(texto || '').trim().toUpperCase();
  const cheio = t.match(/^(?:nexo:)?(?:\/\/)?([A-Z0-9]{6})\s*@\s*(\[[0-9A-F:]+\]|[0-9A-Z._-]+)(?:\s*:\s*(\d{1,5}))?$/i);
  if (cheio) {
    return {
      codigo: cheio[1],
      servidor: 'ws://' + cheio[2] + ':' + (cheio[3] || 3000)
    };
  }
  const soCodigo = t.match(/^([A-Z0-9]{6})$/);
  if (soCodigo) return { codigo: soCodigo[1], servidor: null };
  return null;
}

/** Pergunta ao servidor onde ele está e monta o convite da sala atual. */
async function montarConvite() {
  if (!estado.codigo) return null;
  try {
    const origem = (estado.servidor || padraoServidor).replace(/^ws(s?):/, 'http$1:');
    const r = await fetch(origem + '/api/convite', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!d || !d.ip) throw new Error('servidor sem endereço');
    estado.convite = estado.codigo + '@' + d.ip + ':' + (d.porta || 3000);
  } catch {
    // Sem convite completo o código ainda funciona para quem está no
    // mesmo computador; deixamos o básico e seguimos.
    estado.convite = estado.codigo;
  }
  return estado.convite;
}

async function entrarNaSala(codigo) {
  definirErroEntrada('');
  definirStatusEntrada('Conectando ao servidor…');

  // Fecha a tentativa anterior e desliga os handlers dela. Sem isso um
  // onclose velho podia atirar "a conexão caiu" por cima da tentativa nova.
  if (estado.ws) {
    try {
      estado.ws.onclose = null;
      estado.ws.onerror = null;
      estado.ws.onmessage = null;
      estado.ws.close();
    } catch { /* ignora */ }
    estado.ws = null;
  }

  const servidor = $('#in-servidor').value.trim() || padraoServidor;
  estado.servidor = servidor;
  salvar('servidor', servidor);

  let ws;
  try { ws = await abrirConexao(servidor); }
  catch (erro) {
    definirStatusEntrada('');
    definirErroEntrada(erro.message);
    return;
  }

  estado.ws = ws;
  ws.onmessage = (ev) => { try { processarMensagem(JSON.parse(ev.data)); } catch { /* ignora */ } };
  ws.onclose = desconectado;
  ws.onerror = () => { /* o onclose abaixo cuida do aviso ao usuário */ };

  estado.entrando = true;
  definirStatusEntrada(codigo ? 'Entrando na sala…' : 'Criando sala…');

  enviar(codigo
    ? { tipo: 'entrar', codigo, nome: estado.perfil.nome, avatar: estado.perfil.avatar, cor: estado.perfil.cor }
    : { tipo: 'criar', nome: estado.perfil.nome, avatar: estado.perfil.avatar, cor: estado.perfil.cor });
}

function desconectado() {
  // Caiu no meio da tentativa de abrir sala: sem este ramo o usuário ficaria
  // preso em "Criando sala…" para sempre, sem nenhuma mensagem.
  if (estado.entrando) {
    estado.entrando = false;
    definirStatusEntrada('');
    definirErroEntrada('A conexão com o servidor caiu antes de abrir a sala. Confira o endereço do servidor.');
    return;
  }
  if (!estado.codigo) return;
  limparTudo();
  estado.codigo = null;
  estado.conectado = false;

  $('#tela-sala').hidden = true;
  $('#tela-entrada').hidden = false;
  definirStatusEntrada('');
  definirErroEntrada('A conexão com o servidor caiu. Sua sala foi encerrada.');
}

/* ------------------------------------------------------------------ */
/* Avisos ao usuário                                                   */
/* ------------------------------------------------------------------ */

/* Som de mensagem sintetizado na hora — não precisa de arquivo nenhum
   dentro do pacote e o tom fica do jeito que a gente quer. */
function tocarAvisoDeMensagem() {
  if (!carregar('notaSom', false)) return;
  if (!document.hidden && document.hasFocus()) return;   // já está olhando
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const agora = ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, agora);
      g.gain.exponentialRampToValueAtTime(0.14, agora + 0.02 + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, agora + 0.45 + i * 0.09);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(agora + i * 0.09);
      osc.stop(agora + 0.7 + i * 0.09);
    });
    setTimeout(() => { try { ctx.close(); } catch { /* ignora */ } }, 1200);
  } catch { /* sem áudio: segue sem som */ }
}

/* Acessibilidade: classes no <body> que o CSS responde na hora. */
function aplicarAcessibilidade() {
  const corpo = document.body;
  if (!corpo) return;
  corpo.classList.toggle('reduzir-animacao', !!carregar('reduzirAnimacao', false));
  corpo.classList.toggle('alto-contraste', !!carregar('altoContraste', false));
  corpo.classList.toggle('texto-grande', !!carregar('textoGrande', false));
}

/* ------------------------------------------------------------------ */
/* Mensagens do servidor                                               */
/* ------------------------------------------------------------------ */

function processarMensagem(msg) {
  switch (msg.tipo) {

    case 'entrou-sala':
      estado.entrando = false;
      aoEntrarNaSala(msg);
      break;

    case 'erro':
      if (!estado.codigo) {
        // a flag tem que cair ANTES do close: senão o aviso de "conexão caiu"
        // sobrescreveria a mensagem de erro de verdade do servidor
        estado.entrando = false;
        definirStatusEntrada('');
        definirErroEntrada(msg.texto || 'Erro no servidor.');
        try { estado.ws && estado.ws.close(); } catch { /* ignora */ }
      } else aviso(msg.texto || 'Erro no servidor.', 'erro');
      break;

    case 'presenca':
      estado.participantes = msg.participantes || [];
      desenharParticipantes();
      sincronizarComPresenca();
      atualizarTiles();
      // a aba "Em linha" do painel de amigos depende destes dados
      if (_abaAmigos === 'linha') desenharListaAmigos();
      atualizarBadgesAmigos();
      $('#aviso-limite').hidden = (estado.participantes.length <= LIMITE_CONFORTAVEL);
      reconectarFaltantes();
      break;

    case 'participante-saiu':
      encerrarPar(msg.id);
      estado.participantes = estado.participantes.filter(p => p.id !== msg.id);
      desenharParticipantes();
      desenharBotoesDeMidia();
      atualizarTiles();
      break;

    case 'chat':
      anexarMensagem(msg.msg, false);
      if (msg.msg && msg.msg.nome && msg.msg.nome !== estado.perfil.nome) {
        Notificacoes.mensagem(msg.msg.nome, msg.msg.texto, false);
        tocarAvisoDeMensagem();
      }
      break;

    // conversa individual: só entre eu e a pessoa endereçada
    case 'privado':
      if (msg.msg) {
        anexarMensagemPrivada(msg.msg);
        if (msg.msg.de !== estado.meuId) {
          Notificacoes.mensagem(msg.msg.nome, msg.msg.texto, true);
          tocarAvisoDeMensagem();
        }
      }
      break;

    // histórico da conversa individual que eu pedi ao abrir a aba
    case 'historico-privado':
      if (msg.com && Array.isArray(msg.mensagens)) {
        estado.privados.set(msg.com, msg.mensagens);
        montarAbasConversa();
        if (estado.conversa === msg.com) desenharChat();
      }
      break;

    case 'sistema':
      anexarMensagem({ sistema: true, texto: msg.texto, hora: msg.hora || Date.now() }, false);
      break;

    case 'oferta':
      receberOferta(msg.de, msg.sdp);
      break;

    case 'resposta':
      receberResposta(msg.de, msg.sdp);
      break;

    case 'ice':
      receberIce(msg.de, msg.candidate);
      break;

    default:
      break;
  }
}

function aoEntrarNaSala(dados) {
  estado.codigo = dados.codigo;
  estado.convite = null;
  estado.meuId = dados.meuId;
  estado.participantes = dados.participantes || [];
  estado.conectado = true;
  // daqui para frente vale medir quem está falando: sem isto o anel verde
  // nunca acenderia, porque não há nada ligado às streams
  iniciarDetecaoDeFala();

  // Monta o convite sem segurar a entrada na sala: ele só é exibido
  // quando a pessoa for compartilhar o código.
  montarConvite();

  definirStatusEntrada('');
  definirErroEntrada('');

  $('#codigo-sala').textContent = dados.codigo;
  const codLateral = $('#codigo-sala-painel');
  if (codLateral) codLateral.textContent = dados.codigo;
  $('#tela-entrada').hidden = true;
  $('#tela-sala').hidden = false;
  definirBarraVoz('Conectado');

  carregarAmizades();

  // "Lembrar de mim" - salva nome e servidor pra próxima vez
  if (estado.lembrar) {
    localStorage.setItem('nexo.nomeSalvo', $('#in-nome').value.trim());
    localStorage.setItem('nexo.servidorSalvo', $('#in-servidor').value.trim());
  }

  desconectarEstado('conectado');

  $('#lista-chat').innerHTML = '';
  estado.historico = [];
  estado.privados = new Map();
  estado.naoLidas = new Map();
  estado.conversa = '';
  montarAbasConversa();
  (dados.historico || []).forEach(m => anexarMensagem(m, true));

  desenharParticipantes();
  atualizarTiles();
  iniciarMonitorDeQualidade();

  // quem chega agora inicia a conexão com quem já estava
  for (const p of estado.participantes) {
    if (p.id !== estado.meuId) conectarPara(p.id);
  }

  iniciarMidiaLocal();
}

/* ------------------------------------------------------------------ */
/* WebRTC — malha completa                                             */
/* ------------------------------------------------------------------ */

function trilhaDe(stream, tipo) {
  if (!stream) return null;
  return tipo === 'video' ? (stream.getVideoTracks()[0] || null)
                          : (stream.getAudioTracks()[0] || null);
}

function criarPC(peerId, iniciador) {
  const anterior = estado.pcs.get(peerId);
  if (anterior) return anterior;

  const pc = new RTCPeerConnection(RTC_CONFIG);
  estado.pcs.set(peerId, pc);

  if (iniciador) {
    const micro = trilhaDe(estado.streamMicro, 'audio');
    if (micro) pc.addTrack(micro, estado.streamMicro);
    else pc.addTransceiver('audio', { direction: 'sendrecv' });

    const tela = trilhaDe(estado.streamTela, 'video');
    if (tela) pc.addTrack(tela, estado.streamTela);

    const cam = trilhaDe(estado.streamCamera, 'video');
    if (cam) pc.addTrack(cam, estado.streamCamera);
  }

  pc.onnegotiationneeded = () => renegociar(peerId);

  pc.onicecandidate = (ev) => {
    if (ev.candidate) enviar({ tipo: 'ice', para: peerId, candidate: ev.candidate.toJSON() });
  };

  pc.ontrack = (ev) => aoReceberTrilha(peerId, ev);

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'failed' || s === 'closed') {
      if (estado.pcs.get(peerId) === pc) estado.pcs.delete(peerId);
      try { pc.close(); } catch { /* ignora */ }
    }
    atualizarRodapeConexao();
  };

  return pc;
}

/**
 * Quem inicia a conexão de um par: regra determinística (id maior inicia).
 * Sem isso os dois lados podem abrir ao mesmo tempo e o navegador acaba
 * negociando duas linhas de áudio duplicadas.
 */
function devoIniciar(peerId) {
  return String(estado.meuId || '') > String(peerId || '');
}

function conectarPara(peerId) {
  if (!peerId || peerId === estado.meuId || estado.pcs.has(peerId)) return;
  if (!devoIniciar(peerId)) return; // o outro lado vai abrir
  criarPC(peerId, true); // negotiationneeded dispara a oferta
}

/** cria uma oferta quando o navegador diz que é preciso renegociar */
async function renegociar(peerId) {
  const pc = estado.pcs.get(peerId);
  if (!pc) return;

  if (pc._renegociando || pc.signalingState !== 'stable') {
    pc._fila = true;
    return;
  }

  pc._renegociando = true;
  try {
    const oferta = await pc.createOffer();
    if (pc.signalingState !== 'stable') return;
    await pc.setLocalDescription(oferta);
    enviar({ tipo: 'oferta', para: peerId, sdp: pc.localDescription.sdp });
  } catch (erro) {
    console.warn('[nexo] renegociação falhou:', erro.message);
  } finally {
    pc._renegociando = false;
    if (pc._fila) {
      pc._fila = false;
      setTimeout(() => renegociar(peerId), 80);
    }
  }
}

async function receberOferta(peerId, sdp) {
  const texto = textoSdp(sdp);
  if (!texto || !peerId) return;

  const pc = criarPC(peerId, false);

  // glâre: chegou uma oferta enquanto a minha estava no ar — cedo (rollback)
  if (pc.signalingState === 'have-local-offer') {
    try { await pc.setLocalDescription({ type: 'rollback' }); } catch { /* ignora */ }
    pc._fila = true;
  }

  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: texto });
  } catch (erro) {
    console.warn('[nexo] setRemoteDescription(offer):', erro.message);
    return;
  }

  esvaziarIce(peerId, pc);
  anexarTrilhasFaltantes(pc);

  try {
    const resposta = await pc.createAnswer();
    await pc.setLocalDescription(resposta);
    enviar({ tipo: 'resposta', para: peerId, sdp: pc.localDescription.sdp });
  } catch (erro) {
    console.warn('[nexo] criar resposta:', erro.message);
  }
}

async function receberResposta(peerId, sdp) {
  const texto = textoSdp(sdp);
  const pc = estado.pcs.get(peerId);
  if (!texto || !pc) return;
  try {
    await pc.setRemoteDescription({ type: 'answer', sdp: texto });
    esvaziarIce(peerId, pc);
    anexarTrilhasFaltantes(pc);
  } catch (erro) {
    console.warn('[nexo] setRemoteDescription(answer):', erro.message);
  }
}

function receberIce(peerId, candidate) {
  if (!candidate) return;
  const pc = estado.pcs.get(peerId);
  if (pc && pc.remoteDescription) {
    pc.addIceCandidate(candidate).catch(() => {});
    return;
  }
  const fila = estado.filaIce.get(peerId) || [];
  fila.push(candidate);
  if (fila.length > 40) fila.shift();
  estado.filaIce.set(peerId, fila);
}

function esvaziarIce(peerId, pc) {
  const fila = estado.filaIce.get(peerId);
  if (!fila || !fila.length) return;
  estado.filaIce.set(peerId, []);
  fila.forEach(c => pc.addIceCandidate(c).catch(() => {}));
}

/** coloca minhas trilhas locais nos transceivers ainda vazios */
function anexarTrilhasFaltantes(pc) {
  if (!pc) return;
  const locais = [];
  const micro = trilhaDe(estado.streamMicro, 'audio');
  const tela = trilhaDe(estado.streamTela, 'video');
  const cam = trilhaDe(estado.streamCamera, 'video');
  if (micro) locais.push([micro, estado.streamMicro]);
  if (tela) locais.push([tela, estado.streamTela]);
  if (cam) locais.push([cam, estado.streamCamera]);

  if (!locais.length) return;

  // quantas trilhas eu tenho por tipo (audio = 1, video = tela + camera)
  const quero = {};
  for (const [trilha] of locais) quero[trilha.kind] = (quero[trilha.kind] || 0) + 1;

  // quantas linhas desse tipo já estão carregando alguma trilha minha
  const pronto = {};
  for (const s of pc.getSenders()) {
    if (s.track && quero[s.track.kind]) pronto[s.track.kind] = (pronto[s.track.kind] || 0) + 1;
  }

  for (const [trilha, stream] of locais) {
    if (pc.getSenders().some(s => s.track === trilha)) continue;
    // já existe uma linha desse tipo com minha mídia: não criar outra
    if ((pronto[trilha.kind] || 0) >= quero[trilha.kind]) continue;

    const tx = pc.getTransceivers().find(t =>
      !t.sender.track && t.receiver.track && t.receiver.track.kind === trilha.kind
    );

    if (tx) {
      tx.sender.replaceTrack(trilha);
      tx.direction = 'sendrecv';
    } else {
      pc.addTrack(trilha, stream);
    }
    pronto[trilha.kind] = (pronto[trilha.kind] || 0) + 1;
  }
}

function textoSdp(sdp) {
  if (typeof sdp === 'string') return sdp;
  if (sdp && typeof sdp.sdp === 'string') return sdp.sdp;
  return '';
}

function encerrarPar(peerId) {
  const pc = estado.pcs.get(peerId);
  if (pc) {
    try { pc.close(); } catch { /* ignora */ }
    estado.pcs.delete(peerId);
  }
  estado.filaIce.delete(peerId);
  limparMidiaDoPeer(peerId);
}

/** garante que todo mundo da sala tenha uma conexão comigo */
function reconectarFaltantes() {
  for (const p of estado.participantes) {
    if (p.id !== estado.meuId && !estado.pcs.has(p.id)) conectarPara(p.id);
  }
}

/* ------------------------------------------------------------------ */
/* Mídia remota                                                        */
/* ------------------------------------------------------------------ */

function streamRemoto(streamId) {
  let s = estado.streams.get(streamId);
  if (!s) { s = new MediaStream(); estado.streams.set(streamId, s); }
  return s;
}

function elementoRemoto(streamId) {
  let el = estado.els.get(streamId);
  if (!el) {
    el = document.createElement('video');
    el.autoplay = true;
    el.playsInline = true;
    el.dataset.stream = streamId;
    el.srcObject = streamRemoto(streamId);
    estado.els.set(streamId, el);
    contêinerDeAudio().appendChild(el);
    aplicarSaida(el);
  }
  return el;
}

let _contAudio = null;
function contêinerDeAudio() {
  if (_contAudio && document.body.contains(_contAudio)) return _contAudio;
  _contAudio = document.createElement('div');
  _contAudio.id = 'audios-ocultos';
  _contAudio.setAttribute('aria-hidden', 'true');
  Object.assign(_contAudio.style, {
    position: 'fixed', left: '-12px', top: '-12px',
    width: '2px', height: '2px', opacity: '0.01', overflow: 'hidden',
    pointerEvents: 'none', zIndex: '-1'
  });
  document.body.appendChild(_contAudio);
  return _contAudio;
}

function aoReceberTrilha(peerId, ev) {
  if (!ev.track) return;

  // Trilhas anexadas com replaceTrack() chegam SEM MediaStream no evento.
  // Sem uma chave, o áudio seria descartado em silêncio e ninguém ouviria
  // ninguém — por isso usamos uma chave sintética por par + tipo.
  const realStreamId = ev.streams && ev.streams[0] ? ev.streams[0].id : null;
  // Usa o ID real do stream se vier, senão cria chave sintética por par+tipo
  const sid = realStreamId || ('remoto:' + peerId + ':' + ev.track.kind);

  // Garante que o stream local existe antes de adicionar a trilha
  let s = streamRemoto(sid);
  if (!s.getTracks().includes(ev.track)) {
    s.addTrack(ev.track);
    // Se não tiver stream associated, criamos um novo MediaStream para segurar a trilha
    if (s.getTracks().length === 1 && !realStreamId) {
      // Primeira trilha adicionada sem stream: cria um container stream
      const newStream = new MediaStream();
      newStream.addTrack(ev.track);
      s = streamRemoto(sid, newStream); // substituímos o referência
      // Atualiza o elemento para usar o novo stream
      const el = elementoRemoto(sid);
      el.srcObject = newStream;
    }
  }

  const el = elementoRemoto(sid);
  el.dataset.peer = peerId;
  el.dataset.trilha = ev.track.kind;

  const aoMudar = () => { aplicarSaida(el); atualizarTiles(); };
  ev.track.addEventListener('ended', aoMudar);
  ev.track.addEventListener('mute', aoMudar);
  ev.track.addEventListener('unmute', aoMudar);
  ev.track.addEventListener('removetrack', aoMudar);

  // Tenta tocar o vídeo; se falhar (política de autoplay), ignora silenciosamente
  el.play().catch(() => {});
  aplicarSaida(el);
  atualizarTiles();
}

function limparMidiaDoPeer(peerId) {
  for (const [sid, el] of Array.from(estado.els.entries())) {
    if (el.dataset.peer !== peerId) continue;
    const s = estado.streams.get(sid);
    if (s) s.getTracks().forEach(t => { try { t.stop(); } catch { /* ignora */ } });
    el.srcObject = null;
    el.remove();
    estado.els.delete(sid);
    estado.streams.delete(sid);
  }
}

function rotuloReal(sid) {
  const el = estado.els.get(sid);
  const p = el ? participante(el.dataset.peer) : null;
  if (!p) return { texto: '', eu: false, tipo: 'tela' };

  const possuiTela = !!(p.tela && p.tela === sid);
  const possuiCam = !!(p.camera && p.camera === sid);
  const souEu = p.id === estado.meuId;

  if (possuiTela) return { texto: souEu ? 'Você · tela' : p.nome, tipo: 'tela', eu: souEu };
  if (possuiCam) return { texto: souEu ? 'Você · câmera' : p.nome, tipo: 'camera', eu: souEu };

  // chave sintética (trilha vinda de replaceTrack, sem stream no evento)
  if (el.dataset.trilha === 'video') {
    const tipo = (p.camera && !p.tela) ? 'camera' : 'tela';
    return { texto: souEu ? 'Você · vídeo' : p.nome, tipo, eu: souEu };
  }

  return { texto: souEu ? 'Você' : p.nome, tipo: 'audio', eu: souEu };
}

function sincronizarComPresenca() {
  for (const [sid, el] of Array.from(estado.els.entries())) {
    const peer = el.dataset.peer;
    if (!peer || peer === estado.meuId) continue;

    // só vídeo: o áudio é a linha de voz e nunca pode ser derrubado aqui,
    // senão o mudo temporário de uma pessoa derrubaria a chamada inteira
    const s = estado.streams.get(sid);
    if (!s || !s.getVideoTracks().length) continue;

    const p = participante(peer);
    if (!p) continue;
    if (p.tela === sid || p.camera === sid) continue;

    // o dono não anuncia mais essa fonte de vídeo: derruba na marra,
    // porque a trilha remota pode ficar "live" depois que o remetente para
    s.getTracks().forEach(t => { try { t.stop(); } catch { /* ignora */ } });
    try { el.pause(); } catch { /* ignora */ }
    el.srcObject = null;
    el.remove();
    estado.els.delete(sid);
    estado.streams.delete(sid);
  }

  estado.tilesVisiveis = '';
  atualizarTiles();
}

function atualizarTiles() {
  const grade = $('#grade-videos');
  if (!grade) return;

  const visiveis = [];
  for (const [sid, el] of estado.els) {
    const s = estado.streams.get(sid);
    const temVideo = !!s && s.getVideoTracks().some(t => t.readyState === 'live');
    if (temVideo) visiveis.push(sid);
  }

  const chave = visiveis.join('|') + '#' + (estado.streamTela ? 'T' : '') + (estado.streamCamera ? 'C' : '');
  if (chave === estado.tilesVisiveis) {
    desenharRotulos();
    atualizarMiniJanela();
    atualizarEstadoVideoDaFila();
    return;
  }
  estado.tilesVisiveis = chave;

  grade.innerHTML = '';
  grade.classList.toggle('somente-tela', visiveis.length === 1);

  if (!visiveis.length && !estado.streamTela && !estado.streamCamera) {
    $('#placeholder').hidden = false;
    $('#faixa-aovivo').hidden = true;
    grade.hidden = true;
    atualizarMiniJanela();
    return;
  }

  grade.hidden = false;
  $('#placeholder').hidden = true;

  // prévia local
  for (const [rotulo, stream] of [['tela', estado.streamTela], ['câmera', estado.streamCamera]]) {
    if (!stream || !stream.getVideoTracks().some(t => t.readyState === 'live')) continue;
    const tile = document.createElement('div');
    // classe 'camera' (sem acento, pro CSS) ou 'tela' — controla espelhamento
    tile.className = 'tile local ' + (rotulo === 'tela' ? 'tela' : 'camera');
    const v = document.createElement('video');
    v.autoplay = true; v.playsInline = true; v.muted = true;
    v.srcObject = stream;
    tile.appendChild(v);
    const lab = document.createElement('span');
    lab.className = 'rotulo-tile';
    lab.innerHTML = '<span class="mini-ic ok">●</span> Você · ' + rotulo;
    tile.appendChild(lab);
    grade.appendChild(tile);
  }

  for (const sid of visiveis) {
    const el = estado.els.get(sid);
    if (!el) continue;
    const info = rotuloReal(sid);
    const tile = document.createElement('div');
    tile.className = 'tile' + (info.tipo === 'tela' ? ' tela' : '');
    tile.appendChild(el);

    const lab = document.createElement('span');
    lab.className = 'rotulo-tile';
    lab.dataset.sid = sid;
    tile.appendChild(lab);

    grade.appendChild(tile);
  }

  desenharRotulos();
  atualizarMiniJanela();
  atualizarEstadoVideoDaFila();
}

function desenharRotulos() {
  document.querySelectorAll('.rotulo-tile[data-sid]').forEach(lab => {
    const info = rotuloReal(lab.dataset.sid);
    lab.innerHTML = '<span class="mini-ic ok">●</span> ' + escapeHtml(info.texto || '•');
  });
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------------------------------------------------ */
/* Mídia local: microfone, câmera e tela                               */
/* ------------------------------------------------------------------ */

async function iniciarMidiaLocal() {
  await listarDispositivos();
  ligarMicrofone(true);
}

function restricoesMicro() {
  const base = {
    echoCancellation: estado.eco,
    noiseSuppression: estado.eco,
    autoGainControl: estado.eco
  };
  if (estado.disp.micro) base.deviceId = { exact: estado.disp.micro };
  return base;
}

async function ligarMicrofone(silencioso) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const antigo = estado.streamMicro;
    const s = await navigator.mediaDevices.getUserMedia({ audio: restricoesMicro(), video: false });
    if (antigo) antigo.getTracks().forEach(t => t.stop());

    estado.streamMicro = s;
    estado.microLigado = true;
    const trilha = s.getAudioTracks()[0];
    if (trilha) trilha.enabled = true;

    aplicarMicroNasConexoes();
    iniciarMedidor(s);
    atualizarMonitorMicro();
    enviar({ tipo: 'estado', micro: true, mudo: false });
    await listarDispositivos();
    desenharBotoesDeMidia();
    atualizarRodapeDispositivos();
  } catch (erro) {
    if (!silencioso) aviso('Não consegui usar o microfone: ' + motivoMedia(erro), 'erro');
    estado.streamMicro = null;
    enviar({ tipo: 'estado', micro: false });
    pararMedidor();
    atualizarMonitorMicro();
    desenharBotoesDeMidia();
  }
}

function aplicarMicroNasConexoes() {
  const trilha = trilhaDe(estado.streamMicro, 'audio');
  if (!trilha) return;
  for (const pc of estado.pcs.values()) {
    anexarTrilhasFaltantes(pc);
    renegociarDoPc(pc);
  }
}

function renegociarDoPc(pc) {
  for (const [id, p] of estado.pcs) if (p === pc) { renegociar(id); break; }
}

function alternarMicrofone() {
  if (!estado.streamMicro) { ligarMicrofone(false); return; }

  estado.microLigado = !estado.microLigado;
  const trilha = estado.streamMicro.getAudioTracks()[0];
  if (trilha) trilha.enabled = estado.microLigado;

  enviar({ tipo: 'estado', micro: true, mudo: !estado.microLigado });
  atualizarMonitorMicro();
  desenharBotoesDeMidia();
  desenharParticipantes();
}

async function trocarMicrofone(deviceId) {
  estado.disp.micro = deviceId;
  salvar('disp', estado.disp);
  await ligarMicrofone(false);
}

async function ligarCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    const restricoes = { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
    if (estado.disp.camera) restricoes.video.deviceId = { exact: estado.disp.camera };

    const s = await navigator.mediaDevices.getUserMedia(restricoes);
    if (estado.streamCamera) estado.streamCamera.getTracks().forEach(t => t.stop());

    estado.streamCamera = s;
    const trilha = s.getVideoTracks()[0];
    if (trilha) trilha.addEventListener('ended', desligarCamera);

    enviar({ tipo: 'estado', camera: s.id });
    for (const pc of estado.pcs.values()) { anexarTrilhasFaltantes(pc); renegociarDoPc(pc); }

    await listarDispositivos();
    desenharBotoesDeMidia();
    atualizarTiles();
    aviso('Câmera ligada.', 'ok');
  } catch (erro) {
    aviso('Não consegui usar a câmera: ' + motivoMedia(erro), 'erro');
  }
}

function desligarCamera() {
  if (estado.streamCamera) {
    estado.streamCamera.getTracks().forEach(t => { try { t.stop(); } catch { /* ignora */ } });
    estado.streamCamera = null;
  }
  enviar({ tipo: 'estado', camera: null });
  desenharBotoesDeMidia();
  atualizarTiles();
}

function alternarCamera() {
  if (estado.streamCamera) desligarCamera();
  else ligarCamera();
}

/* ------------------------------ tela ---------------------------- */

async function escolherFonte() {
  if (!DESKTOP) return 'auto';
  try {
    const fontes = await window.nexoDesktop.listarFontes();
    if (!fontes || !fontes.length) return 'auto';

    let resolver = null;
    const grade = $('#grade-fontes');
    grade.innerHTML = '';

    for (const f of fontes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item-fonte';
      const img = document.createElement('img');
      img.src = f.miniatura || '';
      img.alt = f.nome;
      const nome = document.createElement('span');
      nome.className = 'nome';
      nome.textContent = f.nome;
      btn.appendChild(img);
      btn.appendChild(nome);
      btn.onclick = () => resolver(f.id);
      grade.appendChild(btn);
    }

    $('#overlay-fontes').hidden = false;

    return await new Promise((resolve) => {
      resolver = async (id) => {
        $('#overlay-fontes').hidden = true;
        $('#btn-fechar-fontes').onclick = null;
        if (id) await window.nexoDesktop.escolherFonte(id);
        resolve(id || 'auto');
      };
      $('#btn-fechar-fontes').onclick = () => resolver('cancelado');
    });
  } catch (erro) {
    console.warn('[nexo] fontes:', erro);
    return 'auto';
  }
}

async function iniciarTransmissao() {
  if (estado.streamTela) { encerrarTela(); return; }

  try {
    const fonte = await escolherFonte();
    if (fonte === 'cancelado') return;

    if (DESKTOP) {
      await window.nexoDesktop.configurarCaptura({ audio: estado.audioSistema });
    }

    const fps = Number(estado.fps) || 60;
    const largura = Number(estado.resolucao) || 0;

    // Nativa: pede o tamanho fisico real do monitor (devicePixelRatio incluso)
    // e nao força 16:9 - assim nem ultrawide nem notebook tem o que aparece
    // cortado nem rebaixado na transmissao.
    const dpr = window.devicePixelRatio || 1;
    const alvoW = largura > 0 ? largura : Math.round(screen.width * dpr);
    const alvoH = largura > 0 ? Math.round(largura * 9 / 16) : Math.round(screen.height * dpr);

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: fps, max: fps },
        width: { ideal: alvoW },
        height: { ideal: alvoH }
      },
      audio: estado.audioSistema
    });

    estado.streamTela = stream;
    const trilha = stream.getVideoTracks()[0];
    if (trilha) {
      trilha.addEventListener('ended', () => encerrarTela());
      const cfg = trilha.getSettings ? trilha.getSettings() : {};
      if (cfg.frameRate && cfg.frameRate < fps) {
        aviso(`Sua tela entregou ${Math.round(cfg.frameRate)} fps (você pediu ${fps}). O limite vem da taxa da sua tela, da CPU ou da rede.`);
      }
      // se veio abaixo do tamanho do monitor, avisa em vez de entregar
      // uma transmissao capenga sem a pessoa perceber.
      if (cfg.width && cfg.height && cfg.width < alvoW * 0.9) {
        aviso(`Transmitindo em ${cfg.width}×${cfg.height} e não em ${alvoW}×${alvoH}. O Windows pode estar com escala de texto ampliada — em Ajustes > Tela, deixe em 100% para mandar tudo nativo.`, 'erro');
      } else if (cfg.width && cfg.height) {
        console.info(`[nexo] transmissao nativa: ${cfg.width}×${cfg.height} @ ${Math.round(cfg.frameRate || 0)}fps`);
      }
    }

    enviar({ tipo: 'estado', tela: stream.id });
    for (const pc of estado.pcs.values()) { anexarTrilhasFaltantes(pc); renegociarDoPc(pc); }

    desenharBotoesDeMidia();
    atualizarTiles();
    aviso('Transmissão iniciada. Compartilhe o código da sala!', 'ok');
  } catch (erro) {
    if (erro && erro.name !== 'NotAllowedError') {
      aviso('Não foi possível capturar a tela: ' + motivoMedia(erro), 'erro');
    }
  }
}

function encerrarTela() {
  if (!estado.streamTela) return;
  estado.streamTela.getTracks().forEach(t => { try { t.stop(); } catch { /* ignora */ } });
  estado.streamTela = null;
  enviar({ tipo: 'estado', tela: null });
  desenharBotoesDeMidia();
  atualizarTiles();
}

/* ------------------------------------------------------------------ */
/* Medidor de volume do microfone                                      */
/* ------------------------------------------------------------------ */

function iniciarMedidor(stream) {
  pararMedidor();
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const fonte = ctx.createMediaStreamSource(stream);
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 512;
    fonte.connect(analisador);

    const dados = new Uint8Array(analisador.frequencyBinCount);
    estado.analisador = { ctx, analisador, dados, timer: null };
    estado.analisador.timer = setInterval(() => {
      analisador.getByteTimeDomainData(dados);
      let pico = 0;
      for (let i = 0; i < dados.length; i++) {
        pico = Math.max(pico, Math.abs(dados[i] - 128));
      }
      const pct = Math.min(100, Math.round((pico / 128) * 160));
      const barra = $('#barra-nivel');
      if (barra) barra.style.width = pct + '%';
    }, 70);
  } catch { /* sem WebAudio */ }
}

function pararMedidor() {
  if (!estado.analisador) return;
  clearInterval(estado.analisador.timer);
  try { estado.analisador.ctx.close(); } catch { /* ignora */ }
  estado.analisador = null;
}

/* ------------------------------------------------------------------ */
/* Dispositivos                                                        */
/* ------------------------------------------------------------------ */

function motivoMedia(erro) {
  const n = erro && erro.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'permissão negada';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'dispositivo não encontrado';
  if (n === 'NotReadableError') return 'dispositivo ocupado por outro programa';
  return (erro && erro.message) || 'erro desconhecido';
}

async function listarDispositivos() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();

    const micros = devs.filter(d => d.kind === 'audioinput');
    const fones = devs.filter(d => d.kind === 'audiooutput');
    const cams = devs.filter(d => d.kind === 'videoinput');

    // guardo a lista para os menus do painel do usuário, que precisam do
    // mesmo conteúdo do <select> das configurações
    _devsAudio.micro = micros;
    _devsAudio.fone = fones;

    preencherSelect('#sel-micro', micros, estado.disp.micro, 'Padrão do sistema');
    preencherSelect('#sel-fone', fones, estado.disp.fone, 'Padrão do sistema');
    preencherSelect('#sel-camera', cams, estado.disp.camera, 'Padrão do sistema');

    const temSaida = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
    const campoFone = $('#sel-fone');
    if (campoFone) campoFone.disabled = !temSaida;
    _temSaidaAudio = temSaida;

    atualizarRodapeDispositivos();
  } catch { /* ignora */ }
}

/* ------------------------------------------------------------------ */
/* Seletor de aparelhos no painel do usuário (estilo Discord)          */
/* ------------------------------------------------------------------ */
/* O Discord não esconde o microfone e o fone numa tela de configuração:
   cada um fica com a sua setinha, encostado no próprio botão, e a lista
   abre ali mesmo. É o caminho curto para quando o primo entra e a pessoa
   precisa trocar de aparelho na hora, sem sair da sala. */

const _devsAudio = { micro: [], fone: [] };
let _temSaidaAudio = false;

function rotuloDispositivo(tipo, d, i) {
  if (d.label) return d.label;
  return (tipo === 'micro' ? 'Microfone ' : 'Saída ') + (i + 1);
}

function escolhidoEhODoSistema(tipo) { return !estado.disp[tipo]; }

function montarMenuDispositivo(tipo) {
  const menu = $(tipo === 'micro' ? 'menu-micro' : 'menu-fone');
  if (!menu) return;

  const devs = _devsAudio[tipo] || [];
  const escolhido = estado.disp[tipo] || '';
  const titulo = tipo === 'micro' ? 'Microfone' : 'Fone / saída de áudio';

  if (!devs.length) {
    menu.innerHTML = '<p class="md-vazio">Ainda não apareceu nenhum aparelho. ' +
      'Se você acabou de conectar o microfone ou o fone, feche e abra as ' +
      'configurações de novo para o Windows repassar a lista.</p>';
    return;
  }

  const padrao = `<button class="md-item${escolhidoEhODoSistema(tipo) ? ' ativo' : ''}" type="button"
      role="menuitemradio" aria-checked="${escolhidoEhODoSistema(tipo)}" data-id="">
    <svg class="md-check" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
    <span class="md-nome">Padrão do sistema</span>
  </button>`;

  const itens = devs.map((d, i) => {
    const ativo = (d.deviceId || '') === escolhido;
    return `<button class="md-item${ativo ? ' ativo' : ''}" type="button"
        role="menuitemradio" aria-checked="${ativo}" data-id="${escapeHtml(d.deviceId || '')}">
      <svg class="md-check" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
      <span class="md-nome">${escapeHtml(rotuloDispositivo(tipo, d, i))}</span>
    </button>`;
  }).join('');

  let rodape = '';
  if (tipo === 'micro') {
    rodape = `<div class="md-nivel"><i id="nivel-menu-micro"></i></div>
      <div class="md-rodape"><button type="button" data-acao="config-voz">Mais ajustes de áudio…</button></div>`;
  } else {
    rodape = `<div class="md-rodape">
        <input type="range" id="range-volume-menu" min="0" max="100"
               value="${Math.round(estado.volume)}" title="Volume da sala"
               aria-label="Volume da sala" />
        <button type="button" data-acao="config-voz">Mais ajustes de áudio…</button>
      </div>`;
  }

  menu.innerHTML = `<div class="md-titulo">${escapeHtml(titulo)}</div>${padrao}${itens}${rodape}`;

  menu.querySelectorAll('.md-item').forEach(b => {
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      escolherDispositivo(tipo, b.dataset.id || '');
    });
  });

  const cfg = menu.querySelector('[data-acao="config-voz"]');
  if (cfg) cfg.addEventListener('click', (ev) => {
    ev.stopPropagation();
    fecharMenusDispositivo();
    abrirConfig('voz-video');
  });

  const vol = $('#range-volume-menu');
  if (vol) vol.addEventListener('input', (ev) => {
    estado.volume = Number(ev.target.value);
    salvar('volume', estado.volume);
    const cfgVol = $('#range-volume');
    if (cfgVol) cfgVol.value = String(estado.volume);
    aplicarSaidaEmTudo();
  });
}

async function escolherDispositivo(tipo, deviceId) {
  if (tipo === 'micro') await trocarMicrofone(deviceId);
  else {
    estado.disp.fone = deviceId;
    salvar('disp', estado.disp);
    await aplicarSaidaEmTudo();
  }
  // a lista continua aberta: a pessoa pode estar testando um aparelho atrás
  // do outro, e fechar sozinho a cada clique só faria ela reabrir
  montarMenuDispositivo(tipo);
  sincronizarSelecaoConfig();
}

function sincronizarSelecaoConfig() {
  const m = $('#sel-micro'); if (m) m.value = estado.disp.micro || '';
  const f = $('#sel-fone'); if (f) f.value = estado.disp.fone || '';
}

function fecharMenusDispositivo(excepto) {
  ['micro', 'fone'].forEach(tipo => {
    if (tipo === excepto) return;
    const menu = $(tipo === 'micro' ? 'menu-micro' : 'menu-fone');
    const grupo = menu && menu.closest('.grupo-disp');
    if (menu) menu.hidden = true;
    if (grupo) grupo.classList.remove('aberto');
  });
}

function alternarMenuDispositivo(tipo) {
  const menu = $(tipo === 'micro' ? 'menu-micro' : 'menu-fone');
  const grupo = menu && menu.closest('.grupo-disp');
  if (!menu || !grupo) return;
  const abrindo = menu.hidden;
  fecharMenusDispositivo(abrindo ? tipo : null);
  if (abrindo) {
    montarMenuDispositivo(tipo);
    menu.hidden = false;
    grupo.classList.add('aberto');
  }
}

function ligarMenusDispositivo() {
  const mm = $('#btn-menu-micro');
  if (mm) mm.addEventListener('click', (ev) => { ev.stopPropagation(); alternarMenuDispositivo('micro'); });

  const mf = $('#btn-menu-fone');
  if (mf) mf.addEventListener('click', (ev) => { ev.stopPropagation(); alternarMenuDispositivo('fone'); });

  // o botão do fone (sem a seta) também abre a lista: é o atalho de quem
  // quer só conferir em qual aparelho o som está saindo
  const bf = $('#btn-fone');
  if (bf) bf.addEventListener('click', (ev) => { ev.stopPropagation(); alternarMenuDispositivo('fone'); });

  document.addEventListener('click', () => fecharMenusDispositivo());
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fecharMenusDispositivo(); });
}

/* ------------------------------------------------------------------ */
/* Fila de quem está na chamada + anel de quem está falando            */
/* ------------------------------------------------------------------ */
/* A fila são os avatares redondos por cima do palco. O anel verde acende
   em volta de quem está com a boca aberta — medido de verdade, com um
   analisador de áudio ligado a cada stream, e não por "quem tem trilha".

   IMPORTANTE: o analisador só MEDIDURA. Ele não vai para o destination,
   então o som continua saindo pelo caminho de sempre; se ligasse, quem
   estivesse de fone se ouviria ecoando. */

let _ctxAudio = null;
const _analisadores = new Map();   // chave de stream -> { fonte, analisador }
const _falando = new Set();        // quem está na boca AGORA
const _ultimaFala = new Map();     // id -> timestamp da última fala alta

function contextoAudio() {
  if (_ctxAudio) return _ctxAudio;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { _ctxAudio = new AC(); } catch { return null; }
  return _ctxAudio;
}

function vigiarStream(chave, stream) {
  if (!stream || _analisadores.has(chave)) return;
  const ctx = contextoAudio();
  if (!ctx) return;
  try {
    const fonte = ctx.createMediaStreamSource(stream);
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 512;
    analisador.smoothingTimeConstant = 0.75;
    fonte.connect(analisador);
    _analisadores.set(chave, { fonte, analisador });
  } catch { /* stream ainda sem trilha de áudio */ }
}

function desligarVigia(chave) {
  const v = _analisadores.get(chave);
  if (!v) return;
  try { v.fonte.disconnect(); } catch { /* já estava solto */ }
  _analisadores.delete(chave);
}

let _dadosTempo = null;
function medirNivel(analisador) {
  if (!_dadosTempo || _dadosTempo.length !== analisador.fftSize) {
    _dadosTempo = new Uint8Array(analisador.fftSize);
  }
  analisador.getByteTimeDomainData(_dadosTempo);
  let soma = 0;
  for (let i = 0; i < _dadosTempo.length; i++) {
    const v = (_dadosTempo[i] - 128) / 128;
    soma += v * v;
  }
  return Math.sqrt(soma / _dadosTempo.length);   // 0..1
}

let _ultimaStreamLocal = null;

function vigiarTudo() {
  // microfone local: religa o medidor quando a stream muda de identity
  if (estado.streamMicro) {
    if (_ultimaStreamLocal !== estado.streamMicro.id) {
      if (_ultimaStreamLocal) desligarVigia('__eu');
      _ultimaStreamLocal = estado.streamMicro.id;
      vigiarStream('__eu', estado.streamMicro);
    }
  } else if (_ultimaStreamLocal) {
    desligarVigia('__eu');
    _ultimaStreamLocal = null;
    marcarFalante(estado.meuId, false);
  }

  // remotos: cada elemento de mídia já carrega em dataset.peer de quem veio
  for (const [sid, el] of estado.els) {
    const s = el.srcObject;
    if (!s || typeof s.getAudioTracks !== 'function') continue;
    if (!s.getAudioTracks().some(t => t.readyState === 'live')) continue;
    vigiarStream(sid, s);
  }
}

function marcarFalante(id, falando) {
  if (!id) return;
  const jaEstava = _falando.add ? _falando.has(id) : false;
  if (!!falando === !!jaEstava) return;   // só toca no DOM quando muda de verdade
  if (falando) _falando.add(id); else _falando.delete(id);

  const seguro = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(id) : id;
  document.querySelectorAll('.tile-voz[data-pessoa="' + seguro + '"]')
    .forEach(t => t.classList.toggle('falando', !!falando));
  const li = $('#lista-pessoas li[data-id="' + seguro + '"]');
  if (li) li.classList.toggle('falando', !!falando);
}

let _timerFalantes = null;

function iniciarDetecaoDeFala() {
  if (_timerFalantes) return;
  _timerFalantes = setInterval(() => {
    if (!estado.conectado) return;
    vigiarTudo();
    if (_ctxAudio && _ctxAudio.state === 'suspended') _ctxAudio.resume().catch(() => {});

    for (const [chave, v] of _analisadores) {
      const el = estado.els.get(chave);
      const id = chave === '__eu' ? estado.meuId : (el && el.dataset ? el.dataset.peer : null);
      if (!id) continue;

      const nivel = medirNivel(v.analisador);
      if (nivel > 0.035) _ultimaFala.set(id, Date.now());
      // atraso de SAÍDA: sem ele o anel apaga a cada sílaba e vira
      // estroboscópio. Mantém aceso enquanto a pessoa continuar falando.
      const recente = _ultimaFala.has(id) && (Date.now() - _ultimaFala.get(id) < 500);
      marcarFalante(id, recente);
    }
  }, 90);
}

function pararDetecaoDeFala() {
  if (_timerFalantes) { clearInterval(_timerFalantes); _timerFalantes = null; }
  for (const chave of Array.from(_analisadores.keys())) desligarVigia(chave);
  for (const id of Array.from(_falando)) marcarFalante(id, false);
  _ultimaFala.clear();
  _ultimaStreamLocal = null;
}

function desenharFilaVoz() {
  const fila = $('#fila-voz');
  if (!fila) return;

  const ordenados = estado.participantes.slice().sort((a, b) =>
    a.id === estado.meuId ? -1 : b.id === estado.meuId ? 1 : String(a.nome).localeCompare(String(b.nome))
  );

  fila.innerHTML = ordenados.map(p => `
    <button class="tile-voz${_falando.has(p.id) ? ' falando' : ''}" type="button"
            data-pessoa="${escapeHtml(p.id)}" title="${escapeHtml(p.nome || '')} — ver perfil">
      ${avatarHtml(p, 'avatar-grande-voz')}
      <span class="tile-nome">${escapeHtml(p.nome || '')}</span>
    </button>`).join('');

  fila.querySelectorAll('.tile-voz').forEach(t => {
    t.addEventListener('click', () => abrirPerfilPessoa(t.dataset.pessoa));
  });

  atualizarEstadoVideoDaFila();
}

/* Sem vídeo no ar a fila ocupa o miolo; com vídeo, encolhe para o topo e
   devolve o palco para quem está transmitindo. */
function atualizarEstadoVideoDaFila() {
  const area = $('#area-video');
  const grade = $('#grade-videos');
  if (area && grade) area.classList.toggle('com-video', !grade.hidden);
}

/* Antes isto escrevia o nome do microfone e da câmera em texto corrido
   dentro de uma barra embaixo do vídeo — o texto era longo, ficava cortado
   e não tinha nada a ver com o lugar onde a pessoa ajusta áudio. Agora a
   mesma função mantém a lista de aparelhos em dia (o marcador de quem está
   ativo) e o indicador de conexão. */
function atualizarRodapeDispositivos() {
  montarMenuDispositivo('micro');
  montarMenuDispositivo('fone');
}

/* Abre as configurações já numa aba. O seletor de aparelhos do painel do
   usuário mora fora do escopo onde as abas vivem, então quem conhece as
   abas deixa a chave exposta aqui embaixo. */
function abrirConfig(aba) {
  if (typeof window.nexoAbrirConfig === 'function') window.nexoAbrirConfig(aba);
}

function preencherSelect(seletor, lista, valorAtual, rotuloPadrao) {
  const el = $(seletor);
  if (!el) return;
  const anterior = valorAtual || '';
  el.innerHTML = '';

  const padrao = document.createElement('option');
  padrao.value = '';
  padrao.textContent = rotuloPadrao;
  el.appendChild(padrao);

  lista.forEach((d, i) => {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = d.label || `${rotuloPadrao} ${i + 1}`;
    el.appendChild(o);
  });

  el.value = Array.from(el.options).some(o => o.value === anterior) ? anterior : '';
}

/* (a antiga atualizarRodapeDispositivos saiu de perto: ela despejava o nome
   do microfone e da câmera em texto corrido na barra de baixo do vídeo. O
   lugar disso agora é a lista de aparelhos de cada botão.) */

async function aplicarSaida(el) {
  if (!el) return;
  try {
    if (estado.volume >= 0) el.volume = Math.min(1, Math.max(0, estado.volume / 100));
    if (estado.disp.fone && typeof el.setSinkId === 'function' && el.srcObject) {
      await el.setSinkId(estado.disp.fone);
    }
  } catch { /* navegador não permite */ }
}

function aplicarSaidaEmTudo() {
  for (const el of estado.els.values()) aplicarSaida(el);
}

/* ------------------------------------------------------------------ */
/* Monitor local do microfone                                          */
/* ------------------------------------------------------------------ */
/* Padrao DESLIGADO: o microfone vai so para quem esta assistindo e voce
   nao se ouve no proprio fone. Quem quiser conferir se esta saindo som
   liga a opcao no ajuste de audio.                                    */

let _elMonitor = null;

function atualizarMonitorMicro() {
  const deveTocar = !!estado.monitorMicro && !!estado.streamMicro && estado.microLigado !== false;

  if (!deveTocar) {
    if (_elMonitor) {
      try { _elMonitor.pause(); } catch { /* ignora */ }
      _elMonitor.srcObject = null;
    }
    return;
  }

  if (!_elMonitor) {
    _elMonitor = document.createElement('audio');
    _elMonitor.autoplay = true;
    document.body.appendChild(_elMonitor);
  }
  if (_elMonitor.srcObject !== estado.streamMicro) _elMonitor.srcObject = estado.streamMicro;
  aplicarSaida(_elMonitor);
  _elMonitor.play().catch(() => { /* autoplay recusado: nao e critico */ });
}

/* ------------------------------------------------------------------ */
/* Desenho: participantes, botões, rodapé                              */
/* ------------------------------------------------------------------ */

function avatarHtml(p, classe) {
  const cor = corDe(p.cor || 0);
  let conteudo;
  if (ehFoto(p.avatar)) {
    // foto: preenche o redondo preservando a proporção (object-fit: cover)
    conteudo = `<img src="${p.avatar}" alt="" />`;
  } else if (p.avatar) {
    conteudo = `<span class="emoji">${escapeHtml(p.avatar)}</span>`;
  } else {
    conteudo = escapeHtml(iniciais(p.nome));
  }
  return `<span class="${classe}" style="background:${cor};color:${textoSobreFundo(p.cor || 0)}">${conteudo}</span>`;
}

function desenharParticipantes() {
  const lista = $('#lista-pessoas');
  if (!lista) return;

  const ordenados = estado.participantes.slice().sort((a, b) =>
    a.id === estado.meuId ? -1 : b.id === estado.meuId ? 1 : String(a.nome).localeCompare(String(b.nome))
  );

  $('#cont-pessoas').textContent = ordenados.length;

  lista.innerHTML = ordenados.map(p => {
    const souEu = p.id === estado.meuId;
    if (p.nome) estado.nomes.set(p.id, p.nome);
    const selos = [];
    if (souEu) selos.push('<span class="selo eu">você</span>');
    if (p.tela) selos.push('<span class="selo tela">tela</span>');
    if (p.camera) selos.push('<span class="selo camera">câmera</span>');
    if (p.mudo) selos.push('<span class="selo mudo">mudo</span>');

    return `<li class="${souEu ? 'eu' : ''}" data-id="${escapeHtml(p.id)}">
      ${avatarHtml(p, 'avatar')}
      <span class="nome-pessoa" title="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</span>
      ${selos.join('')}
      ${souEu ? '' : `<button class="btn-msg-pessoa" type="button" data-com="${escapeHtml(p.id)}" title="Conversa individual com ${escapeHtml(p.nome)}">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/></svg>
      </button>`}
      <span class="ponto-status-holder"></span>
    </li>`;
  }).join('');

  lista.querySelectorAll('.btn-msg-pessoa').forEach(b => {
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      abrirConversa(b.dataset.com);
    });
  });

  // clicar na pessoa abre o perfil dela (o botão de conversa já trata o clique)
  lista.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', (ev) => {
      if (ev.target.closest('.btn-msg-pessoa')) return;
      if (li.dataset.id) abrirPerfilPessoa(li.dataset.id);
    });
  });

  // ponto de status
  document.querySelectorAll('#lista-pessoas li').forEach((li, i) => {
    const p = ordenados[i];
    if (!p) return;
    const av = li.querySelector('.avatar');
    if (!av) return;
    const ponto = document.createElement('i');
    ponto.className = 'ponto-status' + (p.mudo ? ' off' : '');
    av.appendChild(ponto);
    const holder = li.querySelector('.ponto-status-holder');
    if (holder) holder.remove();
  });

  desenharPainelUsuario(ordenados);
  // a fila de avatares por cima do palco acompanha a mesma lista
  desenharFilaVoz();

  // nomes e avatares podem ter mudado — repinta as conversas privadas
  desenharListaDms();
}

/* Espelho de "eu" no rodapé do painel esquerdo (igual ao painel do usuário
   do Discord): avatar com status, nome e os botões de mídia.             */
function desenharPainelUsuario(ordenados) {
  const eu = (ordenados || []).find(p => p.id === estado.meuId) || {};
  const nome = eu.nome || estado.perfil.nome || 'Você';

  const elNome = $('#nome-user');
  if (elNome) elNome.textContent = nome;

  const elStatus = $('#status-user');
  if (elStatus) {
    if (eu.tela) elStatus.textContent = 'Compartilhando tela';
    else if (eu.camera) elStatus.textContent = 'Câmera ligada';
    else if (eu.mudo) elStatus.textContent = 'Sem áudio';
    else elStatus.textContent = 'Conectado';
  }

  const av = $('#avatar-user');
  if (av) {
    let conteudo;
    if (ehFoto(eu.avatar)) {
      /* Foto de perfil entra como <img>, nunca como texto. Antes o base64
         inteiro era colado dentro do <span class="emoji"> e aparecia como uma
         linha branca gigante espremida no rodapé, sem caber nem quebrar. */
      conteudo = `<img class="avatar-foto" src="${eu.avatar}" alt="" />`;
      av.style.background = 'var(--superficie-2)';
      av.style.color = '';
    } else {
      conteudo = eu.avatar
        ? `<span class="emoji">${escapeHtml(eu.avatar)}</span>`
        : escapeHtml(iniciais(nome));
      av.style.background = corDe(eu.cor || 0);
      av.style.color = textoSobreFundo(eu.cor || 0);
    }
    av.innerHTML = conteudo + `<i class="ponto-status${eu.mudo ? ' off' : ''}"></i>`;
  }

  const st = $('#status-user');
  if (st) st.title = nome;
}

function desenharBotoesDeMidia() {
  const microOk = !!estado.streamMicro;
  const microLigado = microOk && estado.microLigado;
  const camOk = !!estado.streamCamera;
  const telaOk = !!estado.streamTela;

  definirBotao($('#btn-micro'), microOk && microLigado);
  definirBotao($('#ctrl-micro'), microOk && microLigado);

  definirBotao($('#btn-camera'), camOk);
  definirBotao($('#ctrl-camera'), camOk);
  $('#btn-camera')?.classList.toggle('ativo', camOk);

  definirBotao($('#btn-tela'), telaOk);
  definirBotao($('#ctrl-tela'), true); // o principal nunca fica "desligado" em vermelho
  $('#btn-tela')?.classList.toggle('ativo', telaOk);
  $('#ctrl-tela')?.classList.toggle('transmitindo', telaOk);

  const rotulo = $('#rotulo-ctrl-tela');
  if (rotulo) rotulo.textContent = telaOk ? 'Parar' : 'Transmitir';

  $('#ctrl-tela')?.setAttribute('title', telaOk ? 'Parar de transmitir' : 'Compartilhar tela');
  $('#btn-tela')?.setAttribute('title', telaOk ? 'Parar de transmitir' : 'Compartilhar tela');

  const titulo = $('#titulo-transmissao');
  if (titulo) {
    const outrosTela = estado.participantes.find(p => p.id !== estado.meuId && p.tela);
    if (telaOk) titulo.textContent = 'Você está transmitindo sua tela';
    else if (estado.streamCamera && !outrosTela) titulo.textContent = 'Você está com a câmera ligada';
    else if (outrosTela) titulo.textContent = `Tela de ${outrosTela.nome}`;
    else titulo.textContent = 'Aguardando transmissão';
  }

  const semVideo = !telaOk && !estado.streamCamera &&
    !estado.participantes.some(p => p.tela || p.camera);
  $('#placeholder').hidden = !semVideo;
  $('#faixa-aovivo').hidden = !(telaOk || estado.participantes.some(p => p.tela));

  atualizarRodapeDispositivos();
}

/* A barra de conexão virou UMA linha só, em cima do painel do usuário
   (mesma leitura do "Voz conectado" do Discord): verde quando está no ar,
   vermelho quando caiu. Antes ela despejava o endereço do servidor e a
   contagem de pares em texto corrido lá embaixo do vídeo — frase longa,
   ficava cortada, e não dizia nada que a pessoa realmente precisasse. */
function definirBarraVoz(texto, caido) {
  const el = $('#info-conexao');
  if (!el) return;
  el.textContent = texto;
  const barra = el.closest('.barra-voz');
  if (barra) barra.classList.toggle('caido', !!caido);
}

function atualizarRodapeConexao() {
  const el = $('#info-conexao');
  if (!el) return;
  if (!estado.conectado) { definirBarraVoz('Desconectado', true); return; }

  const total = estado.pcs.size;
  const ok = Array.from(estado.pcs.values())
    .filter(pc => pc.connectionState === 'connected').length;
  definirBarraVoz(total
    ? `Conectado · ${ok}/${total} ${total === 1 ? 'par' : 'pares'} WebRTC`
    : 'Conectado');
}

/* qualidade ao vivo: resolução e fps que estão chegando indo/indo */
let relatorioQualidade = null;

function iniciarMonitorDeQualidade() {
  pararMonitorDeQualidade();
  relatorioQualidade = setInterval(() => {
    const el = $('#info-qualidade');
    if (!el) return;

    const meuLocal = estado.streamTela && estado.streamTela.getVideoTracks()[0];
    const alheio = [...estado.streams.values()]
      .flatMap(s => s.getVideoTracks())
      .find(t => t.readyState === 'live');
    const trilha = meuLocal || alheio;

    if (!trilha) { el.textContent = 'sem vídeo'; return; }

    const cfg = trilha.getSettings ? trilha.getSettings() : {};
    const w = cfg.width || 0;
    const h = cfg.height || 0;
    const fps = cfg.framesPerSecond ? Math.round(cfg.framesPerSecond) : 0;
    el.textContent = (w ? `${w}×${h}` : '—') + (fps ? ` · ${fps} fps` : '');
  }, 1500);
}

function pararMonitorDeQualidade() {
  clearInterval(relatorioQualidade);
  relatorioQualidade = null;
}

/* ------------------------------------------------------------------ */
/* Mini-janela flutuante                                               */
/* ------------------------------------------------------------------ */
/* Um quadradinho arrastável com a transmissão, para quem está só
   assistindo continuar vendo enquanto mexe em outra coisa. Fechar a
   mini-janela NÃO corta nada: o vídeo continua caindo, só some da
   tela.                                                              */

let _miniVideo = null;

function sidPrincipal() {
  for (const [sid, el] of estado.els) {
    const s = estado.streams.get(sid);
    if (s && s.getVideoTracks().some(t => t.readyState === 'live')) return sid;
  }
  return null;
}

function atualizarMiniJanela() {
  const painel = $('#mini-janela');
  if (!painel || painel.hidden) return;

  const sid = sidPrincipal();
  const s = sid ? estado.streams.get(sid) : null;
  const info = sid ? rotuloReal(sid) : null;

  // rotuloReal devolve {texto, tipo, eu} — era .nome, que nao existe, e o
  // titulo ficava sempre "Assistindo" mesmo quando dava pra ver de quem era.
  $('#mini-titulo').textContent = (info && info.texto) ? info.texto : 'Assistindo';

  if (!s) {
    const vazio = $('#mini-corpo').querySelector('.mini-vazio');
    if (!vazio) {
      $('#mini-corpo').innerHTML = '<p class="mini-vazio">Ninguém está transmitindo agora.</p>';
    }
    if (_miniVideo) { _miniVideo.srcObject = null; _miniVideo.remove(); _miniVideo = null; }
    return;
  }

  const vazio = $('#mini-corpo').querySelector('.mini-vazio');
  if (vazio) vazio.remove();

  if (!_miniVideo || !document.body.contains(_miniVideo)) {
    _miniVideo = document.createElement('video');
    _miniVideo.autoplay = true;
    _miniVideo.playsInline = true;
    // mudo de propósito: o áudio já sai pelo elemento principal, e tocar
    // duas vezes seria eco na hora de quem usa fone.
    _miniVideo.muted = true;
    $('#mini-corpo').appendChild(_miniVideo);
  }

  if (_miniVideo.srcObject !== s) _miniVideo.srcObject = s;
  _miniVideo.play().catch(() => { /* autoplay recusado: não é crítico */ });
}

function alternarMiniJanela() {
  const painel = $('#mini-janela');
  if (!painel) return;

  painel.hidden = !painel.hidden;
  $('#btn-mini')?.classList.toggle('ativo', !painel.hidden);

  if (!painel.hidden) {
    // abre no canto inferior direito, sem cobrir a barra de controle
    if (!painel.style.left) {
      const r = painel.getBoundingClientRect();
      painel.style.left = Math.max(8, window.innerWidth - r.width - 18) + 'px';
      painel.style.top = Math.max(8, window.innerHeight - r.height - 92) + 'px';
    }
    atualizarMiniJanela();
  }
}

function arrastarMiniJanela() {
  const painel = $('#mini-janela');
  const cabeca = painel && painel.querySelector('.mini-topo');
  if (!painel || !cabeca) return;

  let startX = 0, startY = 0, iniX = 0, iniY = 0, arrastando = false;

  cabeca.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('button')) return;   // o × não arrasta
    const r = painel.getBoundingClientRect();
    startX = ev.clientX; startY = ev.clientY;
    iniX = r.left; iniY = r.top;
    arrastando = true;
    painel.style.right = 'auto';
    // setPointerCapture pode falhar num evento sintético ou com o ponteiro
    // já solto — não vale derrubar o arrasto por causa disso
    try { cabeca.setPointerCapture(ev.pointerId); } catch { /* ignora */ }
    ev.preventDefault();
  });

  cabeca.addEventListener('pointermove', (ev) => {
    if (!arrastando) return;
    const r = painel.getBoundingClientRect();
    const x = Math.min(Math.max(4, iniX + (ev.clientX - startX)), window.innerWidth - r.width - 4);
    const y = Math.min(Math.max(4, iniY + (ev.clientY - startY)), window.innerHeight - r.height - 4);
    painel.style.left = x + 'px';
    painel.style.top = y + 'px';
  });

  const soltar = () => { arrastando = false; };
  cabeca.addEventListener('pointerup', soltar);
  cabeca.addEventListener('pointercancel', soltar);
}

/* ------------------------------------------------------------------ */
/* Anexos no chat: imagem, vídeo, áudio e documento                    */
/* ------------------------------------------------------------------ */
/* O servidor já aceitava /api/upload e já higienizava msg.anexo — o
   que faltava era a interface: escolher, subir com barra de progresso
   e desenhar na conversa. Este bloco fecha essa ponte.                */

const TAM_MAX_ARQUIVO = 25 * 1024 * 1024;
const RE_URL_FORTE = /^https?:\/\/[^\s<>"']+$/i;

/* O Electron carrega a página de file://, entao URL relativa
   (/arquivos/...) nao resolve nada. Tudo vira absoluto aqui. */
function origemHttp() {
  return String(estado.servidor || padraoServidor)
    .replace(/^ws(s?):/, 'http$1:')
    .replace(/\/+$/, '');
}
function absolvaUrl(u) {
  const s = String(u || '');
  if (!s) return '';
  // endereço pronto (http, data: de prévia local, blob: de mídia capturada)
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  // caminho do servidor (/arquivos/...): fica relativo de propósito, para
  // funcionar igual na sua rede e do outro lado da internet
  if (s.startsWith('/')) return origemHttp() + s;
  return origemHttp() + '/' + s;
}

function tamanhoLegivel(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  const un = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < un.length - 1) { v /= 1024; i++; }
  return (i === 0 ? String(Math.round(v)) : v.toFixed(v < 10 ? 1 : 0)) + ' ' + un[i];
}

function porExtensao(nome) {
  const m = /\.([a-z0-9]{1,6})$/i.exec(String(nome || ''));
  return m ? m[1].toLowerCase() : '';
}
function ehImagem(tipo, nome) {
  return /^image\//.test(tipo || '') ||
    /^(png|jpe?g|gif|webp|bmp|svg|avif|ico|jfif)$/.test(porExtensao(nome));
}
function ehVideo(tipo, nome) {
  return /^video\//.test(tipo || '') ||
    /^(mp4|webm|mkv|mov|avi|m4v|ogv|3gp)$/.test(porExtensao(nome));
}
function ehAudio(tipo, nome) {
  return /^audio\//.test(tipo || '') ||
    /^(mp3|wav|ogg|m4a|aac|flac|opus|wma)$/.test(porExtensao(nome));
}
function siglaArquivo(nome) {
  return (porExtensao(nome).toUpperCase() || 'FILE').slice(0, 4);
}

function anexoHtml(anexo) {
  if (!anexo || !anexo.url) return '';
  const url = escapeHtml(absolvaUrl(anexo.url));
  const nome = escapeHtml(String(anexo.nome || 'arquivo'));
  const tipo = String(anexo.tipo || '');
  const bruto = String(anexo.nome || '');
  const tam = escapeHtml(tamanhoLegivel(anexo.tamanho));

  if (ehImagem(tipo, bruto)) {
    // A imagem fica dentro de um link: se ela nao carregar (arquivo apagado do
    // servidor, link morto) o chrome mostra so o texto do alt e nao dava nem
    // para baixar. Assim sempre existe um caminho para abrir ou salvar o
    // arquivo, mesmo com a imagem quebrada. O data-luz segue funcionando para
    // o clique normal abrir em tela cheia.
    return `<div class="anexo-caixa">
      <a class="anexo-visual" href="${url}" target="_blank" rel="noopener noreferrer" title="Abrir ou baixar ${nome}">
        <img src="${url}" alt="${nome}" loading="lazy" data-luz="1">
      </a>
      <a class="anexo-baixar" href="${url}" target="_blank" rel="noopener noreferrer" download>baixar</a>
    </div>`;
  }
  if (ehVideo(tipo, bruto)) {
    return `<div class="anexo-caixa"><video src="${url}" controls preload="metadata" playsinline></video></div>`;
  }
  if (ehAudio(tipo, bruto)) {
    return `<div class="anexo-caixa"><audio class="anexo-audio" src="${url}" controls preload="metadata"></audio></div>`;
  }
  return `<div class="anexo-caixa"><a class="anexo-arquivo" href="${url}" target="_blank" rel="noopener noreferrer">
      <span class="fa">${escapeHtml(siglaArquivo(bruto))}</span>
      <span class="anexo-txt"><span class="fn">${nome}</span><span class="fs">${tam}</span></span>
      <span class="fx">abrir</span>
    </a></div>`;
}

/* Imagem que nao carregou (arquivo apagado do servidor, link morto) nao pode
   virar so um texto solto sem ninguem pra clicar. Aqui a gente marca a caixa
   como quebrada, tira a luzia (que abriria uma tela vazia) e deixa o link de
   "baixar" como caminho real. O CSP do app barra onerror inline, entao o
   ouvinte tem de ser ligado por JS mesmo. */
function ligarAnexos(raiz) {
  if (!raiz || !raiz.querySelectorAll) return;
  raiz.querySelectorAll('img[data-luz]').forEach(img => {
    const marcar = () => {
      const caixa = img.closest('.anexo-caixa');
      if (!caixa) return;
      caixa.classList.add('quebrado');
      img.removeAttribute('data-luz');       // nao abre mais a luzia vazia
      img.remove();
      const aviso = document.createElement('span');
      aviso.className = 'anexo-erro-texto';
      aviso.textContent = 'não foi possível carregar';
      const alvo = caixa.querySelector('.anexo-visual') || caixa;
      alvo.appendChild(aviso);
    };
    if (img.complete && img.naturalWidth === 0) marcar();
    else img.addEventListener('error', marcar, { once: true });
  });
}

/* ---------------- escolha, subida e envio ---------------- */

function limparAnexo() {
  estado.anexo = null;
  const caixa = $('#anexo-pendente');
  if (!caixa) return;
  caixa.hidden = true;
  caixa.classList.remove('erro', 'pronto');
  $('#anexo-mini').innerHTML = '';
  $('#anexo-progresso').style.width = '0%';
  const campo = $('#in-anexo');
  if (campo) campo.value = '';
}

function mostrarPendente(arquivo, situacao) {
  const caixa = $('#anexo-pendente');
  if (!caixa) return;
  caixa.hidden = false;
  caixa.classList.toggle('erro', !!situacao.erro);
  caixa.classList.toggle('pronto', !!situacao.pronto);
  $('#anexo-nome').textContent = arquivo.name;
  $('#anexo-tam').textContent = tamanhoLegivel(arquivo.size);
  $('#anexo-status').textContent = situacao.texto || '';
  $('#anexo-progresso').style.width = Math.max(0, Math.min(100, situacao.pct || 0)) + '%';
}

/* miniatura do arquivo escolhido, antes mesmo de subir */
function desenharMiniatura(arquivo) {
  const alvo = $('#anexo-mini');
  if (!alvo) return;
  alvo.innerHTML = '';
  const nome = arquivo.name;

  if (ehImagem(arquivo.type, nome)) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(arquivo);
    img.onload = () => URL.revokeObjectURL(img.src);
    alvo.appendChild(img);
    return;
  }
  if (ehVideo(arquivo.type, nome)) {
    const v = document.createElement('video');
    v.src = URL.createObjectURL(arquivo);
    v.muted = true; v.preload = 'metadata';
    v.onloadeddata = () => URL.revokeObjectURL(v.src);
    alvo.appendChild(v);
    return;
  }
  const s = document.createElement('span');
  s.textContent = siglaArquivo(nome);
  s.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:.4px';
  alvo.appendChild(s);
}

function escolherAnexos(lista) {
  const arquivo = lista && lista[0];
  if (!arquivo) return;

  if (arquivo.size > TAM_MAX_ARQUIVO) {
    estado.anexo = null;
    mostrarPendente(arquivo, {
      erro: true, pct: 0,
      texto: 'Arquivo grande demais — o limite é 25MB.'
    });
    aviso('Arquivo acima de 25MB.');
    return;
  }

  estado.anexo = { arquivo, url: '', nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size };
  desenharMiniatura(arquivo);
  mostrarPendente(arquivo, { pct: 4, texto: 'Enviando…' });
  subirAnexo(arquivo);
}

/* XHR em vez de fetch: só o XHR dá progresso de subida de verdade. */
function subirAnexo(arquivo) {
  const url = origemHttp() + '/api/upload?nome=' + encodeURIComponent(arquivo.name);
  const xhr = new XMLHttpRequest();

  const vivo = () => estado.anexo && estado.anexo.arquivo === arquivo;

  xhr.upload.onprogress = (ev) => {
    if (!vivo() || !ev.lengthComputable) return;
    const pct = Math.round((ev.loaded / ev.total) * 96);
    mostrarPendente(arquivo, { pct, texto: 'Enviando… ' + pct + '%' });
  };

  xhr.onload = () => {
    if (!vivo()) return;
    let resp = null;
    try { resp = JSON.parse(xhr.responseText); } catch (_e) { resp = null; }

    if (xhr.status === 200 && resp && resp.url) {
      estado.anexo.url = absolvaUrl(resp.url);
      estado.anexo.tipo = resp.tipo || arquivo.type;
      estado.anexo.tamanho = resp.tamanho || arquivo.size;
      estado.anexo.erro = false;
      mostrarPendente(arquivo, { pct: 100, pronto: true, texto: 'Pronto — tecle Enter para enviar' });
    } else {
      const erro = (resp && resp.erro) ? resp.erro : ('Falha no envio (' + xhr.status + ').');
      estado.anexo.erro = true;
      mostrarPendente(arquivo, { erro: true, pct: 0, texto: erro });
      aviso(erro);
    }
  };

  xhr.onerror = () => {
    if (!vivo()) return;
    estado.anexo.erro = true;
    mostrarPendente(arquivo, { erro: true, pct: 0, texto: 'Sem conexão com o servidor.' });
    aviso('Não consegui enviar o arquivo.');
  };

  xhr.open('POST', url);
  xhr.setRequestHeader('Content-Type', arquivo.type || 'application/octet-stream');
  xhr.send(arquivo);
}

/* devolve {texto, anexo} se houver algo para mandar, ou null */
function montarEnvio() {
  const campo = $('#in-chat');
  const texto = (campo ? campo.value : '').trim();
  const a = estado.anexo;

  if (a && a.url) {
    const anexo = { nome: a.nome, url: a.url, tipo: a.tipo, tamanho: a.tamanho };
    campo.value = '';
    limparAnexo();
    campo.focus();
    return { texto, anexo };
  }
  if (a) {
    // ainda subindo (ou falhou): não deixa o Enter sumir com o texto
    aviso(estado.anexo.erro
      ? 'O anexo falhou — escolha o arquivo de novo.'
      : 'O arquivo ainda está subindo, aguarde ficar "Pronto".');
    return null;
  }
  if (!texto) return null;
  campo.value = '';
  campo.focus();
  return { texto, anexo: null };
}

function enviarParaConversa(carga) {
  if (estado.conversa) {
    // conversa individual: mostra do meu lado na hora e manda só pra ela
    anexarMensagemPrivada({
      de: estado.meuId, para: estado.conversa,
      nome: estado.perfil.nome, avatar: estado.perfil.avatar,
      cor: estado.perfil.cor, texto: carga.texto, hora: Date.now(),
      anexo: carga.anexo || undefined
    });
    enviar({ tipo: 'privado', para: estado.conversa, texto: carga.texto, anexo: carga.anexo || undefined });
  } else {
    enviar({ tipo: 'chat', texto: carga.texto, anexo: carga.anexo || undefined });
  }
}

/* ---------------- luzia: ver imagem em tela cheia ---------------- */

function abrirLuzia(src) {
  let lz = $('#luzia');
  if (!lz) {
    lz = document.createElement('div');
    lz.id = 'luzia';
    lz.className = 'luzia hidden';
    lz.innerHTML = '<img alt=""><button class="luzia-fechar" type="button" title="Fechar">×</button>';
    document.body.appendChild(lz);
    lz.addEventListener('click', (ev) => {
      if (ev.target === lz || ev.target.classList.contains('luzia-fechar')) {
        lz.classList.add('hidden');
      }
    });
  }
  lz.querySelector('img').src = src;
  lz.classList.remove('hidden');
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

function criarMsgEl(item) {
  const div = document.createElement('div');
  if (item.sistema) {
    div.className = 'msg sistema';
    div.innerHTML = `<div class="texto-msg">${escapeHtml(item.texto)}</div>`;
  } else {
    div.className = 'msg';
    const p = { nome: item.nome, avatar: item.avatar, cor: item.cor };
    div.innerHTML = `
      ${avatarHtml(p, 'avatar')}
      <div class="corpo-msg">
        <div class="cab-msg">
          <span class="autor-msg" style="color:${corDe(p.cor || 0)}">${escapeHtml(item.nome)}</span>
          <span class="hora-msg">${horaDe(item.hora)}</span>
        </div>
        ${item.texto ? `<div class="texto-msg">${escapeHtml(item.texto)}</div>` : ''}
        ${anexoHtml(item.anexo)}
      </div>`;
  }
  // liga o tratamento de imagem quebrada depois que o HTML entrou no documento
  ligarAnexos(div);
  return div;
}

function anexarMensagem(item, silencioso) {
  if (!item) return;
  estado.historico.push(item);
  if (estado.historico.length > 400) estado.historico.shift();

  // galeria aberta: um anexo novo aparece lá na hora, sem trocar de canal
  if (estado.canal === 'arquivos' && item.anexo) desenharArquivos();

  // estou olhando uma conversa individual: só guarda, não atira na tela errada
  if (estado.conversa) return;

  const lista = $('#lista-chat');
  if (!lista) return;
  const vazio = lista.querySelector('.chat-vazio');
  if (vazio) vazio.remove();
  lista.appendChild(criarMsgEl(item));
  $('#cont-chat').textContent = estado.historico.length;
  lista.scrollTop = lista.scrollHeight;
}

/* ------------------------------------------------------------------ */
/* Conversa individual                                                 */
/* ------------------------------------------------------------------ */
/* Só eu e a pessoa enderecada. O servidor guarda num balde separado do
   chat da sala, entao quem entra depois nao desvia conversa alheia.   */

function acharPessoa(id) {
  if (!id) return null;
  return estado.participantes.find(p => p.id === id)
    || (estado.nomes.has(id) ? { id, nome: estado.nomes.get(id) } : null);
}

function anexarMensagemPrivada(item) {
  if (!item) return;
  const outro = item.de === estado.meuId ? item.para : item.de;
  if (!outro) return;

  if (!estado.privados.has(outro)) estado.privados.set(outro, []);
  const caixa = estado.privados.get(outro);

  const repetida = caixa.some(m => m.hora === item.hora && m.de === item.de && m.texto === item.texto);
  if (!repetida) {
    caixa.push(item);
    if (caixa.length > 200) caixa.shift();
  }

  if (estado.conversa !== outro) {
    estado.naoLidas.set(outro, (estado.naoLidas.get(outro) || 0) + 1);
  }
  // galeria aberta também recebe anexos vindos de conversas privadas
  if (estado.canal === 'arquivos' && item.anexo) desenharArquivos();

  montarAbasConversa();
  if (estado.conversa === outro) desenharChat();
}

function montarAbasConversa() {
  const box = $('#abas-conversa');
  if (!box) return;

  const partes = [`<button class="aba-conversa${estado.conversa ? '' : ' ativa'}" data-com="" type="button">Sala</button>`];

  for (const id of estado.privados.keys()) {
    const p = acharPessoa(id);
    const nome = p ? p.nome : 'Conversa';
    const n = estado.naoLidas.get(id) || 0;
    partes.push(
      `<button class="aba-conversa${estado.conversa === id ? ' ativa' : ''}" data-com="${escapeHtml(id)}" type="button">` +
      `${escapeHtml(nome)}${n ? `<i class="ponto-nao-lido">${n > 9 ? '9+' : n}</i>` : ''}</button>`
    );
  }

  box.innerHTML = partes.join('');
  box.querySelectorAll('.aba-conversa').forEach(b => {
    b.addEventListener('click', () => abrirConversa(b.dataset.com || ''));
  });

  // o painel esquerdo espelha as mesmas conversas, com badge de não-lidas
  desenharListaDms();
}

function abrirConversa(id) {
  // conversa acontece no chat; se a galeria estiver aberta, volta pra ele
  if (estado.canal === 'arquivos') trocarCanal('geral');
  estado.conversa = id || '';
  if (id) {
    estado.naoLidas.delete(id);
    if (!estado.privados.has(id)) {
      estado.privados.set(id, []);
      // pede o histórico que já existiu entre nós dois
      enviar({ tipo: 'historico-privado', para: id });
    }
  }
  montarAbasConversa();
  desenharChat();

  const campo = $('#in-chat');
  if (campo) {
    campo.placeholder = id ? 'Mensagem privada' : 'Enviar mensagem';
    campo.focus();
  }
}

function desenharChat() {
  const lista = $('#lista-chat');
  if (!lista) return;
  lista.innerHTML = '';

  if (estado.conversa) {
    const msgs = estado.privados.get(estado.conversa) || [];
    const p = acharPessoa(estado.conversa);
    if (!msgs.length) {
      lista.innerHTML = `<div class="chat-vazio">Conversa com <b>${escapeHtml(p ? p.nome : 'essa pessoa')}</b>.` +
        ` Só vocês dois leem isto.</div>`;
    }
    msgs.forEach(m => lista.appendChild(criarMsgEl(m)));
    $('#cont-chat').textContent = msgs.length;
  } else {
    if (!estado.historico.length) {
      lista.innerHTML = '<div class="chat-vazio">Ainda não há mensagens. Diga oi!</div>';
    }
    estado.historico.forEach(m => lista.appendChild(criarMsgEl(m)));
    $('#cont-chat').textContent = estado.historico.length;
  }

  lista.scrollTop = lista.scrollHeight;
}

/* ------------------------------------------------------------------ */
/* Canal #arquivos                                                     */
/* ------------------------------------------------------------------ */
/* Não existe um segundo fluxo de mensagens. O canal mostra, organizado
   em galeria, tudo que já foi anexado no chat da sala e nas conversas
   privadas — assim ele é de verdade sem pedir nada novo ao servidor que
   já está publicado. Quem entra na sala depois recebe o histórico e a
   galeria enche sozinha.                                              */

function classificarAnexo(a) {
  if (!a) return 'arquivo';
  if (ehImagem(a.tipo, a.nome)) return 'imagem';
  if (ehVideo(a.tipo, a.nome)) return 'video';
  if (ehAudio(a.tipo, a.nome)) return 'audio';
  return 'arquivo';
}

function coletarArquivos() {
  const saida = [];
  const visto = new Set();

  const empurrar = (item) => {
    const a = item && item.anexo;
    if (!a || !a.url) return;
    if (visto.has(a.url)) return;      // anexo repetido aparece uma vez só
    visto.add(a.url);
    saida.push({
      nome: a.nome || 'arquivo',
      url: a.url,
      tipo: a.tipo || '',
      tamanho: a.tamanho || 0,
      de: item.de || '',
      hora: item.hora || 0,
      classe: classificarAnexo(a)
    });
  };

  estado.historico.forEach(empurrar);
  for (const caixa of estado.privados.values()) caixa.forEach(empurrar);

  return saida.sort((a, b) => b.hora - a.hora);
}

function quemEnviou(id) {
  if (!id) return 'alguém';
  if (id === estado.meuId) return 'você';
  const p = acharPessoa(id);
  return (p && p.nome) || estado.nomes.get(id) || 'alguém';
}

function desenharArquivos() {
  const grade = $('#arq-grade');
  if (!grade) return;

  const filtro = estado.filtroArquivos || 'tudo';
  const todos = coletarArquivos();
  const lista = filtro === 'tudo' ? todos : todos.filter(a => a.classe === filtro);

  document.querySelectorAll('.arq-filtro').forEach(b => {
    b.classList.toggle('ativo', b.dataset.tipo === filtro);
  });

  const resumo = $('#arq-resumo');
  if (resumo) {
    if (todos.length) {
      const bytes = todos.reduce((s, a) => s + (a.tamanho || 0), 0);
      resumo.innerHTML = `<b>${todos.length}</b> ${todos.length === 1 ? 'item' : 'itens'}` +
        ` · ${escapeHtml(tamanhoLegivel(bytes))} no total`;
    } else {
      resumo.textContent = '';
    }
  }

  if (!lista.length) {
    grade.innerHTML = todos.length
      ? `<div class="arq-vazio">Nada em <b>${escapeHtml(filtro)}</b> por enquanto.</div>`
      : `<div class="arq-vazio">Nenhum arquivo compartilhado ainda.<br>` +
        `Toque no <b>clipe</b> do chat — ou arraste um arquivo pra dentro dele —<br>` +
        `que tudo aparece aqui, organizado por tipo.</div>`;
    return;
  }

  grade.innerHTML = lista.map(a => {
    const url = escapeHtml(absolvaUrl(a.url));
    const nome = escapeHtml(a.nome);
    const meta = [quemEnviou(a.de), a.hora ? horaDe(a.hora) : '']
      .filter(Boolean).join(' · ');

    let mini;
    if (a.classe === 'imagem') {
      mini = `<img src="${url}" alt="${nome}" loading="lazy" />`;
    } else if (a.classe === 'video') {
      mini = `<video src="${url}" preload="metadata" muted playsinline></video>`;
    } else if (a.classe === 'audio') {
      mini = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z"/></svg>`;
    } else {
      mini = `<span class="arq-sigla">${escapeHtml(siglaArquivo(a.nome))}</span>`;
    }

    return `<a class="arq-card" href="${url}" target="_blank" rel="noopener noreferrer" title="${nome}">
      <span class="arq-miniatura ${a.classe}">${mini}</span>
      <span class="arq-corpo">
        <span class="arq-nome">${nome}</span>
        <span class="arq-meta">${escapeHtml(meta)} · ${escapeHtml(tamanhoLegivel(a.tamanho))}</span>
      </span>
    </a>`;
  }).join('');
}

/* ------------------------------------------------------------------ */
/* Conversas privadas no painel esquerdo                               */
/* ------------------------------------------------------------------ */
/* As abas no topo do chat continuam existindo; isto aqui é o espelho
   delas no painel, que é onde o Discord coloca. A vantagem é o badge de
   não-lidas ficar visível sem precisar estar olhando o chat.          */

function desenharListaDms() {
  const box = $('#lista-dms');
  if (!box) return;

  const ids = Array.from(estado.privados.keys());
  const totalNaoLidas = ids.reduce((s, id) => s + (estado.naoLidas.get(id) || 0), 0);

  // o cabeçalho ganha o contador quando há mensagens novas
  const rot = document.querySelector('.rot-cat-dms');
  if (rot) rot.textContent = totalNaoLidas
    ? `Conversas (${totalNaoLidas > 9 ? '9+' : totalNaoLidas})`
    : 'Conversas';

  const partes = [`<li><button class="dm-item${estado.conversa ? '' : ' ativa'}" data-com="" type="button">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/></svg>
      <span class="dm-nome">Sala</span>
    </button></li>`];

  for (const id of ids) {
    const p = acharPessoa(id);
    const nome = (p && p.nome) || estado.nomes.get(id) || 'Conversa';
    const n = estado.naoLidas.get(id) || 0;
    const dado = { id, nome, avatar: (p && p.avatar) || '', cor: (p && p.cor) || 0 };

    partes.push(`<li><button class="dm-item${estado.conversa === id ? ' ativa' : ''}" data-com="${escapeHtml(id)}" type="button">
      ${avatarHtml(dado, 'avatar')}
      <span class="dm-nome">${escapeHtml(nome)}</span>
      ${n ? `<i class="ponto-nao-lido">${n > 9 ? '9+' : n}</i>` : ''}
    </button></li>`);
  }

  box.innerHTML = partes.join('');

  box.querySelectorAll('.dm-item').forEach(b => {
    b.addEventListener('click', () => {
      abrirConversa(b.dataset.com || '');
      if (estado.canal === 'arquivos') trocarCanal('geral');
    });
  });
}

/* Escolher com quem conversar. Mostra só quem está na sala agora, que é
   a única gente com quem dá para conversar — o servidor endereça o
   privado para quem está conectado na mesma sala.                     */
function abrirSeletorPessoa() {
  const box = $('#lista-escolher-pessoa');
  if (!box) return;

  const candidatos = estado.participantes.filter(p => p.id !== estado.meuId);

  if (!candidatos.length) {
    box.innerHTML = `<li class="escolha-vazia">Você é a única pessoa na sala por enquanto.<br>` +
      `Compartilhe o código da sala para alguém entrar — aí dá para conversar.</li>`;
  } else {
    box.innerHTML = candidatos.map(p => {
      const dado = { id: p.id, nome: p.nome, avatar: p.avatar || '', cor: p.cor || 0 };
      return `<li><button class="escolha-pessoa" data-com="${escapeHtml(p.id)}" type="button">
        ${avatarHtml(dado, 'avatar')}
        <span class="escolha-nome">${escapeHtml(p.nome || 'Alguém')}</span>
        <span class="escolha-dica">conversar</span>
      </button></li>`;
    }).join('');

    box.querySelectorAll('.escolha-pessoa').forEach(b => {
      b.addEventListener('click', () => {
        fecharModal('#modal-nova-dm');
        abrirConversa(b.dataset.com);
        if (estado.canal === 'arquivos') trocarCanal('geral');
      });
    });
  }

  abrirModal('#modal-nova-dm');
}

/* ------------------------------------------------------------------ */
/* Troca de canal                                                      */
/* ------------------------------------------------------------------ */
/* '#geral' é o chat; '#arquivos' é a galeria. O campo de digitação
   some na galeria para não dar a entender que existe um segundo chat. */
function trocarCanal(nome) {
  const alvo = (nome === 'arquivos') ? 'arquivos' : 'geral';
  estado.canal = alvo;

  document.querySelectorAll('.canal[data-canal]').forEach(c => {
    c.classList.toggle('ativo', c.dataset.canal === alvo);
  });

  const chat = $('#lista-chat');
  const galeria = $('#painel-arquivos');
  const form = $('#form-chat');
  const soltar = $('#zona-soltar');

  if (alvo === 'arquivos') {
    if (chat) chat.hidden = true;
    if (galeria) galeria.hidden = false;
    if (form) form.hidden = true;
    if (soltar) soltar.hidden = true;
    desenharArquivos();
  } else {
    if (chat) chat.hidden = false;
    if (galeria) galeria.hidden = true;
    if (form) form.hidden = false;
    desenharChat();
  }

  // cabeçalho do chat acompanha o canal
  const ic = document.querySelector('.ic-canal-chat');
  if (ic) ic.textContent = '#';

  const campo = $('#in-chat');
  if (campo && alvo === 'geral') {
    campo.placeholder = estado.conversa ? 'Mensagem privada' : 'Mensagem na Sala';
  }

  const cab = document.querySelector('.chat-cabecalho');
  if (cab) cab.classList.toggle('em-arquivos', alvo === 'arquivos');
}

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

function validarEntrada() {
  const nome = $('#in-nome').value.trim();
  if (!nome) {
    definirErroEntrada('Digite seu nome para continuar.');
    $('#in-nome').focus();
    return false;
  }
  estado.perfil.nome = nome;
  salvar('perfil', estado.perfil);
  return true;
}

async function acaoCriar() {
  if (!validarEntrada()) return;
  definirErroEntrada('');
  $('#btn-criar').disabled = true;
  $('#btn-entrar').disabled = true;
  try { await entrarNaSala(null); }
  finally { $('#btn-criar').disabled = false; $('#btn-entrar').disabled = false; }
}

async function acaoEntrar() {
  if (!validarEntrada()) return;

  const leitura = lerConvite($('#in-codigo').value);
  if (!leitura) {
    definirErroEntrada('Cole o convite completo ou digite os 6 caracteres da sala.');
    $('#in-codigo').focus();
    return;
  }

  // Convite de outro computador: aponta o app para o servidor de quem
  // criou a sala antes de pedir para entrar.
  if (leitura.servidor) {
    $('#in-servidor').value = leitura.servidor;
    estado.servidor = leitura.servidor;
    salvar('servidor', leitura.servidor);
  }

  definirErroEntrada('');
  $('#btn-criar').disabled = true;
  $('#btn-entrar').disabled = true;
  try { await entrarNaSala(leitura.codigo); }
  finally { $('#btn-criar').disabled = false; $('#btn-entrar').disabled = false; }
}

function sairDaSala() {
  enviar({ tipo: 'sair' });
  limparTudo();
  estado.entrando = false;
  try { estado.ws && estado.ws.close(); } catch { /* ignora */ }
  estado.ws = null;
  estado.codigo = null;
  estado.meuId = null;
  estado.participantes = [];
  $('#lista-chat').innerHTML = '<div class="chat-vazio">Ainda não há mensagens. Diga oi!</div>';
  const filaSair = $('#fila-voz');
  if (filaSair) filaSair.innerHTML = '';
  $('#tela-sala').hidden = true;
  $('#tela-entrada').hidden = false;
  definirStatusEntrada('');
  definirErroEntrada('');
}

function limparTudo() {
  // solta os medidores de áudio: senão as streams mortas ficariam presas
  // na memória, e o anel continuaria acendendo para quem já saiu
  pararDetecaoDeFala();

  for (const id of Array.from(estado.pcs.keys())) encerrarPar(id);
  estado.pcs.clear();
  estado.filaIce.clear();

  for (const [sid, el] of estado.els) {
    el.srcObject = null;
    el.remove();
  }
  estado.els.clear();
  estado.streams.clear();
  estado.tilesVisiveis = '';

  if (estado.streamTela) { estado.streamTela.getTracks().forEach(t => { try { t.stop(); } catch { /* ignora */ } }); estado.streamTela = null; }
  if (estado.streamCamera) { estado.streamCamera.getTracks().forEach(t => { try { t.stop(); } catch { /* ignora */ } }); estado.streamCamera = null; }
  if (estado.streamMicro) { estado.streamMicro.getTracks().forEach(t => { try { t.stop(); } catch { /* ignora */ } }); estado.streamMicro = null; }
  pararMedidor();
  pararMonitorDeQualidade();

  const grade = $('#grade-videos');
  if (grade) { grade.innerHTML = ''; grade.hidden = true; }
}

/* ------------------------------------------------------------------ */
/* Modais: configurações e perfil                                      */
/* ------------------------------------------------------------------ */

function abrirModal(sel) { $(sel).hidden = false; }
function fecharModal(sel) { $(sel).hidden = true; }

/* ------------------------------------------------------------------ */
/* Temas                                                               */
/* ------------------------------------------------------------------ */
/* 10 temas de anime + o Meia-Noite original. Cada tema so define
   variaveis de cor no CSS, entao trocar nao mexe em nenhum layout.  */

const TEMAS = [
  { id: 'meia-noite',  nome: 'Meia-Noite',       cores: ['#6d5efc', '#b45cf0'] },
  { id: 'zenitsu',     nome: 'Zenitsu',          cores: ['#facc15', '#f59e0b'] },
  { id: 'sukuna',      nome: 'Sukuna',           cores: ['#e11d48', '#7f1d1d'] },
  { id: 'naruto',      nome: 'Naruto',           cores: ['#f97316', '#7c3aed'] },
  { id: 'evangelion',  nome: 'Evangelion',       cores: ['#8b5cf6', '#39ff88'] },
  { id: 'onepiece',    nome: 'One Piece',        cores: ['#e0b23c', '#1d4ed8'] },
  { id: 'deathnote',   nome: 'Death Note',       cores: ['#ffffff', '#e50914'] },
  { id: 'pokemon',     nome: 'Pokémon',          cores: ['#ffcb05', '#3b6fe0'] },
  { id: 'gojo',        nome: 'Gojo',             cores: ['#38bdf8', '#2563eb'] },
  { id: 'chainsawman', nome: 'Chainsaw Man',     cores: ['#dc2626', '#f59e0b'] },
  { id: 'mha',         nome: 'My Hero Academia', cores: ['#22c55e', '#ef4444'] }
];

function aplicarTema(id) {
  const valido = TEMAS.some(t => t.id === id) ? id : 'meia-noite';
  estado.tema = valido;
  document.documentElement.dataset.tema = valido;
}

function escolherTema(id) {
  aplicarTema(id);
  salvar('tema', id);
  montarGradeTemas();
}

function montarGradeTemas() {
  const grade = $('#grade-temas');
  if (!grade) return;
  grade.innerHTML = '';

  TEMAS.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tema-btn' + (t.id === estado.tema ? ' sel' : '');

    const amostra = document.createElement('span');
    amostra.className = 'amostra';
    amostra.style.background = `linear-gradient(135deg, ${t.cores[0]} 0%, ${t.cores[1]} 100%)`;

    const nome = document.createElement('span');
    nome.textContent = t.nome;

    b.append(amostra, nome);
    b.onclick = () => escolherTema(t.id);
    grade.appendChild(b);
  });
}

/* ------------------------------------------------------------------ */
/* Foto de perfil: escolher, cortar e guardar                          */
/* ------------------------------------------------------------------ */
/* A pessoa pega um arquivo do computador, arrasta e dá zoom dentro do
   redondo, e confirma. Guardamos um quadrado 256x256 recortado da
   região visível — é recorte, não encolhimento forçado, então a imagem
   mantém a proporção original e nunca sai distorcida.                 */

const LADO_FOTO = 256;

/* Foto colada em base64. O teste é deliberadamente apertado: o que vem
   de fora do nosso computador só entra se for exatamente uma imagem
   base64 conhecida — nada que consiga virar script dentro do <img>. */
const RE_FOTO = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
function ehFoto(avatar) {
  return typeof avatar === 'string' && RE_FOTO.test(avatar);
}

const corte = { natW: 0, natH: 0, base: 1, escala: 1, tx: 0, ty: 0 };

function aplicarTransforme() {
  const el = $('#corte-img');
  if (!el) return;
  const dw = corte.natW * corte.escala;
  const dh = corte.natH * corte.escala;
  // a foto nunca pode fugir da área: segura pelas bordas
  corte.tx = Math.min(0, Math.max(LADO_FOTO - dw, corte.tx));
  corte.ty = Math.min(0, Math.max(LADO_FOTO - dh, corte.ty));
  el.style.transform = `translate(${corte.tx}px, ${corte.ty}px) scale(${corte.escala})`;
}

function centrarCorte() {
  corte.tx = (LADO_FOTO - corte.natW * corte.escala) / 2;
  corte.ty = (LADO_FOTO - corte.natH * corte.escala) / 2;
  aplicarTransforme();
}

function abrirCorte(dataUrl) {
  const el = $('#corte-img');
  if (!el) return;
  const quandoPronto = () => {
    corte.natW = el.naturalWidth;
    corte.natH = el.naturalHeight;
    if (!corte.natW || !corte.natH) {
      aviso('Não consegui ler essa imagem.', 'erro');
      return;
    }
    // escala base = "cobrir": o menor lado da foto tem que tapar o
    // quadrado, senão sobraria barra vazia no redondo quando a foto é
    // mais alta que larga. O lado que sobrar dá para arrastar depois.
    corte.base = LADO_FOTO / Math.min(corte.natW, corte.natH);
    corte.escala = corte.base;
    const zoom = $('#range-zoom');
    if (zoom) zoom.value = '100';
    centrarCorte();
    abrirModal('#modal-corte');
  };
  el.onload = quandoPronto;
  el.src = dataUrl;
}

function ligarArrasteCorte() {
  const area = $('#corte-area');
  if (!area) return;
  let arrastando = false, x0 = 0, y0 = 0, tx0 = 0, ty0 = 0;

  area.addEventListener('pointerdown', (ev) => {
    if (!corte.natW) return;
    arrastando = true;
    area.classList.add('arrastando');
    try { area.setPointerCapture(ev.pointerId); } catch { /* ignora */ }
    x0 = ev.clientX; y0 = ev.clientY;
    tx0 = corte.tx; ty0 = corte.ty;
    ev.preventDefault();
  });

  area.addEventListener('pointermove', (ev) => {
    if (!arrastando) return;
    corte.tx = tx0 + (ev.clientX - x0);
    corte.ty = ty0 + (ev.clientY - y0);
    aplicarTransforme();
  });

  const soltar = (ev) => {
    if (!arrastando) return;
    arrastando = false;
    area.classList.remove('arrastando');
    try { area.releasePointerCapture(ev.pointerId); } catch { /* ignora */ }
  };
  area.addEventListener('pointerup', soltar);
  area.addEventListener('pointercancel', soltar);
}

/** Recorta a área visível e devolve um quadrado 256x256 em base64. */
function recortarFoto() {
  const el = $('#corte-img');
  if (!el || !corte.natW) return null;

  const canvas = document.createElement('canvas');
  canvas.width = LADO_FOTO;
  canvas.height = LADO_FOTO;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // o que está dentro do quadrado, medido na imagem original:
  // como a escala é uniforme nos dois eixos, a proporção se mantém.
  const sx = -corte.tx / corte.escala;
  const sy = -corte.ty / corte.escala;
  const l = LADO_FOTO / corte.escala;
  ctx.drawImage(el, sx, sy, l, l, 0, 0, LADO_FOTO, LADO_FOTO);

  try { return canvas.toDataURL('image/jpeg', 0.9); }
  catch { return null; }
}

function escolherFotoDoComputador() {
  const inp = $('#in-foto-perfil');
  if (inp) inp.click();
}

function aoEscolherFoto(ev) {
  const inp = ev.target;
  const arq = inp.files && inp.files[0];
  inp.value = ''; // deixa escolher o mesmo arquivo outra vez
  if (!arq) return;

  if (arq.type && !arq.type.startsWith('image/')) {
    aviso('Esse arquivo não é uma imagem.', 'erro');
    return;
  }

  const leitor = new FileReader();
  leitor.onload = () => abrirCorte(String(leitor.result));
  leitor.onerror = () => aviso('Não consegui abrir essa imagem.', 'erro');
  leitor.readAsDataURL(arq);
}

function aplicarCorteNoPerfil() {
  const foto = recortarFoto();
  if (!foto) { aviso('Não consegui recortar essa imagem.', 'erro'); return; }

  estado.perfil.avatar = foto;
  salvar('perfil', estado.perfil);
  fecharModal('#modal-corte');
  atualizarPreviewPerfil();

  if (estado.codigo) enviar({ tipo: 'perfil', nome: estado.perfil.nome, avatar: estado.perfil.avatar, cor: estado.perfil.cor });
  desenharParticipantes();
  aviso('Foto de perfil aplicada.', 'ok');
}

function removerFotoDoPerfil() {
  estado.perfil.avatar = '😀';
  salvar('perfil', estado.perfil);
  atualizarPreviewPerfil();
  montarGradeEmojis();
  if (estado.codigo) enviar({ tipo: 'perfil', nome: estado.perfil.nome, avatar: estado.perfil.avatar, cor: estado.perfil.cor });
}

function montarGradeEmojis() {
  const grade = $('#grade-emojis');
  if (!grade) return;
  grade.innerHTML = '';
  EMOJIS.forEach(e => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.dataset.emoji = e;
    b.classList.toggle('sel', e === estado.perfil.avatar);
    b.onclick = () => {
      estado.perfil.avatar = e;
      grade.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
      atualizarPreviewPerfil();
    };
    grade.appendChild(b);
  });
}

function montarGradeCores() {
  const grade = $('#grade-cores');
  if (!grade) return;
  grade.innerHTML = '';
  CORES.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = corDe(c);
    b.dataset.cor = c;
    b.classList.toggle('sel', c === estado.perfil.cor);
    b.onclick = () => {
      estado.perfil.cor = c;
      grade.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
      atualizarPreviewPerfil();
    };
    grade.appendChild(b);
  });
}

function atualizarPreviewPerfil() {
  const el = $('#avatar-preview');
  if (!el) return;

  const temFoto = ehFoto(estado.perfil.avatar);
  // com foto, a cor fica só no aro — pôr gradiente atrás escureceria a imagem
  el.style.background = temFoto ? 'var(--superficie-2)' : corDe(estado.perfil.cor);
  el.innerHTML = temFoto
    ? `<img src="${estado.perfil.avatar}" alt="" />`
    : escapeHtml(estado.perfil.avatar || iniciais($('#in-perfil-nome').value || estado.perfil.nome));

  const btnRemover = $('#btn-remover-foto');
  if (btnRemover) btnRemover.hidden = !temFoto;
}

function abrirPerfil() {
  $('#in-perfil-nome').value = estado.perfil.nome;
  montarGradeEmojis();
  montarGradeCores();
  atualizarPreviewPerfil();
  abrirModal('#modal-perfil');
}

function salvarPerfil() {
  const nome = $('#in-perfil-nome').value.trim();
  if (!nome) { aviso('Digite um nome.', 'erro'); return; }
  estado.perfil.nome = nome;
  salvar('perfil', estado.perfil);

  $('#in-nome').value = nome;
  enviar({ tipo: 'perfil', nome, avatar: estado.perfil.avatar, cor: estado.perfil.cor });

  fecharModal('#modal-perfil');
  desenharParticipantes();
  aviso('Perfil atualizado.', 'ok');
}

let _pessoaSelecionada = '';

function abrirPerfilPessoa(id) {
  const p = acharPessoa(id);
  if (!p) return;
  _pessoaSelecionada = id;

  const souEu = id === estado.meuId;
  const alvo = $('#pessoa-avatar');
  if (ehFoto(p.avatar)) {
    alvo.style.background = 'var(--superficie-2)';
    alvo.innerHTML = `<img src="${p.avatar}" alt="" />`;
  } else {
    alvo.textContent = p.avatar || '?';
  }
  alvo.style.background = `linear-gradient(135deg, ${corDe(p.cor || 0)}, ${corDe(((p.cor || 0) + 55) % 360)})`;

  $('#pessoa-nome').textContent = p.nome || '—';
  $('#pessoa-nome').style.color = corDe(p.cor || 0);

  const selos = [];
  if (souEu) selos.push('<span class="selo eu">você</span>');
  if (p.tela) selos.push('<span class="selo tela">transmitindo tela</span>');
  if (p.camera) selos.push('<span class="selo camera">câmera ligada</span>');
  if (p.mudo) selos.push('<span class="selo mudo">mudo</span>');
  else if (p.micro) selos.push('<span class="selo ok">microfone ativo</span>');
  if (p.idle) selos.push('<span class="selo">sem transmitir</span>');
  $('#pessoa-selos').innerHTML = selos.join('') || '<span class="selo">na sala</span>';

  $('#btn-conversa-pessoa').hidden = souEu;
  abrirModal('#modal-pessoa');
}

async function testarCamera() {
  const box = $('#teste-cam');
  const video = $('#video-teste');
  try {
    const restricoes = { video: { width: { ideal: 1280 } } };
    if (estado.disp.camera) restricoes.video.deviceId = { exact: estado.disp.camera };
    const s = await navigator.mediaDevices.getUserMedia(restricoes);
    video.srcObject = s;
    box.hidden = false;
    video.play().catch(() => {});
    $('#btn-fechar-teste').onclick = () => {
      s.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      box.hidden = true;
    };
  } catch (erro) {
    aviso('Teste de câmera falhou: ' + motivoMedia(erro), 'erro');
  }
}

/* ------------------------------------------------------------------ */
/* Conta: entrar, criar, recuperar senha                               */
/* ------------------------------------------------------------------ */
/* O servidor já sabia fazer tudo isso desde o começo — cadastro, login,
   código no e-mail, código de suporte — e ficou sem tela. Aqui é só a
   ponte: chama a API, guarda a sessão e desenha quem entrou.            */

async function apiConta(caminho, corpo, metodo) {
  const r = await fetch(origemHttp() + caminho, {
    method: metodo || (corpo ? 'POST' : 'GET'),
    headers: Object.assign({ 'Content-Type': 'application/json' },
      estado.token ? { Authorization: 'Bearer ' + estado.token } : {}),
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: 'no-store'
  });
  let dados = {};
  try { dados = await r.json(); } catch (_e) { /* resposta sem corpo */ }
  if (!r.ok || dados.erro) {
    throw new Error(dados.erro || 'Erro ' + r.status + ' ao falar com o servidor.');
  }
  return dados;
}

function carregarSessao() {
  try {
    estado.token = localStorage.getItem('nexo.token') || null;
    estado.usuario = JSON.parse(localStorage.getItem('nexo.usuario') || 'null');
  } catch { estado.token = null; estado.usuario = null; }
  // token sem usuário (ou usuário sem token) não é sessão nenhuma — se
  // um dos dois faltar, a pessoa entra como visitante e ninguém é enganado
  if (!estado.token || !estado.usuario || !estado.usuario.id) {
    estado.token = null;
    estado.usuario = null;
  }
}

function gravarSessao(token, usuario) {
  estado.token = token || null;
  estado.usuario = usuario || null;
  try {
    if (token) localStorage.setItem('nexo.token', token);
    else localStorage.removeItem('nexo.token');
    if (usuario) localStorage.setItem('nexo.usuario', JSON.stringify(usuario));
    else localStorage.removeItem('nexo.usuario');
  } catch { /* sem espaço: a sessão vale só nesta janela */ }

  // Quem acabou de entrar passa a aparecer com o nome da conta. Sem isso
  // a pessoa cria conta e continua batendo no chat com o nome antigo.
  if (usuario && usuario.nome) {
    estado.perfil.nome = usuario.nome;
    if (usuario.avatar) estado.perfil.avatar = usuario.avatar;
    if (typeof usuario.cor === 'number') estado.perfil.cor = usuario.cor;
    salvar('perfil', estado.perfil);
    const inNome = $('#in-nome');
    if (inNome) inNome.value = usuario.nome;
  }
  atualizarBlocoConta();
}

function mostrarErroConta(texto) {
  const el = $('#erro-conta');
  const ok = $('#status-conta');
  if (ok) { ok.hidden = true; ok.textContent = ''; }
  if (!el) return;
  el.textContent = texto || '';
  el.hidden = !texto;
}
function mostrarStatusConta(texto) {
  const el = $('#status-conta');
  const er = $('#erro-conta');
  if (er) { er.hidden = true; er.textContent = ''; }
  if (!el) return;
  el.textContent = texto || '';
  el.hidden = !texto;
}

function mostrarErroRecuperar(texto) {
  const el = $('#erro-recuperar');
  const ok = $('#status-recuperar');
  if (ok) { ok.hidden = true; ok.textContent = ''; }
  if (!el) return;
  el.textContent = texto || '';
  el.hidden = !texto;
}
function mostrarStatusRecuperar(texto) {
  const el = $('#status-recuperar');
  const er = $('#erro-recuperar');
  if (er) { er.hidden = true; er.textContent = ''; }
  if (!el) return;
  el.textContent = texto || '';
  el.hidden = !texto;
}

function atualizarBlocoConta() {
  const dentro = $('#conta-deslogada');
  const fora = $('#conta-logada');
  if (!dentro || !fora) return;

  const logado = !!estado.usuario;
  dentro.hidden = logado;
  fora.hidden = !logado;

  const suporte = $('#conta-suporte-txt');
  if (suporte && !logado) { suporte.hidden = true; suporte.textContent = ''; }
  if (!logado) return;

  const av = $('#conta-mini-avatar');
  const foto = String(estado.usuario.avatar || '');
  if (av) {
    av.innerHTML = '';
    if (/^data:image\//.test(foto)) {
      const img = document.createElement('img');
      img.src = foto; img.alt = '';
      av.appendChild(img);
    } else {
      av.textContent = foto || iniciais(estado.usuario.nome);
    }
  }
  const n = $('#conta-mini-nome');
  if (n) n.textContent = estado.usuario.nome || '—';
}

/* O código de suporte é entregue uma única vez, na resposta do cadastro
   (publico() não o inclui de propósito). Guardo aqui no computador da
   pessoa para que ela possa reler quando quiser — no servidor ele só volta
   com e-mail + senha, e a senha não fica guardada nem aqui nem lá. */
function verCodigoSuporte() {
  const alvo = $('#conta-suporte-txt');
  if (!alvo) return;
  alvo.hidden = false;
  let codigo = '';
  try {
    codigo = localStorage.getItem('nexo.suporte')
      || (estado.usuario && estado.usuario.suporte)
      || '';
  } catch { codigo = ''; }

  alvo.textContent = codigo
    ? 'Guarde isto — é o seu código de suporte: ' + codigo
    : 'Este código foi entregue na hora em que você criou a conta e não ' +
      'aparece mais por aqui. Sem problema: no servidor ele continua ' +
      'guardado e volta junto com o seu e-mail e a sua senha.';
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

function preencherCriador() {
  const quando = $('#criado-em');
  if (quando) quando.textContent = '9 de outubro de 2026';

  const ver = $('#versao-app');
  if (!ver) return;
  ver.textContent = '1.0.0';

  // tenta ler a versão publicada pelo servidor para não mostrar número velho
  (async () => {
    try {
      let base = null;
      try { base = JSON.parse(localStorage.getItem('nexo.servidor') || 'null'); } catch { /* ignora */ }
      if (!base) {
        base = (location.protocol === 'http:' || location.protocol === 'https:')
          ? location.protocol + '//' + location.host
          : 'http://localhost:3000';
      }
      const r = await fetch(String(base).replace(/^ws/, 'http').replace(/\/+$/, '') + '/api/versao', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      if (d && d.versao) ver.textContent = d.versao;
    } catch { /* offline: mantém 1.0.0 */ }
  })();
}

function inicializar() {
  carregarPreferencias();
  aplicarAcessibilidade();
  aplicarTema(estado.tema);
  window.aplicarIcones();
  Notificacoes.iniciar();
  preencherCriador();
  Tutorial.iniciarSePrimeiraVez();

  $('#in-nome').value = estado.perfil.nome;
  $('#in-servidor').value = estado.servidor;
  $('#in-servidor-config').value = estado.servidor;
  $('#sel-fps').value = String(estado.fps);
  $('#sel-resolucao').value = String(estado.resolucao);
  $('#check-eco').checked = estado.eco;
  $('#check-monitor').checked = !!estado.monitorMicro;
  $('#check-audio-sistema').checked = estado.audioSistema;
  $('#range-volume').value = String(estado.volume);
  montarGradeTemas();

  /* ---------------- entrada ---------------- */
  // "Lembrar de mim" — auto-preenche nome/servidor se marcado
  const chkLembrar = $('#in-lembrar');
  if (chkLembrar) {
    chkLembrar.checked = estado.lembrar;
    if (estado.lembrar) {
      // carrega o que a pessoa salvou da última vez
      const nomeSalvo = localStorage.getItem('nexo.nomeSalvo');
      const servidorSalvo = localStorage.getItem('nexo.servidorSalvo');
      if (nomeSalvo) $('#in-nome').value = nomeSalvo;
      if (servidorSalvo) $('#in-servidor').value = servidorSalvo;
    }
    chkLembrar.addEventListener('change', () => {
      estado.lembrar = chkLembrar.checked;
      salvar('lembrar', estado.lembrar);
      if (estado.lembrar) {
        localStorage.setItem('nexo.nomeSalvo', $('#in-nome').value.trim());
        localStorage.setItem('nexo.servidorSalvo', $('#in-servidor').value.trim());
      } else {
        localStorage.removeItem('nexo.nomeSalvo');
        localStorage.removeItem('nexo.servidorSalvo');
      }
    });
  }

  $('#btn-criar').addEventListener('click', acaoCriar);
  $('#btn-entrar').addEventListener('click', acaoEntrar);
  inicializarAmigos();
  $('#in-codigo').addEventListener('input', (ev) => {
    // Só o que um convite precisa: letras, números e o que separa o
    // endereço ( @ : . - [ ] ). Espaços nas pontas caem sozinhos.
    ev.target.value = ev.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9@:.\[\]\-]/g, '');
  });
  $('#in-codigo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') acaoEntrar(); });
  $('#in-nome').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') $('#in-codigo').value.trim() ? acaoEntrar() : acaoCriar();
  });

  /* ---------------- conta ---------------- */
  carregarSessao();
  atualizarBlocoConta();

  // Abas: Entrar / Criar conta
  document.querySelectorAll('.aba-conta').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.aba-conta').forEach(x => x.classList.remove('ativa'));
      b.classList.add('ativa');
      const alvo = b.dataset.abaConta;
      $('#form-entrar').hidden = alvo !== 'entrar';
      $('#form-criar').hidden = alvo !== 'criar';
      $('#erro-conta').hidden = true;
      $('#status-conta').hidden = true;
    });
  });

  // Entrar
  $('#form-entrar')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('#in-email').value.trim().toLowerCase();
    const senha = $('#in-senha').value;
    if (!email || !senha) return;
    mostrarStatusConta('Entrando…');
    try {
      const d = await apiConta('/api/conta/entrar', { email, senha });
      gravarSessao(d.token, d.usuario);
      if (d.suporte) {
        try { localStorage.setItem('nexo.suporte', d.suporte); } catch {}
      }
      mostrarStatusConta('Entrou como ' + d.usuario.nome + '.');
      carregarAmizades();
    } catch (e) {
      mostrarErroConta(e.message);
    }
  });

  // Criar conta
  $('#form-criar')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nome = $('#in-usuario').value.trim();
    const email = $('#in-email-novo').value.trim().toLowerCase();
    const senha = $('#in-senha-nova').value;
    if (!nome || !email || !senha) return;
    mostrarStatusConta('Criando conta…');
    try {
      const d = await apiConta('/api/conta/cadastrar', { nome, email, senha });
      gravarSessao(d.token, d.usuario);
      if (d.suporte) {
        try { localStorage.setItem('nexo.suporte', d.suporte); } catch {}
      }
      mostrarStatusConta('Conta criada - bem-vindo, ' + d.usuario.nome + '!');
      carregarAmizades();
    } catch (e) {
      mostrarErroConta(e.message);
    }
  });

  // Esqueci senha -> abre modal recuperar
  $('#btn-esqueci')?.addEventListener('click', () => {
    $('#form-entrar').hidden = true;
    $('#form-criar').hidden = true;
    $('#erro-conta').hidden = true;
    $('#status-conta').hidden = true;
    abrirModal('#modal-recuperar');
    $('#in-rec-email').focus();
  });

  // Botão "Mandar código para o e-mail" no modal recuperar
  $('#btn-mandar-codigo')?.addEventListener('click', async () => {
    const email = $('#in-rec-email').value.trim().toLowerCase();
    if (!email) { mostrarErroRecuperar('Digite o e-mail primeiro.'); return; }
    mostrarStatusRecuperar('Enviando código…');
    try {
      await apiConta('/api/conta/esqueci', { email });
      mostrarStatusRecuperar('Código enviado! Confira a caixa de entrada (e spam).');
    } catch (e) {
      mostrarErroRecuperar(e.message);
    }
  });

  // Botão "Trocar minha senha" no modal recuperar
  $('#btn-trocar-senha')?.addEventListener('click', async () => {
    const email = $('#in-rec-email').value.trim().toLowerCase();
    const codigo = $('#in-rec-codigo').value.trim();
    const senha = $('#in-rec-senha').value;
    const suporte = $('#check-rec-suporte').checked;
    if (!email || !codigo || !senha) { mostrarErroRecuperar('Preencha tudo.'); return; }
    mostrarStatusRecuperar('Trocando senha…');
    try {
      if (suporte) {
        await apiConta('/api/conta/redefinir-suporte', { email, suporte: codigo, senha });
      } else {
        await apiConta('/api/conta/redefinir', { email, codigo, senha });
      }
      mostrarStatusRecuperar('Senha trocada — agora pode entrar.');
      setTimeout(() => {
        $('#modal-recuperar').hidden = true;
        $('#form-entrar').hidden = false;
        $('#erro-conta').hidden = true;
        $('#status-conta').hidden = true;
        $('#in-rec-email').value = '';
        $('#in-rec-codigo').value = '';
        $('#in-rec-senha').value = '';
        $('#check-rec-suporte').checked = false;
      }, 1200);
    } catch (e) {
      mostrarErroRecuperar(e.message);
    }
  });

  // Mostrar/ocultar ajuda do código de suporte
  $('#check-rec-suporte')?.addEventListener('change', (ev) => {
    const ajuda = $('#ajuda-rec-codigo');
    if (ajuda) ajuda.textContent = ev.target.checked
      ? 'Este é o código que você recebeu quando criou a conta (não o do e-mail).'
      : 'Não achou a mensagem? Olhe a caixa de spam. Se você guardou o código de suporte, troque o tipo de código aqui embaixo.';
  });

  // Ver código de suporte
  $('#btn-ver-suporte')?.addEventListener('click', verCodigoSuporte);

  // Sair da conta
  $('#btn-sair-conta')?.addEventListener('click', () => {
    gravarSessao(null, null);
    atualizarBlocoConta();
    aviso('Saiu da conta.', 'ok');
  });

  async function copiarCodigoSala() {
    if (!estado.codigo) return;
    // Garante o convite pronto: ele leva o endereço junto, então dá para
    // quem recebe colar num computador diferente e entrar direto.
    if (!estado.convite || estado.convite === estado.codigo) await montarConvite();
    const texto = estado.convite || estado.codigo;
    const completo = texto !== estado.codigo;
    const codLateral = $('#codigo-sala-painel');
    if (codLateral && codLateral.parentElement) {
      const chip = codLateral.parentElement;
      chip.classList.add('copiado');
      setTimeout(() => chip.classList.remove('copiado'), 1400);
    }
    try {
      await navigator.clipboard.writeText(texto);
      aviso(completo
        ? 'Convite copiado! Quem receber cola no campo de código e entra direto.'
        : 'Código copiado: ' + texto, 'ok');
    } catch {
      aviso(completo ? 'Convite da sala: ' + texto : 'Código da sala: ' + texto, 'ok');
    }
  }
  $('#chip-codigo').addEventListener('click', copiarCodigoSala);
  $('#btn-copiar-cod')?.addEventListener('click', copiarCodigoSala);

  /* ---------------- mídia ---------------- */
  $('#btn-micro').addEventListener('click', alternarMicrofone);
  $('#ctrl-micro').addEventListener('click', alternarMicrofone);
  ligarMenusDispositivo();
  $('#btn-camera').addEventListener('click', alternarCamera);
  $('#ctrl-camera').addEventListener('click', alternarCamera);
  $('#btn-tela').addEventListener('click', iniciarTransmissao);
  $('#ctrl-tela').addEventListener('click', iniciarTransmissao);
  $('#btn-sair-som').addEventListener('click', sairDaSala);
  $('#btn-sair-conta-painel').addEventListener('click', () => {
    if (confirm('Sair da conta? Você voltará para a tela de entrada.')) {
      gravarSessao(null, null);
      estado.amigos = [];
      estado.pedidosAmizade = [];
      desenharListaAmigos();
      desenharListaPedidos();
      atualizarBlocoConta();
      $('#tela-sala').hidden = true;
      $('#tela-entrada').hidden = false;
      // limpa o estado da sala
      estado.codigo = null;
      estado.meuId = null;
      estado.participantes = [];
      estado.conectado = false;
      estado.historico = [];
      estado.privados.clear();
      estado.naoLidas.clear();
      estado.conversa = '';
      $('#lista-chat').innerHTML = '<div class="chat-vazio">Ainda não há mensagens. Diga oi!</div>';
      montarAbasConversa();
      desenharParticipantes();
      definirBarraVoz('Desconectado', true);
    }
  });

  /* ---------------- canais (estilo Discord) ---------------- */
  // Recolher/abrir categoria da lista de canais.
  document.querySelectorAll('.cat-titulo').forEach(t => {
    t.addEventListener('click', () => {
      const aberto = t.getAttribute('aria-expanded') === 'true';
      t.setAttribute('aria-expanded', aberto ? 'false' : 'true');
    });
  });

  // '#geral' abre o chat; '#arquivos' abre a galeria do que já foi
  // compartilhado. Os dois são canais de verdade agora.
  document.querySelectorAll('.canal[data-canal]').forEach(c => {
    c.addEventListener('click', () => trocarCanal(c.dataset.canal));
  });

  /* filtros e envio do canal de arquivos */
  document.querySelectorAll('.arq-filtro').forEach(b => {
    b.addEventListener('click', () => {
      estado.filtroArquivos = b.dataset.tipo || 'tudo';
      desenharArquivos();
    });
  });

  const btnEnviarArq = $('#btn-enviar-arq');
  if (btnEnviarArq) btnEnviarArq.addEventListener('click', () => {
    // Volta para o chat e abre o seletor de arquivo: o envio continua
    // acontecendo no chat da sala, que é o único lugar com destino.
    trocarCanal('geral');
    const campo = $('#in-anexo');
    if (campo) setTimeout(() => campo.click(), 0);
  });

  /* nova conversa privada */
  const btnNovaDm = $('#btn-nova-dm');
  if (btnNovaDm) btnNovaDm.addEventListener('click', abrirSeletorPessoa);

  $('#ctrl-cheia').addEventListener('click', () => {
    const alvo = $('#area-video');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (alvo && alvo.requestFullscreen) alvo.requestFullscreen().catch(() => aviso('Tela cheia indisponível.'));
  });

  /* ---------------- configurações ---------------- */
  async function abrirConfigEm(aba) {
    // Abre primeiro, lista os aparelhos depois. Se o navegador demorar a
    // responder o enumerateDevices() — permissão de microfone pendente, por
    // exemplo — as configurações não podem ficar esperando: o botão tem que
    // abrir SEMPRE, mesmo sem áudio nenhum no sistema.
    abrirModal('#modal-config');
    preencherContaConfig();
    // só troca de aba quando quem chamou pediu uma específica: abrir pela
    // engrenagem deixa a pessoa na aba em que ela estava
    if (aba) abrirAbaConfig(aba);
    try { await listarDispositivos(); } catch (_e) { /* sem áudio: abre mesmo assim */ }
  }

  // Deixa a chave para fora do escopo: o seletor de aparelhos do painel do
  // usuário manda a pessoa direto para a aba de voz e vídeo.
  window.nexoAbrirConfig = abrirConfigEm;

  $('#btn-config').addEventListener('click', () => abrirConfigEm());
  const btnConfigUser = $('#btn-config-user');
  if (btnConfigUser) btnConfigUser.addEventListener('click', () => abrirConfigEm('voz-video'));

  /* painel "Conta": o que os outros veem, agora e no futuro */
  function preencherContaConfig() {
    const alvo = $('#conta-avatar');
    if (alvo) {
      alvo.innerHTML = '';
      const f = estado.perfil.avatar;
      if (/^data:image\//.test(String(f))) {
        const img = document.createElement('img');
        img.src = f;
        alvo.appendChild(img);
      } else {
        alvo.textContent = f || iniciais(estado.perfil.nome);
      }
    }
    const n = $('#conta-nome'); if (n) n.textContent = estado.perfil.nome || 'Sem nome';
    const nf = $('#conta-nome-ficha'); if (nf) nf.textContent = estado.perfil.nome || '—';
    const sub = $('#conta-sub');
    if (sub) sub.textContent = String(estado.perfil.avatar || '').length > 2
      ? 'Foto de perfil' : 'Emoji de perfil';
    const s = $('#conta-servidor'); if (s) s.textContent = estado.servidor || '—';
    // a versão já é resolvida na aba do criador — copio daí em vez de
    // perguntar de novo ao servidor toda vez que abre as configurações
    const v = $('#conta-versao');
    if (v) v.textContent = ($('#versao-app') || {}).textContent || '1.0.0';
  }

  const ligar = (id, chave, aoMudar) => {
    const el = $(id);
    if (!el) return;
    el.checked = !!carregar(chave, el.checked);
    if (aoMudar) aoMudar(el.checked);
    el.addEventListener('change', () => {
      salvar(chave, el.checked);
      if (aoMudar) aoMudar(el.checked);
    });
  };

  ligar('#check-nota-som', 'notaSom');
  ligar('#check-nota-badge', 'notaBadge', (v) => {
    const b = $('#sino-badge');
    if (b && !v) b.hidden = true;
  });
  ligar('#check-nota-privado', 'notaPrivado');

  const btnSom = $('#btn-testar-som');
  if (btnSom) btnSom.addEventListener('click', () => {
    const antes = carregar('notaSom', false);
    salvar('notaSom', true);
    tocarAvisoDeMensagem();
    const cb = $('#check-nota-som'); if (cb) cb.checked = true;
    if (!antes) setTimeout(() => { salvar('notaSom', false); if (cb) cb.checked = false; }, 900);
  });

  ligar('#check-reduzir-animacao', 'reduzirAnimacao', aplicarAcessibilidade);
  ligar('#check-alto-contraste', 'altoContraste', aplicarAcessibilidade);
  ligar('#check-texto-grande', 'textoGrande', aplicarAcessibilidade);

  ligar('#check-verificar-atualizacao', 'verificarAtualizacao', (v) => {
    // Notificacoes é um objeto vivo: atribuir aqui já muda o comportamento
    // do setInterval que roda a cada minuto.
    if (typeof Notificacoes !== 'undefined') Notificacoes.semAtualizacao = !v;
  });

  const empurrarPreferenciaBandeja = (valor) => {
    if (!DESKTOP || !window.nexoDesktop || !window.nexoDesktop.definirPreferencia) return;
    Promise.resolve(window.nexoDesktop.definirPreferencia('fecharParaBandeja', valor))
      .catch(() => { /* fora do Electron: não há o que fazer */ });
  };
  ligar('#check-fechar-bandeja', 'fecharBandeja', empurrarPreferenciaBandeja);

  /* O horário é sempre 24h (brasileiro) — não tem opção de 12h de propósito. */
  const fuso = $('#fuso-hora');
  if (fuso) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '—';
      const off = -new Date().getTimezoneOffset() / 60;
      fuso.textContent = `${tz} (UTC${off >= 0 ? '+' : ''}${off})`;
    } catch { fuso.textContent = '—'; }
  }

  const btnLimparHist = $('#btn-limpar-historico');
  if (btnLimparHist) btnLimparHist.addEventListener('click', () => {
    estado.historico = [];
    desenharChat();
    aviso('Conversa limpa.', 'ok');
  });

  const btnApagarTudo = $('#btn-apagar-tudo');
  if (btnApagarTudo) btnApagarTudo.addEventListener('click', () => {
    if (btnApagarTudo.dataset.confirmando === '1') {
      try { localStorage.clear(); } catch { /* ignora */ }
      location.reload();
      return;
    }
    btnApagarTudo.dataset.confirmando = '1';
    btnApagarTudo.textContent = 'Tem certeza? Clique de novo';
    setTimeout(() => {
      delete btnApagarTudo.dataset.confirmando;
      btnApagarTudo.textContent = 'Apagar tudo';
    }, 5000);
  });

  const btnEditarPerfil = $('#btn-editar-perfil');
  if (btnEditarPerfil) btnEditarPerfil.addEventListener('click', () => {
    abrirModal('#modal-perfil');
  });

  document.querySelectorAll('.fecha-modal').forEach(b => {
    b.addEventListener('click', () => {
      const alvo = b.closest('.overlay');
      if (alvo) alvo.hidden = true;
    });
  });

  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('mousedown', (ev) => { if (ev.target === ov) ov.hidden = true; });
  });

  /* ---------------- configurações ---------------- */
  const TITULOS_ABA = {
    conta: 'Conta',
    dados: 'Dados e privacidade',
    'voz-video': 'Voz e vídeo',
    notificacoes: 'Notificações',
    aparencia: 'Aparência',
    acessibilidade: 'Acessibilidade',
    sistema: 'Sistema',
    idioma: 'Idioma e horário',
    criador: 'Leal program',
    loja: 'Loja',
    adicionar_amigo: 'Adicionar amigo'
  };
  
  // Temas da loja (gratuitos)
  const TEMAS_LOJA = [
    { id: 'meia-noite', rotulo: 'Meia-Noite', corAcento: '#6d5efc' },
    { id: 'zenitsu', rotulo: 'Zenitsu (SL)', corAcento: '#facc15' },
    { id: 'sukuna', rotulo: 'Sukuna (JJK)', corAcento: '#e11d48' },
    { id: 'naruto', rotulo: 'Naruto', corAcento: '#f97316' },
    { id: 'evangelion', rotulo: 'Evangelion', corAcento: '#7dd3ec' },
    { id: 'levi', rotulo: 'Levi (SNK)', corAcento: '#06b6d4' },
    { id: 'gon', rotulo: 'Gon (HXH)', corAcento: '#ffb000' },
    { id: 'eren', rotulo: 'Eren (SHK)', corAcento: '#7f1d1d' },
    { id: 'kurapika', rotulo: 'Kurapika (HXH)', corAcento: '#ff6b6b' },
    { id: 'killua', rotulo: 'Killua (HXH)', corAcento: '#7dd3e1' }
  ];

  function abrirAbaConfig(chave) {
    const alvo = TITULOS_ABA[chave] ? chave : 'voz-video';
    document.querySelectorAll('.aba-modal').forEach(a => {
      a.classList.toggle('ativa', a.dataset.aba === alvo);
    });
    document.querySelectorAll('.painel-aba').forEach(p => {
      p.hidden = p.id !== 'aba-' + alvo;
    });
    const t = $('#config-titulo');
    if (t) t.textContent = TITULOS_ABA[alvo];
    const botao = document.querySelector('.aba-modal[data-aba="' + alvo + '"]');
    if (botao && botao.scrollIntoView) botao.scrollIntoView({ block: 'nearest' });
  }

  document.querySelectorAll('.aba-modal').forEach(aba => {
    aba.addEventListener('click', () => abrirAbaConfig(aba.dataset.aba));
  });

  // Gera os botões de tema na aba Aparência
  function gerarTemas() {
    const grade = $('#grade-temas');
    if (!grade) return;
    
    // Temas padrão (anime + meia-noite)
    const temas = [
      { id: 'meia-noite', rotulo: 'Meia-Noite', cores: '--fundo: #080a10; --acento: #6d5efc;' },
      { id: 'zenitsu', rotulo: 'Zenitsu (SL)', cores: '--acento: #facc15;' },
      { id: 'sukuna', rotulo: 'Sukuna (JJK)', cores: '--acento: #e11d48;' },
      { id: 'naruto', rotulo: 'Naruto', cores: '--acento: #f97316;' },
      { id: 'evangelion', rotulo: 'Evangelion', cores: '--acento: #7dd3ec;' },
      { id: 'levi', rotulo: 'Levi (SNK)', cores: '--acento: #06b6d4;' },
      { id: 'gon', rotulo: 'Gon (HXH)', cores: '--acento: #ffb000;' },
      { id: 'eren', rotulo: 'Eren (SHK)', cores: '--acento: #7f1d1d;' },
      { id: 'kurapika', rotulo: 'Kurapika (HXH)', cores: '--acento: #ff6b6b;' },
      { id: 'killua', rotulo: 'Killua (HXH)', cores: '--acento: #7dd3e1;' }
    ];
    
    grade.innerHTML = '';
    
    temas.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-tema';
      btn.dataset.tema = t.id;
      btn.innerHTML = `<span class="rotulo-tema">${t.rotulo}</span>`;
      btn.onclick = () => {
        document.body.dataset.tema = t.id;
        salvar('tema', t.id);
        aviso(`Tema alterado para ${t.rotulo}`, 'ok');
      };
      grade.appendChild(btn);
    });
    
    // Botão de tema personalizado
    const btnPersonalizado = document.createElement('button');
    btnPersonalizado.type = 'button';
    btnPersonalizado.className = 'btn-tema';
    btnPersonalizado.id = 'btn-novo-tema';
    btnPersonalizado.innerHTML = '🎨 Tema personalizado';
    btnPersonalizado.onclick = () => {
      $('#input-novo-tema').click();
    };
    grade.appendChild(btnPersonalizado);
    
    // Input de cor pessoal (oculto por padrão, aparece quando clica no botão)
    const inputCor = document.createElement('input');
    inputCor.type = 'color';
    inputCor.id = 'input-novo-tema';
    inputCor.style.display = 'none';
    inputCor.onchange = () => {
      const cor = inputCor.value;
      // Extrair matiz da cor hsl para criar um tema simples
      const h = parseInt(cor.slice(4).split(' ')[0]);
      const temaPersonalizado = `personalizado-${h}`;
      document.body.dataset.tema = temaPersonalizado;
      salvar('tema', temaPersonalizado);
      // Aplicar cor personalizada via CSS variáveis inline
      document.body.style.setProperty('--acento', cor);
      aviso('Tema personalizado criado', 'ok');
      $('#input-novo-tema').hide();
      $('#btn-novo-tema').show();
    };
    grade.appendChild(inputCor);
  }
  
  // Inicializar geração de temas ao carregar
  setTimeout(gerarTemas, 100);
  
  // === LOJA DE TEMAAS ===
  function gerarLoja() {
    // Será chamado quando a aba loja for aberta
  }
  
  // Função para abrir a loja e gerar os cards
  function abrirLoja() {
    const grade = $('#grade-temas-loja');
    if (!grade) return;
    
    grade.innerHTML = '';
    
    TEMAS_LOJA.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card-tema-loja';
      card.innerHTML = `
        <div class="card-cor" style="background: var(--acento, #6d5efc);"></div>
        <span class="card-rotulo">${t.rotulo}</span>
      `;
      card.onclick = () => {
        document.body.dataset.tema = t.id;
        salvar('tema', t.id);
        // Atualizar variáveis CSS
        document.body.style.setProperty('--acento', t.corAcento);
        // Atualizar cor de texto do botão se necessário
        const botao = document.querySelector('.aba-modal.ativa');
        if (botao && botao.dataset.aba === 'loja') {
          aviso(`Tema aplicado: ${t.rotulo}`, 'ok');
        }
      };
      grade.appendChild(card);
    });
    
    // Botão para tema personalizado
    const btnPersonalizado = document.createElement('div');
    btnPersonalizado.className = 'card-tema-loja';
    btnPersonalizado.style.border = '2px dashed var(--borda)';
    btnPersonalizado.innerHTML = `
      <span class="card-rotulo">🎨 Tema personalizado</span>
    `;
    btnPersonalizado.onclick = () => {
      $('#input-novo-tema').click();
    };
    grade.appendChild(btnPersonalizado);
  }
  
  // Interceptar clique na aba loja
  const abaLoja = document.querySelector('.aba-modal[data-aba="loja"]');
  if (abaLoja) {
    abaLoja.addEventListener('click', (ev) => {
      ev.stopPropagation();
      abrirAbaConfig('loja');
      // Pequeno delay para garantir que o painel apareça antes de gerar conteúdo
      setTimeout(() => {
        // Se o painel aba-loja não existir no HTML, criamos dinamicamente
        let painel = document.getElementById('aba-loja');
        if (!painel) {
          // Inserir após o painel do criador
          const pai = document.querySelector('.config-paginas');
          if (pai) {
            const novoPainel = document.createElement('div');
            novoPainel.id = 'aba-loja';
            novoPainel.className = 'painel-aba';
            novoPainel.hidden = false;
            novoPainel.innerHTML = `
              <p class="config-ajuda">Temas gratuitos que mudam o visual do app na hora.</p>
              <div class="grade-temas-loja" id="grade-temas-loja"></div>
              <div class="config-linha">
                <div>
                  <strong>Como aplicar um tema</strong>
                  <small>Selecione um tema e ele será salvo automaticamente.</small>
                </div>
              </div>
            `;
            pai.querySelector('.config-rolagem').appendChild(novoPainel);
          }
        }
        // Agora gerar os cards da loja
        abrirLoja();
      }, 150);
    });
  }

  // Busca no topo da barra lateral, como no Discord: filtra as abas e
  // esconde os títulos de grupo que não sobrou ninguém embaixo deles.
  const buscaConfig = $('#busca-config');
  if (buscaConfig) {
    const filtrar = () => {
      const q = buscaConfig.value.trim().toLowerCase();
      let achou = 0;
      document.querySelectorAll('.aba-modal').forEach(a => {
        const fatias = [a.dataset.rotulo, a.textContent, a.dataset.aba].join(' ');
        const sim = !q || fatias.toLowerCase().includes(q);
        a.hidden = !sim;
        if (sim) achou++;
      });
      document.querySelectorAll('[data-grupo]').forEach(g => {
        if (!q) { g.hidden = false; return; }
        let tem = false;
        let el = g.nextElementSibling;
        while (el && !el.hasAttribute('data-grupo')) {
          if (el.classList && el.classList.contains('aba-modal') && !el.hidden) { tem = true; break; }
          el = el.nextElementSibling;
        }
        g.hidden = !tem;
      });
      const vazio = $('#config-vazio');
      if (vazio) vazio.hidden = achou > 0;
    };
    buscaConfig.addEventListener('input', filtrar);
    buscaConfig.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { buscaConfig.value = ''; filtrar(); }
    });
  }

  $('#sel-micro').addEventListener('change', (ev) => trocarMicrofone(ev.target.value));
  $('#sel-camera').addEventListener('change', async (ev) => {
    estado.disp.camera = ev.target.value;
    salvar('disp', estado.disp);
    if (estado.streamCamera) { desligarCamera(); await ligarCamera(); }
  });
  $('#sel-fone').addEventListener('change', async (ev) => {
    estado.disp.fone = ev.target.value;
    salvar('disp', estado.disp);
    await aplicarSaidaEmTudo();
    aviso('Saída de áudio alterada.', 'ok');
  });
  $('#check-eco').addEventListener('change', async (ev) => {
    estado.eco = ev.target.checked;
    salvar('eco', estado.eco);
    if (estado.streamMicro) await ligarMicrofone(true);
  });
  $('#check-audio-sistema').addEventListener('change', (ev) => {
    estado.audioSistema = ev.target.checked;
    salvar('audioSistema', estado.audioSistema);
  });
  $('#range-volume').addEventListener('input', (ev) => {
    estado.volume = Number(ev.target.value);
    salvar('volume', estado.volume);
    aplicarSaidaEmTudo();
  });
  $('#sel-fps').addEventListener('change', (ev) => {
    estado.fps = Number(ev.target.value) || 60;
    salvar('fps', estado.fps);
    if (estado.streamTela) aviso('As novas configurações de fps valem na próxima vez que você transmitir.');
  });
  $('#sel-resolucao').addEventListener('change', (ev) => {
    estado.resolucao = Number(ev.target.value) || 0;
    salvar('resolucao', estado.resolucao);
  });
  $('#check-monitor').addEventListener('change', (ev) => {
    estado.monitorMicro = !!ev.target.checked;
    salvar('monitorMicro', estado.monitorMicro);
    atualizarMonitorMicro();
  });
  $('#in-servidor-config').addEventListener('change', (ev) => {
    estado.servidor = ev.target.value.trim() || padraoServidor;
    salvar('servidor', estado.servidor);
    $('#in-servidor').value = estado.servidor;
  });
  $('#btn-testar-cam').addEventListener('click', testarCamera);

  /* ---------------- mini-janela flutuante ---------------- */
  $('#btn-mini')?.addEventListener('click', alternarMiniJanela);
  $('#mini-fechar')?.addEventListener('click', () => {
    // só esconde o quadradinho: a transmissão continua caindo em silêncio
    $('#mini-janela').hidden = true;
    $('#btn-mini')?.classList.remove('ativo');
  });
  arrastarMiniJanela();
  $('#btn-tutorial')?.addEventListener('click', () => {
    fecharModal('#modal-config');
    Tutorial.iniciar(true);
  });

  /* ---------------- perfil ---------------- */
  $('#btn-perfil')?.addEventListener('click', abrirPerfil);
  $('#btn-conversa-pessoa')?.addEventListener('click', () => {
    fecharModal('#modal-pessoa');
    if (_pessoaSelecionada) abrirConversa(_pessoaSelecionada);
  });
  $('#btn-salvar-perfil').addEventListener('click', salvarPerfil);

  /* -------- foto de perfil: escolher, cortar, aplicar --------
     Tudo com ?.: se algum elemento não existir, um clique a menos
     nunca pode derrubar a inicialização inteira do app. */
  $('#btn-escolher-foto')?.addEventListener('click', escolherFotoDoComputador);
  $('#in-foto-perfil')?.addEventListener('change', aoEscolherFoto);
  $('#btn-remover-foto')?.addEventListener('click', removerFotoDoPerfil);
  $('#btn-aplicar-corte')?.addEventListener('click', aplicarCorteNoPerfil);
  $('#btn-cancelar-corte')?.addEventListener('click', () => fecharModal('#modal-corte'));
  ligarArrasteCorte();

  $('#range-zoom')?.addEventListener('input', (ev) => {
    if (!corte.natW) return;
    const zoom = Number(ev.target.value) / 100;
    // guarda o ponto que está no meio do redondo para o zoom não dar pulo
    const cx = (-corte.tx + LADO_FOTO / 2) / corte.escala;
    const cy = (-corte.ty + LADO_FOTO / 2) / corte.escala;
    corte.escala = corte.base * zoom;
    corte.tx = LADO_FOTO / 2 - cx * corte.escala;
    corte.ty = LADO_FOTO / 2 - cy * corte.escala;
    aplicarTransforme();
  });

  /* ---------------- chat ---------------- */
  $('#form-chat').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const carga = montarEnvio();
    if (!carga) return;
    enviarParaConversa(carga);
  });

  /* ---------------- anexos ---------------- */
  $('#btn-anexar').addEventListener('click', () => $('#in-anexo').click());
  $('#in-anexo').addEventListener('change', (ev) => {
    escolherAnexos(ev.target.files);
  });
  $('#btn-tirar-anexo').addEventListener('click', () => {
    limparAnexo();
    $('#in-chat').focus();
  });

  // Arrastar um arquivo por cima do chat
  const painelChat = $('#painel-chat');
  const zona = $('#zona-soltar');
  let sobreChat = 0;

  const dentro = (ev) => ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes('Files');
  const mostrarZona = (sim) => { if (zona) zona.hidden = !sim; };

  if (painelChat) {
    painelChat.addEventListener('dragenter', (ev) => {
      if (!dentro(ev)) return;
      ev.preventDefault();
      sobreChat++;
      mostrarZona(true);
    });
    painelChat.addEventListener('dragover', (ev) => {
      if (!dentro(ev)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    });
    painelChat.addEventListener('dragleave', (ev) => {
      if (!dentro(ev)) return;
      sobreChat = Math.max(0, sobreChat - 1);
      if (!sobreChat) mostrarZona(false);
    });
    painelChat.addEventListener('drop', (ev) => {
      ev.preventDefault();
      sobreChat = 0;
      mostrarZona(false);
      if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) {
        escolherAnexos(ev.dataTransfer.files);
      }
    });
  }

  // clique numa imagem do chat abre em tela cheia
  document.addEventListener('click', (ev) => {
    const img = ev.target && ev.target.closest ? ev.target.closest('img[data-luz]') : null;
    if (img) {
      // a imagem agora vive dentro de um <a> para dar sempre um caminho de
      // download; sem isto o clique abriria a luzia E o link ao mesmo tempo.
      ev.preventDefault();
      abrirLuzia(img.currentSrc || img.src);
    }
  });

  $('#btn-toggle-chat').addEventListener('click', () => {
    if (window.innerWidth <= 1220) $('#painel-chat').classList.toggle('aberto');
    else $('#tela-sala').classList.toggle('chat-fechado');
  });

  /* ---------------- janela ---------------- */
  document.querySelectorAll('[data-janela]').forEach(botao => {
    botao.addEventListener('click', () => {
      if (DESKTOP) window.nexoDesktop.controlarJanela(botao.dataset.janela);
    });
  });
  if (!DESKTOP) document.querySelector('.controles-janela')?.remove();

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      document.querySelectorAll('.overlay').forEach(o => o.hidden = true);
      $('#painel-chat').classList.remove('aberto');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    // atalhos de voz, como no Discord
    if (ev.ctrlKey && ev.code === 'KeyM' && estado.codigo) {
      ev.preventDefault();
      alternarMicrofone();
    }
  });

  window.addEventListener('beforeunload', () => {
    enviar({ tipo: 'sair' });
    limparTudo();
  });

  setTimeout(() => ($('#in-nome').value ? $('#in-codigo') : $('#in-nome')).focus(), 140);
}

document.addEventListener('DOMContentLoaded', inicializar);


/* ------------------------------------------------------------------ */
/* Amigos / lista de amizades                                          */
/* ------------------------------------------------------------------ */

/* Carrega a lista de amigos e pedidos do servidor e atualiza a UI. */
async function carregarAmizades() {
  if (!estado.usuario || !estado.token) return;

  try {
    const r = await fetch(origemHttp() + '/api/amigos', {
      headers: { Authorization: 'Bearer ' + estado.token }
    });
    if (!r.ok) throw new Error('falhou');
    const data = await r.json();
    if (data.amigos) estado.amigos = data.amigos;
    if (data.pedidos) estado.pedidosAmizade = data.pedidos;
    desenharListaAmigos();
    desenharListaPedidos();
    atualizarBadgesAmigos();
  } catch (e) {
    console.warn('amizades: falha ao carregar', e);
  }
}

/* Desenha a lista de amigos na sidebar. Respeita a aba aberta:
   "linha" mostra só quem está conectado; "todos" mostra a lista inteira. */
function desenharListaAmigos() {
  const box = $('#lista-amigos');
  if (!box) return;

  const todos = estado.amigos || [];
  const amigos = (_abaAmigos === 'linha') ? amigosEmLinha() : todos;

  // só a aba que usa esta lista deixa ela visível — desenhar não pode
  // reabrir a lista por cima da aba "Pendentes" ou "Adicionar".
  box.hidden = !(_abaAmigos === 'linha' || _abaAmigos === 'todos');

  if (!amigos.length) {
    box.innerHTML = (_abaAmigos === 'linha' && todos.length)
      ? `<li class="amigo-vazio">Ninguém em linha agora.</li>`
      : `<li class="amigo-vazio">Nenhum amigo ainda.</li>`;
    return;
  }
  box.innerHTML = amigos.map(a => `
    <li class="item-amigo" data-id="${escapeHtml(a.id)}">
      <button class="amigo-abrir" data-id="${escapeHtml(a.id)}" type="button"
              title="Conversar com ${escapeHtml(a.nome)}">
        ${avatarHtml({ id: a.id, nome: a.nome, avatar: a.avatar, cor: a.cor }, 'avatar')}
        <span class="item-nome">${escapeHtml(a.nome)}</span>
      </button>
      <button class="btn-pedido remover" data-id="${escapeHtml(a.id)}" type="button"
              title="Remover ${escapeHtml(a.nome)} dos amigos">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 9v11H8V9h8m0-5H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-1 4h-2v2h-2v-2H9V9h2V7h2v2h2v2Z"/></svg>
      </button>
    </li>
  `).join('');

  box.querySelectorAll('.amigo-abrir').forEach(b => {
    b.addEventListener('click', () => {
      // abre conversa privada com esse amigo
      const id = b.dataset.id;
      abrirConversa(id);
      if (estado.canal === 'arquivos') trocarCanal('geral');
    });
  });

  box.querySelectorAll('.btn-pedido.remover').forEach(b => {
    b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await removerAmizade(b.dataset.id);
    });
  });
}

/* Desenha a lista de pedidos pendentes (recebidos). */
function desenharListaPedidos() {
  const box = $('#lista-pedidos');
  if (!box) return;

  const pedidos = estado.pedidosAmizade || [];

  // a aba "Pendentes" fica visível mesmo vazia, só com o aviso —
  // esconder o <ul> aqui faria a aba parecer travada. Fora dela, some.
  box.hidden = (_abaAmigos !== 'pedidos');

  if (!pedidos.length) {
    box.innerHTML = `<li class="pedido-vazio">Nenhum pedido de amizade.</li>`;
    return;
  }
  box.innerHTML = pedidos.map(p => `
    <li>
      <div class="item-pedido" data-id="${escapeHtml(p.id)}">
        ${avatarHtml({ id: p.id, nome: p.nome, avatar: p.avatar, cor: p.cor }, 'avatar')}
        <span class="item-nome">${escapeHtml(p.nome)}</span>
        <div class="pedido-acoes">
          <button class="btn-pedido aceitar" data-id="${escapeHtml(p.id)}" type="button" title="Aceitar">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
          </button>
          <button class="btn-pedido recusar" data-id="${escapeHtml(p.id)}" type="button" title="Recusar">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      </div>
    </li>
  `).join('');

  box.querySelectorAll('.btn-pedido.aceitar').forEach(b => {
    b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await aceitarPedidoAmizade(b.dataset.id);
    });
  });
  box.querySelectorAll('.btn-pedido.recusar').forEach(b => {
    b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await recusarPedidoAmizade(b.dataset.id);
    });
  });
}

/* Envia pedido de amizade ao servidor. */
async function pedirAmizade(amigoId) {
  if (!estado.usuario || !estado.token) return;
  try {
    const r = await fetch(origemHttp() + '/api/amigos/pedir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + estado.token
      },
      body: JSON.stringify({ amigoId })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'falhou');
    aviso('Pedido de amizade enviado!', 'ok');
    // o servidor não envia push pro outro lado em tempo real ainda
    // mas localmente podemos mostrar que enviamos
  } catch (e) {
    aviso('Erro: ' + e.message, 'erro');
  }
}

/* Aceita pedido de amizade. */
async function aceitarPedidoAmizade(amigoId) {
  if (!estado.usuario || !estado.token) return;
  try {
    const r = await fetch(origemHttp() + '/api/amigos/aceitar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + estado.token
      },
      body: JSON.stringify({ amigoId })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'falhou');
    aviso('Amizade aceita!', 'ok');
    // recarrega a lista
    await carregarAmizades();
  } catch (e) {
    aviso('Erro: ' + e.message, 'erro');
  }
}

/* Recusa/cancela pedido de amizade. */
async function recusarPedidoAmizade(amigoId) {
  if (!estado.usuario || !estado.token) return;
  try {
    const r = await fetch(origemHttp() + '/api/amigos/recusar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + estado.token
      },
      body: JSON.stringify({ amigoId })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'falhou');
    aviso('Pedido recusado.', 'ok');
    await carregarAmizades();
  } catch (e) {
    aviso('Erro: ' + e.message, 'erro');
  }
}

/* Remove a amizade (o botão de lixeira ao lado do nome). */
async function removerAmizade(amigoId) {
  if (!estado.usuario || !estado.token) return;
  const alvo = (estado.amigos || []).find(a => a.id === amigoId);
  const nome = alvo ? alvo.nome : 'esse amigo';
  if (!confirm('Remover ' + nome + ' dos seus amigos?')) return;
  try {
    const r = await fetch(origemHttp() + '/api/amigos/remover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + estado.token
      },
      body: JSON.stringify({ amigoId })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'falhou');
    aviso(nome + ' foi removido da sua lista de amigos.', 'ok');
    await carregarAmizades();
  } catch (e) {
    aviso('Erro: ' + e.message, 'erro');
  }
}

/* Atualiza os badges (contadores) na aba "Amigos". */
function atualizarBadgesAmigos() {
  const totalPedidos = (estado.pedidosAmizade || []).length;

  // contadores DENTRO das abas do painel de amigos
  const cLinha = $('#cont-aba-linha');
  if (cLinha) {
    const n = amigosEmLinha().length;
    cLinha.hidden = n === 0;
    cLinha.textContent = n > 9 ? '9+' : String(n);
  }
  const cPedidos = $('#cont-aba-pedidos');
  if (cPedidos) {
    cPedidos.hidden = totalPedidos === 0;
    cPedidos.textContent = totalPedidos > 9 ? '9+' : String(totalPedidos);
  }

  // bolinha vermelha no ícone de Amigos do rail (Discord faz igual)
  const badge = $('#rail-badge-amigos');
  if (badge) {
    badge.hidden = totalPedidos === 0;
    badge.textContent = totalPedidos > 9 ? '9+' : String(totalPedidos);
  }

  // se a aba "Pendentes" estiver aberta, redesenha a lista na hora
  if (_abaAmigos === 'pedidos') desenharListaPedidos();
}

/* ------------------------------------------------------------------ */
/* Navegação do rail: Sala <-> Amigos (como o Discord troca Home/DMs)  */
/* ------------------------------------------------------------------ */

let _abaAmigos = 'todos';

/* Amigos que estão de fato conectados agora (presença da sala). */
function amigosEmLinha() {
  const onlines = new Set((estado.participantes || []).map(p => p.id));
  return (estado.amigos || []).filter(a => onlines.has(a.id));
}

/* Mostra o painel de Amigos no lugar da lista de canais. */
function irParaAmigos(aba) {
  const painelSala = $('#painel-sala-visao');
  const painelAmigos = $('#painel-amigos');
  if (!painelAmigos) return;

  if (painelSala) painelSala.hidden = true;
  painelAmigos.hidden = false;

  const bSala = $('#rail-sala');
  const bAmigos = $('#rail-amigos');
  if (bSala) bSala.classList.remove('ativo');
  if (bAmigos) bAmigos.classList.add('ativo');

  // busca mais fresca toda vez que abre — mas sem travar a troca de vista
  carregarAmizades();
  mudarAbaAmigos(aba || 'linha');
}

/* Volta para a lista de canais (a "sala"). */
function irParaSala() {
  const painelSala = $('#painel-sala-visao');
  const painelAmigos = $('#painel-amigos');
  if (painelAmigos) painelAmigos.hidden = true;
  if (painelSala) painelSala.hidden = false;

  const bSala = $('#rail-sala');
  const bAmigos = $('#rail-amigos');
  if (bAmigos) bAmigos.classList.remove('ativo');
  if (bSala) bSala.classList.add('ativo');
}

/* Troca a aba ativa do painel de amigos e mostra só o bloco dela. */
function mudarAbaAmigos(aba) {
  const valido = ['linha', 'todos', 'pedidos', 'adicionar'];
  _abaAmigos = valido.includes(aba) ? aba : 'linha';

  document.querySelectorAll('.aba-amigos').forEach(b => {
    b.classList.toggle('ativa', b.dataset.aba === _abaAmigos);
  });

  const listaAmigos = $('#lista-amigos');
  const listaPedidos = $('#lista-pedidos');
  const painelAdd = $('#painel-adicionar');
  const rotulo = $('#rot-aba-amigos');

  // por padrão esconde tudo; cada aba liga o seu bloco
  if (listaAmigos) listaAmigos.hidden = true;
  if (listaPedidos) listaPedidos.hidden = true;
  if (painelAdd) painelAdd.hidden = true;
  if (rotulo) rotulo.hidden = true;

  if (_abaAmigos === 'adicionar') {
    if (painelAdd) painelAdd.hidden = false;
    const inp = $('#in-busca-amigo');
    if (inp) inp.focus();
  } else if (_abaAmigos === 'pedidos') {
    if (rotulo) { rotulo.hidden = false; rotulo.textContent = 'Pendentes'; }
    if (listaPedidos) listaPedidos.hidden = false;
    desenharListaPedidos();
  } else {
    if (rotulo) {
      rotulo.hidden = false;
      rotulo.textContent = _abaAmigos === 'linha' ? 'Em linha' : 'Todos os amigos';
    }
    if (listaAmigos) listaAmigos.hidden = false;
    desenharListaAmigos();
  }
}

/* ------------------------------------------------------------------ */
/* Modal "Adicionar amigo"                                             */
/* ------------------------------------------------------------------ */

function abrirBuscaAmigo() {
  const box = $('#lista-resultado-amigo');
  if (box) box.innerHTML = '';
  const input = $('#in-busca-amigo');
  if (input) { input.value = ''; input.focus(); }
  // a busca mora DENTRO do painel de amigos — não há mais modal por cima
  irParaAmigos('adicionar');
}

async function buscarAmigo() {
  const input = $('#in-busca-amigo');
  const box = $('#lista-resultado-amigo');
  if (!input || !box) return;

  const q = input.value.trim();
  if (q.length < 2) {
    box.innerHTML = '<li class="escolha-vazia">Digite pelo menos 2 letras.</li>';
    return;
  }

  if (!estado.token) {
    box.innerHTML = '<li class="escolha-vazio">Você precisa estar logado para adicionar amigos.</li>';
    return;
  }

  box.innerHTML = '<li class="escolha-vazio">Buscando…</li>';

  try {
    const r = await fetch(origemHttp() + '/api/pessoas?q=' + encodeURIComponent(q), {
      headers: { Authorization: 'Bearer ' + estado.token }
    });
    if (!r.ok) throw new Error('falhou na busca');
    const data = await r.json();

    if (!data.pessoas || !data.pessoas.length) {
      box.innerHTML = '<li class="escolha-vazio">Nenhuma pessoa encontrada.</li>';
      return;
    }

    // filtra quem já é amigo ou já tem pedido pendente
    const amigosIds = new Set((estado.amigos || []).map(a => a.id));
    const pedidosIds = new Set((estado.pedidosAmizade || []).map(p => p.id));
    const meuId = estado.usuario?.id;

    const filtrados = data.pessoas.filter(p => p.id !== meuId && !amigosIds.has(p.id) && !pedidosIds.has(p.id));

    if (!filtrados.length) {
      box.innerHTML = '<li class="escolha-vazio">Essa pessoa já é seu amigo ou tem pedido pendente.</li>';
      return;
    }

    box.innerHTML = filtrados.map(p => `
      <li class="resultado-amigo" data-id="${escapeHtml(p.id)}">
        ${avatarHtml({ id: p.id, nome: p.nome, avatar: p.avatar, cor: p.cor }, 'avatar')}
        <span class="resultado-nome">${escapeHtml(p.nome)}</span>
        <span class="resultado-acao">
          <button class="btn-pedido" data-id="${escapeHtml(p.id)}" type="button" title="Adicionar">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-5-9h4V7H7v4H3V7H7V3h4v4h4v2H7v4H3v2h4v4h4v2h2v-4h4v-4h-4v-4h-2V3z"/></svg>
          </button>
        </span>
      </li>
    `).join('');

    box.querySelectorAll('.resultado-amigo .btn-pedido').forEach(b => {
      b.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await pedirAmizade(b.dataset.id);
        b.disabled = true;
        b.title = 'Enviado';
        b.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
      });
    });
  } catch (e) {
    box.innerHTML = '<li class="escolha-vazio">Erro na busca: ' + escapeHtml(e.message) + '</li>';
  }
}

/* ------------------------------------------------------------------ */
/* Inicialização dos amigos                                            */
/* ------------------------------------------------------------------ */

function inicializarAmigos() {
  // botão "+" no cabeçalho do painel de amigos
  const btnNovoAmigo = $('#btn-novo-amigo');
  if (btnNovoAmigo) btnNovoAmigo.addEventListener('click', abrirBuscaAmigo);

  // busca (agora dentro do painel, não num modal)
  const btnBuscar = $('#btn-buscar-amigo');
  if (btnBuscar) btnBuscar.addEventListener('click', buscarAmigo);
  const inputBusca = $('#in-busca-amigo');
  if (inputBusca) {
    inputBusca.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') buscarAmigo();
    });
  }

  // abas do painel (Em linha / Todos / Pendentes / Adicionar)
  document.querySelectorAll('.aba-amigos').forEach(b => {
    b.addEventListener('click', () => mudarAbaAmigos(b.dataset.aba));
  });

  // rail: troca entre a sala e o painel de amigos, como o Discord
  const railSala = $('#rail-sala');
  if (railSala) railSala.addEventListener('click', irParaSala);
  const railAmigos = $('#rail-amigos');
  if (railAmigos) railAmigos.addEventListener('click', () => irParaAmigos());
  const railLoja = $('#rail-loja');
  if (railLoja) railLoja.addEventListener('click', () => abrirConfig('loja'));

  // quem chega num pedido novo tira a bolinha do rail
  atualizarBadgesAmigos();
}
