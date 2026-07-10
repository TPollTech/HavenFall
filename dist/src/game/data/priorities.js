'use strict';

const basePriorityDefs = {
  build: { label: 'Construção', note: 'Procura blueprints automaticamente.' },
  gather: { label: 'Coleta', note: 'Coleta recursos marcados manualmente ou por área.' },
  defense: { label: 'Defesa', note: 'Fica de guarda e corre para espantar ameaças.' },
  farming: { label: 'Agricultura', note: 'Prepara solo, planta e colhe nas zonas de cultivo.' },
  crafting: { label: 'Artesanato', note: 'Fabricar itens em bancadas, forja e estações.' },
  hauling: { label: 'Transporte', note: 'Leva itens soltos até depósitos e zonas.' },
  research: { label: 'Pesquisa', note: 'Trabalha na mesa de pesquisa para desbloquear tecnologias.' }
};
const basePriorityOrder = ['build', 'gather', 'farming', 'crafting', 'hauling', 'research', 'defense'];
