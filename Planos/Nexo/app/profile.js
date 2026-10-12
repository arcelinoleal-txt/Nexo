/* Perfil do usuário - referência Discord via REA */
function renderProfile() {
  const container = document.getElementById('conteudo') || document.body;
  container.innerHTML = `
    <section class="perfil-hero">
      <div class="avatar-grande" style="background: linear-gradient(135deg, #5865f2, #a855f7); width: 120px; height: 120px; border-radius: 50%;"></div>
      <h1>Nexo Premium</h1>
      <p>Marca construída com REA. Referência: Discord v1.0.9261 (core.asar analisado — 547 módulos reconstruídos).</p>
      <button onclick="abrirModal('#modal-config')">Configurações</button>
    </section>
  `;
}

window.renderConfiguracoes = function() {
  // Usa o modal-config existente no index.html (linha 459) em vez de criar um duplicado
  const modal = document.getElementById('modal-config');
  if (modal) {
    modal.hidden = false;
    return;
  }
  // Fallback: cria dinamicamente se não existir
  const div = document.createElement('div');
  div.id = 'modal-config';
  div.className = 'overlay';
  div.innerHTML = `<aside class="config-sidebar"><h2>Nexo Premium</h2><button onclick="fecharConfig()">Fechar</button></aside><main class="config-main"><h1>Configurações</h1><p>Recriado com referência do Discord analisado pelo REA (análise estática, 547 módulos).</p></main>`;
  document.body.appendChild(div);
};
window.fecharConfig = function() { document.getElementById('modal-config')?.remove(); };