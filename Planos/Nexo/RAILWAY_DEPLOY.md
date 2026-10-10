# 🚀 Deploy do Nexo no Railway

Guia passo a passo para hospedar o servidor Nexo no Railway.app

---

## 📋 Pré-requisitos

- Conta no [Railway](https://railway.app)
- Projeto clonado localmente
- Git configurado

---

## 🔧 1. Preparar o Repositório

```bash
# No diretório do projeto Nexo
cd planos/Nexo

# Verificar se os arquivos de configuração existem
ls -la railway.json nixpacks.toml .env.example
```

> **Arquivos já criados:**
> - `railway.json` - Configuração de deploy
> - `nixpacks.toml` - Build configuration
> - `.env.example` - Template de variáveis de ambiente
> - `package.json` - Script `start` atualizado para `node servidor/servidor.js`
> - Health check endpoint `/health` adicionado ao servidor

---

## 🗄️ 2. Criar Volume Persistente (IMPORTANTE)

O Nexo armazena:
- **Contas de usuários** (`dados-contas.json`)
- **Arquivos enviados no chat** (`arquivos/`)

No Railway, o sistema de arquivos é **efêmero** (apaga a cada deploy). Você **PRECISA** de um Volume:

1. No painel do Railway, vá no seu projeto
2. Clique em **New** → **Volume**
3. Nome: `nexo-data`
4. Mount Path: `/data`
5. Tamanho: 1GB (ou conforme necessidade)

---

## ⚙️ 3. Configurar Variáveis de Ambiente

No painel do Railway, aba **Variables**, adicione:

| Variável | Valor | Obrigatório? |
|----------|-------|--------------|
| `NEXO_DIR_DADOS` | `/data` | ✅ Sim |
| `NEXO_SEGREDO_TOKEN` | `gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | ✅ Sim |
| `NEXO_PUBLIC_URL` | `https://SEU-PROJETO.up.railway.app` | ✅ Sim |
| `NEXO_SMTP_HOST` | `smtp.seuprovedor.com` | ❌ Opcional |
| `NEXO_SMTP_PORT` | `587` | ❌ Opcional |
| `NEXO_SMTP_USER` | `seu@email.com` | ❌ Opcional |
| `NEXO_SMTP_PASS` | `sua_senha_app` | ❌ Opcional |
| `NEXO_EMAIL_DE` | `Nexo <noreply@seudominio.com>` | ❌ Opcional |

> **⚠️ IMPORTANTE:** Gere o `NEXO_SEGREDO_TOKEN` **uma vez** e use o mesmo valor sempre. Se mudar, todos os usuários serão deslogados.

```bash
# Comando para gerar o token seguro:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🌐 4. Configurar Domínio Público

1. No Railway, vá em **Settings** → **Domains**
2. Clique em **Generate Domain** (gratuito: `seu-projeto.up.railway.app`)
3. Copie a URL completa (ex: `https://nexo-abc123.up.railway.app`)
4. Cole no `NEXO_PUBLIC_URL` nas Variables

---

## 🚀 5. Deploy

### Opção A: Via GitHub (Recomendado)
1. Push seu código para GitHub
2. No Railway: **New Project** → **Deploy from GitHub repo**
3. Selecione o repositório
4. Railway detecta automaticamente o `railway.json` e `nixpacks.toml`
5. Configure as Variables (passo 3)
6. Deploy automático!

### Opção B: Via CLI
```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Inicializar projeto (na pasta planos/Nexo)
railway init

# Deploy
railway up
```

---

## ✅ 6. Verificar se Funcionou

Após o deploy, verifique:

1. **Health Check:** `https://SEU-DOMINIO.up.railway.app/health`
   ```json
   {
     "status": "ok",
     "timestamp": 1234567890,
     "uptime": 45.2,
     "salas": 0,
     "conexoes": 0
   }
   ```

2. **Interface Web:** `https://SEU-DOMINIO.up.railway.app/`
   - Deve carregar a tela de entrada do Nexo

3. **WebSocket:** `wss://SEU-DOMINIO.up.railway.app`
   - O app desktop conecta aqui

4. **Convite API:** `https://SEU-DOMINIO.up.railway.app/api/convite`
   ```json
   {
     "ip": "nexo-abc123.up.railway.app",
     "porta": 443,
     "protocolo": "wss"
   }
   ```

---

## 🔗 7. Conectar o App Desktop

No app Nexo (versão Electron):
1. Abra o app
2. No campo **Servidor**, cole: `wss://SEU-DOMINIO.up.railway.app`
3. Clique em **Criar sala** ou **Entrar**
4. Compartilhe o código gerado (formato: `ABCDEF@nexo-abc123.up.railway.app:443`)

---

## 🐛 Troubleshooting

### "Health check failed" / Deploy falha
- Verifique logs no Railway (aba **Deployments** → **View Logs**)
- Confirme se `NEXO_DIR_DADOS=/data` está configurado
- Confirme se o Volume foi criado e montado em `/data`

### WebSocket não conecta
- Verifique se `NEXO_PUBLIC_URL` está correto (com `https://`)
- O Railway faz proxy TLS automático - use `wss://` no cliente
- Confira se a porta no convite é `443` (HTTPS/WSS)

### Sessões caem a cada deploy
- `NEXO_SEGREDO_TOKEN` deve ser **fixo** (não gere a cada deploy)
- Verifique se a variável está definida no Railway (não no .env local)

### Upload de arquivos falha
- Volume deve estar montado em `/data`
- `NEXO_DIR_DADOS=/data` cria a pasta `arquivos` automaticamente
- Limite padrão: 25MB (configure `NEXO_MAX_ARQUIVO` se precisar mais)

### E-mail de recuperação não envia
- Configure variáveis SMTP (opcional)
- Sem SMTP: códigos aparecem nos logs do Railway (aba **Logs**)

---

## 📁 Estrutura de Arquivos para Deploy

```
planos/Nexo/
├── railway.json          # Config Railway
├── nixpacks.toml         # Build config
├── .env.example          # Template variáveis
├── package.json          # Script "start": "node servidor/servidor.js"
├── servidor/
│   ├── servidor.js       # Servidor principal (escuta 0.0.0.0:PORT)
│   └── contas.js         # Usa NEXO_SEGREDO_TOKEN e NEXO_DADOS_CONTAS
└── app/                  # Interface web (servida estaticamente)
    ├── index.html
    ├── renderer.js
    ├── estilo.css
    └── ...
```

---

## 🔄 Atualizações Futuras

```bash
# Faça suas alterações
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# Railway faz deploy automático se conectado ao GitHub
# Ou manual: railway up
```

---

## 📞 Suporte

- Logs: Railway Dashboard → **Deployments** → **View Logs**
- Métricas: Railway Dashboard → **Metrics**
- Variáveis: Railway Dashboard → **Variables**

---

**Pronto!** Seu servidor Nexo estará rodando 24/7 no Railway com WebSocket seguro (WSS), armazenamento persistente e domínio público gratuito. 🎉