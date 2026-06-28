'use strict';

const basePriorityDefs = {
  build: { label: 'Construção', note: 'Procura blueprints automaticamente.' },
  gather: { label: 'Coleta', note: 'Coleta recursos marcados manualmente ou por área.' },
  defense: { label: 'Defesa', note: 'Fica de guarda e corre para espantar ameaças.' }
};
const basePriorityOrder = ['build', 'gather', 'defense'];
