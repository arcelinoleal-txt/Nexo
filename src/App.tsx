/* ================================================================
   Discord Clone - App Principal
   React + Zustand + WebRTC Integration
   ================================================================ */

import React, { useEffect, useRef } from 'react';
import './index.css';
{/* Import icons */ ceremony }
import { useDiscordStore } from './zustand/store';
import { useWebRTC } from './hooks/useWebRTC';
import { ServerIcon, ChannelIcon, UserIcon, MicIcon, SpeakerIcon, SettingsGearIcon, CloseIcon, SearchIcon, PlusIcon, CheckIcon, CrossIcon } from './icons';

// Icons inline simples (substituir por imports reais depois)
const icons = {
  ServerIcon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  ChannelIcon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H5l-1.4 12A2 2 0 0 1 1 18V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/></svg>',
  UserIcon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5h-2v6l-2-2L6 9v7H3l-2 2v5c2 7 8 11 8 11z"/></svg>',
  MicIcon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 13v6a2 2 0 0 1-2 2H9l-5-5L3 17v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6zM5 17h14M5 10h14M5 3h14"/></svg>',
  SpeakerIcon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  SettingsGearIcon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.8 7.8 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1a7.3 7.3 0 0 0 1.7 1l.4 2.6c0 .3.2.5.5.5h4c.3 0 .5-.2.5-.5l.4-2.6a7.3 7.3 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"/></svg>',
  CloseIcon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m18.3 5.7-12.6 12.6 1.4 1.4 12.6-12.6-1.4-1.4Z"/></svg>',
};

