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
    rabbit: {
      family: 'rabbit',
      scale: 1,
      outline: '#4f463a',
      healthColor: '#d8d0bd',
      palette: {
        body: '#b8aa93',
        bodyLight: '#d3c9b8',
        belly: '#eee7d9',
        ear: '#d8cfbf',
        earInner: '#e9cabf',
        tail: '#f5efe2',
        leg: '#8f8170',
        nose: '#6e6357',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 13,
        shadowRy: 6
      }
    },
    deer: {
      family: 'deer',
      scale: 0.9,
      outline: '#2f2519',
      healthColor: '#d6a24a',
      palette: {
        body: '#9a7244',
        bodyLight: '#a77745',
        head: '#9f7447',
        neck: '#8b623a',
        flank: '#c49a67',
        chest: '#d9bf98',
        rump: '#eadbc4',
        ear: '#c38f5e',
        snout: '#e3cfb3',
        leg: '#714c31',
        antler: '#4b3524',
        tail: '#e7dac7',
        nose: '#382a20',
        eye: '#120f0c'
      },
      anatomy: {
        shadowRx: 18,
        shadowRy: 6.2
      },
      variation: {
        headLift: -0.25,
        bodyStretch: 1.12,
        bodyTall: 0.88,
        earSpread: 0.46
      }
    },
    goat: {
      family: 'goat',
      scale: 0.92,
      outline: '#2b241d',
      healthColor: '#ceb48a',
      palette: {
        body: '#8f8068',
        bodyLight: '#c7bba5',
        flank: '#ad9c82',
        head: '#9a8a73',
        headDark: '#72624f',
        neck: '#b5a58d',
        snout: '#d6c4ad',
        horn: '#d8c7a0',
        beard: '#54473a',
        ear: '#a99476',
        earInner: '#d5bc9e',
        leg: '#625546',
        hoof: '#312821',
        tail: '#dbceb4',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 17,
        shadowRy: 6.6
      }
    },
    sheep: {
      family: 'sheep',
      scale: 0.9,
      outline: '#40362b',
      healthColor: '#d8ccb6',
      palette: {
        body: '#d9d4c5',
        bodyLight: '#f0eadc',
        wool: '#f7f1e4',
        woolShadow: '#ddd4c0',
        face: '#b3a18a',
        faceDark: '#7a6b5b',
        leg: '#73685c',
        hoof: '#2f2924',
        ear: '#c9b59c',
        tail: '#ebe2d2',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 18,
        shadowRy: 7.1
      }
    },
    pig: {
      family: 'pig',
      scale: 0.9,
      outline: '#4d342f',
      healthColor: '#d2a08e',
      palette: {
        body: '#b87b70',
        bodyLight: '#d79b90',
        flank: '#c98b7f',
        belly: '#e3ab9e',
        head: '#cc9084',
        ear: '#dba496',
        earInner: '#f0b8ad',
        snout: '#e5b0a4',
        snoutDark: '#aa6f64',
        leg: '#8d5b53',
        hoof: '#4a2c28',
        tail: '#b98074',
        eye: '#1a1412'
      },
      anatomy: {
        shadowRx: 17,
        shadowRy: 6.8
      }
    },
    cow: {
      family: 'cow',
      scale: 1.08,
      outline: '#2b241d',
      healthColor: '#d6c9a6',
      palette: {
        body: '#6f5b4a',
        bodyLight: '#d8d0bd',
        flank: '#8e7762',
        head: '#8b7767',
        spot: '#3d3026',
        leg: '#5d4a3b',
        hoof: '#2a211b',
        horn: '#d8c7a0',
        tail: '#ad9988',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 20,
        shadowRy: 7.4
      }
    },
    chicken: {
      family: 'chicken',
      scale: 0.8,
      outline: '#211914',
      healthColor: '#d8c59b',
      palette: {
        body: '#d8c9a5',
        bodyLight: '#eadfbf',
        wing: '#b98b5f',
        tail: '#8a5d3c',
        comb: '#b91c1c',
        beak: '#e8a236',
        leg: '#b58743',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 10,
        shadowRy: 5
      }
    },
    duck: {
      family: 'duck',
      scale: 0.86,
      outline: '#213126',
      healthColor: '#c4d8b3',
      palette: {
        body: '#60765f',
        bodyLight: '#92a388',
        wing: '#435847',
        head: '#526950',
        beak: '#e8a236',
        leg: '#c58a3b',
        tail: '#d7e5cf',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 11,
        shadowRy: 5.1
      }
    },
    turkey: {
      family: 'turkey',
      scale: 1,
      outline: '#2b1b15',
      healthColor: '#d1b394',
      palette: {
        body: '#5a3a2d',
        bodyLight: '#7b5540',
        wing: '#6b4937',
        tail: '#744d3d',
        head: '#a08f84',
        comb: '#c2410c',
        beak: '#c99242',
        leg: '#9b6c37',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 12,
        shadowRy: 5.6
      }
    },
    squirrel: {
      family: 'squirrel',
      scale: 1,
      outline: '#2f2118',
      healthColor: '#c8945c',
      palette: {
        body: '#9b6b3f',
        bodyLight: '#c1915d',
        tail: '#8a5d36',
        tailLight: '#b37b49',
        belly: '#ead0a7',
        leg: '#714a2f',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 10,
        shadowRy: 5
      }
    },
    turtle: {
      family: 'turtle',
      scale: 1,
      outline: '#1f2a19',
      healthColor: '#83a15f',
      palette: {
        shell: '#556b3d',
        shellLight: '#6f8750',
        shellDark: '#415131',
        skin: '#6f8750',
        skinDark: '#4b5f38',
        eye: '#11100e'
      },
      anatomy: {
        shadowRx: 13,
        shadowRy: 5
      }
    },
    bear: { family: 'bear', scale: 1.2, palette: { body: '#4b3a2c', bodyLight: '#7a5f4b' } },
    boar: { family: 'boar', scale: 1.1, palette: { body: '#5c3a2d', bodyLight: '#8a5f4b', snout: '#d1a08f' } },
    fox: { family: 'fox', scale: 0.9, palette: { body: '#b85c2d', bodyLight: '#e08a5f' } },
    lynx: { family: 'lynx', scale: 0.9, palette: { body: '#7a5f4b', bodyLight: '#c9bba6' } },
    cougar: { family: 'cougar', scale: 1, palette: { body: '#8a5f4b', bodyLight: '#c9bba6' } },
    bobcat: { family: 'bobcat', scale: 0.9, palette: { body: '#7a5f4b', bodyLight: '#c9bba6' } },
    mountain_lion: { family: 'mountain_lion', scale: 1, palette: { body: '#8a5f4b', bodyLight: '#c9bba6' } },
    coyote: { family: 'coyote', scale: 0.9, palette: { body: '#8a5f4b', bodyLight: '#c9bba6' } },
    hyena: { family: 'hyena', scale: 0.9, palette: { body: '#7a5f4b', bodyLight: '#c9bba6' } },
    jaguar: { family: 'jaguar', scale: 1, palette: { body: '#9a7244', bodyLight: '#d3a660' } },
    panther: { family: 'panther', scale: 1, palette: { body: '#1f2020', bodyLight: '#3a3a3a' } },
    tiger: { family: 'tiger', scale: 1, palette: { body: '#b85c2d', bodyLight: '#e08a5f' } },
    lion: { family: 'lion', scale: 1, palette: { body: '#b88b54', bodyLight: '#e0c076' } },
    elephant: { family: 'elephant', scale: 1.4, palette: { body: '#5c5f5a', bodyLight: '#8a8f86' } },
    rhino: { family: 'rhino', scale: 1.3, palette: { body: '#5c5f5a', bodyLight: '#8a8f86' } },
    hippo: { family: 'hippo', scale: 1.3, palette: { body: '#5c5f5a', bodyLight: '#8a8f86' } },
    giraffe: { family: 'giraffe', scale: 1.45, palette: { body: '#b88b54', bodyLight: '#e0c9a5' } },
    zebra: { family: 'zebra', scale: 1.18, palette: { body: '#e0e0dc', bodyLight: '#ffffff' } },
    kangaroo: { family: 'kangaroo', scale: 1.08, palette: { body: '#b88b54', bodyLight: '#e0c9a5' } },
    koala: { family: 'koala', scale: 0.92, palette: { body: '#5c5f5a', bodyLight: '#8a8f86' } },
    panda: { family: 'panda', scale: 1, palette: { body: '#f1eee8', bodyLight: '#1f2020' } }
  });

  const generatedColonistClothCycle = ['#8f5f3b', '#596f58', '#6b6478', '#7a5f4b'];

  function seedUnit(seed, salt) {
    return (core.hashText(`${seed}|${salt}`) % 1000) / 999;
  }

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

  function animalVariation(seed, family = 'animal') {
    return {
      earTilt: -0.28 + seedUnit(seed, `${family}:earTilt`) * 0.56,
      headLift: -1.3 + seedUnit(seed, `${family}:headLift`) * 2.6,
      tailLift: -0.45 + seedUnit(seed, `${family}:tailLift`) * 0.9,
      bodyStretch: 0.94 + seedUnit(seed, `${family}:bodyStretch`) * 0.12,
      bodyTall: 0.95 + seedUnit(seed, `${family}:bodyTall`) * 0.12,
      patternShift: -1.4 + seedUnit(seed, `${family}:patternShift`) * 2.8,
      markScale: 0.88 + seedUnit(seed, `${family}:markScale`) * 0.28,
      fluff: 0.88 + seedUnit(seed, `${family}:fluff`) * 0.28,
      gait: -0.8 + seedUnit(seed, `${family}:gait`) * 1.6,
      hornTilt: -0.2 + seedUnit(seed, `${family}:hornTilt`) * 0.4,
      earSpread: 0.85 + seedUnit(seed, `${family}:earSpread`) * 0.35
    };
  }

  function applyLegacyPaletteOverrides(basePalette, appearance = {}) {
    const palette = {
      ...(basePalette || {}),
      ...(appearance.palette || {})
    };

    if (appearance.body) palette.body = appearance.body;
    if (appearance.light) palette.bodyLight = appearance.light;
    if (appearance.wing) palette.wing = appearance.wing;
    if (appearance.beak) palette.beak = appearance.beak;
    if (appearance.comb) palette.comb = appearance.comb;
    if (appearance.face) palette.face = appearance.face;

    return palette;
  }

  function animalProfile(type, pawn = null) {
    const base = animalProfiles[type] || {};
    const appearance = pawn?.appearance || {};
    const seedSource = appearance.seed || pawn?.id || pawn?.name || type;
    const seed = core.hashText(seedSource);
    const palette = applyLegacyPaletteOverrides(base.palette, appearance);
    const anatomy = {
      ...(base.anatomy || {}),
      ...(appearance.anatomy || {})
    };
    const marks = {
      ...(base.marks || {}),
      ...(appearance.marks || {})
    };

    return {
      ...base,
      ...appearance,
      type,
      seed,
      family: appearance.family || base.family || type,
      scale: appearance.scale ?? base.scale ?? 1,
      outline: appearance.outline || base.outline || '#2b241d',
      healthColor: appearance.healthColor || base.healthColor || '#d6a24a',
      palette,
      anatomy,
      marks,
      variation: {
        ...animalVariation(seed, appearance.family || base.family || type),
        ...(base.variation || {}),
        ...(appearance.variation || {})
      },
      body: palette.body || base.body || '#8f8068',
      light: palette.bodyLight || palette.belly || base.light || palette.body || '#c7bba5',
      wing: palette.wing || base.wing || null,
      beak: palette.beak || base.beak || null,
      comb: palette.comb || base.comb || null
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
