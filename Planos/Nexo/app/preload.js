'use strict';

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
  plataforma: process.platform
});
