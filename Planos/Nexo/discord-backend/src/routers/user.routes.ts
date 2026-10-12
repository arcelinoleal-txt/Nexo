/* ================================================================
   Auth Routes - Registro, Login e Perfil
   ================================================================ */

import { Request, Response, NextFunction } from 'express';
import prisma from '../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// ============================================================
// Middleware de Autenticação JWT
// ============================================================
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'discord_clone_secret_key', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
    req.user = user;
    next();
  });
};

// ============================================================
// ROUTE: POST /api/auth/register
// ============================================================
export const register = async (req: Request, res: Response) => {
  try {
    const { username, tag, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Usuário ou e-mail já cadastrado' });
    }

    // Hash da senha
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        username,
        tag: tag || '#0001',
        email,
        passwordHash,
        avatarUrl: `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`,
        status: 'offline',
      },
    });

    // Gerar token JWT
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET || 'discord_clone_secret_key', { expiresIn: '7d' });

    return res.status(201).json({
      message: 'Usuário criado com sucesso!',
      user: { id: user.id, username: user.username, tag: user.tag, avatar: user.avatarUrl },
      token,
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ============================================================
// ROUTE: POST /api/auth/login
// ============================================================
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    // Buscar usuário
    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Gerar token
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET || 'discord_clone_secret_key', { expiresIn: '7d' });

    return res.json({
      message: 'Login successful!',
      user: { id: user.id, username: user.username, tag: user.tag, avatar: user.avatarUrl },
      status: user.status,
      token,
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ============================================================
// ROUTE: GET /api/auth/me
// ============================================================
export const getCurrentUser = (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }
  return res.json({
    id: req.user.userId,
    username: req.user.username,
    tag: req.user.tag,
    avatar: req.user.avatar,
    status: req.user.status,
  });
};

// Exporta todas as funções
export const authControllers = { register, login, getCurrentUser };