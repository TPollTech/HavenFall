'use strict';

function installCraftingWallFixPatch() {
  window.havenfallWallOrientation = window.havenfallWallOrientation || 'horizontal';

  function injectCraftingWallStyles() {
    if (document.getElementById('craftingWallFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'craftingWallFixStyles';
    style.textContent = `
      #craftingPanel.active {
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        gap: 7px;
        overflow: hidden;
        padding-top: 8px;
      }
      #craftingPanel .panel-title-row,
      #craftingPanel #craftingInfo {
        display: none !important;
      }
      #craftingPanel #recipeGrid {
        min-height: 0;
        max-height: 128px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 4px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 7px;
      }
      #craftingPanel .recipe-card {
        min-height: 76px;
        padding: 8px;
        gap: 3px;
      }
      #craftingPanel .recipe-card img {
        width: 28px;
        height: 28px;
      }
      #craftingPanel .recipe-card small,
      #craftingPanel .recipe-card em {
        font-size: 10px;
        line-height: 1.15;
      }
      #craftingPanel #inventoryInfo {
        max-height: 52px;
        overflow: hidden;
        border-top: 1px solid rgba(255,255,255,.08);
        padding-top: 5px;
      }
      #craftingPanel #inventoryInfo h3 {
        display: none;
      }
      #craftingPanel .item-strip {
        max-height: 44px;
        overflow: hidden;
        gap: 5px;
      }
      #craftingPanel .item-pill {
        padding: 4px 7px;
        min-height: 30px;
        font-size: 11px;
      }
      #craftingPanel .item-pill img {
        width: 18px;
        height: 18px;
      }
      .wall-rotate-btn {
        min-height: 28px;
        padding: 5px 11px;
        border-radius: 999px;
        border-color: rgba(244,179,80,.46) !important;
        color: #f4d18a !important;
      }
      .wall-orientation-pill strong {
        letter-spacing: .02em;
      }
    `;
    document.head.appendChild(style);
  }

  function setWallOrientation(next, shouldLog = true) {
    window.havenfallWallOrientation = next === 'vertical' ? 'vertical' : 'horizontal';
    if (shouldLog && state) {
      log(`Parede: ${window.havenfallWallOrientation === 'vertical' ? 'vertical' : 'horizontal'}.`);
    }
    updateUI(true);
  }

  function toggleWallOrientationFix() {
    setWallOrientation(window.havenfallWallOrientation === 'horizontal' ? 'vertical' : 'horizontal');
  }

  function installWallRotateButton() {
    const row = document.querySelector('#buildPanel .panel-title-row');
    if (!row || document.getElementById('rotateWallBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'rotateWallBtn';
    btn.type = 'button';
    btn.className = 'secondary wall-rotate-btn';
    btn.textContent = 'Rotacionar parede (R)';
    btn.addEventListener('click', () => {
      if (currentBuild !== 'wall') currentBuild = 'wall';
      toggleWallOrientationFix();
    });
    row.appendChild(btn);
  }

  function wallOrientationLabel() {
    return window.havenfallWallOrientation === 'vertical' ? 'vertical' : 'horizontal';
  }

  function drawProceduralWall(cx, cy, orientation, alpha = 1) {
    const vertical = orientation === 'vertical';
    const w = vertical ? 18 : 42;
    const h = vertical ? 42 : 18;
    const x = cx - w / 2;
    const y = cy - h / 2;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = '#4d4f50';
    ctx.strokeStyle = '#202224';
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 5, true, true);

    const stones = vertical
      ? [[x + 3, y + 4, 12, 9], [x + 3, y + 15, 12, 9], [x + 3, y + 27, 12, 10]]
      : [[x + 4, y + 3, 10, 12], [x + 16, y + 3, 10, 12], [x + 28, y + 3, 10, 12]];

    ctx.lineWidth = 1;
    for (const [sx, sy, sw, sh] of stones) {
      ctx.fillStyle = '#686a68';
      ctx.strokeStyle = 'rgba(20,22,24,.72)';
      roundRect(sx, sy, sw, sh, 3, true, true);
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.fillRect(sx + 2, sy + 2, Math.max(3, sw - 5), 1);
    }

    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(cx - 6, y + 7); ctx.lineTo(cx + 3, y + 15);
      ctx.moveTo(cx + 5, y + 23); ctx.lineTo(cx - 4, y + 31);
    } else {
      ctx.moveTo(x + 8, cy - 4); ctx.lineTo(x + 16, cy + 4);
      ctx.moveTo(x + 25, cy + 4); ctx.lineTo(x + 34, cy - 4);
    }
    ctx.stroke();
    ctx.restore();
  }

  function syncPlacedWallOrientation(buildKey, x, y, beforeCount) {
    if (buildKey !== 'wall' || !state?.objects || state.objects.length <= beforeCount) return;
    const placed = [...state.objects].reverse().find(o => o.type === 'blueprint' && o.buildType === 'wall' && o.x === x && o.y === y);
    if (!placed) return;
    placed.orientation = wallOrientationLabel();
    placed.rotation = placed.orientation === 'vertical' ? 90 : 0;
    placed.assetMode = 'procedural-wall';
  }

  const previousPlaceBlueprint = placeBlueprint;
  placeBlueprint = function fixedWallPlaceBlueprint(buildKey, x, y) {
    const before = state?.objects?.length || 0;
    previousPlaceBlueprint(buildKey, x, y);
    syncPlacedWallOrientation(buildKey, x, y, before);
  };

  const previousDrawObject = drawObject;
  drawObject = function fixedWallDrawObject(obj) {
    const isWall = obj?.type === 'wall' || (obj?.type === 'blueprint' && obj?.buildType === 'wall');
    if (!isWall) return previousDrawObject(obj);

    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2 + 14;
    const orientation = obj.orientation === 'vertical' || obj.rotation === 90 ? 'vertical' : 'horizontal';
    const isBlueprint = obj.type === 'blueprint';
    drawProceduralWall(cx, cy, orientation, isBlueprint ? 0.48 : 1);
    if (isBlueprint) {
      drawProgress(cx, obj.y * TILE + 8, (obj.progress || 0) / buildDefs[obj.buildType].work, '#9bd36a');
    }
  };

  const previousDrawBuildPreview = drawBuildPreview;
  drawBuildPreview = function fixedWallDrawBuildPreview() {
    if (currentBuild !== 'wall') return previousDrawBuildPreview();
    if (!mouseTile || !isInside(mouseTile.x, mouseTile.y)) return;
    const can = canPlace('wall', mouseTile.x, mouseTile.y);
    const cx = mouseTile.x * TILE + TILE / 2;
    const cy = mouseTile.y * TILE + TILE / 2 + 14;
    drawProceduralWall(cx, cy, wallOrientationLabel(), can ? 0.58 : 0.26);
  };

  function compactCraftingLabels() {
    const title = document.querySelector('#craftingPanel h2');
    if (title) title.textContent = 'Crafting';
    const hint = document.querySelector('#craftingPanel .panel-hint');
    if (hint) hint.textContent = '';
  }

  function updateWallStatusLine() {
    installWallRotateButton();
    if (!dom.buildStatus || currentBuild !== 'wall') return;
    const label = wallOrientationLabel();
    dom.buildStatus.innerHTML = `Parede selecionada <span class="wall-orientation-pill"><strong>R</strong> ${label}</span>`;
  }

  const previousUpdateUI = updateUI;
  updateUI = function fixedCraftingWallUpdateUI(force = false) {
    previousUpdateUI(force);
    compactCraftingLabels();
    installWallRotateButton();
    updateWallStatusLine();
  };

  window.addEventListener('keydown', e => {
    if (appScreen !== SCREEN.PLAYING || currentBuild !== 'wall') return;
    if (e.code !== 'KeyR') return;
    e.preventDefault();
    e.stopPropagation();
    toggleWallOrientationFix();
  }, true);

  injectCraftingWallStyles();
}
