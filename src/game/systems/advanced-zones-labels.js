'use strict';

(() => {
  const advancedLabels = {
    storage: 'Armazenamento',
    dumping: 'Descarte / lixo',
    home: 'Casa / área base',
    safe: 'Área segura',
    priority: 'Área prioritária',
    growing: 'Zona de cultivo',
    allowed: 'Área permitida',
    none: 'apagando zonas'
  };

  zoneToolLabel = function zoneToolLabelAdvanced() {
    if (!currentZoneTool) return 'nenhuma ferramenta ativa';
    if (currentZoneTool === 'none') return advancedLabels.none;
    return `marcando ${String(advancedLabels[currentZoneTool] || currentZoneTool).toLowerCase()}`;
  };
})();
