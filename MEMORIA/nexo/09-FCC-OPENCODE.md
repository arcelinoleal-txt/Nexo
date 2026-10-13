# 🤖 FCC (Free Claude Code) + OpenCode — como está configurado

> **Situação:** FCC v6.16.0 instalado, configurado e testado de ponta a ponta.
> O **OpenCode continua intacto** (v2.0.27, config original).

---

## O que é

O FCC é um app desktop que expõe um endpoint compatível com a API do
**Anthropic (`/v1/messages`)** e integra com o **OpenCode**.
Usa o provedor **NVIDIA NIM** com o modelo **Nemotron**.

---

## Instalação

| Item | Valor |
|------|-------|
| Versão | **6.16.0** |
| Binários | `C:\Users\Arcelino Leal\.local\bin\` |
| Executáveis | `fcc-server.exe`, `fcc-opencode.exe`, `fcc-doctor.exe`, `fcc-desktop.exe`, `fcc-update`, + wrappers (`fcc-claude`, `fcc-codex`, `fcc-pi`, `fcc-cline`, `fcc-hermes`, `fcc-dsh`, `fcc-grok`, `fcc-muse`, `fcc-aider`) |
| Admin UI | `http://127.0.0.1:8082/admin` |
| Chave | `C:\Users\Arcelino Leal\.fcc\.env` |
| Log | `C:\Users\Arcelino Leal\.fcc\logs\server.log` |

### Inicialização automática
Atalho criado em:
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Free Claude Code.lnk
  → fcc-desktop.exe
```

---

## Configuração do provedor (NVIDIA NIM)

| Item | Valor |
|------|-------|
| Provedor | NVIDIA NIM |
| Modelo | `nvidia_nim/nvidia/nemotron-3-super-120b-a12b` |

### Como configurar pela Admin API

```http
GET  /admin/api/config                                  → lê config + "revision"
POST /admin/api/config/apply
{
  "values": {
    "NVIDIA_NIM_API_KEY": {
      "revision": <da resposta>,
      "entries": [ { "value": "<chave>" } ]              ← ARRAY de OBJETOS
    }
  }
}
```

> ⚠️ **`entries` precisa ser array de objetos** (`[{value:...}]`), não string.
> ⚠️ `revision` é um hash de concorrência — sem ele o apply falha.

---

## ⚠️ O QUE VOCÊ PRECISA FAZER

1. **GIRAR a chave NVIDIA NIM** — ela foi colada aqui no chat.
   - Gere outra em `build.nvidia.com`.
   - Troque no Admin UI (`http://127.0.0.1:8082/admin`).
   - Troque em `C:\Users\Arcelino Leal\.fcc\.env`.
2. Railway token inválido / GitHub issue #1 → ver `10-PENDENCIAS.md`.

---

## Como o FCC fala com o OpenCode (segurança)

- A integração é um **overlay process-local**:
  - Gera um `opencode.json` **temporário**.
  - Seta `OPENCODE_CONFIG` / `OPENCODE_CONFIG_CONTENT` + `FCC_OPENCODE_API_KEY`
    **só no processo filho**.
  - Passa `--standalone` e **nega todos os outros provedores**.
- ✅ **O `opencode.jsonc` real do usuário NUNCA é alterado.**
  (confirmado: byte idêntico ao backup em
  `C:\Users\Arcelino Leal\Documents\backup\opencode-antes-fcc\`)
- ✅ MCP `rea` do OpenCode continua funcionando.
- ✅ OpenCode continua na **v2.0.27**.

---

## ⚠️ Armadilha do Nemotron (importante)

O `nvidia/nemotron-3-super-120b-a12b` é um modelo de **reasoning**.
Ele emite um bloco **`thinking`** que **consome `max_tokens`**.

→ Se o `max_tokens` for pequeno, o texto final (`text`) **nunca aparece**
(resposta vazia) e o processo retorna 0.

**Solução:** usar `max_tokens >= 512`. Já testado e funcionando.

---

## Verificação de saúde

- `fcc-doctor.exe` → checagem de instalação.
- `fcc-opencode run` → executou de ponta a ponta, retornou texto correto, **exit 0**.
- OpenCode: `opencode.jsonc` byte idêntico ao backup; MCP `rea` ok.

---

## Backup feito

```
C:\Users\Arcelino Leal\Documents\backup\opencode-antes-fcc\
  ├── opencode.jsonc        (cópia byte idêntica)
  ├── opencode.json         (overlay gerado, como evidência)
  ├── fcc-openai-keys.json  (formato OpenAI que o OpenCode espera)
  ├── testar-mimo.bat       (script de teste)
  └── LEIA-ANTES.md, backup-completo-YYYYMMDD-HHMMSS.txt
```

---

## Regras FCC (não violar)

1. **NÃO** desinstalar/migrar o OpenCode sem confirmação do usuário.
2. **NÃO** apagar memórias/agentes/plugins/arquivos do projeto.
3. **NÃO** declarar instalação concluída sem **testar de verdade**.
4. **NÃO** contornar limites de uso.
5. Se uma etapa exigir chave/API: **parar e guiar o usuário**.
6. Trabalhar **por etapas e reportar**.
