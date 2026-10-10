# 📦 Histórico de Versões do Nexo

| Versão | Data | Status | O que mudou |
|--------|------|--------|-------------|
| **1.0.0** | 10/10/2026 00:17 | Original — pasta `instalador original/` | App completo: salas, voz em malha, chat, transmissão de tela, 10 temas, servidor embutido |
| 1.1.0 | — | Próxima | Correções pós-teste do 1.0 (ver abaixo) |

---

## 🔧 Correções aplicadas no código (serão a versão 1.1.0)

Estas correções JÁ estão no instalador que foi para `instalador original/`
(build de 10/10/2026 19:22) e no servidor Railway:

1. **Vídeo da transmissão corrompido** (preto + artefatos verdes)
   - Causa: `transform: scaleX(-1)` (espelhar) aplicado na tela compartilhada
     bugava o compositor do Chromium
   - Fix: espelhar só a câmera; tela usa `object-fit: contain` (tela inteira)

2. **Toast "Transmissão iniciada" cobrindo os controles do vídeo**
   - Fix: `.aviso` com `position: relative; z-index: 2` (fica abaixo dos botões)

3. **Contador de participantes dessincronizado** (1 na lateral, 0 na sala)
   - Fix: chamar `atualizarTiles()` no evento `presenca` do servidor

4. **Deploy no Railway**
   - `railway.json`, health check `/health`, volume `/data`, variáveis de ambiente
   - Servidor online: `https://nexo-production-0b47.up.railway.app`

---

## 🔄 Fluxo de versionação (combinado)

Sempre que você pedir uma alteração:

1. Eu altero o código em `planos/Nexo/`
2. Subo a versão no `package.json` (1.1.0 → 1.2.0 → 1.3.0 ...)
   - e no `versao.json` (que alimenta o aviso de atualização no sininho)
3. Rebuildo com `npm run dist`
4. Coloco o novo instalador em `versoes/vX.Y.Z/`
5. Atualizo esta tabela
6. Commit + push pro GitHub (o Railway atualiza sozinho)

**Regra:** a pasta `instalador original/` fica intacta com o 1.0 —
é a base. Cada versão nova mora em `versoes/`.
