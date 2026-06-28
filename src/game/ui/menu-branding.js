'use strict';

(() => {
  const MENU_BACKGROUND_URL = 'menu.png';
  const MENU_LOGO_URL = 'logo.png';

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
        background-position: center center, center center, center center !important;
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

      .classic-title-wrap.has-logo {
        top: clamp(24px, 4.2vh, 58px) !important;
      }

      .classic-title-wrap.has-logo .game-logo-img {
        display: block;
        width: min(560px, 58vw);
        max-height: clamp(104px, 22vh, 250px);
        object-fit: contain;
        margin: 0 auto;
        filter:
          drop-shadow(0 22px 42px rgba(0,0,0,.72))
          drop-shadow(0 0 22px rgba(255, 139, 42, .20));
        pointer-events: none;
        user-select: none;
      }

      .classic-title-wrap.has-logo .game-title {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      .classic-title-wrap.has-logo .game-subtitle {
        margin-top: clamp(4px, 1vh, 12px) !important;
        color: rgba(236, 242, 255, .78) !important;
        letter-spacing: .32em !important;
        text-shadow: 0 8px 28px rgba(0,0,0,.85) !important;
      }

      body.menu-logo-failed .classic-title-wrap.has-logo .game-logo-img {
        display: none !important;
      }

      body.menu-logo-failed .classic-title-wrap.has-logo .game-title {
        position: static !important;
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        overflow: visible !important;
        clip: auto !important;
        white-space: normal !important;
      }

      @media (max-width: 720px) {
        .classic-title-wrap.has-logo {
          top: 26px !important;
        }
        .classic-title-wrap.has-logo .game-logo-img {
          width: min(82vw, 420px);
          max-height: 148px;
        }
        .classic-title-wrap.has-logo .game-subtitle {
          font-size: 11px !important;
          letter-spacing: .20em !important;
        }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installMenuBranding, { once: true });
  } else {
    installMenuBranding();
  }
})();
