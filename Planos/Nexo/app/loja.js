// Loja de temas gratuitos para o Nexo
// === Dados dos temas da loja ===
const TEMAS_LOJA = [
  { id: 'meia-noite', rotulo: 'Meia-Noite', corAcento: '#6d5efc' },
  { id: 'zenitsu', rotulo: 'Zenitsu (SL)', corAcento: '#facc15' },
  { id: 'sukuna', rotulo: 'Sukuna (JJK)', corAcento: '#e11d48' },
  { id: 'naruto', rotulo: 'Naruto', corAcento: '#f97316' },
  { id: 'evangelion', rotulo: 'Evangelion', corAcento: '#7dd3ec' },
  { id: 'levi', rotulo: 'Levi (SNK)', corAcento: '#06b6d4' },
  { id: 'gon', rotulo: 'Gon (HXH)', corAcento: '#ffb000' },
  { id: 'eren', rotulo: 'Eren (SHK)', corAcento: '#7f1d1d' },
  { id: 'kurapika', rotulo: 'Kurapika (HXH)', corAcento: '#ff6b6b' },
  { id: 'killua', rotulo: 'Killua (HXH)', corAcento: '#7dd3e1' }
];

// === Função para abrir a loja ===
function abrirLoja() {
  // Criar container da grade se não existir
  let grade = document.getElementById('grade-temas-loja');
  if (!grade) {
    grade = document.createElement('div');
    grade.id = 'grade-temas-loja';
    grade.style = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 12px; padding: 12px;';
    
    // Inserir no modal de configurações
    const modal = document.querySelector('.config-janela');
    if (modal) {
      const rolagem = modal.querySelector('.config-rolagem');
      if (rolagem) rolagem.appendChild(grade);
    }
  }
  
  grade.innerHTML = '';
  
  TEMAS_LOJA.forEach(t => {
    const card = document.createElement('div');
    card.className = 'card-tema-loja';
    card.style = 'border: 1px solid var(--borda); border-radius: var(--raio); padding: 12px; text-align: center; cursor: pointer; transition: transform 0.2s;';
    card.innerHTML = `
      <div class="card-cor" style="width: 100%; height: 60px; background: var(--acento, #6d5efc); border-radius: var(--raio-g) var(--raio) var(--raio) var(--raio); margin-bottom: 8px;"></div>
      <span class="card-rotulo" style="font-size: 12px; color: var(--texto-suave);">${t.rotulo}</span>
    `;
    card.onmouseover = () => card.style.transform = 'translateY(-2px)';
    card.onmouseout = () => card.style.transform = 'translateY(0)';
    card.onclick = () => {
      document.body.dataset.tema = t.id;
      salvar('tema', t.id);
      document.body.style.setProperty('--acento', t.corAcento);
      aviso(`Tema aplicado: ${t.rotulo}`, 'ok');
      // Voltar para a aba de aparência após um breve delay
      setTimeout(() => { 
        const aba = document.querySelector('.aba-modal.ativa'); 
        if (aba && aba.dataset.aba === 'loja') abrirAbaConfig('apparencia'); 
      }, 300);
    };
    grade.appendChild(card);
  });
  
  // Botão para tema personalizado
  const btnPersonalizado = document.createElement('div');
  btnPersonalizado.style = 'border: 2px dashed var(--borda); border-radius: var(--raio); padding: 12px; text-align: center; margin-top: 8px; cursor: pointer;';
  btnPersonalizado.innerHTML = `
    <span class="card-rotulo" style="font-size: 14px; color: var(--acento);">🎨 Tema personalizado</span>
  `;
  btnPersonalizado.onclick = () => {
    $('#input-novo-tema').click();
  };
  grade.appendChild(btnPersonalizado);
}

// === Conectar com o modal de configurações ===
// Verificar se o botão da loja existe e conectar
document.addEventListener('DOMContentLoaded', () => {
  const abaLoja = document.querySelector('.aba-modal[data-aba="loja"]');
  if (abaLoja) {
    abaLoja.addEventListener('click', (ev) => {
      ev.stopPropagation();
      abrirAbaConfig('loja');
      // Pequeno delay para o painel abrir antes de gerar conteúdo
      setTimeout(abrirLoja, 200);
    });
  }
});