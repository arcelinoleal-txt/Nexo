'use strict';
/* Nexo — preload seguro (mesma arquitetura do Discord: mainScreenPreload.js analisado pelo REA como preload module / require:9934) */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexoDesktop', {
  listarFontes: () => ipcRenderer.invoke('fontes:listar'),
  escolherFonte: (id) => ipcRenderer.invoke('fontes:escolher', id),
  configurarCaptura: (cfg) => ipcRenderer.invoke('captura:configurar', cfg),
  controlarJanela: (acao) => ipcRenderer.invoke('janela:controle', acao),
  estaMaximizada: () => ipcRenderer.invoke('janela:maximizada'),
  onMaximizada: (cb) => ipcRenderer.on('janela:maximizada', (_e, valor) => cb(valor)),
  info: () => ipcRenderer.invoke('app:info'),
  definirPreferencia: (chave, valor) => ipcRenderer.invoke('app:preferencia', chave, valor),
  plataforma: process.platform,
  // REA / Discord-inspired: safe config bridge for premium settings
  salvarConfigLocal: (chave, valor) => ipcRenderer.invoke('config:salvar', chave, valor),
  carregarConfigLocal: (chave) => ipcRenderer.invoke('config:carregar', chave)
});