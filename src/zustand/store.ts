/* ================================================================
   Zustand Store - State Management for Discord Clone
   ================================================================ */

import create from 'zustand';
import { persist } from 'zustand/middleware';

// Tipos para o estado da aplicação
type StatusUsuario = 'online' | 'ausente' | 'nao-perturbe' | 'offline';

interface Usuario {
  id: string;
  nome: string;
  tag: string; // ex: #1234
  avatar: string;
  status: StatusUsuario;
  jogoAtual?: string;
}

interface Servidor {
  id: string;
  nome: string;
  icon?: string;
  canaisTexto: string[];
  canaisVoz: string[];
  membros: Usuario[];
}

interface Canal {
  id: string;
  nome: string;
  tipo: 'texto' | 'voz';
  servidorId: string;
}

interface Mensagem {
  id: string;
  usuario: Usuario;
  conteudo: string;
  hora: string;
  tipo?: 'sistema' | 'arquivo' | 'imagem';
}

// ============================================================
// ESTADO DO ZUSTAND - Discount Store
// ============================================================

interface DiscordState {
  // 🔍 Navegação de Servidores
  activeServerId: string | null;
  servidores: Servidor[];
  
  // 📋 Navegação de Canais
  activeChannelId: string | null;
  canais: Canal[];
  
  // 👥 Navegação de Amigos / DMs
  amigos: Usuario[];
  dmAtivo: Usuario | null;
  amigoSelecionado: Usuario | null;
  
  // Abas de amigos
  amigosAba: 'disponivel' | 'todos' | 'pendente' | 'bloqueados' | 'adicionar-amigo';
  
  // 🎮 Controle de Áudio
  isMuted: boolean;
  isDeafened: boolean;
  volume: number; // 0 a 100
  isVoiceSettingsOpen: boolean;
  dispositivoEntrada: string;
  dispositivoSaida: string;
  
  // 🪔 Modal de Configurações
  isSettingsModalOpen: boolean;
  settingsAbas: 'minha-conta' | 'perfil' | 'privacidade' | 'voz-video' | 'notificacoes';
  
  // 💬 Gerenciamento de Mensagens Locais
  messages: Mensagem[];
  inputMensagem: string;
  
  // ⚙️ Outras configs
  statusUsuario: StatusUsuario;
  
  // Ações (methods)
  setActiveServer: (id: string | null) => void;
  setServers: (servers: Servidor[]) => void;
  setActiveChannel: (id: string | null) => void;
  setChannels: (channels: Canal[]) => void;
  setFriends: (friends: Usuario[]) => void;
  setDmAtivo: (user: Usuario | null) => void;
  setAmigoSelecionado: (user: Usuario | null) => void;
  setAbaAmigos: (aba: 'disponivel' | 'todos' | 'pendente' | 'bloqueados' | 'adicionar-amigo') => void;
  toggleMute: () => void;
  setMute: (state: boolean) => void;
  toggleDeafened: () => void;
  setDeafened: (state: boolean) => void;
  setVolume: (vol: number) => void;
  setVoiceSettingsOpen: (open: boolean) => void;
  setDispositivoEntrada: (id: string) => void;
  setDispositivoSaida: (id: string) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  setSettingsAbas: (aba: 'minha-conta' | 'perfil' | 'privacidade' | 'voz-video' | 'notificacoes') => void;
  setMessages: (msgs: Mensagem[]) => void;
  addMessage: (msg: Omit<Mensagem, 'id'>) => void;
  setInputMensagem: (text: string) => void;
  clearInputMensagem: () => void;
  setStatusUsuario: (status: StatusUsuario) => void;
}

// ============================================================
// CRIAÇÃO DO STORE
// ============================================================

