'use strict';

function installUiSpriteCleanupPatch() {
  const cleanSpriteSources = {};

  function shouldCleanSprite(name) {
    return /^weapon_/.test(name) || /^tool_/.test(name) || /^res_/.test(name) || name === 'toolkit';
  }

  function originalSpritePath(name) {
    return `assets/sprites/${name}.png`;
  }

  window.spriteSrc = function spriteSrc(name) {
    return cleanSpriteSources[name] || originalSpritePath(name);
  };

  function createCleanSpriteUrl(img) {
    if (!img || !img.complete || !img.width || !img.height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ictx = canvas.getContext('2d');
    ictx.drawImage(img, 0, 0);

    let data;
    try { data = ictx.getImageData(0, 0, canvas.width, canvas.height); }
    catch (_) { return null; }

    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      const lightChecker = r > 214 && g > 214 && b > 214;
      const neutralChecker = max > 185 && max - min < 24;
      const paleChecker = r > 165 && g > 165 && b > 165 && max - min < 34;
      const magentaKey = r > 180 && b > 180 && g < 120;

      if (lightChecker || neutralChecker || paleChecker || magentaKey) px[i + 3] = 0;
    }

    ictx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  }

  const previousLoadImages = loadImages;
  loadImages = function cleanUiSpritesBeforeBoot() {
    return previousLoadImages().then(() => {
      const jobs = assetNames.filter(shouldCleanSprite).map(name => new Promise(resolve => {
        const cleanUrl = createCleanSpriteUrl(images[name]);
        if (!cleanUrl) { resolve(); return; }

        cleanSpriteSources[name] = cleanUrl;

        const cleanImg = new Image();
        cleanImg.onload = () => {
          images[name] = cleanImg;
          resolve();
        };
        cleanImg.onerror = () => resolve();
        cleanImg.src = cleanUrl;
      }));

      return Promise.all(jobs).then(() => undefined);
    });
  };
}
