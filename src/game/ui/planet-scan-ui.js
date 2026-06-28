'use strict';

(() => {
  function injectPlanetScanStyle() {
    if (document.getElementById('planet-scan-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'planet-scan-ui-style';
    style.textContent = `
      .planet-scan-screen {
        background:
          radial-gradient(circle at 72% 28%, rgba(245, 158, 11, .14), transparent 30%),
          radial-gradient(circle at 18% 18%, rgba(56, 189, 248, .13), transparent 28%),
          linear-gradient(135deg, #050812 0%, #080d17 48%, #03050a 100%);
        color: #e5eefc;
        overflow: hidden;
      }

      .planet-scan-screen::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(148, 163, 184, .045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, .045) 1px, transparent 1px);
        background-size: 38px 38px;
        mask-image: radial-gradient(circle at center, black 0%, transparent 78%);
      }

      .planet-scan-shell {
        position: relative;
        z-index: 1;
        width: min(1180px, calc(100vw - 40px));
        max-height: calc(100vh - 44px);
        margin: 22px auto;
        display: grid;
        grid-template-columns: minmax(300px, 420px) minmax(420px, 1fr);
        gap: 18px;
        align-items: stretch;
      }

      .scan-panel {
        border: 1px solid rgba(125, 211, 252, .22);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(15, 23, 42, .86), rgba(3, 7, 18, .86));
        box-shadow: 0 26px 80px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.06);
        padding: 18px;
        overflow: hidden;
      }

      .scan-title-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 14px;
      }

      .scan-title-row h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 46px);
        letter-spacing: .04em;
        color: #f8fafc;
      }

      .scan-title-row p {
        margin: 6px 0 0;
        color: rgba(203, 213, 225, .78);
        max-width: 58ch;
      }

      .scan-status-pill {
        flex: 0 0 auto;
        border: 1px solid rgba(251, 191, 36, .38);
        color: #fde68a;
        background: rgba(120, 53, 15, .18);
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 11px;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .scan-grid {
        display: grid;
        gap: 14px;
      }

      .scan-hologram-panel {
        min-height: 520px;
        display: grid;
        place-items: center;
        position: relative;
      }

      .scan-hologram-panel::after {
        content: '';
        position: absolute;
        inset: 16px;
        pointer-events: none;
        border-radius: 18px;
        background: linear-gradient(transparent 48%, rgba(125, 211, 252, .055) 50%, transparent 52%);
        background-size: 100% 7px;
        opacity: .65;
        mix-blend-mode: screen;
      }

      .scan-radar {
        --scan-a: 52%;
        --scan-b: 38%;
        --scan-c: 66%;
        width: min(430px, 56vw);
        aspect-ratio: 1;
        position: relative;
        border-radius: 50%;
        background:
          radial-gradient(circle at 48% 42%, rgba(255,255,255,.24) 0 2px, transparent 3px),
          radial-gradient(circle at 35% 58%, rgba(251, 191, 36, .55) 0 3px, transparent 4px),
          radial-gradient(circle at 64% 35%, rgba(56, 189, 248, .55) 0 2px, transparent 4px),
          radial-gradient(circle at 50% 50%, rgba(34, 211, 238, .20) 0 28%, rgba(15, 23, 42, .42) 42%, rgba(3,7,18,.88) 70%),
          conic-gradient(from 140deg, rgba(56,189,248,.20), rgba(251,191,36,.16), rgba(56,189,248,.10), rgba(14,165,233,.24));
        box-shadow:
          0 0 0 1px rgba(125,211,252,.35),
          0 0 36px rgba(56,189,248,.28),
          inset 0 0 40px rgba(14,165,233,.16);
        overflow: hidden;
      }

      .scan-radar::before {
        content: '';
        position: absolute;
        inset: 7%;
        border-radius: 50%;
        border: 1px solid rgba(125,211,252,.28);
        background:
          linear-gradient(90deg, transparent 49%, rgba(125,211,252,.30) 50%, transparent 51%),
          linear-gradient(transparent 49%, rgba(125,211,252,.24) 50%, transparent 51%),
          repeating-radial-gradient(circle, transparent 0 37px, rgba(125,211,252,.18) 38px 39px);
        animation: scanPulse 2.8s ease-in-out infinite;
      }

      .scan-radar::after {
        content: '';
        position: absolute;
        inset: -30%;
        background: conic-gradient(from 0deg, transparent 0deg, rgba(125,211,252,.36) 22deg, transparent 48deg);
        animation: scanSweep 5.2s linear infinite;
        mix-blend-mode: screen;
      }

      .scan-sector-label {
        position: absolute;
        left: 18px;
        bottom: 16px;
        display: grid;
        gap: 2px;
        color: rgba(226,232,240,.78);
        font-size: 12px;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .scan-sector-label b {
        color: #e0f2fe;
      }

      .scan-data-list,
      .scan-log-list,
      .scan-signature-list {
        display: grid;
        gap: 10px;
      }

      .scan-data-row {
        display: grid;
        grid-template-columns: 128px 1fr 42px;
        gap: 10px;
        align-items: center;
      }

      .scan-data-row span,
      .scan-signature-card small,
      .scan-log-list span {
        color: rgba(203,213,225,.74);
        font-size: 11px;
      }

      .scan-data-row b {
        color: #e0f2fe;
        font-size: 12px;
        text-align: right;
      }

      .scan-segments {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 4px;
      }

      .scan-segments i {
        height: 12px;
        border-radius: 4px;
        background: rgba(51,65,85,.75);
        border: 1px solid rgba(255,255,255,.04);
      }

      .scan-segments i.on {
        background: linear-gradient(180deg, rgba(125,211,252,.95), rgba(14,165,233,.70));
        box-shadow: 0 0 10px rgba(56,189,248,.35);
      }

      .scan-segments.amber i.on {
        background: linear-gradient(180deg, rgba(251,191,36,.95), rgba(217,119,6,.70));
        box-shadow: 0 0 10px rgba(251,191,36,.28);
      }

      .scan-signature-card {
        border: 1px solid rgba(125,211,252,.14);
        background: rgba(15,23,42,.58);
        border-radius: 14px;
        padding: 11px;
        display: grid;
        gap: 4px;
      }

      .scan-signature-card b {
        color: #f8fafc;
      }

      .scan-log-list span {
        border-left: 2px solid rgba(251,191,36,.55);
        padding-left: 9px;
      }

      .scan-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .scan-actions button,
      .scan-panel button {
        border: 1px solid rgba(125,211,252,.24);
        background: rgba(15,23,42,.72);
        color: #e5eefc;
        border-radius: 13px;
        padding: 10px 14px;
        cursor: pointer;
      }

      .scan-actions button.primary {
        border-color: rgba(251,191,36,.62);
        background: linear-gradient(180deg, rgba(251,191,36,.28), rgba(120,53,15,.32));
        color: #fff7ed;
      }

      @keyframes scanSweep { to { transform: rotate(360deg); } }
      @keyframes scanPulse { 50% { opacity: .62; transform: scale(.986); } }

      @media (max-width: 900px) {
        .planet-scan-shell {
          grid-template-columns: 1fr;
          overflow-y: auto;
        }
        .scan-hologram-panel {
          min-height: 360px;
        }
        .scan-radar {
          width: min(330px, 78vw);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function scanRandom(config) {
    const seed = `${config?.seed || 'scan'}|${config?.difficulty || 'normal'}|${config?.mapSize || 'giant'}|sector-preview-v1`;
    return typeof seededRandom === 'function' ? seededRandom(seed) : Math.random;
  }

  function segmentBar(value, amber = false) {
    const lit = Math.max(0, Math.min(10, Math.round(value / 10)));
    return `<div class="scan-segments ${amber ? 'amber' : ''}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('')}</div>`;
  }

  function metricRows(config, rand) {
    const difficultyBoost = ({ easy: -8, normal: 0, hard: 10, hardcore: 18 })[config.difficulty] || 0;
    const eventBoost = ({ low: -12, normal: 0, high: 14 })[config.eventIntensity] || 0;
    const mapBoost = ({ large: -6, huge: 2, giant: 10, infinite_chunks: 16 })[config.mapSize] || 0;
    return [
      ['Densidade geológica', 45 + mapBoost + rand() * 26, false],
      ['Atividade biológica', 38 + eventBoost + rand() * 30, false],
      ['Instabilidade climática', 34 + eventBoost + rand() * 32, true],
      ['Ruído atmosférico', 28 + difficultyBoost + rand() * 38, true],
      ['Integridade do pouso', 82 - difficultyBoost - rand() * 18, false]
    ].map(([label, value, amber]) => {
      const clamped = Math.max(4, Math.min(98, Math.round(value)));
      return `<div class="scan-data-row"><span>${escapeHtml(label)}</span>${segmentBar(clamped, amber)}<b>${clamped}%</b></div>`;
    }).join('');
  }

  function signatureCards(config, rand) {
    const count = ({ low: 2, normal: 3, high: 4 })[config.eventIntensity] || 3;
    const names = ['Eco térmico irregular', 'Ruína estrutural', 'Movimento orgânico', 'Sinal metálico soterrado', 'Anomalia de teto natural', 'Agrupamento de fauna'];
    return Array.from({ length: count }, (_, i) => {
      const name = names[Math.floor(rand() * names.length)] || names[i];
      const range = Math.floor(12 + rand() * 78);
      const risk = ['baixo', 'moderado', 'elevado'][Math.floor(rand() * 3)] || 'moderado';
      return `<div class="scan-signature-card"><b>${escapeHtml(name)}</b><small>Assinatura ${String(i + 1).padStart(2, '0')} · distância estimada ${range}km · risco ${risk}</small></div>`;
    }).join('');
  }

  function refreshPlanetScan(config = null) {
    injectPlanetScanStyle();
    const activeConfig = config || (typeof readNewGameConfigSafe === 'function' ? readNewGameConfigSafe() : defaultNewGameConfig);
    const rand = scanRandom(activeConfig);
    const sector = `HV-${String(hashSeed?.(activeConfig.seed || 'scan') || 0).slice(0, 5).toUpperCase()}`;

    const title = document.getElementById('scanSectorTitle');
    const meta = document.getElementById('scanSectorMeta');
    const metrics = document.getElementById('scanMetrics');
    const signatures = document.getElementById('scanSignatures');
    const log = document.getElementById('scanProcessingLog');
    const label = document.getElementById('scanRadarLabel');

    if (title) title.textContent = activeConfig.colonyName || 'First Haven';
    if (meta) {
      meta.textContent = `Seed ${activeConfig.seed || 'sem seed'} · ${labelMapSize?.(activeConfig.mapSize || 'giant') || activeConfig.mapSize} · eventos ${labelEventIntensity?.(activeConfig.eventIntensity || 'normal') || activeConfig.eventIntensity}`;
    }
    if (metrics) metrics.innerHTML = metricRows(activeConfig, rand);
    if (signatures) signatures.innerHTML = signatureCards(activeConfig, rand);
    if (label) label.innerHTML = `<span>SETOR</span><b>${escapeHtml(sector)}</b>`;
    if (log) {
      log.innerHTML = [
        'Sincronizando telemetria orbital...',
        'Calibrando grade de coordenadas...',
        'Detectando biomas dominantes...',
        'Mapeando assinaturas hostis...',
        'Prévia visual pronta. Motor real será acoplado na próxima passada.'
      ].map(line => `<span>${escapeHtml(line)}</span>`).join('');
    }
  }

  injectPlanetScanStyle();
  window.refreshPlanetScan = refreshPlanetScan;
})();
