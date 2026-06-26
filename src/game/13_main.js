'use strict';

// Escopo encapsulado para evitar vazamento de variáveis de configuração
(() => {
  // Inicialização segura do namespace de contexto global do projeto
  window.HavenfallContext = window.HavenfallContext || {};

  // SOLUÇÃO DA ABERRAÇÃO 1: Declaração explícita de variáveis locais obrigatórias no Strict Mode
  let settings = {};
  let showDebugGrid = false;

  try {
    if (typeof loadSettings === 'function') {
      settings = loadSettings() || {};
      showDebugGrid = !!settings.showGrid;
      
      // Vinculação intencional e controlada ao escopo global para consumo do motor
      window.settings = settings;
      window.showDebugGrid = showDebugGrid;
    }
  } catch (err) {
    console.warn('[Engine Boot] Falha ao ler configurações locais antes do loop:', err);
  }

  function bootGame() {
    // SOLUÇÃO DA ABERRAÇÃO 2 (Idempotência): Bloqueia loops de animação duplicados paralelos
    if (window.HavenfallContext.coreEngineActive) {
      console.warn('[Engine Boot] Bloqueio preventivo: O loop do jogo já está ativo no Canvas.');
      return;
    }

    if (typeof loadImages !== 'function') {
      handleBootError(new Error('Módulo essencial de carregamento de texturas (loadImages) ausente.'));
      return;
    }

    loadImages()
      .then(() => {
        // Execuções defensivas de infraestrutura
        if (typeof setupEventListeners === 'function') setupEventListeners();
        
        if (typeof writeNewGameConfig === 'function' && typeof defaultNewGameConfig !== 'undefined') {
          writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
        }
        
        if (typeof createInitialState === 'function' && typeof defaultNewGameConfig !== 'undefined') {
          window.state = createInitialState({ ...defaultNewGameConfig, colonyName: 'First Haven', seed: 'preview-menu' });
        }
        
        window.activeSession = false;
        
        if (typeof ensureResearchState === 'function') ensureResearchState();
        if (typeof refreshMenuSaveInfo === 'function') refreshMenuSaveInfo();
        if (typeof refreshLoadScreen === 'function') refreshLoadScreen();
        if (typeof updateUI === 'function') updateUI(true);
        
        if (typeof setScreen === 'function' && typeof SCREEN !== 'undefined') {
          setScreen(SCREEN.MAIN_MENU);
        }
        
        if (typeof resizeGameCanvas === 'function') {
          resizeGameCanvas();
          // SOLUÇÃO DA ABERRAÇÃO 3: Remove listener antigo idêntico antes de registrar o novo
          window.removeEventListener('resize', resizeGameCanvas);
          window.addEventListener('resize', resizeGameCanvas);
        }
        
        if (typeof gameLoop === 'function') {
          // Sinaliza que o motor do jogo está rodando em background de forma única
          window.HavenfallContext.coreEngineActive = true;
          requestAnimationFrame(gameLoop);
        } else {
          throw new Error('A rotina principal gameLoop não foi localizada no ecossistema.');
        }
      })
      .catch(handleBootError);
  }

  function handleBootError(err) {
    console.error('[Fatal Engine Crash]:', err);
    const message = 'Falha ao iniciar o jogo. Verifique se os assets e módulos principais foram carregados corretamente.';
    
    // Varredura cirúrgica e defensiva do objeto global DOM
    const modal = typeof dom !== 'undefined' ? dom.modal : null;
    const modalText = modal?.querySelector('p');
    
    if (modalText) {
      modalText.textContent = message;
      modal.classList.add('show');
    } else {
      alert(message);
    }
  }

  // Inicializa o fluxo de boot isolado
  bootGame();
})();