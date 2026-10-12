# Nexo

Aplicativo estilo Discord para **transmitir tela em tempo real** com **chat de texto**.

Quem transmite compartilha a tela (ou uma janela) e todo mundo que entra na sala com o
código vê a imagem ao vivo, com chat e lista de participantes.

```
┌──────────────────────────────────────────────────────────────┐
│  Nexo │ Sala ABC123 ● conectado                      ─ □ ✕ │
├────────────┬───────────────────────────────┬─────────────────┤
│ CONTROLES  │                               │  CHAT DA SALA   │
│            │                               │                 │
│ [Comparti- │      tela transmitida         │  Ana   14:02    │
│  lhar tela]│        ao vivo                │  ola!           │
│            │                               │                 │
│ Particip.  │                               │  Bruno 14:03    │
│ ● Ana  (T) │                               │  consigo ver    │
│ ● Bruno    │   1920x1080 · 30 fps          │                 │
│ ● Carla    │                               │ [enviar msgs]   │
└────────────┴───────────────────────────────┴─────────────────┘
```

---

## Como rodar

### 1. Instalar

```bash
npm install
```

### 2. Subir o servidor (sempre primeiro)

```bash
npm run servidor
```

Sai no terminal:

```
Nexo servidor online
Interface : http://localhost:3000
WebSocket : ws://localhost:3000
```

### 3. Abrir o app desktop

```bash
npm start
```

Na tela de entrada:

| Campo     | O que colocar                                        |
|-----------|------------------------------------------------------|
| Nome      | como os outros vão te chamar                         |
| Servidor  | `ws://localhost:3000` (na sua máquina)               |

Depois clique em **Criar sala e transmitir**. Vai aparecer um código de 6 letras no topo —
**mande esse código** para quem quiser assistir.

### 4. Quem vai assistir

Duas opções:

- **App**: instala o Nexo, preenche o mesmo servidor e o código da sala.
- **Navegador** (sem instalar nada): abre `http://SEU-SERVIDOR` no navegador, coloca o
  nome e o código. Só funciona para **assistir** — para **transmitir** é preciso o app.

---

## Publicando o servidor online

Você precisa de um servidor Node acessível pela internet. Qualquer um serve:

### Opção A — Render (grátis para começar)

