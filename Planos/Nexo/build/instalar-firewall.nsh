; =========================================================================
;  Nexo - passos extras do instalador
;  -----------------------------------------------------------------------
;  O Nexo precisa QUE OUTRAS PESSOAS ALCANCEM esta máquina para entrar na
;  sala (a voz, a tela e o chat passam pelo servidor local). Sem a regra do
;  Firewall, o Windows bloqueia a conexão e a outra pessoa não entra.
;
;  O instalador roda com privilégio de administrador (perMachine), então
;  consegue gravar essa regra sem precisar que ninguém abra prompt nenhum
;  depois. A regra fica limitada ao Nexo.exe e à porta 3000 — não abre o
;  computador para o resto.
;
;  Regra espelhada na desinstalação, para não deixar lixo para trás.
; =========================================================================

!macro customInstall
  DetailPrint "Liberando o Nexo no Firewall do Windows (para outras pessoas entrarem na sua sala)..."
  ; Só o Nexo.exe, só TCP, só a porta 3000.
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Nexo - salas de voz e tela" dir=in action=allow protocol=TCP localport=3000 program="$INSTDIR\Nexo.exe"'
  Pop $0
  DetailPrint "  regra do firewall: codigo de saida $0 (0 = ok)"
!macroend

!macro customUnInstall
  DetailPrint "Removendo a regra do Firewall do Windows..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Nexo - salas de voz e tela"'
  Pop $0
!macroend
