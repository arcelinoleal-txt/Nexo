/* ================================================================
   useWebRTC Hook - Discord Clone
   Gerencia captura de mídia, conexões Peer e sinalização
   ================================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';

// Tipos para o estado do hook
type LocalStreamType = null | MediaStream;
type RemoteStreamMapType = Map<string, MediaStream>; // peerId -> stream
type PeerConnectionMapType = Map<string, RTCPeerConnection>; // peerId -> pc

export interface UseWebRTCReturn {
  // Estado Local
  localStream: LocalStreamType;
  isLocalAudioMuted: boolean;
  isLocalVideoMuted: boolean;
  isScreenSharing: boolean;
  
  // Controles
  toggleAudio: () => void;
  toggleVideo: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  
  // Conexões Peer
  connectToUser: (userId: string, remoteStream: MediaStream) => Promise<void>;
  disconnectFromUser: (userId: string) => void;
  getRemoteStream: (userId: string) => MediaStream | undefined;
  
  // Estado da conexão
  connectionStates: Map<string, 'connecting' | 'connected' | 'disconnected'>;
  
  // Métodos utilitários
  getLocalVideoElement: () => HTMLVideoElement | null;
  getAudioLevel: () => number;
}

/* ============================================================
   HOOK PRINCIPAL
   ============================================================ */

