'use strict';

/** Icones do Nexo — SVG inline, sem dependencias externas. */

const ICONES = {
  mic: '<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z"/>',

  'mic-off': '<path d="M19 11h-2a5 5 0 0 1-.7 2.5l1.3 1.3A7 7 0 0 0 19 11ZM4.3 3 3 4.3l6 6V11a3 3 0 0 0 4.2 2.7l1.3 1.4A5 5 0 0 1 7 11H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 1.5-.3l4.2 4.2 1.3-1.3L4.3 3ZM12 5v3.1l4.1 4.1A3 3 0 0 0 15 8V5h-3Z"/>',

  cam: '<path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Zm0 4.5-3-3v1.5H4V7h10v5h3v3Z"/>',

  'cam-off': '<path d="m3.3 2 17.4 17.4 1.3-1.3L18 14.7V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7c0-.3.1-.6.3-.8L1.9 4.7 3.3 2Zm12.7 9.5V7H4.5L16 11.5ZM7.4 4 4 7.4V16h10l-.4-.4L7.4 4Z"/>',

  screen: '<path d="M20 3H4a2 2 0 0 0-2 2v11h2V5h16v11h2V5a2 2 0 0 0-2-2ZM1 19h14v2H1v-2Zm13-6v4h-4l5 6 5-6h-4v-4h-2Z"/>',

  sair: '<path d="M10 17l1.4-1.4L9.2 13H16v-2H9.2l2.2-2.6L10 7l-5 5 5 5Zm9-13H9a2 2 0 0 0-2 2v3h2V6h10v12H9v-3H7v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/>',

  cheia: '<path d="M7 14H5v5h5v-2H7v-3Zm-2-4h2V7h3V5H5v5Zm14 7h-3v2h5v-5h-2v3ZM14 5v2h3v3h2V5h-5Z"/>',

  'cheia-sair': '<path d="M5 16h2v-3h3v-2H5v5Zm0-8h5V5H5v3Zm14 8h-5v-2h3v-3h2v5Zm0-11h-5V5h5v2Z"/>'
};

/**
 * Preenche todos os <span class="ic" data-on="..."> com o SVG correspondente.
 * data-on  = icone quando ligado
 * data-off = icone quando desligado (data-estado="off")
 */
function aplicarIcones() {
  document.querySelectorAll('.ic[data-on]').forEach(el => {
    const ativo = el.dataset.estado !== 'off';
    const nome = ativo ? el.dataset.on : (el.dataset.off || el.dataset.on);
    const corpo = ICONES[nome] || ICONES[ativo ? 'mic' : 'mic-off'];
    el.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">' +
      corpo + '</svg>';
  });
}

/** Marca um botao de midia como ligado/desligado. */
function definirBotao(el, ligado) {
  if (!el) return;
  const ic = el.querySelector('.ic');
  if (ic) ic.dataset.estado = ligado ? 'on' : 'off';
  el.classList.toggle('desligado', !ligado);
  aplicarIcones();
}

window.ICONS = ICONES;
window.aplicarIcones = aplicarIcones;
window.definirBotao = definirBotao;
