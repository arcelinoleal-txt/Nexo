/* ================================================================
   Channel Routes - Criação e Gestão de Canais
   ================================================================ */

import { Request, Response, NextFunction } from 'express';
import prisma from '../db';
import jwt from 'jsonwebtoken';

// Middleware: verificar se usuário pode gerenciar canal neste servidor
const verifyChannelAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const userId = (req as any).user?.userId;
    
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });
    
    const membership = await prisma.serverMember.findFirst({
      where: { userId, serverId },
    });
    
    if (!membership || membership.role === 'GUEST') {
      return res.status(403).json({ error: 'Sem permissão para gerenciar canais' });
    }
    
    req.body.membership = membership;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar acesso' });
  }
};

export const createChannel = async (req: Request, res: Response) => {
  try {
    const { name, type } = req.body;
    const { serverId } = req.params;
    const userId = (req as any).user?.userId;
    
    if (!name || !type || !userId) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    const channel = await prisma.channel.create({
      data: {
        name,
        type,
        serverId,
        // Position auto-incremental poderia ser adicionado aqui
      },
      include: { server: true }
    });
    
    // Notificar via WebSocket sobre novo canal
    io.emit('channel_created', { channel: channel, serverId });
    
    return res.json({
      message: 'Canal criado com sucesso!',
      channel
    });
  } catch (error) {
    console.error('Erro ao criar canal:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const getChannels = async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    
    const channels = await prisma.channel.findMany({
      where: { serverId },
      orderBy: { position: 'asc' }
    });
    
    return res.json({ channels });
  } catch (error) {
    console.error('Erro ao listar canais:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};