'use strict';

(() => {
  const animations = window.HavenfallAssets?.animations;
  if (!animations) return;

  const campfireAnimation = {
    key: 'campfire',
    path: 'assets/vfx/campfire_fire_sheet.svg',
    source: 'assets/vfx/campfire_fire_sheet.svg',
    frameWidth: 96,
    frameHeight: 96,
    frames: 6,
    frameDelaysMs: [115, 115, 115, 115, 115, 115],
    layout: 'horizontal'
  };

  const torchAnimation = {
    key: 'weapon_torch',
    path: 'assets/vfx/torch_fire_sheet.svg',
    source: 'assets/vfx/torch_fire_sheet.svg',
    frameWidth: 64,
    frameHeight: 96,
    frames: 6,
    frameDelaysMs: [95, 95, 95, 95, 95, 95],
    layout: 'horizontal'
  };

  animations.campfire = animations.campfire || campfireAnimation;
  animations.edificios_campfire = animations.edificios_campfire || { ...campfireAnimation, key: 'campfire' };
  animations.stove = animations.stove || { ...campfireAnimation, key: 'campfire', frameDelaysMs: [140, 140, 140, 140, 140, 140] };
  animations.edificios_stove = animations.edificios_stove || { ...campfireAnimation, key: 'campfire', frameDelaysMs: [140, 140, 140, 140, 140, 140] };

  animations.weapon_torch = animations.weapon_torch || torchAnimation;
  animations.torch = animations.torch || { ...torchAnimation, key: 'weapon_torch' };
  animations.ferramentas_torch = animations.ferramentas_torch || { ...torchAnimation, key: 'weapon_torch' };
})();
