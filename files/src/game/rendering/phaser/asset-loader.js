'use strict';

(() => {
  const TERRAIN_TYPES = Object.freeze(['grass', 'dirt', 'sand', 'stone', 'water']);
  const TERRAIN_COLORS = Object.freeze({
    grass: 0x586d2d,
    dirt: 0x7a5738,
    sand: 0xaa914f,
    stone: 0x626966,
    water: 0x1f6f88
  });

  function tileSize() {
    if (typeof getTileSize === 'function') return getTileSize();
    return typeof TILE !== 'undefined' ? TILE : 48;
  }

  function normalizeTerrain(type) {
    const value = String(type || 'grass').toLowerCase();
    return TERRAIN_COLORS[value] ? value : 'grass';
  }

  function textureKey(type) {
    return `hf_tile_${normalizeTerrain(type)}`;
  }

  function sourceImageFor(type) {
    const key = `tile_${normalizeTerrain(type)}`;
    const imageMap = typeof images !== 'undefined' ? images : null;
    const img = imageMap?.[key] || (type === 'water' ? null : imageMap?.tile_grass);
    if (!img || img.dataset?.missingAsset) return null;
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    return width > 1 && height > 1 ? img : null;
  }

  function ensureFallbackTexture(scene, type) {
    const key = textureKey(type);
    if (scene.textures.exists(key)) return key;

    const size = tileSize();
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(TERRAIN_COLORS[normalizeTerrain(type)] || TERRAIN_COLORS.grass, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.lineStyle(1, 0x000000, 0.12);
    graphics.strokeRect(0, 0, size, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
    return key;
  }

  function ensureTerrainTexture(scene, type) {
    const key = textureKey(type);
    if (scene.textures.exists(key)) return key;

    const img = sourceImageFor(type);
    if (img) {
      try {
        scene.textures.addImage(key, img);
        return key;
      } catch (err) {
        console.warn(`[Phaser V1] Falha ao registrar textura ${key}. Usando fallback.`, err);
      }
    }

    return ensureFallbackTexture(scene, type);
  }

  function ensureAllTerrainTextures(scene) {
    for (const type of TERRAIN_TYPES) ensureTerrainTexture(scene, type);
  }

  window.HavenfallPhaserAssetLoader = Object.freeze({
    version: 'phaser-asset-loader-v1',
    TERRAIN_TYPES,
    TERRAIN_COLORS,
    normalizeTerrain,
    textureKey,
    ensureTerrainTexture,
    ensureAllTerrainTextures
  });
})();