export const useDiscordStore = create<DiscordState>()(
  persist(
    (set) => ({
      // Estado Inicial
      activeServerId: null,
      servidores: [],
      activeChannelId: null,
      canais: [],
      amigos: [],
      dmAtivo: null,
      amigoSelecionado: null,
      amigosAba: 'disponivel',
      isMuted: false,
      isDeafened: false,
      volume: 100,
      isVoiceSettingsOpen: false,
      dispositivoEntrada: 'Microfone Padrão',
      dispositivoSaida: 'Fones Padrão',
      isSettingsModalOpen: false,
      settingsAbas: 'minha-conta',
      messages: [],
      inputMensagem: '',
      statusUsuario: 'online',
      
      // ==========================================================
      // 🔍 NAVEGAÇÃO DE SERVIDORES / CANAIS
      // ==========================================================
      
      setActiveServer: (id) => set({ activeServerId: id }),
      
      setServers: (servers) => set({ servidores: servers }),
      
      setActiveChannel: (id) => set({ activeChannelId: id }),
      setChannels: (canais) => set({ canais }),
      
      // ==========================================================
      // 👥 NAVEGAÇÃO DE AMIGOS / DMs
      // ==========================================================
      
      setFriends: (amigos) => set({ amigos }),
      setDmAtivo: (user) => set({ dmAtivo: user }),
      setAmigoSelecionado: (user) => set({ amigoSelecionado: user }),
      setAbaAmigos: (aba) => set({ amigosAba: aba }),
      
      // ==========================================================
      // 🎮 CONTROLE DE ÁUDIO
      // ==========================================================
      
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      setMute: (state) => set({ isMuted: state }),
      toggleDeafened: () => set((state) => ({ isDeafened: !state.isDeafened })),
      setDeafened: (state) => set({ isDeafened: state }),
      setVolume: (vol) => set({ volume: vol }),
      setVoiceSettingsOpen: (open) => set({ isVoiceSettingsOpen: open }),
      setDispositivoEntrada: (id) => set({ dispositivoEntrada: id }),
      setDispositivoSaida: (id) => set({ dispositivoSaida: id }),
      
      // ==========================================================
      // 🪔 MODAL DE CONFIGURAÇÕES DO USUÁRIO
      // ==========================================================
      
      openSettingsModal: () => set({ isSettingsModalOpen: true }),
      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
      setSettingsAbas: (aba) => set({ settingsAbas: aba }),
      
      // ==========================================================
      // 💬 GERENCIAMENTO DE MENSAGENS LOCAIS
      // ==========================================================
      
      setMessages: (msgs) => set({ messages: msgs }),
      addMessage: (msg) =>
        set((state) => ({
          messages: [...state.messages, { ...msg, id: Date.now().toString() }],
        })),
      setInputMensagem: (text) => set({ inputMensagem: text }),
      clearInputMensagem: () => set({ inputMensagem: '' }),
      
      // ==========================================================
      // ⚙️ OUTRAS CONFIGURAÇÕES
      // ==========================================================
      
      setStatusUsuario: (status) => set({ statusUsuario: status }),
    }),
    {
      // Persistir o estado no localStorage
      name: 'discord-clone-storage',
      skipHydration: true,
    }
  )
);

// ============================================================
// HELPERS & SELECTORS (para uso em componentes)
// ============================================================

export const useActiveServer = () => useDiscordStore((state) => state.activeServerId);
export const useServers = () => useDiscordStore((state) => state.servidores);
export const useActiveChannel = () => useDiscordStore((state) => state.activeChannelId);
export const useChannels = () => useDiscordStore((state) => state.canais);
export const useFriends = () => useDiscordStore((state) => state.amigos);
export const useDmAtivo = () => useDiscordStore((state) => state.dmAtivo);
export const useAmigoSelecionado = () => useDiscordStore((state) => state.amigoSelecionado);
export const useAbaAmigos = () => useDiscordStore((state) => state.amigosAba);
export const useIsMuted = () => useDiscordStore((state) => state.isMuted);
export const useIsDeafened = () => useDiscordStore((state) => state.isDeafened);
export const useVolume = () => useDiscordStore((state) => state.volume);
export const useIsVoiceSettingsOpen = () => useDiscordStore((state) => state.isVoiceSettingsOpen);
export const useDispositivoEntrada = () => useDiscordStore((state) => state.dispositivoEntrada);
export const useDispositivoSaida = () => useDiscordStore((state) => state.dispositivoSaida);
export const useIsSettingsModalOpen = () => useDiscordStore((state) => state.isSettingsModalOpen);
export const useSettingsAbas = () => useDiscordStore((state) => state.settingsAbas);
export const useMessages = () => useDiscordStore((state) => state.messages);
export const useInputMensagem = () => useDiscordStore((state) => state.inputMensagem);
export const useStatusUsuario = () => useDiscordStore((state) => state.statusUsuario);

// Exportar tipos tipados
export type { Usuario, Servidor, Canal, Mensagem, DiscordState };