const App: React.FC = () => {
  // ==========================================================
  // ESTADO ZUSTAND
  // ==========================================================
  
  const {
    // Estado
    activeServerId, servidores, activeChannelId, canais,
    amigos, dmAtivo, amigoSelecionado, amigosAba,
    isMuted, isDeafened, volume, isVoiceSettingsOpen,
    dispositivoEntrada, dispositivoSaida,
    isSettingsModalOpen, settingsAbas,
    messages, inputMensagem, statusUsuario,
    toggleMute, setMute, toggleDeafened, setDeafened, setVolume,
    setVoiceSettingsOpen, setDispositivoEntrada, setDispositivoSaida,
    openSettingsModal, closeSettingsModal, setSettingsAbas,
    setMessages, addMessage, setInputMensagem, clearInputMensagem,
    setStatusUsuario,
    
    // Ações de servidor
    setActiveServer, setServers, setActiveChannel, setChannels,
    setFriends, setDmAtivo, setAmigoSelecionado, setAbaAmigos,
    
    // Útil para o hook WebRTC
    useDiscordStore
  } = useDiscordStore();

  // Usuário logado (simulado)
  const myUserId = 'user_1'; // Em produção, viria do JWT
  const myUsername = 'Leal';
  
  // Usuários "conectados" (vindo do store ou simulação)
  const connectedUsers = useDiscordStore(state => state.amigos.length > 0 ? state.amigos.map(a => a.id) : ['user_2', 'user_3']);
  
  // ==========================================================
  // HOOK WEBRTC
  // ==========================================================
  
  const {
    // Estado local
    localStream, isLocalAudioMuted, isLocalVideoMuted, isScreenSharing,
    // Controles
    toggleAudio, toggleVideo, startScreenShare, stopScreenShare,
    // Conexões
    connectToUser, disconnectFromUser, getRemoteStream,
    // Áudio level
    getAudioLevel,
    // Elementos de vídeo
    getLocalVideoElement,
    connectionStates,
    // Estados adicionais
  } = useWebRTC(myUserId, connectedUsers);
  
  // ==========================================================
  // EFEITO: Inicializar stream local quando usuários conectam
  // ==========================================================
  
  useEffect(() => {
    const init = async () => {
      if (!localStream && connectedUsers.length > 0) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          
          // O setLocalStream é feito no usoWebRTC internamente
          // Aqui apenas garantimos que o efeito roda
          console.log('🔧 Efeito WebRTC inicializado', connectedUsers.length, 'usuários');
        } catch (error) {
          console.error('❌ Erro ao inicializar WebRTC:', error);
        }
      }
    };
    
    init();
  }, [connectedUsers, localStream]);
  
  // ==========================================================
  // LAYOUT DE 4 COLUNAS DISCORD
  // ==========================================================
  
  return (
    <div className="min-h-screen bg-[var(--discord-bg-chat)] text-white">
      <div className="flex h-screen">
        
        {/* ========== COluna 1: Dock de Servidores (72px) ========== */}
        <aside class="w-14 bg-[var(--discord-sidebar-serv)] border-r border-gray-600 flex flex-col p-2">
          <div className="h-14 flex items-center justify-between">
            <span className="text-xs font-medium">Discord</span>
            <button className="p-2 rounded hover:bg-gray-700" onClick={openSettingsModal}>
              {icons.SettingsGearIcon}
            </button>
          </div>
          
          <div className="flex-1 h-overflow space-y-1">
            {/* Home/Direct Messages */}
            <div className="px-2 py-1 bg-gray-900 rounded cursor-pointer" onClick={() => setActiveServer(null)}>
              <span className="text-xs opacity-60">DMs</span>
            </div>
            
            {/* Servidores */}
            {servidores.map((servidor) => (
              <div
                key={servidor.id}
                className="px-2 py-1 bg-gray-900 rounded hover:bg-gray-800 cursor-pointer"
                onClick={() => setActiveServer(servidor.id)}
              >
                <span className="text-xs">{servidor.nome}</span>
              </div>
            ))}
            
            {/* Botão Nova Servidor */}
            <button className="px-2 py-1 text-xs text-gray-400 rounded hover:text-white">
              {icons.PlusIcon} Criar
            </button>
          </div>
        </aside>

        {/* ========== Coluna 2: Canais/DMs (240px) ========== */}
        <aside class="w-64 bg-[var(--discord-sidebar-canais)] border-r border-gray-600 flex flex-col">
          <div className="h-14 border-b px-3">
            {activeServerId ? `Canais: ${activeServerId}` : 'Servidores e DMs'}
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {/* Canais do Servidor */}
            {activeServerId && (
              <div>
                <p className="text-xs uppercase text-gray-400">CANAIS DE TEXTO</p>
                {canais?.filter(c => c.tipo === 'texto' && c.servidorId === activeServerId)?.map(c => (
                  <div key={c.id} className="px-1 py-1 rounded hover:bg-gray-800 cursor-pointer mb-1">
                    {c.nome}
                  </div>
                ))}
                <p className="text-xs uppercase text-gray-400 mt-2">CANAIS DE VOZ</p>
                {canais?.filter(c => c.tipo === 'voz' && c.servidorId === activeServerId)?.map(c => (
                  <div key={c.id} className="px-1 py-1 rounded hover:bg-gray-800 cursor-pointer mb-1">
                    {c.nome} 🔊
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase text-gray-400">AMIGOS</p>
                {amigos.map((a, i) => (
                  <div key={a.id} className="px-1 py-1 rounded hover:bg-gray-800 cursor-pointer mb-1">
                    {a.nome} {a.tag}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ========== Coluna 3: Área Principal (Chat) ========== */}
        <main class="flex-1 flex flex-col">
          <div className="h-14 border-b px-4 justify-between">
            <span className="font-medium" id="channel-name">
              {activeChannelId ? '#geral' : 'Selecione um canal'}
            </span>
            <div className="flex gap-2">
              <button className="p-1 rounded hover:bg-gray-800 text-xs" onClick={toggleAudio}>
                {icons.MicIcon} Áudio
              </button>
              <button className="p-1 rounded hover:bg-gray-800 text-xs" onClick={toggleVideo}>
                {icons.MicIcon} Vídeo
              </button>
            </div>
          </div>
          
          {/* Área de Mensagens */}
          <div className="flex-1 h-overflow overflow-y-auto p-4 space-y-2" id="messages-container">
            {messages.map((msg, i) => (
              <div key={msg.id} className="px-3 py-2 rounded bg-gray-900 max-w-xs">
                <span className="text-xs text-gray-400">{msg.hora}</span>
                <p className="font-medium">{msg.usuario.nome}</p>
                <p>{msg.conteudo}</p>
              </div>
            ))}
            
            {/* Área de Input */}
            <div className="p-4 border-t bg-gray-900">
              <textarea 
                className="w-full bg-gray-800 border rounded p-2 focus:outline-none focus:ring-2 focus:ring-[var(--discord-accent-prim)]"
                placeholder="Digite uma mensagem..." 
                rows={1}
                onChange={(e) => setInputMensagem(e.target.value)}
                value={inputMensagem}
              ></textarea>
              <button 
                className="mt-2 w-full py-2 bg-[var(--discord-accent-prim)] text-white rounded hover:bg-blue-600 text-sm font-medium"
                onClick={() => { 
                  addMessage({ 
                    usuario: { nome: myUsername, tag: '#POH', avatar: '😀', status: 'online' }, 
                    conteudo: inputMensagem, 
                    hora: new Date().toLocaleTimeString() 
                  }); 
                  clearInputMensagem(); 
                }>
                Enviar
              </button>
            </div>
          </div>
        </main>

        {/* ========== Coluna 4: Painel Lateral Direito (340px) ========== */}
        <aside class="w-80 bg-gray-900 border-l border-gray-600 flex flex-col">
          <div className="h-14 border-b px-3">Ativo Agora</div>
          <div className="flex-1 p-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded bg-gray-900">
                <span className="text-xs">Transmitindo</span>
                <span className="text-xs text-gray-400">VALORANT</span>
              </div>
              <div className="p-2 rounded bg-gray-900">
                <span className="text-xs">Jogando</span>
                <span className="text-xs text-gray-400">Minecraft</span>
              </div>
            </div>
            
            {/* Indicador de Voz Ativa */}
            <div className="mt-4 p-2 rounded bg-gray-900" style={{border: `2px solid ${isLocalAudioMuted ? 'transparent' : 'var(--discord-accent-prim)'}`}}>
              <span className="font-medium">Você</span>
              <span className="text-xs">Áudio: {isLocalAudioMuted ? 'Mudo' : 'Ativo'} • Nível: {Math.round(getAudioLevel(myUserId) * 100)}%</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;