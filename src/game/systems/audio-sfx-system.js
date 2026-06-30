'use strict';

(() => {
  if (window.HavenfallAudio?.version === 'work-sfx-v2') return;

  const AUDIO_VERSION = 'work-sfx-v2';
  const MASTER_VOLUME = 0.72;
  const SFX_VOLUME = 0.82;
  const AMBIENT_VOLUME = 0.38;
  const MIN_REPEAT_MS = 70;

  const RAIN_LAYERS = Object.freeze([
    { name: 'rain-body', duration: 5.3, type: 'lowpass', frequency: 720, q: 0.45, gain: 0.105, rate: 0.92 },
    { name: 'rain-sheet', duration: 3.7, type: 'bandpass', frequency: 1450, q: 0.72, gain: 0.075, rate: 1.04 },
    { name: 'rain-hiss', duration: 4.6, type: 'highpass', frequency: 2400, q: 0.38, gain: 0.035, rate: 1.12 },
    { name: 'rain-near-drops', duration: 2.9, type: 'bandpass', frequency: 3600, q: 2.4, gain: 0.025, rate: 0.98 }
  ]);

  const audioState = {
    ctx: null,
    master: null,
    sfx: null,
    ambient: null,
    noiseBuffers: new Map(),
    unlocked: false,
    lastPlayed: new Map(),
    rain: null,
    rainModTimer: 0,
    rainDropTimer: 1.2,
    thunderCooldown: 8
  };

  function nowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getAudioContextCtor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function ensureContext() {
    if (audioState.ctx) return audioState.ctx;
    const AudioCtor = getAudioContextCtor();
    if (!AudioCtor) return null;

    const ctx = new AudioCtor();
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    const ambient = ctx.createGain();

    master.gain.value = MASTER_VOLUME;
    sfx.gain.value = SFX_VOLUME;
    ambient.gain.value = AMBIENT_VOLUME;

    sfx.connect(master);
    ambient.connect(master);
    master.connect(ctx.destination);

    audioState.ctx = ctx;
    audioState.master = master;
    audioState.sfx = sfx;
    audioState.ambient = ambient;
    return ctx;
  }

  function unlockAudio() {
    const ctx = ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    audioState.unlocked = true;
    return true;
  }

  function installUnlockListeners() {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  function isAudioMuted() {
    const currentSettings = typeof settings !== 'undefined' ? settings : null;
    return currentSettings?.audio === 'off' || !!currentSettings?.muteAudio;
  }

  function audioReady() {
    const ctx = ensureContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function shouldPlay(key, cooldownMs = MIN_REPEAT_MS) {
    const now = nowMs();
    const last = audioState.lastPlayed.get(key) || 0;
    if (now - last < cooldownMs) return false;
    audioState.lastPlayed.set(key, now);
    return true;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function noiseBuffer(duration = 0.18, mode = 'decay') {
    const ctx = audioReady();
    if (!ctx) return null;
    const key = `${mode}:${Math.round(duration * 1000)}`;
    if (audioState.noiseBuffers.has(key)) return audioState.noiseBuffers.get(key);

    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let smooth = 0;

    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      smooth = smooth * 0.986 + white * 0.014;
      const loopTexture = white * 0.62 + smooth * 0.82;
      data[i] = mode === 'loop'
        ? loopTexture * 0.72
        : white * Math.pow(1 - t, 1.6);
    }

    if (mode === 'loop') {
      const fade = Math.min(Math.floor(ctx.sampleRate * 0.045), Math.floor(length / 3));
      for (let i = 0; i < fade; i++) {
        const a = i / fade;
        const start = data[i];
        const end = data[length - fade + i];
        const blended = start * a + end * (1 - a);
        data[i] = blended;
        data[length - fade + i] = blended;
      }
    }

    audioState.noiseBuffers.set(key, buffer);
    return buffer;
  }

  function connectWithEnvelope(node, destination, startAt, duration, gainValue, attack = 0.008, release = 0.08) {
    const ctx = audioReady();
    if (!ctx) return null;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(attack + release, duration));
    node.connect(gain);
    gain.connect(destination || audioState.sfx);
    return gain;
  }

  function playFilteredNoise({ key, duration = 0.18, gain = 0.28, frequency = 900, q = 0.8, type = 'bandpass', cooldownMs = 70, destination = null, delay = 0, attack = 0.006, release = null } = {}) {
    if (key && !shouldPlay(key, cooldownMs)) return;
    const ctx = audioReady();
    const buffer = noiseBuffer(duration, 'decay');
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const startAt = ctx.currentTime + Math.max(0, delay);
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.value = frequency * randomBetween(0.88, 1.12);
    filter.Q.value = q;
    source.connect(filter);
    connectWithEnvelope(filter, destination || audioState.sfx, startAt, duration, gain, attack, release ?? duration * 0.45);
    source.start(startAt);
    source.stop(startAt + duration + 0.04);
  }

  function playTone({ frequency = 220, endFrequency = null, duration = 0.12, gain = 0.12, type = 'sine', destination = null, delay = 0 } = {}) {
    const ctx = audioReady();
    if (!ctx) return;

    const startAt = ctx.currentTime + Math.max(0, delay);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startAt);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startAt + duration);
    connectWithEnvelope(osc, destination || audioState.sfx, startAt, duration, gain, 0.004, duration * 0.6);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.04);
  }

  function playStoneHit(detail = {}) {
    const ore = detail.rockType === 'iron' || detail.resource === 'metal' || detail.kind === 'ore';
    playFilteredNoise({ key: 'stone-hit', duration: 0.14, gain: ore ? 0.26 : 0.22, frequency: ore ? 1250 : 760, q: ore ? 1.6 : 1.1, cooldownMs: 95 });
    playTone({ frequency: ore ? randomBetween(520, 760) : randomBetween(180, 260), endFrequency: ore ? 360 : 95, duration: ore ? 0.16 : 0.11, gain: ore ? 0.075 : 0.055, type: ore ? 'triangle' : 'sine' });
  }

  function playRockBreak(detail = {}) {
    playFilteredNoise({ key: 'rock-break', duration: 0.34, gain: 0.4, frequency: detail.resource === 'metal' ? 980 : 520, q: 0.65, type: 'lowpass', cooldownMs: 180 });
    playTone({ frequency: 120, endFrequency: 48, duration: 0.24, gain: 0.13, type: 'sawtooth' });
    if (detail.resource === 'metal') playTone({ frequency: 690, endFrequency: 420, duration: 0.18, gain: 0.065, type: 'triangle' });
  }

  function playWoodChop() {
    playFilteredNoise({ key: 'wood-chop', duration: 0.11, gain: 0.24, frequency: 430, q: 0.9, type: 'bandpass', cooldownMs: 90 });
    playTone({ frequency: randomBetween(150, 210), endFrequency: 85, duration: 0.10, gain: 0.08, type: 'triangle' });
  }

  function playWoodBreak() {
    playFilteredNoise({ key: 'wood-break', duration: 0.26, gain: 0.36, frequency: 650, q: 0.7, type: 'bandpass', cooldownMs: 160 });
    playTone({ frequency: 210, endFrequency: 70, duration: 0.18, gain: 0.08, type: 'square' });
  }

  function playScrapHit() {
    playFilteredNoise({ key: 'scrap-hit', duration: 0.12, gain: 0.2, frequency: 1500, q: 2.2, cooldownMs: 80 });
    playTone({ frequency: randomBetween(720, 980), endFrequency: 420, duration: 0.10, gain: 0.055, type: 'triangle' });
  }

  function playResearchPageTurn() {
    if (!shouldPlay('research-page-turn', 360)) return;
    playFilteredNoise({ duration: 0.22, gain: 0.085, frequency: randomBetween(620, 940), q: 0.55, type: 'bandpass', cooldownMs: 0, attack: 0.012, release: 0.16 });
    playFilteredNoise({ duration: 0.085, gain: 0.052, frequency: randomBetween(1550, 2300), q: 1.35, type: 'bandpass', cooldownMs: 0, delay: 0.055, attack: 0.004, release: 0.045 });
    playFilteredNoise({ duration: 0.045, gain: 0.03, frequency: randomBetween(2600, 4200), q: 1.9, type: 'highpass', cooldownMs: 0, delay: 0.115, attack: 0.003, release: 0.03 });
  }

  function playSoftWork(kind) {
    const key = `soft-${kind}`;
    playFilteredNoise({ key, duration: 0.08, gain: 0.12, frequency: 900, q: 1.2, cooldownMs: 120 });
  }

  function playWorkImpact(kind, detail = {}) {
    if (isAudioMuted()) return;
    if (!audioReady()) return;

    const normalized = String(kind || '').toLowerCase();
    if (normalized === 'mine' || normalized === 'stone' || normalized === 'ore') return playStoneHit(detail);
    if (normalized === 'wood' || normalized === 'tree' || normalized === 'gather-wood') return playWoodChop();
    if (normalized === 'scrap' || normalized === 'metal' || normalized === 'forge') return playScrapHit();
    if (normalized === 'research') return playResearchPageTurn();
    if (normalized === 'build') return playSoftWork('build');
    if (normalized === 'craft' || normalized === 'cook' || normalized === 'heal') return playSoftWork(normalized);
    playSoftWork('generic');
  }

  function playWorkComplete(kind, detail = {}) {
    if (isAudioMuted()) return;
    const normalized = String(kind || '').toLowerCase();
    if (normalized === 'mine' || normalized === 'stone' || normalized === 'ore') return playRockBreak(detail);
    if (normalized === 'wood' || normalized === 'tree' || normalized === 'gather-wood') return playWoodBreak();
    if (normalized === 'scrap' || normalized === 'metal') return playScrapHit();
    if (normalized === 'research') return playResearchPageTurn();
    playTone({ frequency: 440, endFrequency: 620, duration: 0.10, gain: 0.055, type: 'triangle' });
  }

  function createRainLayer(definition) {
    const ctx = audioReady();
    const buffer = noiseBuffer(definition.duration, 'loop');
    if (!ctx || !buffer) return null;

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = definition.rate * randomBetween(0.96, 1.04);
    filter.type = definition.type;
    filter.frequency.value = definition.frequency;
    filter.Q.value = definition.q;
    gain.gain.value = 0.0001;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioState.ambient);
    source.start();
    return { ...definition, source, filter, gain, target: 0 };
  }

  function createRainLoop() {
    const ctx = audioReady();
    if (!ctx || audioState.rain) return audioState.rain;

    const layers = RAIN_LAYERS.map(createRainLayer).filter(Boolean);
    if (!layers.length) return null;

    audioState.rain = { layers, target: 0 };
    return audioState.rain;
  }

  function setRainActive(active, intensity = 1) {
    if (isAudioMuted()) active = false;
    const ctx = active ? audioReady() : audioState.ctx;
    if (!ctx) return;

    const rain = active ? createRainLoop() : audioState.rain;
    if (!rain?.layers?.length) return;

    const target = active ? clampValue(0.72 + intensity * 0.33, 0.72, 1.12) : 0;
    rain.target = target;
    for (const layer of rain.layers) {
      layer.target = Math.max(0.0001, layer.gain ? layer.gain.gain.value : 0.0001);
      const next = active ? Math.max(0.0001, layer.gain * target) : 0.0001;
      layer.gain.gain.cancelScheduledValues(ctx.currentTime);
      layer.gain.gain.setTargetAtTime(next, ctx.currentTime, active ? 0.75 : 0.42);
    }
  }

  function modulateRainLayers(dt) {
    const rain = audioState.rain;
    if (!rain?.layers?.length || rain.target <= 0) return;
    audioState.rainModTimer -= Math.max(0, dt || 0);
    if (audioState.rainModTimer > 0) return;
    audioState.rainModTimer = randomBetween(0.28, 0.52);

    const ctx = audioState.ctx;
    if (!ctx) return;
    for (const layer of rain.layers) {
      const movement = 0.88 + Math.random() * 0.24;
      const next = Math.max(0.0001, layer.gain * rain.target * movement);
      layer.gain.gain.setTargetAtTime(next, ctx.currentTime, 0.35);
    }
  }

  function playRainCloseDrop() {
    if (!shouldPlay('rain-close-drop', 155)) return;
    playFilteredNoise({ duration: 0.045, gain: 0.026, frequency: randomBetween(2600, 4400), q: 2.8, type: 'bandpass', destination: audioState.ambient, cooldownMs: 0, attack: 0.002, release: 0.026 });
    if (Math.random() < 0.34) playTone({ frequency: randomBetween(760, 1180), endFrequency: randomBetween(420, 620), duration: 0.055, gain: 0.012, type: 'triangle', destination: audioState.ambient });
  }

  function tickRainDrops(dt) {
    audioState.rainDropTimer -= Math.max(0, dt || 0);
    if (audioState.rainDropTimer > 0) return;
    audioState.rainDropTimer = randomBetween(0.18, 0.55);
    if (Math.random() < 0.78) playRainCloseDrop();
  }

  function playThunder() {
    if (!shouldPlay('thunder', 2500)) return;
    playFilteredNoise({ key: 'thunder-noise', duration: 1.2, gain: 0.23, frequency: 130, q: 0.5, type: 'lowpass', cooldownMs: 0, destination: audioState.ambient });
    playTone({ frequency: 65, endFrequency: 28, duration: 0.95, gain: 0.18, type: 'sawtooth', destination: audioState.ambient });
  }

  function tickWeatherAudio(dt) {
    if (!state || appScreen !== SCREEN.PLAYING || state.isPreview === true || state.runtimeMode === 'menu-preview') {
      setRainActive(false);
      return;
    }

    const raining = state.weather === 'chuva';
    setRainActive(raining, raining ? 1 : 0);
    if (!raining) return;

    modulateRainLayers(dt);
    tickRainDrops(dt);

    audioState.thunderCooldown -= Math.max(0, dt || 0);
    if (audioState.thunderCooldown <= 0) {
      audioState.thunderCooldown = randomBetween(14, 32);
      if (Math.random() < 0.32) playThunder();
    }
  }

  installUnlockListeners();

  window.HavenfallAudio = {
    version: AUDIO_VERSION,
    unlock: unlockAudio,
    playWorkImpact,
    playWorkComplete,
    setRainActive,
    tickWeatherAudio,
    isReady: () => !!audioState.ctx && audioState.ctx.state !== 'closed'
  };

  window.GameSystems?.registerTick('audio:weather-ambience', tickWeatherAudio, { order: 86, intervalMs: 180, type: 'audio' });
})();
