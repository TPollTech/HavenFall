'use strict';

(() => {
  class HavenfallPhaserScene extends Phaser.Scene {
    constructor() {
      super({ key: 'HavenfallPhaserScene' });
      this.worldLayer = null;
      this.lastState = null;
    }

    create() {
      window.HavenfallPhaserAssetLoader?.ensureAllTerrainTextures?.(this);
      this.worldLayer = new window.HavenfallPhaserWorldLayer(this);
      this.cameras.main.setRoundPixels(false);
      window.HavenfallPhaser?._registerScene?.(this);
    }

    syncState(nextState) {
      this.lastState = nextState;
      this.syncCamera();
      this.worldLayer?.sync(nextState);
    }

    syncCamera() {
      const scale = Number(viewTransform?.scale || camera?.zoom || 1) || 1;
      const width = Number(canvas?.width || window.innerWidth || 800);
      const height = Number(canvas?.height || window.innerHeight || 600);
      const scrollX = -Number(viewTransform?.offsetX || 0) / scale;
      const scrollY = -Number(viewTransform?.offsetY || 0) / scale;

      const cam = this.cameras.main;
      cam.setViewport(0, 0, width, height);
      cam.setZoom(scale);
      cam.setScroll(scrollX, scrollY);
    }
  }

  window.HavenfallPhaserScene = HavenfallPhaserScene;
})();
