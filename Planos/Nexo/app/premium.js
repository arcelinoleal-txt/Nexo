/* Modo premium — REA (Discord) + modelos GitHub */
function selecionarAba(el, chave){
  document.querySelectorAll('.aba-item').forEach(a=>a.classList.remove('ativa'));
  el.classList.add('ativa');
  document.querySelector('.chat-titulo').innerHTML = el.querySelector('.aba-nome').textContent + ' <span class="sala-status"><span class="ponto"></span>Online</span>';
}
function filtrarAbas(q){
  document.querySelectorAll('.aba-item').forEach(a=>{ a.style.display = a.innerText.toLowerCase().includes(q.toLowerCase())?'':'none'; });
}
function abrirNovaSala(){ alert('Nova sala — crie pelo código ou pelo servidor em /api/convite'); }
function enviarMsg(ev){ ev.preventDefault(); const v=document.getElementById('campo-mensagem').value.trim(); if(!v)return; const c=document.getElementById('chat-corpo'); const m=document.createElement('div');m.className='msg';m.style.animation='fadeUp .35s ease-out';m.innerHTML='<div class="msg-avatar">V</div><div class="msg-body"><div class="msg-cabe"><span class="msg-autor">Você</span><span class="msg-hora">agora</span></div><div class="msg-texto">'+v.replace(/</g,'&lt;')+'</div></div>';c.appendChild(m);c.scrollTop=c.scrollHeight;document.getElementById('campo-mensagem').value='';
}