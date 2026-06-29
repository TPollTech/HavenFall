'use strict';

(() => {
  if (window.HavenfallContext?.landingSiteScanUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.landingSiteScanUiInstalled = true;

  const colors = { safe:'#22c55e', favorable:'#86efac', moderate:'#38bdf8', hard:'#fb923c', extreme:'#ef4444' };
  const previewColors = { grass:'#2f8f58', dirt:'#7c5635', stone:'#7d8794', sand:'#c48a3a', forest:'#14532d', water:'#0e7490', ruin:'#94a3b8', snow:'#dbeafe', spawn:'#fde68a' };
  const biomeLabels = { forest:'Floresta', desert:'Deserto', snow:'Frio', rock:'Rochoso', water:'Água', meadow:'Pradaria', ruins:'Ruínas' };

  function esc(v) { return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }
  function setupConfig() { return (typeof newGameConfig !== 'undefined' && newGameConfig) || (typeof readNewGameConfigSafe === 'function' ? readNewGameConfigSafe() : defaultNewGameConfig); }
  function ensureConfig(config = null) { return typeof ensurePlanetScanOnConfig === 'function' ? ensurePlanetScanOnConfig(config || setupConfig()) : (config || setupConfig()); }
  function selectedSite(profile) { return profile?.landingSites?.find(s => s.id === profile.selectedLandingSiteId) || profile?.selectedLandingSite || profile?.landingSites?.[0] || null; }

  function injectStyle() {
    if (document.getElementById('landing-site-scan-style')) return;
    const style = document.createElement('style');
    style.id = 'landing-site-scan-style';
    style.textContent = `
      .scan-radar{position:relative;overflow:hidden}.scan-planet-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:.96}.scan-radar::before,.scan-radar::after{pointer-events:none}.scan-sector-label{z-index:7;pointer-events:none}
      .landing-site-marker{position:absolute;z-index:8;width:18px;height:18px;transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(255,255,255,.75);background:radial-gradient(circle,#fff 0 15%,var(--c,#38bdf8) 28% 58%,rgba(56,189,248,.12) 70%);box-shadow:0 0 18px var(--c,#38bdf8);cursor:pointer;padding:0;animation:landingMarkerPulse 2.4s ease-in-out infinite}.landing-site-marker:hover{width:24px;height:24px}.landing-site-marker.selected{width:30px;height:30px;border-color:#fde68a;background:radial-gradient(circle,#fff7ed 0 14%,#facc15 26% 54%,rgba(250,204,21,.14) 70%);box-shadow:0 0 32px rgba(250,204,21,.86)}.landing-site-marker.selected::after{content:'';position:absolute;inset:-9px;border-radius:inherit;border:2px solid rgba(250,204,21,.55)}
      .landing-site-tooltip{position:fixed;z-index:99999;max-width:260px;min-width:190px;pointer-events:none;opacity:0;transition:opacity .12s ease;border:1px solid rgba(125,211,252,.28);background:rgba(2,6,23,.94);border-radius:12px;padding:10px;box-shadow:0 18px 42px rgba(0,0,0,.45);color:#e5eefc}.landing-site-tooltip.show{opacity:1}.landing-site-tooltip b{display:block;color:#fff;margin-bottom:2px}.landing-site-tooltip small{color:rgba(203,213,225,.76)}
      .landing-analysis{border:1px solid rgba(125,211,252,.16);background:rgba(2,6,23,.38);border-radius:16px;padding:12px;display:grid;gap:10px}.landing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.landing-card{border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.58);border-radius:14px;padding:11px;display:grid;gap:6px}.landing-card.full{grid-column:1/-1}.landing-card h3{margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9}.landing-card b{color:#f8fafc}.landing-card small{color:rgba(203,213,225,.76)}.landing-row{display:grid;grid-template-columns:82px 1fr 34px;gap:8px;align-items:center;font-size:11px;color:rgba(226,232,240,.82)}.landing-bar{height:8px;border-radius:999px;background:rgba(51,65,85,.9);overflow:hidden}.landing-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#facc15)}.landing-list{margin:0;padding-left:17px;color:rgba(226,232,240,.86);font-size:12px}.landing-warning{border:1px solid rgba(251,146,60,.35);background:rgba(124,45,18,.18);border-radius:12px;color:#fed7aa;padding:9px;font-size:12px}.landing-preview{width:100%;height:180px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:#020617;image-rendering:pixelated}.scan-actions button:disabled{opacity:.48;cursor:not-allowed}
      @keyframes landingMarkerPulse{50%{filter:brightness(1.25);transform:translate(-50%,-50%) scale(1.08)}}@media(max-width:900px){.landing-grid{grid-template-columns:1fr}.landing-preview{height:140px}}
    `;
    document.head.appendChild(style);
  }

  function ensureCanvas() {
    const radar = document.querySelector('.scan-radar');
    if (!radar) return null;
    let canvas = document.getElementById('scanPlanetCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'scanPlanetCanvas';
      canvas.className = 'scan-planet-canvas';
      canvas.width = 420; canvas.height = 420;
      radar.prepend(canvas);
    }
    return canvas;
  }

  function hash(text) { return typeof hashSeed === 'function' ? hashSeed(String(text)) : String(text).split('').reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619),2166136261)>>>0; }
  function unit(seed, x, y, salt='n') { return (hash(`${seed}|${salt}|${x}|${y}`) % 10000) / 10000; }

  function drawPlanet(profile, config) {
    const canvas = ensureCanvas();
    if (!canvas) return;
    const ctx2 = canvas.getContext('2d');
    const size = canvas.width, c = size / 2, r = size * .43;
    ctx2.clearRect(0,0,size,size);
    const img = ctx2.createImageData(size, size);
    const seed = `${config.seed}|scan-globe`;
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
      const nx=(x-c)/r, ny=(y-c)/r, d=Math.hypot(nx,ny), idx=(y*size+x)*4;
      if (d>1) { img.data[idx+3]=0; continue; }
      const n=unit(seed, Math.floor(x/4), Math.floor(y/4), 'biome');
      let biome = profile?.dominantBiome || 'forest';
      if (n < (profile?.biomeStats?.water||0)/100) biome='water';
      else if (n < ((profile?.biomeStats?.water||0)+(profile?.biomeStats?.rock||0))/100) biome='rock';
      else if (n > .86 && (profile?.biomeStats?.desert||0)>18) biome='desert';
      else if (Math.abs(ny)>.72 && (profile?.biomeStats?.snow||0)>14) biome='snow';
      const rgb = ({forest:[34,151,118],desert:[205,141,47],snow:[160,215,232],rock:[117,132,148],water:[24,88,122]})[biome] || [34,151,118];
      const light = .62 + (1-d)*.34 + n*.18;
      img.data[idx]=Math.min(255,rgb[0]*light); img.data[idx+1]=Math.min(255,rgb[1]*light); img.data[idx+2]=Math.min(255,rgb[2]*light+14); img.data[idx+3]=Math.round(245*Math.min(1,(1-d)*6));
    }
    ctx2.putImageData(img,0,0);
    const glow = ctx2.createRadialGradient(c*.82,c*.74,r*.04,c,c,r);
    glow.addColorStop(0,'rgba(255,255,255,.24)'); glow.addColorStop(.45,'rgba(125,211,252,.06)'); glow.addColorStop(1,'rgba(2,6,23,.64)');
    ctx2.fillStyle=glow; ctx2.beginPath(); ctx2.arc(c,c,r,0,Math.PI*2); ctx2.fill();
  }

  function markerHtml(site, selectedId) {
    const tier = site.difficulty?.tier || 'moderate';
    const c = colors[tier] || colors.moderate;
    const left = clamp(site.globe?.x ?? .5, .08, .92) * 100;
    const top = clamp(site.globe?.y ?? .5, .08, .92) * 100;
    return `<button type="button" class="landing-site-marker ${esc(tier)} ${site.id===selectedId?'selected':''}" style="left:${left}%;top:${top}%;--c:${c}" data-landing-site="${esc(site.id)}" aria-label="Selecionar ${esc(site.name)}"></button>`;
  }

  function tooltip() {
    let el = document.getElementById('landingSiteTooltip');
    if (!el) { el = document.createElement('div'); el.id='landingSiteTooltip'; el.className='landing-site-tooltip'; document.body.appendChild(el); }
    return el;
  }

  function renderMarkers(profile) {
    const radar = document.querySelector('.scan-radar');
    if (!radar) return;
    radar.querySelectorAll('.landing-site-marker').forEach(el => el.remove());
    radar.insertAdjacentHTML('beforeend', (profile?.landingSites||[]).map(site => markerHtml(site, profile.selectedLandingSiteId)).join(''));
    const tip = tooltip();
    radar.querySelectorAll('.landing-site-marker').forEach(btn => {
      const site = profile.landingSites.find(s => s.id === btn.dataset.landingSite);
      btn.addEventListener('click', () => selectLandingSite(site.id));
      btn.addEventListener('pointermove', e => {
        tip.innerHTML = `<b>${esc(site.name)}</b><small>${esc(site.labels?.subtitle || '')}<br>Score ${Number(site.difficulty?.score||0)}/100 · ${esc(site.difficulty?.label||'')}</small>`;
        tip.style.left = `${e.clientX + 14}px`; tip.style.top = `${e.clientY + 14}px`; tip.classList.add('show');
      });
      btn.addEventListener('pointerleave', () => tip.classList.remove('show'));
    });
  }

  function ensureAnalysis() {
    const grid = document.querySelector('.scan-grid');
    if (!grid) return null;
    let panel = document.getElementById('scanLandingAnalysis');
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'scanLandingAnalysis'; panel.className = 'landing-analysis';
      const anchor = document.getElementById('scanMetrics')?.parentElement;
      grid.insertBefore(panel, anchor || grid.children[1] || null);
    }
    return panel;
  }

  function bar(label, value, danger=false) {
    const v = clamp(value,0,100);
    return `<div class="landing-row"><span>${esc(label)}</span><div class="landing-bar"><i style="width:${v}%;background:${danger?'linear-gradient(90deg,#facc15,#ef4444)':'linear-gradient(90deg,#38bdf8,#22c55e)'}"></i></div><b>${v}</b></div>`;
  }
  function resRows(site) { const r=site.resources||{}; return [['Madeira','wood'],['Comida','food'],['Pedra','stone'],['Metal','metal'],['Remédio','medicine'],['Água','water']].map(([l,k])=>bar(l,r[k]||0,false)).join(''); }
  function riskRows(site) { const r=site.risks||{}; return [['Fauna','fauna'],['Clima','weather'],['Doença','disease'],['Ataques','raids'],['Terreno','terrain']].map(([l,k])=>bar(l,r[k]||0,true)).join(''); }

  function drawPreview(site) {
    const canvas = document.getElementById('scanLandingPreviewCanvas');
    const sample = site?.preview?.terrainSample || [];
    if (!canvas || !sample.length) return;
    const h=sample.length, w=sample[0]?.length||1, scale=12;
    canvas.width=w*scale; canvas.height=h*scale;
    const ctx2=canvas.getContext('2d'); ctx2.clearRect(0,0,canvas.width,canvas.height);
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const t=sample[y]?.[x]?.type||'grass'; ctx2.fillStyle=previewColors[t]||previewColors.grass; ctx2.fillRect(x*scale,y*scale,scale,scale);
      if (t==='spawn') { ctx2.strokeStyle='#fff7ed'; ctx2.lineWidth=2; ctx2.strokeRect(x*scale+2,y*scale+2,scale-4,scale-4); }
    }
  }

  function renderAnalysis(site) {
    const panel = ensureAnalysis();
    if (!panel) return;
    if (!site) { panel.innerHTML = '<div class="landing-warning">Selecione um ponto no globo para analisar o pouso.</div>'; return; }
    const warning = site.difficulty?.tier === 'extreme' ? '<div class="landing-warning">Risco extremo: clima, terreno e ameaças podem pressionar logo no início.</div>' : '';
    panel.innerHTML = `${warning}<div class="landing-card full"><h3>Local de Pouso Selecionado</h3><b>${esc(site.name)}</b><small>${esc(site.labels?.biomeLabel || biomeLabels[site.biomes?.primary] || '')} · ${esc(site.labels?.subtitle || '')}</small><small>Classificação ${esc(site.difficulty?.label || 'Moderado')} · Score ${Number(site.difficulty?.score || 0)}/100 · ID ${esc(site.id)}</small></div><div class="landing-grid"><div class="landing-card"><h3>Recursos</h3>${resRows(site)}</div><div class="landing-card"><h3>Riscos</h3>${riskRows(site)}</div><div class="landing-card"><h3>Pontos positivos</h3><ul class="landing-list">${(site.positives||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="landing-card"><h3>Pontos negativos</h3><ul class="landing-list">${(site.negatives||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="landing-card full"><h3>Prévia leve do setor</h3><canvas id="scanLandingPreviewCanvas" class="landing-preview"></canvas><small>Preview orbital aproximado. O mapa final usa a seed e os modificadores deste pouso.</small></div></div>`;
    drawPreview(site);
  }

  function metricRows(profile) {
    const m = profile?.metrics || {};
    return [['Densidade geológica',m.geology],['Atividade biológica',m.biology],['Instabilidade climática',m.climate,true],['Ruído atmosférico',m.noise,true],['Integridade orbital',m.landing]].map(([l,v,d])=>`<div class="scan-data-row"><span>${esc(l)}</span><div class="scan-segments ${d?'amber':''}">${Array.from({length:10},(_,i)=>`<i class="${i<Math.round((v||0)/10)?'on':''}"></i>`).join('')}</div><b>${Math.round(v||0)}%</b></div>`).join('');
  }

  function signatureCards(site, profile) {
    const list = site?.signatures?.length ? site.signatures : (profile?.signatures || []);
    return list.map((sig,i)=>`<div class="scan-signature-card"><b>${esc(sig.name || sig.kind || 'Assinatura orbital')}</b><small>Assinatura ${String(i+1).padStart(2,'0')} · risco ${esc(sig.risk || 'moderado')} ${sig.positive ? `· ${esc(sig.positive)}` : ''}</small></div>`).join('');
  }

  function selectLandingSite(siteId) {
    const base = ensureConfig();
    const next = typeof selectLandingSiteInConfig === 'function' ? selectLandingSiteInConfig(base, siteId) : { ...base, selectedLandingSiteId: siteId };
    if (typeof newGameConfig !== 'undefined') newGameConfig = next;
    refreshPlanetScan(next);
  }

  function refreshPlanetScan(config = null) {
    injectStyle();
    const active = ensureConfig(config);
    if (typeof newGameConfig !== 'undefined') newGameConfig = active;
    const profile = active.planetScan;
    const site = selectedSite(profile);
    drawPlanet(profile, active);
    renderMarkers(profile);
    renderAnalysis(site);

    const title = document.getElementById('scanSectorTitle');
    const meta = document.getElementById('scanSectorMeta');
    const metrics = document.getElementById('scanMetrics');
    const signatures = document.getElementById('scanSignatures');
    const log = document.getElementById('scanProcessingLog');
    const label = document.getElementById('scanRadarLabel');
    const legend = document.getElementById('scanBiomeLegend') || document.createElement('div');
    const proceed = dom?.buttons?.scanProceed || document.getElementById('scanProceedBtn');

    if (!legend.id) { legend.id='scanBiomeLegend'; legend.className='scan-biome-legend'; document.querySelector('.scan-hologram-panel')?.appendChild(legend); }
    if (title) title.textContent = active.colonyName || 'Primeiro Refúgio';
    if (meta) meta.textContent = `Seed ${active.seed || 'sem seed'} · ${profile?.sectorId || 'setor'} · local: ${site?.name || 'não selecionado'}`;
    if (metrics) metrics.innerHTML = metricRows(profile);
    if (signatures) signatures.innerHTML = signatureCards(site, profile);
    if (label) label.innerHTML = `<span>LOCAIS</span><b>${(profile?.landingSites || []).length} DETECTADOS</b>`;
    if (legend) legend.innerHTML = Object.entries(profile?.biomeStats||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="scan-biome-chip"><i style="background:${colors.moderate}"></i>${esc(biomeLabels[k]||k)} ${v}%</span>`).join('');
    if (proceed) { proceed.disabled = !site; proceed.textContent = site ? 'Continuar com este pouso' : 'Selecione um ponto no globo'; }
    if (log) log.innerHTML = ['Varredura orbital concluída.', `${(profile?.landingSites||[]).length} pontos spawnáveis encontrados.`, site ? `Selecionado: ${site.name} · score ${site.difficulty?.score}/100.` : 'Selecione um local no globo.', 'O gerador do mundo usará este local, seus recursos, riscos e modificadores.'].map(x=>`<span>${esc(x)}</span>`).join('');

    window.HavenfallPlanetScanDebug = { config: active, planetScan: profile, selectedLandingSite: site, landingSites: profile?.landingSites || [] };
  }

  window.refreshPlanetScan = refreshPlanetScan;
  window.selectLandingSite = selectLandingSite;
})();