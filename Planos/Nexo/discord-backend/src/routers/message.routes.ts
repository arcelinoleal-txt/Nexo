/* ================================================================
   Message Routes - Histórico e Mensagens em Tempo Real
   ================================================================ */

import { Request, Response, NextFunction } from 'express';
import prisma from '../db';

// GET /api/messages?channelId=X - Histórico de mensagens com paginação
export const getMessages = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.query;
    
    if (!channelId) {
      return res.status(400).json({ error: 'ID do canal é obrigatório' });
    }
    
    const messages = await prisma.message.findMany({
      where: { channelId: String(channelId) },
      include: { user: { select: { id: true, username: true, tag: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50, // Últimas 50 mensagens
    });
    
    // Invertemos para mostrar mais antiga primeiro (como o Discord faz)
    const reversed = messages.reverse();
    
    return res.json({ messages: reversed });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// POST /api/messages - Salvar mensagem (será chamado via Socket também)
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { channelId, content } = req.body;
    const userId = (req as any).user?.userId;
    
    if (!channelId || !content || !userId) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    const message = await prisma.message.create({
      data: {
        content,
        userId,
        channelId,
      },
      include: { user: { select: { id: true, username: true, tag: true, avatarUrl: true } } }
    });
    
    return res.json({
      message: 'Mensagem enviada!',
      message
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};