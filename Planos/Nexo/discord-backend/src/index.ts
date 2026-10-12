/* ================================================================
   Discord Clone - Servidor Backend com WebRTC Signaling
   ================================================================ */

import express from 'express';
import http from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import dotenv from 'dotenv';
import './db';

import UserRouter from './routers/user.routes';
import ServerRouter from './routers/server.routes';
import ChannelRouter from './routers/channel.routes';
import MessageRouter from './routers/message.routes';

dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

// Configuração do CORS - aceita origem do frontend ou localhost para desenvolvimento
// Em produção (Railway/Render), a origem virá do process.env.CLIENT_URL
const allowedOrigins = process.env.CLIENT_URL 
  ? [process.env.CLIENT_URL, 'https://*.railway.app', 'https://*.render.com']
  : ['http://localhost:3000', 'http://localhost:3001'];

const io = new SocketServer(server, {
  cors: { 
    origin: function(origin, callback) {
      // Permite requisições sem origem (como extensões de navegador ou testes)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Em desenvolvimento, permite todas; em produção, restringe
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(null, false);
        }
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middlewares
app.use(express.json({ limit: '10kb' }));

// Rotas API
app.use('/api/auth', UserRouter);
app.use('/api/servers', ServerRouter);
app.use('/api/channels', ChannelRouter);
app.use('/api/messages', MessageRouter);

// Health check
app.get('/', (req, res) => res.json({ status: 'Discord Clone API Online' }));

// ============================================================
// GESTÃO DE PEERS WEBRTC - SINALIZAÇÃO
// ============================================================

// Mapas para rastreamento de conexões
const peerConnections: Map<string, RTCPeerConnection> = new Map(); // peerId -> RTCPeerConnection
const userSocketMap: Map<string, string> = new Map(); // userId -> socketId

// Configuração RTC (STUN servers)
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Evento de conexão Socket.io
io.on('connection', (socket: Socket) => {
  console.log(`🔌 Usuário conectado: ${socket.id}`);

  // Autenticação via token no handshake
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'discord_clone_dev_secret_key';
      const decoded: any = jwt.verify(token, jwtSecret);
      
      userSocketMap.set(decoded.userId, socket.id);
      socket.userId = decoded.userId;
      socket.join(`user_${decoded.userId}`);
      console.log(`✅ Usuário ${decoded.userId} autenticado`);
    } catch (error) {
      console.error('❌ Erro ao autenticar socket:', error);
      socket.disconnect();
    }
  } else {
    console.warn('⚠️ Socket sem autenticação');
  }

  // ==========================================================
  // EVENTO: join-voice-channel - Entrar em canal de voz
  // ============================================================
  socket.on('join-voice-channel', (data: { channelId: string; userId: string; peerId: string }) => {
    const { channelId, userId, peerId } = data;
    
    socket.join(`voice_${channelId}`);
    
    // Notificar outros participantes que este usuário entrou
    socket.to(`voice_${channelId}`).emit('participant-joined', {
      userId,
      peerId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`🎤 Usuário ${userId} entrou no canal de voz ${channelId}`);
  });

  // ==========================================================
  // EVENTO: offer - Criar oferta SDP
  // ============================================================
  socket.on('offer', (data: { sdp: string; from: string; to: string }) => {
    const { sdp, from, to } = data;
    
    // Criar conexão peer se não existir
    if (!peerConnections.has(from)) {
      peerConnections.set(from, new RTCPeerConnection(RTC_CONFIG));
    }
    
    const pc = peerConnections.get(from)!;
    
    // Adicionar ICE candidate listener
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.to(`user_${to}`).emit('ice-candidate', {
          candidate: event.candidate,
          from,
          to
        });
      }
    };
    
    // Adicionar trilha de mídia local (será feita no frontend)
    // Aqui apenas configuramos o manipulador de candidate
    
    // Criar oferta
    pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
      .then(offer => {
        return pc.setLocalDescription(offer);
      })
      .then(() => {
        // Enviar oferta para o destinatário
        socket.to(`user_${to}`).emit('offer', {
          sdp: pc.localDescription.sdp,
          from,
          to
        });
      })
      .catch(err => {
        console.error('❌ Erro ao criar oferta:', err);
      });
  });

  // ==========================================================
  // EVENTO: answer - Criar resposta SDP
  // ============================================================
  socket.on('answer', (data: { sdp: string; from: string; to: string }) => {
    const { sdp, from, to } = data;
    
    if (!peerConnections.has(from)) {
      peerConnections.set(from, new RTCPeerConnection(RTC_CONFIG));
    }
    
    const pc = peerConnections.get(from)!;
    
    pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
      .then(() => {
        console.log(`✅ Conexão estabelecida entre ${from} e ${to}`);
      })
      .catch(err => {
        console.error('❌ Erro ao definir resposta:', err);
      });
  });

  // ==========================================================
  // EVENTO: ice-candidate - Candidato ICE
  // ============================================================
  socket.on('ice-candidate', (data: { candidate: any; from: string; to: string }) => {
    const { candidate, from, to } = data;
    
    if (!peerConnections.has(from)) {
      peerConnections.set(from, new RTCPeerConnection(RTC_CONFIG));
    }
    
    const pc = peerConnections.get(from)!;
    
    pc.addIceCandidate(new RTCIceCandidate(candidate))
      .then(() => {
        console.log(`✅ ICE candidate adicionado para ${from} -> ${to}`);
      })
      .catch(err => {
        console.error('❌ Erro ao adicionar ICE candidate:', err);
      });
  });

  // ==========================================================
  // EVENTO: leave-voice-channel - Sair do canal
  // ============================================================
  socket.on('leave-voice-channel', (data: { channelId: string; userId: string }) => {
    socket.leave(`voice_${data.channelId}`);
    
    socket.to(`voice_${data.channelId}`).emit('participant-left', {
      userId: data.userId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`🎤 Usuário ${data.userId} saiu do canal ${data.channelId}`);
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log(`❌ Usuário desconectado: ${socket.id}`);
    // Limpeza de conexões peer
    for (const [peerId, pc] of peerConnections) {
      if (pc) pc.close();
    }
    peerConnections.clear();
    userSocketMap.clear();
  });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================

server.listen(PORT, () => {
  console.log(`🚀 Servidor Discord Clone rodando em http://localhost:${PORT}`);
});

export { io, server, peerConnections, userSocketMap };