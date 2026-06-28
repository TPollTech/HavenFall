'use strict';

const baseResearchDefs = {
  metalworking: { label: 'Metalurgia básica', unlocks: ['forge'], cost: 24 },
  cooking: { label: 'Cozinha de sobrevivência', unlocks: ['stove'], cost: 20 },
  medicine: { label: 'Primeiros socorros', unlocks: ['med_station'], cost: 22 }
};
const baseResearchOrder = ['metalworking', 'cooking', 'medicine'];
