'use strict';

(() => {
  const MENU_BACKGROUND_URL = 'menu.png';
  const MENU_LOGO_URL = 'logo.png';
  const RUNTIME_EXTENSION_BLUEPRINTS = Object.freeze([
    { id: 'audio_sfx_system', file: 'src/game/systems/audio-sfx-system.js' },
    { id: 'work_feedback_system', file: 'src/game/systems/work-feedback-system.js' }
  ]);

  function injectMenuBrandingStyle() {
    if (document.getElementById('havenfall-menu-branding-style')) return;
    const style = document.createElement('style');
    style.id = 'havenfall-menu-branding-style';
    style.textContent = `
      .main-menu-classic .main-menu-bg {
        background-image:
          linear-gradient(90deg, rgba(3, 5, 10, .78), rgba(3, 5, 10, .18) 44%, rgba(3, 5, 10, .70)),
          radial-gradient(circle at 50% 36%, rgba(255, 166, 61, .10), transparent 34%),
          url("${MENU_BACKGROUND_URL}") !important;
        background-size: cover, cover, cover !important;
        background-position: center center, center center, bottom center !important;
        background-repeat: no-repeat !important;
        transform: scale(1.015) !important;
        filter: saturate(1.05) contrast(1.04);
      }

      .main-menu-classic .main-menu-bg::before {
        opacity: .10 !important;
        mix-blend-mode: screen;
      }

      .main-menu-classic .main-menu-vignette {
        background:
          linear-gradient(90deg, rgba(0,0,0,.76), rgba(0,0,0,.12) 48%, rgba(0,0,0,.70)),
          linear-gradient(180deg, rgba(0,0,0,.44), transparent 32%, rgba(0,0,0,.70)),
          radial-gradient(circle at center, transparent 34%, rgba(0,0,0,.76) 100%) !important;
      }

      .classic-title-wrap.has-logo .game-logo-img {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function installMenuBranding() {
    injectMenuBrandingStyle();

    const titleWrap = document.querySelector('#mainMenuScreen .classic-title-wrap');
    if (!titleWrap || titleWrap.querySelector('.game-logo-img')) return;

    const logo = document.createElement('img');
    logo.className = 'game-logo-img';
    logo.src = MENU_LOGO_URL;
    logo.alt = 'HavenFall';
    logo.decoding = 'async';
    logo.loading = 'eager';
    logo.onerror = () => document.body.classList.add('menu-logo-failed');

    titleWrap.prepend(logo);
    titleWrap.classList.add('has-logo');
  }

  function loadRuntimeExtension(blueprint) {
    if (!blueprint?.file || document.querySelector(`script[data-blueprint-id="${blueprint.id}"]`)) return;
    const script = document.createElement('script');
    script.src = blueprint.file;
    script.dataset.blueprintId = blueprint.id;
    script.onerror = () => console.warn(`[Runtime Extension] Falha ao carregar ${blueprint.id}`);
    document.body.appendChild(script);
  }

  function installRuntimeFeedbackExtensions() {
    const bootIds = new Set((window.HavenfallBootManifest?.core || []).map(blueprint => blueprint.id));
    for (const blueprint of RUNTIME_EXTENSION_BLUEPRINTS) {
      if (!bootIds.has(blueprint.id)) loadRuntimeExtension(blueprint);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installMenuBranding, { once: true });
  } else {
    installMenuBranding();
  }

  if (document.body) installRuntimeFeedbackExtensions();
  else document.addEventListener('DOMContentLoaded', installRuntimeFeedbackExtensions, { once: true });
})();
