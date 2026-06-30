'use strict';

(() => {
  if (window.HavenfallAudio?.version === 'work-sfx-v1') return;

  const AUDIO_VERSION = 'work-sfx-v1';
  const MASTER_VOLUME = 0.72;
  const SFX_VOLUME = 0.82;
  const AMBIENT_VOLUME = 0.38;
  const MIN_REPEAT_MS = 70;

  const audioState = {
    ctx: null,
    master: null,
    sfx: null,
    ambient: null,
    noiseBuffers: new Map(),
    unlocked: false,
    lastPlayed: new Map(),
    rain: null,
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

  function noiseBuffer(duration = 0.18) {
    const ctx = audioReady();
    if (!ctx) return null;
    const key = Math.round(duration * 1000);
    if (audioState.noiseBuffers.has(key)) return audioState.noiseBuffers.get(key);

    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.6);
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

  function playFilteredNoise({ key, duration = 0.18, gain = 0.28, frequency = 900, q = 0.8, type = 'bandpass', cooldownMs = 70 } = {}) {
    if (key && !shouldPlay(key, cooldownMs)) return;
    const ctx = audioReady();
    const buffer = noiseBuffer(duration);
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.value = frequency * randomBetween(0.88, 1.12);
    filter.Q.value = q;
    source.connect(filter);
    connectWithEnvelope(filter, audioState.sfx, ctx.currentTime, duration, gain, 0.006, duration * 0.45);
    source.start();
    source.stop(ctx.currentTime + duration + 0.04);
  }

  function playTone({ frequency = 220, endFrequency = null, duration = 0.12, gain = 0.12, type = 'sine', destination = null } = {}) {
    const ctx = audioReady();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), ctx.currentTime + duration);
    connectWithEnvelope(osc, destination || audioState.sfx, ctx.currentTime, duration, gain, 0.004, duration * 0.6);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.04);
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

  function playSoftWork(kind) {
    const key = `soft-${kind}`;
    playFilteredNoise({ key, duration: 0.08, gain: 0.12, frequency: kind === 'research' ? 1750 : 900, q: 1.2, cooldownMs: 120 });
  }

  function playWorkImpact(kind, detail = {}) {
    if (isAudioMuted()) return;
    if (!audioReady()) return;

    const normalized = String(kind || '').toLowerCase();
    if (normalized === 'mine' || normalized === 'stone' || normalized === 'ore') return playStoneHit(detail);
    if (normalized === 'wood' || normalized === 'tree' || normalized === 'gather-wood') return playWoodChop();
    if (normalized === 'scrap' || normalized === 'metal' || normalized === 'forge') return playScrapHit();
    if (normalized === 'build') return playSoftWork('build');
    if (normalized === 'craft' || normalized === 'cook' || normalized === 'heal' || normalized === 'research') return playSoftWork(normalized);
    playSoftWork('generic');
  }

  function playWorkComplete(kind, detail = {}) {
    if (isAudioMuted()) return;
    const normalized = String(kind || '').toLowerCase();
    if (normalized === 'mine' || normalized === 'stone' || normalized === 'ore') return playRockBreak(detail);
    if (normalized === 'wood' || normalized === 'tree' || normalized === 'gather-wood') return playWoodBreak();
    if (normalized === 'scrap' || normalized === 'metal') return playScrapHit();
    playTone({ frequency: 440, endFrequency: 620, duration: 0.10, gain: 0.055, type: 'triangle' });
  }

  function createRainLoop() {
    const ctx = audioReady();
    if (!ctx || audioState.rain) return audioState.rain;

    const buffer = noiseBuffer(2.5);
    if (!buffer) return null;

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 1650;
    filter.Q.value = 0.55;
    gain.gain.value = 0.0001;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioState.ambient);
    source.start();
    audioState.rain = { source, gain, filter, target: 0 };
    return audioState.rain;
  }

  function setRainActive(active, intensity = 1) {
    if (isAudioMuted()) active = false;
    const ctx = active ? audioReady() : audioState.ctx;
    if (!ctx) return;

    const rain = active ? createRainLoop() : audioState.rain;
    if (!rain) return;

    const target = active ? clampValue(0.06 + intensity * 0.18, 0.06, 0.28) : 0.0001;
    rain.target = target;
    rain.gain.gain.cancelScheduledValues(ctx.currentTime);
    rain.gain.gain.setTargetAtTime(target, ctx.currentTime, active ? 0.55 : 0.35);
  }

  function playThunder() {
    if (!shouldPlay('thunder', 2500)) return;
    playFilteredNoise({ key: 'thunder-noise', duration: 1.2, gain: 0.23, frequency: 130, q: 0.5, type: 'lowpass', cooldownMs: 0 });
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

    audioState.thunderCooldown -= Math.max(0, dt || 0);
    if (audioState.thunderCooldown <= 0) {
      audioState.thunderCooldown = randomBetween(12, 26);
      if (Math.random() < 0.42) playThunder();
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
