# 💥 Armadilhas do PowerShell neste projeto

> **LEIA ISSO ANTES de rodar QUALQUER comando.**
> Praticamente tudo abaixo foi erro real que quebrou o trabalho ou o app.
> O ambiente é **Windows PowerShell 5.1**, não PowerShell 7.

---

## 1. Encoding — o erro mais grave

**NUNCA faça isto para ler/escrever um arquivo de código:**

```powershell
# ❌ ERRADO — corrompe acentos!
$t = [IO.File]::ReadAllText($path)        # lê como ANSI
$t = $t.Replace("x","y")
[IO.File]::WriteAllText($path, $t, [Text.UTF8Encoding]::new($false))  # grava UTF-8
```

Os arquivos do Nexo são **UTF-8 com BOM**. Lê-los como ANSI faz `ç` virar
`Ã§`, e gravar em UTF-8 "conserta" a string já errada → o app inteiro mostra
`Ã§Ã£` na interface.

**✅ O que usar (nesta ordem de preferência):**
1. Ferramentas de edição nativas (`edit` / `write`).
2. Node.js para qualquer manipulação programática.

Veja `03-GOTCHAS-ENCODING.md` para o método de verificação.

---

## 2. `npm` e `railway` são `.ps1` — `Start-Process` falha

No PATH, `npm` resolve para `C:\nvm4w\nodejs\npm.ps1`. Se você fizer
`Start-Process -FilePath "npm"` → **"%1 não é um aplicativo Win32 válido"**.

**✅ Correto:**
```powershell
C:\nvm4w\nodejs\npm.cmd run dist
node C:\nvm4w\nodejs\node_modules\@railway\cli\bin\railway.js ...
```

---

## 3. `PSNativeCommandUseErrorActionPreference` (falso abort)

```powershell
$ErrorActionPreference = "Stop"
npm install 2>&1 | ForEach-Object { ... }   # ❌ aborta no PRIMEIRO "npm warn"
```

No PS 5.1, `2>&1`/`*>&1` converte o stderr nativo (que é só aviso) em
`NativeCommandError` terminante. Parece que o install falhou — não falhou.

**✅ Correto:** usar `Start-Process` com `-RedirectStandardOutput` /
`-RedirectStandardError` e ler os arquivos depois, **ou** não usar
`$ErrorActionPreference = "Stop"` junto com captura de stderr nativo.

---

## 4. Sem heredoc

O PowerShell 5.1 **não tem `<<'EOF'`**. Escrever um bloco grande assim
quebra a linha seguinte.

**✅ Correto:**
- Gravar o arquivo com a ferramenta `write`, **ou**
- `git commit -F caminho/arquivo-de-msg.txt`

---

## 5. `Select-Object -First N` mata o pipeline que produz

```powershell
... | Select-Object -First 5    # encerra o processo que gera a saída
```
Útil às vezes, mas causa "terminou sem fazer nada" inesperado.

---

## 6. `Set-Location` NÃO afeta métodos .NET

```powershell
Set-Location C:\algo
[IO.File]::ReadAllText("arquivo.txt")   # ❌ lê da RAIZ, não de C:\algo
```
**✅ Use caminhos absolutos sempre.**

---

## 7. Operadores que NÃO EXISTEM no PS 5.1

| ❌ Errado | ✅ Correto |
|-----------|-----------|
| `$a ?? $b` | `if ($null -ne $a) { $a } else { $b }` |
| `$(if (...) {..} else {..})` | calcular fora da string |
| `-ArgumentList ""` | omitir o parâmetro |
| `"texto $linha final"` (linha malformada) | `${linha}` ou concatenação |

**Obs.:** a tentativa de fazer um "heredoc" anônimo com `$s=@'...'@` também
falha quando o PS decide que a linha seguinte (`git status --porcelain`) não
é um terminator válido — use ferramenta `write`.

---

## 8. `node -e` inline quebra o parser do PowerShell

```powershell
node -e "const a=require('fs');..."   # ❌ aspas escapadas quebram o parser
```
**✅ Sempre grave o script em `arquivo.js` e rode `node arquivo.js`.**

---

## 9. `node --check` em CSS/HTML retorna exit 1

Não é erro de verdade — `node --check` só serve pra JS.
**✅ Valide CSS por balanceamento de chaves `{ }`.**

---

## 10. Git push

O Windows Credential Manager precisa estar atualizado. `GIT_ASKPASS` sozinho
não resolve.

**✅ Funciona:**
```powershell
git -c credential.helper= push origin master:main
```
- Askpass (`.cmd`) é chamado **2×**: primeiro usuário, depois senha.
- `Set-Location` + `git -C` — prefira `-C` com caminho absoluto.

---

## 11. Ambiente do PowerShell

- Caminho `$env:TEMP` às vezes resolve pro atalho 8.3 `C:\Users\ARCALIN~1\...`.
- **NÃO recurse** `C:\Users\Arcelino Leal\.config\opencode` — tem `node_modules`
  enorme e o output estoura.
- Falha "cosmética": `Get-NetFirewallPortFilter` piped de
  `Get-NetFirewallApplicationFilter` → `AmbiguousParameterSet`.

---

## 12. Depois de editar — avisar o usuário

Sempre lembrar: **"Aperte F5 e confirme que o arquivo aberto é
`Planos/Nexo/app/index.html`."**

---

## ✅ Lista de verificação antes de rodar um comando

- [ ] Estou usando ferramenta `write`/`edit` ou Node, não `ReadAllText`?
- [ ] O executável é `.cmd`/`node`, não o `.ps1`?
- [ ] Tem `$ErrorActionPreference="Stop"` + `2>&1` junto? (tira um)
- [ ] Preciso de heredoc? (usa ferramenta `write` ou `-F arquivo`)
- [ ] Usei `node -e`? (grava em arquivo primeiro)
- [ ] Caminhos são absolutos?
