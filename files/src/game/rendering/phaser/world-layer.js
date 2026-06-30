'use strict';

(() => {
  class HavenfallPhaserWorldLayer {
    constructor(scene) {
      this.scene = scene;
      this.activeTiles = new Map();
      this.pool = [];
      this.lastBoundsKey = '';
    }

    tileSize() {
      if (typeof getTileSize === 'function') return getTileSize();
      return typeof TILE !== 'undefined' ? TILE : 48;
    }

    tileOverdraw() {
      return typeof TILE_OVERDRAW !== 'undefined' ? TILE_OVERDRAW : 1.4;
    }

    visibleBounds() {
      if (typeof visibleTileBounds === 'function') return visibleTileBounds(3);
      const rows = typeof getWorldRows === 'function' ? getWorldRows() : 1;
      const cols = typeof getWorldCols === 'function' ? getWorldCols() : 1;
      return { startX: 0, startY: 0, endX: Math.max(0, cols - 1), endY: Math.max(0, rows - 1) };
    }

    acquireSprite() {
      const sprite = this.pool.pop() || this.scene.add.image(0, 0, null);
      sprite.setOrigin(0, 0);
      sprite.setDepth(0);
      sprite.setVisible(true);
      return sprite;
    }

    releaseSprite(id, sprite) {
      sprite.setVisible(false);
      sprite.removeData?.('terrainKey');
      this.activeTiles.delete(id);
      this.pool.push(sprite);
    }

    sync(state) {
      if (!state?.terrain?.length) return;

      const bounds = this.visibleBounds();
      const size = this.tileSize();
      const overdraw = this.tileOverdraw();
      const displaySize = size + overdraw * 2;
      const seen = new Set();

      for (let y = bounds.startY; y <= bounds.endY; y++) {
        const row = state.terrain[y];
        if (!row) continue;

        for (let x = bounds.startX; x <= bounds.endX; x++) {
          const terrainType = row[x] || 'grass';
          const id = `${x}:${y}`;
          seen.add(id);

          const texture = window.HavenfallPhaserAssetLoader.ensureTerrainTexture(this.scene, terrainType);
          let sprite = this.activeTiles.get(id);
          if (!sprite) {
            sprite = this.acquireSprite();
            this.activeTiles.set(id, sprite);
          }

          if (sprite.texture?.key !== texture) sprite.setTexture(texture);
          sprite.setPosition(x * size - overdraw, y * size - overdraw);
          sprite.setDisplaySize(displaySize, displaySize);
          sprite.setVisible(true);
        }
      }

      for (const [id, sprite] of [...this.activeTiles.entries()]) {
        if (!seen.has(id)) this.releaseSprite(id, sprite);
      }

      this.lastBoundsKey = `${bounds.startX},${bounds.startY},${bounds.endX},${bounds.endY}`;
      window.HavenfallPhaserStats = {
        version: 'phaser-world-layer-v1',
        activeTiles: this.activeTiles.size,
        pooledTiles: this.pool.length,
        bounds: { ...bounds },
        updatedAt: Date.now()
      };
    }
  }

  window.HavenfallPhaserWorldLayer = HavenfallPhaserWorldLayer;
})();