1. Suba o projeto para um repositório no GitHub.
2. Em [render.com](https://render.com) → **New → Web Service** → aponte o repositório.
3. Configurações:
   - **Build command**: `npm install`
   - **Start command**: `npm run servidor`
   - **Instance type**: Free (dorme após inatividade)
4. Ao final você ganha algo como `https://nexo.onrender.com`.
5. No app, coloque **`wss://nexo.onrender.com`**.

> Plano grátis cai/hiberna quando ninguém usa. Para uso sério, um plano pago
> (Render Starter ~US$ 7, Railway, Fly.io) ou um VPS resolve.

### Opção B — VPS próprio (DigitalOcean, Hetzner, Contabo...)

```bash
# no servidor
git clone <seu-repositorio> nexo && cd nexo
npm install
npm install -g pm2
pm2 start servidor/servidor.js --name nexo
pm2 save && pm2 startup
```

Depois abra a porta **3000** no firewall e aponte um domínio com **HTTPS** (obrigatório
para `wss://`). Um `nginx` inverso com **certbot** resolve:

```nginx
server {
    listen 443 ssl;
    server_name nexo.seudominio.com;
    ssl_certificate     /etc/letsencrypt/live/nexo.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nexo.seudominio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;     # essencial pro WebSocket
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

---

## Gerar o instalador do Windows

```bash
npm run dist
```

O instalador fica em **`dist/Nexo-Setup-1.0.0.exe`**.

Para colocar ícone próprio, crie `assets/logo.ico` e adicione ao `package.json`:

```json
"win": { "icon": "assets/logo.ico" }
```

---

## Como funciona por dentro

```
 app Electron (quem transmite)          servidor (Node)              app / navegador (quem assiste)
 ─────────────────────────────          ───────────────              ───────────────────────────────
 getDisplayMedia()  ─── captura a tela
        │
        ├── WebRTC (video) ─────────────────────────────────────►  <video> ao vivo
        │                                                          │
        └── WebSocket (sinalização + chat) ──────────────────────► relé p/ todos
```

- **WebRTC** transporta o vídeo de ponta a ponta (P2P) — o servidor não passa imagem,
  só coordena. Por isso a latência é baixa.
- **WebSocket** (`servidor/servidor.js`) faz a sinalização (oferta/resposta/ICE),
  o chat, a lista de participantes e serve a interface.
- O servidor usa **STUN público do Google** para descobrir o endereço dos computadores.

### Limites do desenho atual

| Situação                        | Comportamento                                             |
|---------------------------------|-----------------------------------------------------------|
| Até ~8 espectadores             | fluidez ótima                                             |
| Mais de 10 espectadores         | aparece um aviso no painel — vale migrar para SFU         |
| Rede corporativa / NAT agressivo| pode falhar — precisa de servidor **TURN** (ver abaixo)   |
| Audio do sistema                | funciona no **Windows** (checkbox "Compartilhar audio")   |

### Adicionando um servidor TURN (rede restritiva)

Se algum usuário estiver atrás de firewall/VPN e a tela ficar travada, cadastre um TURN
grátis (ex.: [Metered](https://www.metered.ca/), ou um `coturb` seu) e cole em
`app/renderer.js`:

```js
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:SEU-TURN.com:3478', username: 'user', credential: 'senha' }
  ]
};
```

---

## Comandos

| Comando                    | O que faz                                                    |
|----------------------------|--------------------------------------------------------------|
| `npm install`              | instala tudo                                                 |
| `npm run servidor`         | sobe o servidor em `localhost:3000`                          |
| `npm start`                | abre o app desktop                                           |
| `npm run dist`             | gera o instalador `.exe` do Windows                          |
| `npm run teste`            | 21 testes do servidor (salas, chat, sinalização)             |
| `npm run teste-app`        | 25 testes da interface (requer `npm start` + depuração)       |
| `npm run teste-video`      | 25 testes do vídeo: captura + WebRTC de ponta a ponta        |

### Teste de ponta a ponta (o mais completo)

Ele abre o Electron como **transmissor** e um Chrome headless como **espectador**,
captura a tela de verdade e confere se o vídeo chega no outro lado:

```bash
# terminal 1
npm run servidor

# terminal 2
npx electron . --remote-debugging-port=9222

# terminal 3  (Windows)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
    --headless=new --remote-debugging-port=9333 `
    --user-data-dir="$env:TEMP\nexo-perfil-teste" `
    --autoplay-policy=no-user-gesture-required http://localhost:3000

# terminal 4
npm run teste-video
```

Resultado esperado: `VIDEO FLUINDO no espectador: 1280x882`.

---

## Estrutura

```
Nexo/
├── package.json          dependências + build do instalador
├── _e2e.js               teste da interface (CDP)
├── _e2e-video.js         teste de vídeo ponta a ponta (CDP + Chrome headless)
├── servidor/
│   ├── servidor.js       HTTP + WebSocket: salas, chat, sinalização
│   └── _teste.js         teste automatizado do servidor
└── app/
    ├── main.js           processo do Electron (janela + captura de tela)
    ├── preload.js        ponte segura entre a janela e o Electron
    ├── index.html        interface
    ├── estilo.css        tema escuro estilo Discord
    ├── renderer.js       WebRTC, chat e toda a lógica da sala
    └── favicon.svg       ícone
```

---

## Permissões do Windows

Na primeira vez que clicar em **Compartilhar tela**, o Windows/Chrome pode pedir
permissão. Se a captura falhar:

1. Confira se o app não está bloqueado pelo antivírus.
2. Em **Configurações → Privacidade → Captura de tela** do Windows, libere os apps.
3. Rode `npm start` pelo terminal e veja se aparece erro no console.
