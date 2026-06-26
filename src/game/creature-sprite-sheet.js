'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};

  const RAW_CREATURE_SHEET = 'assets/raw/creature_sprite_sheet_with_various_animals.png';
  const SOURCE_SIZE = { w: 1254, h: 1254 };

  const CREATURE_FRAMES = Object.freeze({
    rabbit: {
      front: [52, 506, 62, 116],
      back: [181, 506, 61, 115],
      walk: [
        [314, 519, 97, 106],
        [461, 522, 110, 101],
        [619, 522, 109, 101],
        [768, 522, 102, 103],
        [938, 520, 98, 103]
      ],
      dead: [1094, 565, 118, 71]
    },
    spider: {
      front: [17, 912, 131, 184],
      back: [152, 914, 119, 193],
      walk: [
        [284, 966, 149, 139],
        [436, 966, 147, 138],
        [590, 965, 148, 139],
        [739, 967, 149, 138],
        [914, 966, 152, 139]
      ],
      dead: [1059, 1036, 183, 117]
    }
  });

  function isRawSheetBackground(r, g, b) {
    return r > 195 && g > 195 && b > 195 && Math.max(r, g, b) - Math.min(r, g, b) < 24;
  }

  function sliceFrame(sheet, rect, key) {
    const scaleX = sheet.naturalWidth / SOURCE_SIZE.w;
    const scaleY = sheet.naturalHeight / SOURCE_SIZE.h;
    const sx = Math.max(0, Math.floor(rect[0] * scaleX));
    const sy = Math.max(0, Math.floor(rect[1] * scaleY));
    const sw = Math.max(1, Math.ceil(rect[2] * scaleX));
    const sh = Math.max(1, Math.ceil(rect[3] * scaleY));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const frameCtx = canvas.getContext('2d');
    frameCtx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);

    const imageData = frameCtx.getImageData(0, 0, sw, sh);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (isRawSheetBackground(data[i], data[i + 1], data[i + 2])) data[i + 3] = 0;
    }
    frameCtx.putImageData(imageData, 0, 0);
    canvas.dataset.spriteKey = key;
    return canvas;
  }

  function installCreatureFrames(sheet) {
    Object.entries(CREATURE_FRAMES).forEach(([creature, def]) => {
      images[`${creature}_front`] = sliceFrame(sheet, def.front, `${creature}_front`);
      images[`${creature}_back`] = sliceFrame(sheet, def.back, `${creature}_back`);
      def.walk.forEach((rect, i) => {
        images[`${creature}_walk_${i}`] = sliceFrame(sheet, rect, `${creature}_walk_${i}`);
      });
      images[`${creature}_dead`] = sliceFrame(sheet, def.dead, `${creature}_dead`);
    });

    window.HavenfallContext.creatureSpriteSheetLoaded = true;
    window.HavenfallContext.creatureSpriteFrameCount = Object.keys(images).filter(key => key.startsWith('rabbit_') || key.startsWith('spider_')).length;
  }

  function loadCreatureSheet() {
    if (window.HavenfallContext.creatureSpriteSheetLoading) return;
    window.HavenfallContext.creatureSpriteSheetLoading = true;
    const sheet = new Image();
    sheet.onload = () => installCreatureFrames(sheet);
    sheet.onerror = () => {
      window.HavenfallContext.creatureSpriteSheetLoaded = false;
      console.warn('[Assets] Não foi possível carregar a sheet de criaturas:', RAW_CREATURE_SHEET);
    };
    sheet.src = RAW_CREATURE_SHEET;
  }

  loadCreatureSheet();
})();
