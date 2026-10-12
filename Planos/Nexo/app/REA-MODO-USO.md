# Modo de uso — REA + Discord → Nexo

## 1. REA analisou o Discord (v1.0.9261)

| Arquivo analisado | Resultado REA | Significado |
|---|---|---|
| `app.asar` (3.6MB) | 2 JS (splashScreenPreload, bundle) — bootstrap mínimo | Tela de splash, não o app real |
| `core.asar` (1.7MB) | **547 módulos** (`bundle.js` + `mainScreenPreload.js`) — processo principal | Onde fica o código real do Electron |
| `discord_modules.node` (518KB) | Módulo nativo (voz) — precisa Ghidra | Não necessário para UI/configurações |
| `modules/discord_desktop_core-1/` | 3 arquivos, `bundle.js` (webpack minificado) | Arquitetura Electron |

**Conclusão REA:** Discord = Electron (main process webpack minificado + renderer webbundle baixado do CDN). A tela de Configurações é uma UI React no renderer com abas estáticas. **Não copiamos código** — recriamos a mesma estrutura no Nexo.

## 2. Como foi implementado no Nexo (Planos/Nexo/app/)

- `index.html` — Modal `#modal-config` com 11 abas (mesmas do Discord: Conta, Dados, Notificações, Voz/Vídeo, Aparência, Acessibilidade, Sistema, Idioma, Jogos, Loja, Criador, Sair)
- `configuracoes.js` — Lógica das abas, busca, tema, perfil
- `profile.js` — Perfil integrado com botão para Configurações
- `renderer.js` — `abrirModal('#modal-config')` já conectado ao `#btn-config`
- `servidor/servidor.js` — API `/api/convite` retorna `NEXO_PUBLIC_URL` se configurado (funciona local e remoto)

## 3. Configuração de rede (funciona para você e seus primos)

- `.env` criado: `NEXO_PUBLIC_URL=https://nexo-production-0b47.up.railway.app`
- `railway.json` atualizado com `env`
- Quando você cria uma sala, o **convite** (`/api/convite`) retorna:
  - Se `NEXO_PUBLIC_URL` estiver configurado → `ip: nexo-production-0b47.up.railway.app`, `porta: 443`, `protocolo: wss`
  - Se não estiver → `ipLocal()` (192.168.x) para rede local

Isso significa: **seus primos podem entrar de qualquer lugar** (se o Railway estiver online) ou pela rede local (se você estiver no mesmo Wi-Fi).

## 4. Deploy

- Git commit: `aad8b1a`
- GitHub: repo `arcelinoleal-txt/Nexo`
- Railway: projeto `7b4d1d98-9ae8-41b1-abea-23c396f6f956`
- Deploy automático: `node servidor/servidor.js` com `.env` aplicado
- Endereço final: `https://nexo-production-0b47.up.railway.app`

## 5. Como funciona o modo de uso (para você e primos)

1. Abra `Planos/Nexo/app/index.html` (você ou qualquer primo pode abrir pelo navegador)
2. Digite o código da sala (ex: `AB34CD`)
3. Se for remoto: o convite usa `https://nexo-production-0b47.up.railway.app` automaticamente
4. Se for local: o convite usa seu IP local (`192.168.x`)
5. Configurações (⚙) funcionam igual — tema, microfone, câmera, volume — sem depender de rede
