'use strict';

(() => {
  const profiles = Object.freeze({
    bench: { wood: '#7a5537', darkWood: '#4b3424', metal: '#a7b0ad', accent: '#d0aa65' },
    research_desk: { wood: '#68513a', darkWood: '#3d2d21', paper: '#e8dcc4', accent: '#6f8fa3' },
    forge: { stone: '#5d5b54', darkStone: '#343431', metal: '#9fa6a3', fire: '#f97316' },
    stove: { stone: '#6c665c', darkStone: '#37332d', metal: '#a6aaa8', fire: '#f59e0b' },
    med_station: { wood: '#746250', cloth: '#d8d5cb', accent: '#b93b3b', metal: '#9aa3a1' },
    sewing_table: { wood: '#77563d', cloth: '#8977a2', thread: '#d8c59b', metal: '#a7aba8' },
    smokehouse: { wood: '#604735', darkWood: '#35251b', smoke: 'rgba(214,205,185,.45)', ember: '#f97316' }
  });

  function profile(type) {
    return profiles[type] || profiles.bench;
  }

  function canRender(type) {
    return !!profiles[type];
  }

  window.HavenfallWorkstationStyle = Object.freeze({
    profile,
    canRender
  });
})();
