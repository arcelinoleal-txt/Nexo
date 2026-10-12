/* ================================================================
   Server Routes - Criação e Gestão de Servidores
   ================================================================ */

import { Request, Response, NextFunction } from 'express';
import prisma from '../db';
import jwt from 'jsonwebtoken';

// Middleware para verificar se usuário é membro/owner do servidor
const verifyServerMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId } = req.params;
    const userId = (req as any).user?.userId;
    
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });
    
    const membership = await prisma.serverMember.findFirst({
      where: { userId, serverId },
    });
    
    if (!membership) {
      return res.status(403).json({ error: 'Você não é membro deste servidor' });
    }
    
    req.body.membership = membership;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar membresia' });
  }
};

export const createServer = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { name } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Gerar código de convite único
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    
    const server = await prisma.server.create({
      data: {
        name,
        ownerId: userId,
        inviteCode,
        inviteExpires,
        channels: {
          create: [
            { name: 'geral', type: 'TEXT' } // Canal padrão
          ]
        },
        members: {
          create: [
            { userId, role: 'ADMIN' }
          ]
        }
      },
      include: {
        members: true,
        channels: true
      }
    });
    
    return res.json({
      message: 'Servidor criado com sucesso!',
      server: {
        id: server.id,
        name: server.name,
        inviteCode: server.inviteCode,
        channels: server.channels
      }
    });
  } catch (error) {
    console.error('Erro ao criar servidor:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const joinServerByCode = async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body;
    const userId = (req as any).user?.userId;
    
    if (!inviteCode || !userId) {
      return res.status(400).json({ error: 'Código e usuário são obrigatórios' });
    }
    
    // Buscar servidor pelo código
    const server = await prisma.server.findFirst({
      where: { inviteCode },
      include: { members: true }
    });
    
    if (!server) {
      return res.status(404).json({ error: 'Código de convite inválido ou expirado' });
    }
    
    if (server.inviteExpires && new Date() > server.inviteExpires) {
      return res.status(410).json({ error: 'Código de convite expirado' });
    }
    
    // Verificar se usuário já é membro
    const alreadyMember = server.members.some(m => m.userId === userId);
    
    if (alreadyMember) {
      return res.status(400).json({ error: 'Você já é membro deste servidor' });
    }
    
    // Adicionar usuário como member com role MEMBER
    await prisma.serverMember.create({
      data: {
        userId,
        serverId: server.id,
        role: 'MEMBER'
      }
    });
    
    return res.json({
      message: 'Entrada no servidor bem-sucedida!',
      server: { id: server.id, name: server.name }
    });
  } catch (error) {
    console.error('Erro ao entrar no servidor:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const getServers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    const memberships = await prisma.serverMember.findMany({
      where: { userId },
      include: { server: true }
    });
    
    const servers = memberships.map(m => m.server);
    
    return res.json({ servers });
  } catch (error) {
    console.error('Erro ao listar servidores:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};