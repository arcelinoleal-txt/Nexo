'use strict';

/**
 * Contas do Nexo — cadastro, login, sessão e recuperação de senha.
 *
 * - Senhas guardadas com scrypt + sal (nunca em texto puro).
 * - Sessão por token assinado com HMAC, então sobrevive a reinício do servidor.
 * - Recuperação em dois caminhos:
 *     1. código de 6 dígitos enviado por e-mail (o principal);
 *     2. código de recuperação de suporte, que só o dono da conta vê no app —
 *        é o caminho de você mesmo atender quem perdeu o e-mail.
 * - Senha de suporte NUNCA é guardada em texto: só o hash, e só o dono consegue
 *   revelar, digitando a própria senha atual.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* Caminho dos dados. Dá para desviar com NEXO_DADOS_CONTAS — os testes
   usam isso para trabalhar numa base descartável e não sujar a real. */
const ARQUIVO = process.env.NEXO_DADOS_CONTAS
  ? path.resolve(process.env.NEXO_DADOS_CONTAS)
  : path.join(__dirname, 'dados-contas.json');

/* Segredo para assinar tokens HMAC.
   IMPORTANTO: Em produção, DEFINA NEXO_SEGREDO_TOKEN no ambiente.
   Se não definido, gera um aleatório (sessões expiram no restart). */
const SEGREDO = process.env.NEXO_SEGREDO_TOKEN || crypto.randomBytes(32).toString('hex');

const MAX_TENTATIVAS = 8;
const JANELA_TENTATIVAS = 10 * 60 * 1000;   // 10 minutos
const VIDA_CODIGO = 20 * 60 * 1000;          // 20 minutos

let banco = {
  segredo: SEGREDO,
  usuarios: [],
  seq: 1
};

/* ------------------------------------------------------------------ */
/* Persistência                                                        */
/* ------------------------------------------------------------------ */

function carregar() {
  try {
    if (!fs.existsSync(ARQUIVO)) return;
    const bruto = fs.readFileSync(ARQUIVO, 'utf8');
    const dados = JSON.parse(bruto);
    if (dados && Array.isArray(dados.usuarios)) banco = dados;
    if (!banco.segredo) banco.segredo = SEGREDO_PADRAO;
    if (!banco.seq) banco.seq = 1;
  } catch (erro) {
    console.warn('[nexo] nao consegui ler dados-contas.json:', erro.message);
  }
}

function gravar() {
  try {
    fs.writeFileSync(ARQUIVO, JSON.stringify(banco, null, 2), 'utf8');
  } catch (erro) {
    console.warn('[nexo] nao consegui gravar dados-contas.json:', erro.message);
  }
}

carregar();

/* ------------------------------------------------------------------ */
/* Senhas                                                              */
/* ------------------------------------------------------------------ */

function hashSenha(senha, sal) {
  const s = sal || crypto.randomBytes(16).toString('hex');
  const digesto = crypto.scryptSync(String(senha), s, 64).toString('hex');
  return { sal: s, hash: digesto };
}

function conferirSenha(senha, sal, hash) {
  try {
    const novo = crypto.scryptSync(String(senha), sal, 64);
    const antigo = Buffer.from(hash, 'hex');
    return novo.length === antigo.length && crypto.timingSafeEqual(novo, antigo);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Validação                                                           */
/* ------------------------------------------------------------------ */

const RE_NOME = /^[a-zA-Z0-9_.-]{3,24}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizarEmail(e) { return String(e || '').trim().toLowerCase(); }

function validarSenha(senha) {
  const s = String(senha || '');
  if (s.length < 8) return 'A senha precisa de pelo menos 8 caracteres.';
  if (s.length > 200) return 'A senha está longa demais.';
  if (!/[a-zA-Z]/.test(s) || !/[0-9]/.test(s)) return 'Use ao menos uma letra e um número.';
  return null;
}

/* ------------------------------------------------------------------ */
/* Tokens de sessão                                                    */
/* ------------------------------------------------------------------ */

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function assinar(parte) {
  return crypto.createHmac('sha256', banco.segredo).update(parte).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function gerarToken(usuario) {
  const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'NX' }));
  const corpo = base64url(JSON.stringify({
    sub: usuario.id,
    nome: usuario.nome,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 dias
  }));
  return cabecalho + '.' + corpo + '.' + assinar(cabecalho + '.' + corpo);
}

