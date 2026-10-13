# 📋 Pendências do Nexo — o que ainda falta

> Data: **12/10/2026** (sessão que publicou a **v1.12.0**).

---

## 🔴 Precisa de ATUAÇÃO do Arcelino (só você pode fazer)

### 1. Girar a chave da NVIDIA NIM ⚠️ SEGURANÇA
- A chave foi **colada no chat** (potencialmente exposta).
- **Faça:**
  1. Entre em `build.nvidia.com` e **gere uma nova chave**.
  2. Abra `http://127.0.0.1:8082/admin` → troque a chave.
  3. Edite `C:\Users\Arcelino Leal\.fcc\.env` → troque a chave.
  4. Reinicie o FCC.

### 2. Fechar a Issue #1 do GitHub
- Chave: `teste-permissao-1791824968256`
- Motivo: o **PAT atual só tem permissão de Contents**, então
  `PATCH /issues/1` retorna **403** — não dá pra fechar via API.
- **Faça:** fechar manualmente em
  https://github.com/arcelinoleal-txt/Nexo/issues/1
- (Alternativa: criar um PAT novo com permissão `issues`.)

### 3. Instalar o Nexo 1.12.0
- Installer: `Planos\Nexo\versoes\v1.12.0\Nexo-Setup-1.12.0.exe` (76.7 MB)
- Você disse que **prefere desinstalar o antigo primeiro** — fica à vontade.
- Depois é só instalar. O servidor já está no ar servindo a 1.12.0.

### 4. (Opcional) Novo token do Railway
- O `RAILWAY_TOKEN` em `nexo-secreto-backup.txt` está **inválido**.
- **Não afeta nada** no fluxo normal (deploy é automático no push).
- Só é necessário se você quiser usar o **CLI do Railway**.

---

## 🟡 Tarefas técnicas para a PRÓXIMA IA

### 1. Migrar healthcheck do Railway até **2026-12-01**
- `railway.json` usa healthcheck **`/health`** — o Railway **deprecou** isso.
- **Migração:** usar `.railway/railway.ts` (novo formato).
- ⏰ Prazo: 01/12/2026. Depois disso o deploy pode falhar.

### 2. Limpar `.exe` antigos do repositório
- Removidos do disco mas **não commitados** (de propósito):
  `versoes/v1.1.0` … `v1.8.0` (15 pastas).
- `versoes/v1.10.0/` está **untracked** — deixado de propósito também.
- O repo tem **~1.1 GB de histórico** de `.exe` (avisos `GH001` no push).
- **Se um dia precisar encolher o repo:** `git filter-repo` / LFS.
  (Atenção: isso **reescreve o histórico** — só com aprovação explícita.)

### 3. Quando for criar a próxima versão
- [ ] Subir `package.json` **E** `versao.json`
- [ ] Escrever `novidades` no `versao.json`
- [ ] Rodar as **4 suítes (188/188)**
- [ ] `C:\nvm4w\nodejs\npm.cmd run dist`
- [ ] Commit + `git -c credential.helper= push origin master:main`
- [ ] Conferir `GET /api/versao` e `GET /atualizacao/Nexo-Setup-<ver>.exe`

---

## 🟢 Itens já resolvidos (não mexer)

| Item | Estado |
|------|--------|
| Encoding dos acentos | ✅ Resolvido na 1.11.0 (ver `03`) |
| Crash em `/arquivos/` | ✅ Resolvido |
| 401 em `/api/` | ✅ Resolvido |
| 404 no `/atualizacao/` | ✅ Resolvido na 1.12.0 (seção 11 dos testes) |
| Avatar base64 branco | ✅ Trocado por `<img>` |
| Modal duplicado de amigos | ✅ Removido, virou painel lateral |
| FCC instalado | ✅ v6.16.0 OK |
| OpenCode intacto | ✅ v2.0.27, config byte idêntica |

---

## 💡 Ideias futuras (se o Arcelino pedir)

- Adicionar a pasta `nexo/` como referência em `melhorias.md`.
- Testar chamada de voz entre **2 máquinas reais** (só foi testado local).
- Tema claro (light mode) — hoje é só escuro + themes anime.
- Moderação em canais (ban/kick) — hoje não existe.
- Verificação de email/convite no cadastro.

---

## 📌 Regras de ouro (repetir aqui pra nunca esquecer)

1. **NUNCA** `Get-Content -Raw` + gravar UTF-8 (`03-GOTCHAS-ENCODING.md`).
2. **SEMPRE** testar as 4 suítes antes de publicar.
3. **SEMPRE** versionar `package.json` **E** `versao.json` juntos.
4. **REACT** do `servidor.js` exige **novo build** do instalador.
5. **REA só pra referência** — nunca copiar código do Discord.
6. Responder **sempre em português do Brasil**, tom simples e direto.
