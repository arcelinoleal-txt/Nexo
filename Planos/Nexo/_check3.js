const fs = require('fs');
const t = fs.readFileSync(__dirname + '/dist/win-unpacked/resources/app.asar').toString('utf8');
const checks = [
  ['botao Baixar atualizacao', t.includes("'Baixar atualização'")],
  ['le d.download', t.includes('d.download')],
  ['window.open no aviso', t.includes('window.open(link,')],
  ['servidor repassa download', t.includes("download: typeof dados.download")],
  ['versao 1.8.0', t.includes('"version": "1.8.0"')],
  ['versao.json 1.8.0', t.includes('"versao": "1.8.0"')]
];
let ok = 0;
for (const [n, p] of checks) { console.log((p ? 'OK   ' : 'FALHA') + ' ' + n); if (p) ok++; }
console.log('\n' + ok + '/' + checks.length + ' — ' + (ok === checks.length ? 'APROVADO' : 'REVISAR'));