function lerToken(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  if (assinar(partes[0] + '.' + partes[1]) !== partes[2]) return null;
  try {
    const corpo = JSON.parse(Buffer.from(partes[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (!corpo || corpo.exp < Date.now()) return null;
    return corpo;
  } catch {
    return null;
  }
}

function usuarioDoToken(token) {
  const corpo = lerToken(token);
  if (!corpo) return null;
  return banco.usuarios.find(u => u.id === corpo.sub) || null;
}

/* ------------------------------------------------------------------ */
/* Recuperação de senha                                                */
/* ------------------------------------------------------------------ */

function novoCodigo() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/** código de suporte: 24 caracteres, mais difícil de chutar */
function novoCodigoSuporte() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1
  return Array.from({ length: 24 }, (_, i) =>
    (i > 0 && i % 5 === 0 ? '-' : '') + alfabeto[crypto.randomInt(alfabeto.length)]
  ).join('');
}

function gerarRecuperacao(usuario) {
  const codigo = novoCodigo();
  usuario.recuperacao = {
    codigo,
    expira: Date.now() + VIDA_CODIGO,
    tentativas: 0
  };
  gravar();
  return codigo;
}

function conferirCodigo(usuario, codigo) {
  const r = usuario.recuperacao;
  if (!r || !r.expira || r.expira < Date.now()) return 'Código expirado. Peça um novo.';
  if (r.tentativas >= MAX_TENTATIVAS) return 'Muitas tentativas. Peça um novo código.';
  r.tentativas++;
  gravar();

  const digitado = String(codigo || '').trim().replace(/\s/g, '').toUpperCase();
  const esperado = String(r.codigo).toUpperCase();
  if (digitado.length !== esperado.length) return 'Código incorreto.';

  // compara em tempo constante para não vazar pela velocidade
  const a = Buffer.from(digitado);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'Código incorreto.';
  return null;
}

/* ------------------------------------------------------------------ */
/* Acesso ao banco                                                     */
/* ------------------------------------------------------------------ */

function porId(id) { return banco.usuarios.find(u => u.id === id) || null; }
function porNome(nome) {
  const n = String(nome || '').trim().toLowerCase();
  if (!n) return null;
  return banco.usuarios.find((u) => u && u.nome && u.nome.toLowerCase() === n) || null;
}

/* Procura parcial por nome, sem diferenciar maiúscula de minúscula.
   É o que move a aba "Adicionar amigo": a pessoa digita um pedaço do
   nome e vê quem casa. Nunca devolvo e-mail, senha, token ou código de
   suporte — quem procura só vê o que já apareceria numa lista de sala.
   Limite de 12 para não transformar a busca em listão do servidor inteiro. */
function procurar(q) {
  const s = String(q || '').trim().toLowerCase();
  if (s.length < 2) return [];
  return banco.usuarios
    .filter((u) => u && u.nome && u.nome.toLowerCase().includes(s))
    .slice(0, 12);
}

function porEmail(email) {
  const e = normalizarEmail(email);
  return banco.usuarios.find(u => u.email === e) || null;
}

function publico(u) {
  if (!u) return null;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    avatar: u.avatar || '',
    cor: u.cor || 0,
    criadoEm: u.criadoEm
  };
}

/* ------------------------------------------------------------------ */
/* Operações                                                           */
/* ------------------------------------------------------------------ */

function cadastrar({ nome, email, senha, avatar, cor }) {
  const n = String(nome || '').trim();
  const e = normalizarEmail(email);

  if (!RE_NOME.test(n)) return { erro: 'Nome de usuário inválido: 3 a 24 letras, números, ponto, hífen ou _.', status: 400 };
  if (!RE_EMAIL.test(e)) return { erro: 'E-mail inválido.', status: 400 };
  const problemaSenha = validarSenha(senha);
  if (problemaSenha) return { erro: problemaSenha, status: 400 };

  if (porEmail(e)) return { erro: 'Este e-mail já está cadastrado.', status: 409 };
  if (porNome(n)) return { erro: 'Este nome de usuário já está em uso.', status: 409 };

  const { sal, hash } = hashSenha(senha);
  const usuario = {
    id: 'u' + (banco.seq++),
    nome: n,
    email: e,
    sal,
    hash,
    avatar: String(avatar || '').slice(0, 8),
    cor: Math.max(0, Math.min(360, Number(cor) || 0)),
    criadoEm: Date.now(),
    suporte: novoCodigoSuporte(),
    recuperacao: null,
    tentativasLogin: 0,
    bloqueadoAte: 0
  };
  banco.usuarios.push(usuario);
  gravar();

  return { usuario, token: gerarToken(usuario) };
}

function entrar({ email, senha }) {
  const usuario = porEmail(email);
  if (!usuario) return { erro: 'E-mail ou senha incorretos.', status: 401 };

  if (usuario.bloqueadoAte && usuario.bloqueadoAte > Date.now()) {
    const min = Math.ceil((usuario.bloqueadoAte - Date.now()) / 60000);
    return { erro: `Muitas tentativas. Tente de novo em ${min} minuto(s).`, status: 429 };
  }

  if (!conferirSenha(senha, usuario.sal, usuario.hash)) {
    usuario.tentativasLogin = (usuario.tentativasLogin || 0) + 1;
    if (usuario.tentativasLogin >= MAX_TENTATIVAS) {
      usuario.bloqueadoAte = Date.now() + JANELA_TENTATIVAS;
      usuario.tentativasLogin = 0;
    }
    gravar();
    return { erro: 'E-mail ou senha incorretos.', status: 401 };
  }

  usuario.tentativasLogin = 0;
  usuario.bloqueadoAte = 0;
  gravar();
  return { usuario, token: gerarToken(usuario) };
}

function redefinir({ email, codigo, senha }) {
  const usuario = porEmail(email);
  // mesma mensagem nos dois casos: não revela se o e-mail existe
  if (!usuario) return { erro: 'Código inválido ou expirado.', status: 400 };

  const problema = conferirCodigo(usuario, codigo);
  if (problema) return { erro: problema, status: 400 };

  const problemaSenha = validarSenha(senha);
  if (problemaSenha) return { erro: problemaSenha, status: 400 };

  const novo = hashSenha(senha);
  usuario.sal = novo.sal;
  usuario.hash = novo.hash;
  usuario.recuperacao = null;
  // trocar a senha invalida qualquer sessão aberta
  usuario.senhaTrocadaEm = Date.now();
  gravar();

  return { usuario, token: gerarToken(usuario) };
}

/** Recuperação pelo código de suporte: quem tem o código troca a senha
 *  sem precisar do e-mail. É o caminho de atendimento manual. */
function redefinirComSuporte({ email, suporte, senha }) {
  const usuario = porEmail(email);
  if (!usuario) return { erro: 'Código de suporte inválido.', status: 400 };

  const digitado = String(suporte || '').trim().toUpperCase().replace(/\s+/g, '');
  const esperado = String(usuario.suporte || '').toUpperCase();
  if (!esperado || digitado !== esperado) {
    return { erro: 'Código de suporte inválido.', status: 400 };
  }

  const problemaSenha = validarSenha(senha);
  if (problemaSenha) return { erro: problemaSenha, status: 400 };

  const novo = hashSenha(senha);
  usuario.sal = novo.sal;
  usuario.hash = novo.hash;
  usuario.recuperacao = null;
  usuario.senhaTrocadaEm = Date.now();
  gravar();

  return { usuario, token: gerarToken(usuario) };
}

/** Só o dono da conta, estando logado e digitando a senha atual,
 *  consegue reler o próprio código de suporte. */
function mostrarSuporte(usuario, senha) {
  if (!conferirSenha(senha, usuario.sal, usuario.hash)) {
    return { erro: 'Senha atual incorreta.', status: 401 };
  }
  return { suporte: usuario.suporte };
}

module.exports = {
  cadastrar, entrar, redefinir, redefinirComSuporte, mostrarSuporte,
  gerarRecuperacao, porEmail, porId, porNome, procurar,
  usuarioDoToken, gerarToken, publico,
  conferirSenha, validarSenha
};
