'use strict';

/**
 * Nexo - tutorial guiado
 * ------------------------------------------------------------------
 * Uma tela só, um passo por vez. A pessoa lê e clica em Próximo —
 * sem precisar criar sala, sem precisar conversar com ninguém para
 * aprender a usar. Serve tanto para quem chegou agora quanto para
 * quem quer rever (tem o botão em Configurações > Geral).
 */

const Tutorial = (() => {

  const PASSOS = [
    {
      titulo: 'Bem-vindo ao Nexo',
      texto: 'Um app para ver a tela do amigo, falar com todo mundo e conversar ao mesmo tempo — de graça, sem assinatura e sem anúncio.',
      dica: 'Leia com calma e clique em Próximo. Não acontece nada de errado.'
    },
    {
      titulo: 'Entrar numa sala',
      texto: 'Clique em <b>Criar sala</b> para abrir a sua, ou digite o código de 6 letras de quem já abriu, em <b>Entrar com código</b>.',
      dica: 'O código aparece no topo da tela. Mande para a galera e todo mundo entra na mesma sala.'
    },
    {
      titulo: 'Seu nome e seu avatar',
      texto: 'No ícone de perfil, no canto superior direito, você escolhe o nome, o emoji e a cor que os outros vão ver.',
      dica: 'Dá para mudar quando quiser, as atualizações valem na hora para quem está na sala.'
    },
    {
      titulo: 'Microfone e câmera',
      texto: 'Os botões <b>Microfone</b> e <b>Câmera</b> ligam e desligam. Em Configurações › Áudio você escolhe qual microfone e qual fone usar.',
      dica: 'Padrão: só quem está assistindo ouve você. Se quiser se ouvir no seu fone, há uma opção lá.'
    },
    {
      titulo: 'Transmitir a tela',
      texto: 'Clique em <b>Transmitir</b>, escolha a tela ou a janela e pronto. A imagem sai na qualidade nativa do seu monitor, sem rebaixar.',
      dica: 'Dá para transmitir a tela e a câmera ao mesmo tempo. Em Configurações › Vídeo você escolhe os frames por segundo.'
    },
    {
      titulo: 'Chat e conversa individual',
      texto: 'À direita fica o chat da sala. Passando o mouse numa pessoa da lista aparece o ícone de conversa: ele abre um papo <b>só entre vocês dois</b>.',
      dica: 'Mande imagem, vídeo, link ou documento arrastando para o campo de mensagem.'
    },
    {
      titulo: 'O sininho',
      texto: 'No topo, o sininho reúne o que chegou enquanto você não estava olhando, e avisa quando sai uma versão nova do app, com a lista do que mudou.',
      dica: 'Clique duas vezes em marcar como lido e ele volta a zero.'
    },
    {
      titulo: 'Pronto para usar',
      texto: 'É só isso. Clique em Concluir e você volta para a tela de entrada, já sabendo o caminho de tudo.',
      dica: 'Se um dia esquecer, abra Configurações › Geral e clique em Ver tutorial de novo.'
    }
  ];

  let atual = 0;
  let noFim = null;

  function jaViu() {
    try { return localStorage.getItem('nexo.tutorialVisto') === '1'; } catch { return false; }
  }
  function marcarVisto() {
    try { localStorage.setItem('nexo.tutorialVisto', '1'); } catch { /* ignora */ }
  }

  function montar() {
    if (document.getElementById('tutorial-overlay')) return;

    const ov = document.createElement('div');
    ov.id = 'tutorial-overlay';
    ov.className = 'tutorial-overlay';
    ov.innerHTML = `
      <div class="tutorial-cartao" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo">
        <div class="tutorial-topo">
          <span class="tutorial-passo" id="tutorial-indice"></span>
          <button type="button" class="link-btn" id="tutorial-pular">Pular tutorial</button>
        </div>

        <div class="tutorial-corpo">
          <div class="tutorial-icone" id="tutorial-icone">◆</div>
          <h3 id="tutorial-titulo"></h3>
          <p id="tutorial-texto"></p>
          <p class="tutorial-dica" id="tutorial-dica"></p>
        </div>

        <div class="tutorial-barra"><i id="tutorial-Progresso"></i></div>

        <div class="tutorial-acoes">
          <button type="button" class="btn pequeno" id="tutorial-voltar">Voltar</button>
          <button type="button" class="btn pequeno gradiente" id="tutorial-proximo">Próximo</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    ov.querySelector('#tutorial-pular').addEventListener('click', () => concluir());
    ov.querySelector('#tutorial-voltar').addEventListener('click', () => mover(-1));
    ov.querySelector('#tutorial-proximo').addEventListener('click', () => mover(1));

    // esc fecha, setas navegam — só para quem já sabe usar teclado
    document.addEventListener('keydown', (ev) => {
      if (ov.hidden) return;
      if (ev.key === 'Escape') { concluir(); }
      if (ev.key === 'ArrowRight') mover(1);
      if (ev.key === 'ArrowLeft') mover(-1);
    });
  }

  function desenhar() {
    const p = PASSOS[atual];
    const ov = document.getElementById('tutorial-overlay');
    if (!ov || !p) return;

    ov.querySelector('#tutorial-indice').textContent = `${atual + 1} de ${PASSOS.length}`;
    ov.querySelector('#tutorial-titulo').textContent = p.titulo;
    ov.querySelector('#tutorial-texto').innerHTML = p.texto;
    ov.querySelector('#tutorial-dica').textContent = p.dica;

    const barra = ov.querySelector('#tutorial-Progresso');
    barra.style.width = Math.round(((atual + 1) / PASSOS.length) * 100) + '%';

    const voltar = ov.querySelector('#tutorial-voltar');
    const proximo = ov.querySelector('#tutorial-proximo');
    voltar.disabled = atual === 0;
    voltar.style.visibility = atual === 0 ? 'hidden' : 'visible';
    proximo.textContent = atual === PASSOS.length - 1 ? 'Concluir' : 'Próximo';
  }

  function mover(delta) {
    const proximo = atual + delta;
    if (proximo < 0) return;
    if (proximo >= PASSOS.length) { concluir(); return; }
    atual = proximo;
    desenhar();
  }

  function concluir() {
    const ov = document.getElementById('tutorial-overlay');
    if (ov) ov.hidden = true;
    marcarVisto();
    if (typeof noFim === 'function') { const f = noFim; noFim = null; f(); }
  }

  /** Mostra o tutorial. `forcar` ignora o "já viu". */
  function iniciar(forcar, aoTerminar) {
    montar();
    atual = 0;
    noFim = typeof aoTerminar === 'function' ? aoTerminar : null;
    const ov = document.getElementById('tutorial-overlay');
    ov.hidden = false;
    desenhar();
    if (forcar) marcarVisto();
  }

  function iniciarSePrimeiraVez() {
    if (jaViu()) return false;
    iniciar(false);
    return true;
  }

  return { iniciar, iniciarSePrimeiraVez, jaViu };
})();