const useWebRTC = (myUserId: string, connectedUsers: string[]): UseWebRTCReturn => {
  // ==========================================================
  // 1. ESTADO LOCAL - Captura de Áudio e Vídeo
  // ==========================================================
  
  const [localStream, setLocalStream] = useState<LocalStreamType>(null);
  const [isLocalAudioMuted, setIsLocalAudioMuted] = useState(false);
  const [isLocalVideoMuted, setIsLocalVideoMuted] = useState(true); // Inicialmente vídeo off
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const [connectionStates, setConnectionStates] = useState<Map<string, 'connecting' | 'connected' | 'disconnected'>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamMapType>(new Map());
  
  // Referências para elementos de vídeo
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement>>({});
  
  // Níveis de áudio (para indicador de voz)
  const audioLevels = useRef<Record<string, number>>(new Map());
  
  // ==========================================================
  // 2. CAPTURA DE MÍDIA LOCAL
  // ============================================================
  
  const toggleAudio = useCallback(async () => {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsLocalAudioMuted(!audioTrack.enabled);
    }
  }, [localStream]);
  
  const toggleVideo = useCallback(async () => {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsLocalVideoMuted(!videoTrack.enabled);
    }
  }, [localStream]);
  
  // Iniciar compartilhamento de tela
  const startScreenShare = useCallback(async () => {
    try {
      // Parar sharing anterior se houver
      if (isScreenSharing) {
        stopScreenShare();
      }
      
      // Capturar tela/display media
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { min: 300, max: 1920 },
          height: { min: 150, max: 1080 }
        },
        audio: true
      });
      
      setIsScreenSharing(true);
      
      // Se já temos uma conexão peer, adicionar a trilha
      // Isso será tratado pelo connectToUser quando o usuário for selecionado
      console.log('📺 Compartilhamento de tela iniciado', screenStream.getTracks());
      
    } catch (error) {
      console.error('❌ Erro ao iniciar sharing de tela:', error);
      alert('Não foi possível acessar a tela. Permita a permissão de tela nas configurações do navegador.');
    }
  }, [isScreenSharing, stopScreenShare]);
  
  const stopScreenShare = useCallback(() => {
    setIsScreenSharing(false);
    // Note: O stream precisa ser parado explicitamente pelo componente que o chamou
    // ou quando o usuário sai da chamada
    console.log('⏹️ Compartilhamento de tela parado');
  };
  
  // ==========================================================
  // 3. CONEXÕES PEER - WebRTC Signalization
  // ============================================================
  
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [remoteStreamsMap, setRemoteStreamsMap] = useState<RemoteStreamMapType>(new Map());
  
  // Função para conectar a um usuário específico
  const connectToUser = useCallback(async (userId: string, remoteStream: MediaStream) => {
    // Se já houver conexão, fechar e reconectar
    if (peerConnections.has(userId)) {
      const existingPc = peerConnections.get(userId);
      if (existingPc) {
        existingPc.close();
      }
    }
    
    const pc = new RTCPeerConnection(RTC_CONFIG);
    setPeerConnections(prev => new Map(prev).set(userId, pc));
    
    // Armazenar stream remoto
    setRemoteStreamsMap(prev => new Map(prev).set(userId, remoteStream));
    
    // Evento: quando trilha remota for adicionada
    pc.ontrack = (event) => {
      console.log(`📥 Received track from ${userId}:`, event.track.kind);
      // O componente que chama esse hook irá renderizar o vídeo
    };
    
    // Evento: candidato ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Enviar candidato ICE para o signaling server
        // Em um sistema completo, enviaríamos via socket.io para o outro usuário
        console.log(`🧊 ICE candidate from ${userId}:`, event.candidate);
      }
    };
    
    // Evento: mudança de estado de conexão
    pc.onconnectionstatechange = (event) => {
      console.log(`🔗 Connection state for ${userId}:`, event.target.connectionState);
      setConnectionStates(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, event.target.connectionState as any);
        return newMap;
      });
    };
    
    // Evento: oniceconnectionstatechange (alternativo)
    pc.oniceconnectionstatechange = (event) => {
      console.log(`🔗 ICE Connection state for ${userId}:`, event.target.iceConnectionState);
    };
    
    // ==========================================================
    // CREAT OFFER E SINALIZAÇÃO
    // ==========================================================
    
    // Adicionar trilha local (áudio e vídeo)
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    // Criar oferta SDP
    try {
      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      
      // Enviar oferta para o servidor de sinalização
      // Em um sistema real, isso seria: socket.emit('offer', { sdp: pc.localDescription.sdp, to: userId })
      // Aqui simulamos o envio
      console.log(`📤 Offer created for ${userId}`, pc.localDescription.type);
      
      // Definir estado de conexão como conectando
      setConnectionStates(prev => new Map(prev).set(userId, 'connecting'));
      
    } catch (error) {
      console.error('❌ Erro ao criar oferta:', error);
      setConnectionStates(prev => new Map(prev).set(userId, 'disconnected'));
    }
  }, [myUserId, connectedUsers, localStream]);
  
  // ==========================================================
  // DESCONECTAR DE USUÁRIO
  // ============================================================
  
  const disconnectFromUser = useCallback((userId: string) => {
    if (peerConnections.has(userId)) {
      const pc = peerConnections.get(userId)!;
      pc.close();
      peerConnections.delete(userId);
    }
    
    setRemoteStreamsMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
    
    setConnectionStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
    
    console.log(`👋 Desconectado de ${userId}`);
  };
  
  // ==========================================================
  // PEGAR STREAM REMOTO
  // ============================================================
  
  const getRemoteStream = useCallback((userId: string): MediaStream | undefined => {
    return remoteStreamsMap.get(userId);
  };
  
  // ==========================================================
  // NÍVEIS DE ÁUDIO (Indicador de Voz)
  // ============================================================
  
  const getAudioLevel = useCallback((userId: string): number => {
    // Retorna um nível de áudio entre 0 e 1 baseado no mapa de níveis
    return audioLevels.current[userId] || 0;
  };
  
  // ==========================================================
  // INICIALIZAÇÃO - Solicitar mídia local na montagem
  // ============================================================
  
  useEffect(() => {
    // Solicitar acesso à câmera e microfone somente quando o hook for montado
    // e houver usuários conectados
    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: {
            facingMode: 'user', // Câmera frontal padrão
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        setLocalStream(stream);
        
        // Atribuir tracks aos elementos de vídeo locais
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        console.log('🎥 Stream local capturado com sucesso');
        console.log('Tracks:', stream.getTracks().length);
        
      } catch (error) {
        console.error('❌ Erro ao capturar stream local:', error);
        alert('Permissão de câmera e microfone necessária para usar o Discord Clone.');
      }
    };
    
    // Só inicializar se tivermos usuários conectados
    if (connectedUsers && connectedUsers.length > 0) {
      initLocalStream();
    }
  }, [connectedUsers]);
  
  // ==========================================================
  // EFFECT: Atualizar streams remotos quando mudarem
  // ============================================================
  
  useEffect(() => {
    // Este effect observa as mudanças nos streams remotos
    // e atualiza os elementos de vídeo correspondentes
    
    const updateRemoteVideos = () => {
      setRemoteStreamsMap(prev => {
        const newMap = new Map(prev);
        return newMap;
      });
    };
    
    return updateRemoteVideos;
  }, [remoteStreams]);
  
  // ==========================================================
  // RETORNO DO HOOK
  // ============================================================
  
  return {
    // Estado Local
    localStream,
    isLocalAudioMuted,
    isLocalVideoMuted,
    isScreenSharing,
    
    // Controles
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    
    // Conexões Peer
    connectToUser,
    disconnectFromUser,
    getRemoteStream,
    
    // Estado da conexão
    connectionStates,
    
    // Métodos utilitários
    getLocalVideoElement: () => localVideoRef.current,
    getAudioLevel,
  };
};

/* ============================================================
   EXPORTAÇÃO
   ============================================================ */

export default useWebRTC;