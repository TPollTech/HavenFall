'use strict';

(() => {
  const core = window.HavenfallPawnCore;
  const skinPalette = ['#c98f65', '#b77a52', '#d3a072', '#8f5f43', '#e0b27f'];
  const hairPalette = ['#2c1b13', '#4b2f1e', '#6b4a2f', '#202022', '#7a5537'];
  const accentPalette = ['#b7a66b', '#8fb8a0', '#b08a72', '#9da4b8'];

  const clothPalette = {
    colonistA: '#8f5f3b',
    colonistB: '#596f58',
    colonistC: '#6b6478',
    gather: '#617a4b',
    build: '#8a6a3f',
    defense: '#764846',
    research: '#4d687a',
    medicine: '#6f6b7f',
    trader: '#735c3f',
    raider: '#6f3632',
    visitor: '#536c72'
  };

  const animalProfiles = Object.freeze({
    goat: { body: '#8f8068', light: '#c7bba5', horn: true, beard: true, scale: 0.86 },
    sheep: { body: '#d9d4c5', light: '#f0eadc', wool: true, scale: 0.84 },
    pig: { body: '#b87b70', light: '#d79b90', snout: true, scale: 0.82 },
    cow: { body: '#6f5b4a', light: '#d8d0bd', horn: true, spots: true, scale: 1.08 },
    chicken: { body: '#d8c9a5', wing: '#b98b5f', comb: '#b91c1c', scale: 0.74 },
    duck: { body: '#60765f', wing: '#374c3e', beak: '#e8a236', scale: 0.82 },
    turkey: { body: '#5a3a2d', wing: '#7b5540', comb: '#c2410c', fan: true, scale: 0.98 },
    bear: { body: '#4b3a2c', light: '#7a5f4b', scale: 1.2 },
    boar: { body: '#5c3a2d', light: '#8a5f4b', tusk: true, snout: true, scale: 1.1 },
    fox: { body: '#b85c2d', light: '#e08a5f', tail: true, scale: 0.9 },
    lynx: { body: '#7a5f4b', light: '#c9bba6', earTufts: true, scale: 0.9 },
    cougar: { body: '#8a5f4b', light: '#c9bba6', tail: true, scale: 1 },
    bobcat: { body: '#7a5f4b', light: '#c9bba6', earTufts: true, scale: 0.9 },
    mountain_lion: { body: '#8a5f4b', light: '#c9bba6', tail: true, scale: 1 },
    coyote: { body: '#8a5f4b', light: '#c9bba6', tail: true, scale: 0.9 },
    hyena: { body: '#7a5f4b', light: '#c9bba6', mane: true, spots: true, scale: 0.9 },
    jaguar: { body: '#9a7244', light: '#d3a660', spots: true, tail: true, scale: 1 },
    panther: { body: '#1f2020', light: '#3a3a3a', tail: true, scale: 1 },
    tiger: { body: '#b85c2d', light: '#e08a5f', stripes: true, tail: true, scale: 1 },
    lion: { body: '#b88b54', light: '#e0c076', mane: true, tail: true, scale: 1 },
    elephant: { body: '#5c5f5a', light: '#8a8f86', trunk: true, tusk: true, scale: 1.4 },
    rhino: { body: '#5c5f5a', light: '#8a8f86', horn: true, scale: 1.3 },
    hippo: { body: '#5c5f5a', light: '#8a8f86', snout: true, scale: 1.3 },
    giraffe: { body: '#b88b54', light: '#e0c9a5', spots: true, horn: true, longNeck: true, scale: 1.45 },
    zebra: { body: '#e0e0dc', light: '#ffffff', stripes: true, scale: 1.18 },
    kangaroo: { body: '#b88b54', light: '#e0c9a5', tail: true, scale: 1.08 },
    koala: { body: '#5c5f5a', light: '#8a8f86', roundEars: true, scale: 0.92 },
    panda: { body: '#f1eee8', light: '#1f2020', panda: true, scale: 1 }
  });

  const generatedColonistClothCycle = ['#8f5f3b', '#596f58', '#6b6478', '#7a5f4b'];

  function generatedColonistCloth(sprite) {
    const match = /^colonist([A-Z]+)$/.exec(String(sprite || ''));
    if (!match) return null;
    const letters = match[1];
    let value = 0;
    for (let i = 0; i < letters.length; i++) value = value * 26 + (letters.charCodeAt(i) - 64);
    return generatedColonistClothCycle[Math.max(0, value - 1) % generatedColonistClothCycle.length];
  }

  function colonistStyle(pawn) {
    const appearance = pawn?.appearance || {};
    const seed = core.hashText(pawn?.name || pawn?.id || pawn?.sprite);
    const pref = pawn?.workPreferenceId || pawn?.priority || pawn?.workPreference || pawn?.faction;
    return {
      skin: appearance.skin || skinPalette[seed % skinPalette.length],
      hair: appearance.hairColor || appearance.hair || hairPalette[Math.floor(seed / 3) % hairPalette.length],
      cloth: appearance.cloth || appearance.clothes || clothPalette[pref] || clothPalette[pawn?.sprite] || generatedColonistCloth(pawn?.sprite) || '#665a49',
      accent: appearance.accent || accentPalette[Math.floor(seed / 7) % accentPalette.length],
      body: appearance.body || 'average',
      head: appearance.head || 'round',
      hairStyle: appearance.hairStyle || 'short'
    };
  }

  function animalProfile(type, pawn = null) {
    return {
      ...(animalProfiles[type] || {}),
      ...(pawn?.appearance || {})
    };
  }

  function hasAnimalProfile(type) {
    return !!animalProfiles[type];
  }

  window.HavenfallPawnStyle = Object.freeze({
    clothPalette,
    colonistStyle,
    animalProfile,
    hasAnimalProfile
  });
})();
