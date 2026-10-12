'use strict';

/**
 * Gera app/icone.png - o icone do Nexo (quadrado arredondado com gradiente
 * indigo -> violeta e um "N" simples).
 *
 * Roda so na hora de mudar o icone:  node ferramentas/gerar-icone.js
 * Sem dependencia nenhuma: monta o PNG na mao com zlib.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const T = 128;          // lado do icone
const RAIO = 28;        // arredondamento
const CX = T / 2, CY = T / 2;

/* ---- cor em funcao da posicao: gradiente diagonal ---- */
const C1 = [79, 70, 229];   // indigo-600
const C2 = [139, 92, 246];  // violeta-500

function mistura(t) {
  return [
    Math.round(C1[0] + (C2[0] - C1[0]) * t),
    Math.round(C1[1] + (C2[1] - C1[1]) * t),
    Math.round(C1[2] + (C2[2] - C1[2]) * t)
  ];
}

/* ---- "N" desenhado como tres barras ---- */
function dentroDoN(x, y) {
  const e = T * 0.30;        // espessura do traço
  const x0 = T * 0.33, x1 = T * 0.67;
  const y0 = T * 0.28, y1 = T * 0.72;

  // barra esquerda
  if (x >= x0 && x <= x0 + e && y >= y0 && y <= y1) return true;
  // barra direita
  if (x >= x1 - e && x <= x1 && y >= y0 && y <= y1) return true;
  // diagonal de uma barra a outra
  if (y >= y0 && y <= y1) {
    const t = (y - y0) / (y1 - y0);
    const alvo = (x0 + e) + ((x1 - e) - (x0 + e)) * t;
    if (Math.abs(x - alvo) <= e * 0.55) return true;
  }
  return false;
}

function arredondado(x, y) {
  const bx = Math.max(RAIO - x, x - (T - 1 - RAIO), 0);
  const by = Math.max(RAIO - y, y - (T - 1 - RAIO), 0);
  return (bx * bx + by * by) <= RAIO * RAIO;
}

/* ---- monta os pixels ---- */
const bruto = Buffer.alloc(T * (T * 4 + 1));
for (let y = 0; y < T; y++) {
  const linha = y * (T * 4 + 1);
  bruto[linha] = 0; // filtro: nenhum
  for (let x = 0; x < T; x++) {
    const o = linha + 1 + x * 4;
    if (!arredondado(x, y)) { bruto[o + 3] = 0; continue; }

    const t = (x + y) / (2 * (T - 1));
    let [r, g, b] = mistura(t);
    let a = 255;

    if (dentroDoN(x, y)) { r = 255; g = 255; b = 255; }

    bruto[o] = r; bruto[o + 1] = g; bruto[o + 2] = b; bruto[o + 3] = a;
  }
}

/* ---- montagem do PNG ---- */
const TABELA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABELA[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pedaco(tipo, dados) {
  const b = Buffer.alloc(8 + dados.length + 4);
  b.writeUInt32BE(dados.length, 0);
  b.write(tipo, 4, 'ascii');
  dados.copy(b, 8);
  b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo, 'ascii'), dados])), 8 + dados.length);
  return b;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(T, 0);
ihdr.writeUInt32BE(T, 4);
ihdr[8] = 8;   // profundidade
ihdr[9] = 6;   // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  pedaco('IHDR', ihdr),
  pedaco('IDAT', zlib.deflateSync(bruto, { level: 9 })),
  pedaco('IEND', Buffer.alloc(0))
]);

const destino = path.join(__dirname, '..', 'app', 'icone.png');
fs.writeFileSync(destino, png);
console.log('icone gerado: ' + destino + ' (' + png.length + ' bytes, ' + T + 'x' + T + ')');
