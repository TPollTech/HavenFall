'use strict';

(() => {
  if (window.HavenfallContext?.desktopSaveSettingsUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.desktopSaveSettingsUiInstalled = true;

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  }

  function desktop() {
    return window.HavenfallDesktop || null;
  }

  function injectStyle() {
    if (document.getElementById('desktop-save-settings-style')) return;
    const style = document.createElement('style');
    style.id = 'desktop-save-settings-style';
    style.textContent = `
      .desktop-save-settings-card {
        margin-top: 18px;
        border: 1px solid rgba(125, 211, 252, .18);
        background: linear-gradient(180deg, rgba(15, 23, 42, .72), rgba(2, 6, 23, .56));
        border-radius: 16px;
        padding: 14px;
        display: grid;
        gap: 12px;
      }
      .desktop-save-settings-card h2 {
        margin: 0;
        color: #f8fafc;
        font-size: 18px;
      }
      .desktop-save-settings-card p {
        margin: 0;
        color: rgba(203, 213, 225, .78);
        line-height: 1.45;
      }
      .desktop-save-path-box {
        border: 1px solid rgba(148, 163, 184, .14);
        background: rgba(2, 6, 23, .42);
        border-radius: 12px;
        padding: 10px;
        display: grid;
        gap: 5px;
      }
      .desktop-save-path-box small {
        color: rgba(125, 211, 252, .78);
        text-transform: uppercase;
        letter-spacing: .10em;
        font-size: 10px;
      }
      .desktop-save-path-box code {
        color: #e5eefc;
        white-space: normal;
        overflow-wrap: anywhere;
        font-size: 12px;
      }
      .desktop-save-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .desktop-save-actions button {
        border: 1px solid rgba(125, 211, 252, .20);
        background: rgba(15, 23, 42, .78);
        color: #dbeafe;
        border-radius: 11px;
        padding: 9px 11px;
        cursor: pointer;
        font-weight: 800;
      }
      .desktop-save-actions button.primary {
        border-color: rgba(34, 197, 94, .34);
        background: rgba(22, 101, 52, .26);
        color: #bbf7d0;
      }
      .desktop-save-actions button.warn {
        border-color: rgba(250, 204, 21, .28);
        background: rgba(120, 53, 15, .22);
        color: #fef3c7;
      }
      .desktop-save-status {
        min-height: 18px;
        color: rgba(203, 213, 225, .82);
        font-size: 12px;
      }
      .desktop-save-status.ok { color: #bbf7d0; }
      .desktop-save-status.warn { color: #fed7aa; }
      .desktop-save-status.error { color: #fecaca; }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    injectStyle();
    const settingsScreen = document.getElementById('settingsScreen');
    const card = settingsScreen?.querySelector('.menu-card');
    if (!card) return null;
    let panel = document.getElementById('desktopSaveSettingsPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'desktopSaveSettingsPanel';
    panel.className = 'desktop-save-settings-card';
    panel.innerHTML = `
      <div>
        <h2>Saves no Desktop</h2>
        <p>Escolha onde o HavenFall deve guardar os savegames. Isso não depende do instalador: tu pode mudar quando quiser.</p>
      </div>
      <div class="desktop-save-path-box">
        <small>Pasta atual dos saves</small>
        <code id="desktopSaveCurrentPath">Carregando...</code>
      </div>
      <div class="desktop-save-actions">
        <button type="button" class="primary" id="desktopChooseSaveFolderBtn">Escolher pasta dos saves</button>
        <button type="button" id="desktopOpenSaveFolderBtn">Abrir pasta atual</button>
        <button type="button" class="warn" id="desktopResetSaveFolderBtn">Voltar para pasta padrão</button>
      </div>
      <div id="desktopSaveStatus" class="desktop-save-status"></div>
    `;
    const subtle = card.querySelector('.subtle-box');
    if (subtle) card.insertBefore(panel, subtle);
    else card.appendChild(panel);
    panel.addEventListener('click', handleClick);
    return panel;
  }

  function setStatus(message, kind = '') {
    const el = document.getElementById('desktopSaveStatus');
    if (!el) return;
    el.className = `desktop-save-status ${kind}`.trim();
    el.textContent = message || '';
  }

  async function refresh() {
    const panel = ensurePanel();
    if (!panel) return;
    const pathEl = document.getElementById('desktopSaveCurrentPath');
    const api = desktop();
    if (!api?.isElectron) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';
    try {
      const paths = api.getDesktopPaths ? api.getDesktopPaths() : api.paths;
      if (pathEl) pathEl.textContent = paths?.saves || 'Pasta não encontrada';
      const mode = paths?.customSaves ? 'Pasta personalizada ativa.' : 'Usando pasta padrão do Windows/Electron.';
      setStatus(mode, paths?.customSaves ? 'ok' : '');
    } catch (error) {
      if (pathEl) pathEl.textContent = 'Erro ao ler pasta de saves';
      setStatus(error.message || String(error), 'error');
    }
  }

  async function handleClick(event) {
    const api = desktop();
    if (!api?.isElectron) return;
    if (event.target.closest('#desktopChooseSaveFolderBtn')) {
      setStatus('Abrindo seletor de pasta...', 'warn');
      const result = await api.chooseSaveFolder?.({ migrate: true });
      if (result?.ok) {
        const copied = result.migration?.copied || 0;
        const skipped = result.migration?.skipped || 0;
        setStatus(`Pasta alterada. Saves copiados: ${copied}. Ignorados: ${skipped}.`, 'ok');
      } else if (result?.canceled) {
        setStatus('Alteração cancelada.', 'warn');
      } else {
        setStatus(result?.error || 'Não foi possível alterar a pasta.', 'error');
      }
      await refresh();
    }
    if (event.target.closest('#desktopOpenSaveFolderBtn')) {
      await api.openFolder?.('saves');
      setStatus('Pasta de saves aberta.', 'ok');
    }
    if (event.target.closest('#desktopResetSaveFolderBtn')) {
      const ok = confirm('Voltar para a pasta padrão dos saves? Os saves atuais serão copiados para a pasta padrão quando possível.');
      if (!ok) return;
      const result = await api.resetSaveFolder?.({ migrate: true });
      if (result?.ok) {
        const copied = result.migration?.copied || 0;
        const skipped = result.migration?.skipped || 0;
        setStatus(`Pasta padrão restaurada. Saves copiados: ${copied}. Ignorados: ${skipped}.`, 'ok');
      } else {
        setStatus(result?.error || 'Não foi possível restaurar a pasta padrão.', 'error');
      }
      await refresh();
    }
  }

  function installHooks() {
    ensurePanel();
    refresh();
    desktop()?.onDesktopPathsChanged?.(() => refresh());
    const openSettings = document.getElementById('openSettingsBtn');
    openSettings?.addEventListener('click', () => setTimeout(refresh, 30));
    const settingsBack = document.getElementById('settingsBackBtn');
    settingsBack?.addEventListener('click', () => setTimeout(refresh, 30));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installHooks);
  else installHooks();

  window.refreshDesktopSaveSettingsPanel = refresh;
})();