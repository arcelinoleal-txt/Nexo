/**
 * Nexo Premium — Tela de Configurações (baseada na observação do Discord via REA)
 * REA analisou o core.asar do Discord (v1.0.9261): 547 módulos reconstruídos,
 * incluindo bundle.js (processo principal) e mainScreenPreload.js (preload).
 * Esta implementação é uma RECRIAÇÃO de referência, não cópia de código.
 */

const ABAS = [
  { chave: 'conta', titulo: 'Minha Conta', icone: 'user-cog' },
  { chave: 'privacidade', titulo: 'Dados e Privacidade', icone: 'shield-check' },
  { chave: 'permissoes', titulo: 'Permissões de Mensagens', icone: 'message-circle' },
  { chave: 'notificacoes', titulo: 'Notificações', icone: 'bell' },
  { chave: 'voz_video', titulo: 'Voz e Vídeo', icone: 'mic-video' },
  { chave: 'aparencia', titulo: 'Aparência', icone: 'palette' },
  { chave: 'acessibilidade', titulo: 'Acessibilidade', icone: 'accessibility' },
  { chave: 'sistema', titulo: 'Sistema', icone: 'server' },
  { chave: 'idioma', titulo: 'Idioma e Horário', icone: 'globe' },
  { chave: 'jogos', titulo: 'Jogos Registrados', icone: 'gamepad-2' },
  { chave: 'sair', titulo: 'Sair', icone: 'log-out' }
];

function render(tela) {
  const container = document.getElementById('tela-config') || document.createElement('div');
  container.id = 'tela-config';
  container.innerHTML = `
    <aside class="config-sidebar">
      <h2>Nexo Premium</h2>
      <input class="config-search" placeholder="Buscar configurações..." oninput="filtrarAbas(this.value)">
      <nav id="abas-nav">
        ${ABAS.map(a => `<button onclick="abrirAba('${a.chave}')" data-chave="${a.chave}" class="aba-btn"><span>${a.titulo}</span></button>`).join('')}
      </nav>
    </aside>
    <main id="config-main" class="config-main"></main>
  `;
  document.body.appendChild(container);
  abrirAba('conta');
}

function abrirAba(chave) {
  document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.aba-btn[data-chave="${chave}"]`);
  if (btn) btn.classList.add('active');
  const aba = ABAS.find(a => a.chave === chave);
  const main = document.getElementById('config-main');
  if (!main) return;
  main.innerHTML = `
    <header class="config-header">
      <h1>${aba ? aba.titulo : chave}</h1>
      <button onclick="fecharConfig()" class="btn-fechar">×</button>
    </header>
    <section class="config-body">
      ${conteudoAba(chave)}
    </section>
  `;
}

function conteudoAba(chave) {
  if (chave === 'conta') return `
    <div class="config-row"><label>Nome de usuário</label> <input value="${window.usuario?.nome || ''}"></div>
    <div class="config-row"><label>E-mail</label> <input value="${window.usuario?.email || ''}" disabled></div>
    <div class="config-row"><label>Avatar</label> <button onclick="abrirSeletorAvatar()">Alterar foto</button></div>
    <div class="config-row"><label>Cor</label> <input type="color" value="#${(window.usuario?.cor || 0).toString(16).padStart(6, '0')}"></div>
  `;
  if (chave === 'privacidade') return `<h3>Controle de dados e privacidade</h3>
    <div class="config-row"><label>Permitir pesquisa por nome</label> <label class="switch"><input type="checkbox" checked><span class="slider"></span></label></div>
    <div class="config-row"><label>Mostrar e-mail no perfil</label> <label class="switch"><input type="checkbox"><span class="slider"></span></label></div>`;
  if (chave === 'permissoes') return `<h3>Mensagens</h3>
    <div class="config-row"><label>Mensagens privadas</label> <label class="switch"><input type="checkbox" checked><span class="slider"></span></label></div>`;
  if (chave === 'notificacoes') return `<h3>Notificações</h3>
    <div class="config-row"><label>Sons de mensagem</label> <label class="switch"><input type="checkbox" checked><span class="slider"></span></label></div>
    <div class="config-row"><label>Notificações de atualização</label> <label class="switch"><input type="checkbox" checked><span class="slider"></span></label></div>`;
  if (chave === 'voz_video') return `<h3>Dispositivos</h3>
    <div class="config-row"><label>Microfone</label> <select id="mics"></select></div>
    <div class="config-row"><label>Volume de entrada</label> <input type="range" min="0" max="100" value="80"></div>
    <div class="config-row"><label>Configurações avançadas</label> <button onclick="abrirConfigAvancada()">Abrir aba de áudio</button></div>`;
  if (chave === 'aparencia') return `<h3>Temas</h3>
    <div class="grid-temas">
      ${['Meia-Noite', 'Anime 1', 'Anime 2', 'Anime 3', 'Anime 4', 'Anime 5', 'Anime 6', 'Anime 7', 'Anime 8', 'Anime 9', 'Anime 10'].map(t => `<button onclick="aplicarTema('${t}')" class="tema-card">${t}</button>`).join('')}
    </div>`;
  if (chave === 'acessibilidade') return `<h3>Acessibilidade</h3>
    <div class="config-row"><label>Tamanho da fonte</label> <input type="range" min="10" max="24" value="16"></div>`;
  if (chave === 'sistema') return `<h3>Sistema</h3>
    <div class="config-row"><label>Inicializar com o sistema</label> <label class="switch"><input type="checkbox" checked><span class="slider"></span></label></div>`;
  if (chave === 'idioma') return `<h3>Idioma e Fuso</h3>
    <div class="config-row"><label>Idioma</label> <select><option>Português</option><option>English</option></select></div>`;
  if (chave === 'jogos') return `<h3>Jogos Registrados</h3>
    <p>Nenhum jogo registrado ainda.</p>`;
  if (chave === 'sair') return `<h3>Sair</h3>
    <p>Encerrar a sessão atual.</p>
    <button onclick="encerrarSessao()">Sair do Nexo Premium</button>`;
  return `<p>Conteúdo da aba: ${chave}</p>`;
}

function filtrarAbas(q) {
  const termo = q.toLowerCase().trim();
  document.querySelectorAll('.aba-btn').forEach(btn => {
    const texto = btn.innerText.toLowerCase();
    btn.style.display = texto.includes(termo) ? '' : 'none';
  });
}

function fecharConfig() { document.getElementById('tela-config')?.remove(); }
function abrirSeletorAvatar() { alert('Seletor de avatar — implementado no profile.js'); }
function abrirConfigAvancada() { abrirAba('voz_video'); }
function aplicarTema(t) { document.body.className = `tema-${t.toLowerCase().replace(/[^a-z0-9]/g, '-')}`; localStorage.setItem('tema', t); }
function encerrarSessao() { localStorage.removeItem('token'); window.location.href = 'index.html'; }

// Carrega tema salvo
(function() {
  const salvo = localStorage.getItem('tema');
  if (salvo) document.body.classList.add(`tema-${salvo.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
})();

window.render = render;
window.abrirAba = abrirAba;
window.filtrarAbas = filtrarAbas;
window.fecharConfig = fecharConfig;
