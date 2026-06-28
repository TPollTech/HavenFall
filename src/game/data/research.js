'use strict';

const baseResearchDefs = {
  metalworking: { label: 'Metalurgia básica', unlocks: ['forge'], cost: 24 },
  cooking: { label: 'Cozinha de sobrevivência', unlocks: ['stove'], cost: 20 },
  medicine: { label: 'Primeiros socorros', unlocks: ['med_station'], cost: 22 },
  heavy_hauling: { label: 'Carga pesada', unlocks: ['handcart'], cost: 24 },
  carpentry: { label: 'Carpintaria Básica', unlocks: ['wall', 'door'], cost: 15 },
  agriculture: { label: 'Agricultura', unlocks: ['farm'], cost: 30 },
  storage: { label: 'Logística de Estoque', unlocks: ['storage'], cost: 25 },
  basic_defense: { label: 'Defesa Básica', unlocks: ['spike_trap'], cost: 20 },
  thermal_comfort: { label: 'Isolamento Térmico', unlocks: ['shelter'], cost: 30 },
  preservation: { label: 'Preservação de Alimentos', unlocks: ['smokehouse'], cost: 30 },
  light_hauling: { label: 'Carga Léve', unlocks: ['cart'], cost: 20 },
};
const baseResearchOrder = ['metalworking', 'cooking', 'medicine', 'heavy_hauling', 'carpentry', 'agriculture', 'storage', 'basic_defense', 'thermal_comfort', 'preservation', 'light_hauling'];
