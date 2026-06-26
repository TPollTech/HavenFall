'use strict';

function newGame() {
  writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
  newGameConfig = readNewGameConfig();
  generateColonistCandidates(newGameConfig);
  setScreen(SCREEN.COLONIST_SELECT);
}

function showModal(title, text, button) {
  dom.modal.querySelector('h1').textContent = title;
  dom.modal.querySelector('p').innerHTML = text;
  dom.modal.querySelector('button').textContent = button;
  dom.modal.classList.add('show');
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updateWorld(dt);
  if (typeof updateEnvironmentTick === 'function') updateEnvironmentTick(dt);
  if (typeof updateClimateAdvancedTick === 'function') updateClimateAdvancedTick(dt);
  if (typeof updateDefenseTick === 'function') updateDefenseTick(dt);
  if (typeof updateHaulingAdvTick === 'function') updateHaulingAdvTick(dt);
  if (typeof updateWorkbenchToolsTick === 'function') updateWorkbenchToolsTick(dt);
  if (typeof updateMobsTick === 'function') updateMobsTick(dt);
  if (typeof updateZonesTick === 'function') updateZonesTick(dt);
  if (window.BuildingRoofSystem?.update) window.BuildingRoofSystem.update(dt);
  updateCamera(dt);
  if (state && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) draw();
  uiTimer += dt;
  autosaveTimer += dt;
  if (state && uiTimer > 0.25) { uiTimer = 0; updateUI(); }
  if (state && settings.autosave !== 'off' && appScreen === SCREEN.PLAYING && autosaveTimer > 15) { autosaveTimer = 0; saveGame(false); }
  requestAnimationFrame(gameLoop);
}
