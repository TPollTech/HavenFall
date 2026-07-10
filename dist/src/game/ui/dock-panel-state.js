'use strict';

(() => {
  if (window.HavenfallContext?.dockPanelStateInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};

  function panel() {
    return document.getElementById('anchored-ui-panel');
  }

  function clearClosedDockState() {
    const p = panel();
    const body = document.getElementById('anchoredPanelBody');
    if (!p || p.classList.contains('is-active')) return;
    delete p.dataset.activeDockTab;
    if (body) delete body.dataset.activeDockTab;
    document.querySelectorAll('#bottom-navigation-dock [data-ui-panel]').forEach(button => button.classList.remove('is-active'));
  }

  function patchRefreshDockPanel() {
    if (!window.HavenfallUI?.refreshDockPanel || window.HavenfallContext.dockPanelRefreshManaged) return;
    const nativeRefresh = window.HavenfallUI.refreshDockPanel;
    window.HavenfallUI.refreshDockPanel = function refreshDockPanelOnlyWhenOpen(key) {
      const p = panel();
      if (!p?.classList.contains('is-active')) {
        clearClosedDockState();
        return;
      }
      return nativeRefresh(key);
    };
    window.HavenfallContext.dockPanelRefreshManaged = true;
  }

  document.addEventListener('click', event => {
    if (!event.target?.closest?.('#anchored-ui-panel [data-close-ui-panel]')) return;
    setTimeout(clearClosedDockState, 0);
  }, true);

  window.GameSystems?.registerTick?.('ui.dock-panel-state', () => {
    clearClosedDockState();
    patchRefreshDockPanel();
  }, { order: 98 });

  patchRefreshDockPanel();
  window.HavenfallContext.dockPanelStateInstalled = true;
})();
