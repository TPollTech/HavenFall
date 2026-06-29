'use strict';

(() => {
  if (window.HavenfallContext?.landingSiteScanPolishInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.landingSiteScanPolishInstalled = true;

  const TIER_COLOR = { favorable:'#86efac', safe:'#22c55e', moderate:'#38bdf8', hard:'#fb923c', extreme:'#ef4444' };
  const TILE_COLOR = { grass:'#2f8f58', dirt:'#7c5635', stone:'#7d8794', sand:'#c48a3a', forest:'#14532d', water:'#0e7490', ruin:'#94a3b8', snow:'#dbeafe', spawn:'#fde68a' };
  const BIOME = { forest:'Floresta', desert:'Deserto', snow:'Frio', rock:'Rochoso', water:'Água', meadow:'Pradaria', ruins:'Ruínas', riverbank:'Margem de rio' };
  const RES = [['Madeira','wood'],['Comida','food'],['Pedra','stone'],['Metal','metal'],['Remédios','medicine'],['Água','water']];
  const RISK = [['Fauna','fauna'],['Clima','weather'],['Doença','disease'],['Ameaças','raids'],['Terreno','terrain']];
  let frame = 0;
  let hoverId = null;

  function esc(v){ return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }
  function h(text){ if (typeof hashSeed === 'function') return hashSeed(String(text)); let x=2166136261; for(const ch of String(text||'')){ x^=ch.charCodeAt(0); x=Math.imul(x,16777619); } return x>>>0; }
  function u(seed,x,y,s='n'){ return (h(`${seed}|${s}|${x}|${y}`)%10000)/10000; }
  function cfg(){ return (typeof newGameConfig !== 'undefined' && newGameConfig) || (typeof readNewGameConfigSafe === 'function' ? readNewGameConfigSafe() : defaultNewGameConfig); }
  function ensure(config=null){ return typeof ensurePlanetScanOnConfig === 'function' ? ensurePlanetScanOnConfig(config || cfg()) : (config || cfg()); }
  function selected(profile){ return profile?.landingSites?.find(s => s.id === profile.selectedLandingSiteId) || profile?.selectedLandingSite || profile?.landingSites?.[0] || null; }
  function siteById(profile,id){ return profile?.landingSites?.find(s => s.id === id) || selected(profile); }
  function avg(obj){ const vals=Object.values(obj||{}); return Math.round(vals.reduce((s,v)=>s+Number(v||0),0)/Math.max(1,vals.length)); }
  function score(site){ return Number(site?.difficulty?.score || 0); }
  function tier(site){ return site?.difficulty?.tier || 'moderate'; }
  function color(site){ return TIER_COLOR[tier(site)] || TIER_COLOR.moderate; }

  function injectStyle(){
    if (document.getElementById('landing-site-polish-style')) return;
    const style=document.createElement('style');
    style.id='landing-site-polish-style';
    style.textContent=`
      .planet-scan-shell{width:min(1320px,calc(100vw - 32px));grid-template-columns:minmax(430px,560px) minmax(520px,1fr)}
      .scan-hologram-panel{min-height:650px;overflow:hidden}.scan-radar{width:min(500px,67vw);transform:translateY(-36px);position:relative;overflow:visible;border-radius:50%}
      .scan-planet-canvas{position:absolute;inset:0;z-index:0;width:100%;height:100%;opacity:.98;filter:saturate(1.2) contrast(1.08)}
      .scan-atmosphere{position:absolute;inset:-6%;z-index:3;border-radius:50%;pointer-events:none;box-shadow:inset -40px -30px 60px rgba(0,0,0,.38),0 0 48px rgba(56,189,248,.34),0 0 110px rgba(56,189,248,.12);background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.18),transparent 18%),radial-gradient(circle at 60% 62%,transparent 45%,rgba(2,6,23,.42) 84%);mix-blend-mode:screen}
      .scan-orbit-ring{position:absolute;z-index:6;border-radius:50%;pointer-events:none;border:1px solid rgba(125,211,252,.18)}.scan-orbit-ring.r1{inset:-9%;transform:rotate(-18deg) scaleY(.36)}.scan-orbit-ring.r2{inset:9%;transform:rotate(23deg) scaleY(.24);opacity:.7}.scan-orbit-ring.r3{inset:18%;transform:rotate(72deg) scaleY(.30);opacity:.52}
      .landing-site-marker{position:absolute;z-index:14;width:18px;height:18px;transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(255,255,255,.82);background:radial-gradient(circle,#fff 0 15%,var(--c,#38bdf8) 28% 58%,rgba(56,189,248,.12) 70%);box-shadow:0 0 20px var(--c,#38bdf8);cursor:pointer;padding:0;transition:.16s;animation:landingPulse 2.6s ease-in-out infinite}
      .landing-site-marker:hover,.landing-site-marker.hovered{width:25px;height:25px;filter:brightness(1.25)}.landing-site-marker.selected{width:32px;height:32px;border-color:#fff7ed;background:radial-gradient(circle,#fff7ed 0 14%,#facc15 26% 54%,rgba(250,204,21,.16) 70%);box-shadow:0 0 36px rgba(250,204,21,.95),0 0 0 8px rgba(250,204,21,.08)}
      .landing-site-marker.selected:after{content:'';position:absolute;inset:-13px;border-radius:inherit;border:2px solid rgba(250,204,21,.52);animation:landingRing 1.8s ease-out infinite}.landing-site-label{position:absolute;z-index:13;transform:translate(-50%,12px);color:rgba(226,232,240,.86);font-size:10px;font-weight:800;text-shadow:0 2px 8px rgba(0,0,0,.85);white-space:nowrap;pointer-events:none;opacity:0}.landing-site-label.selected,.landing-site-label.hovered{opacity:1}
      .landing-site-tooltip{position:fixed;z-index:99999;max-width:280px;min-width:220px;pointer-events:none;opacity:0;transition:.12s;transform:translateY(4px);border:1px solid rgba(125,211,252,.28);background:linear-gradient(180deg,rgba(2,6,23,.96),rgba(15,23,42,.96));border-radius:14px;padding:12px;box-shadow:0 18px 42px rgba(0,0,0,.48);color:#e5eefc}.landing-site-tooltip.show{opacity:1;transform:translateY(0)}.landing-site-tooltip b{display:block;color:#fff;margin-bottom:3px}.landing-site-tooltip small{display:block;color:rgba(203,213,225,.78);line-height:1.45}
      .landing-analysis{border:1px solid rgba(125,211,252,.16);background:radial-gradient(circle at 92% 0%,rgba(56,189,248,.10),transparent 28%),rgba(2,6,23,.42);border-radius:18px;padding:14px;display:grid;gap:12px}.landing-hero{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:start;border:1px solid rgba(148,163,184,.16);background:linear-gradient(180deg,rgba(15,23,42,.72),rgba(2,6,23,.64));border-radius:18px;padding:15px}.landing-hero h2{margin:0;font-size:26px;color:#f8fafc}.landing-hero p{margin:5px 0 0;color:rgba(203,213,225,.82);line-height:1.45}.landing-score{min-width:110px;text-align:center;border:1px solid rgba(250,204,21,.28);background:rgba(120,53,15,.20);border-radius:16px;padding:10px}.landing-score b{display:block;color:#fef3c7;font-size:30px;line-height:1}
      .landing-mini-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.landing-mini-tags span{border:1px solid rgba(125,211,252,.16);background:rgba(15,23,42,.56);border-radius:999px;padding:5px 8px;color:rgba(226,232,240,.82);font-size:11px}.landing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.landing-card{border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.60);border-radius:15px;padding:12px;display:grid;gap:8px}.landing-card.full{grid-column:1/-1}.landing-card h3{margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9}.landing-card small{color:rgba(203,213,225,.76);line-height:1.4}
      .landing-row{display:grid;grid-template-columns:88px 1fr 34px;gap:8px;align-items:center;font-size:11px;color:rgba(226,232,240,.85)}.landing-bar{height:8px;border-radius:999px;background:rgba(51,65,85,.92);overflow:hidden}.landing-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#22c55e)}.landing-bar.danger i{background:linear-gradient(90deg,#facc15,#ef4444)}.landing-list{margin:0;padding-left:18px;color:rgba(226,232,240,.88);font-size:12px;line-height:1.42}.landing-warning{border:1px solid rgba(251,146,60,.35);background:rgba(124,45,18,.18);border-radius:14px;color:#fed7aa;padding:10px 11px;font-size:12px;line-height:1.45}
      .landing-preview-wrap{display:grid;grid-template-columns:minmax(220px,1fr) minmax(160px,.72fr);gap:12px}.landing-preview{width:100%;height:210px;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:#020617;image-rendering:pixelated}.landing-preview-legend{display:grid;gap:6px;align-content:start}.landing-preview-legend span{display:flex;align-items:center;gap:7px;color:rgba(226,232,240,.82);font-size:11px}.landing-preview-legend i{width:11px;height:11px;border-radius:3px;background:var(--c)}
      .landing-compare{display:grid;gap:7px}.landing-compare-row{display:grid;grid-template-columns:1fr 46px 46px 46px;gap:6px;align-items:center;border:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.34);border-radius:11px;padding:7px;color:rgba(226,232,240,.82);font-size:11px;cursor:pointer}.landing-compare-row.selected{border-color:rgba(250,204,21,.45);background:rgba(120,53,15,.18)}.landing-compare-row b{color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.landing-compare-row small{text-align:right;color:rgba(203,213,225,.78)}
      .scan-actions button.primary.pulse-ready{animation:proceedPulse 2.2s ease-in-out infinite}@keyframes landingPulse{50%{transform:translate(-50%,-50%) scale(1.08);filter:brightness(1.18)}}@keyframes landingRing{from{transform:scale(.86);opacity:.82}to{transform:scale(1.24);opacity:0}}@keyframes proceedPulse{50%{box-shadow:0 0 0 8px rgba(250,204,21,0)}}@media(max-width:1050px){.planet-scan-shell{grid-template-columns:1fr;overflow-y:auto}.scan-radar{transform:none}.scan-hologram-panel{min-height:500px}}@media(max-width:720px){.landing-grid,.landing-preview-wrap,.landing-hero{grid-template-columns:1fr}.landing-preview{height:160px}}
    `;
    document.head.appendChild(style);
  }

  function ensureCanvas(){
    const radar=document.querySelector('.scan-radar');
    if(!radar) return null;
    let canvas=document.getElementById('scanPlanetCanvas');
    if(!canvas){ canvas=document.createElement('canvas'); canvas.id='scanPlanetCanvas'; canvas.className='scan-planet-canvas'; radar.prepend(canvas); }
    canvas.width=520; canvas.height=520;
    if(!radar.querySelector('.scan-atmosphere')){ const el=document.createElement('div'); el.className='scan-atmosphere'; radar.appendChild(el); }
    ['r1','r2','r3'].forEach(cls=>{ if(!radar.querySelector(`.scan-orbit-ring.${cls}`)){ const r=document.createElement('div'); r.className=`scan-orbit-ring ${cls}`; radar.appendChild(r); }});
    return canvas;
  }

  function biomeColor(b){ return ({forest:[34,151,118],desert:[205,141,47],snow:[172,220,235],rock:[117,132,148],water:[24,88,122]})[b] || [34,151,118]; }

  function pixelBiome(seed,profile,nx,ny,x,y,rot){
    const water=(profile?.biomeStats?.water||0)/100, rock=(profile?.biomeStats?.rock||0)/100, desert=(profile?.biomeStats?.desert||0)/100, snow=(profile?.biomeStats?.snow||0)/100;
    const n=u(seed,Math.floor((x+rot*90)/4),Math.floor(y/4),'biome');
    const moist=u(seed,Math.floor(x/7),Math.floor((y+rot*65)/7),'moisture');
    if(n < water*1.18 && moist>.22) return 'water';
    if(n > 1-Math.max(.10,rock*.72)) return 'rock';
    if(Math.abs(ny)>.68 && snow>.10 && moist>.28) return 'snow';
    if(desert>.16 && moist<.30 && n>.42) return 'desert';
    return profile?.dominantBiome || 'forest';
  }

  function drawPlanet(profile, config){
    const canvas=ensureCanvas(); if(!canvas) return;
    const ctx2=canvas.getContext('2d'), size=canvas.width, c=size/2, r=size*.43, seed=`${config.seed}|polished-planet`, rot=(frame++%1440)/1440;
    const img=ctx2.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const nx=(x-c)/r, ny=(y-c)/r, d=Math.hypot(nx,ny), idx=(y*size+x)*4;
      if(d>1){ img.data[idx+3]=0; continue; }
      const b=pixelBiome(seed,profile,nx,ny,x,y,rot), rgb=biomeColor(b);
      const terr=u(seed,Math.floor(x/3),Math.floor(y/3),'terrain');
      const light=.60+terr*.22+(1-d)*.22-Math.max(0,nx*.20+ny*.12);
      const cloud=u(seed,Math.floor((x+rot*160)/10),Math.floor((y-rot*85)/10),'cloud');
      const ca=cloud>.78 ? (cloud-.78)*.70 : 0;
      img.data[idx]=clamp(rgb[0]*light+ca*255,0,255);
      img.data[idx+1]=clamp(rgb[1]*light+ca*255,0,255);
      img.data[idx+2]=clamp(rgb[2]*light+18+ca*255,0,255);
      img.data[idx+3]=Math.round(246*Math.min(1,(1-d)*8));
    }
    ctx2.clearRect(0,0,size,size); ctx2.putImageData(img,0,0);
    const g=ctx2.createRadialGradient(c*.78,c*.70,r*.04,c,c,r); g.addColorStop(0,'rgba(255,255,255,.24)'); g.addColorStop(.34,'rgba(125,211,252,.06)'); g.addColorStop(1,'rgba(2,6,23,.62)');
    ctx2.globalCompositeOperation='screen'; ctx2.fillStyle=g; ctx2.beginPath(); ctx2.arc(c,c,r,0,Math.PI*2); ctx2.fill(); ctx2.globalCompositeOperation='source-over';
  }

  function tip(){
    let el=document.getElementById('landingSiteTooltip');
    if(!el){ el=document.createElement('div'); el.id='landingSiteTooltip'; el.className='landing-site-tooltip'; document.body.appendChild(el); }
    return el;
  }

  function renderMarkers(profile){
    const radar=document.querySelector('.scan-radar'); if(!radar) return;
    if(radar.__landingPointerHandler) radar.removeEventListener('pointerdown',radar.__landingPointerHandler,true);
    radar.__landingPointerHandler=ev=>selectMarkerNearPointer(radar,ev);
    radar.addEventListener('pointerdown',radar.__landingPointerHandler,true);
    radar.querySelectorAll('.landing-site-marker,.landing-site-label').forEach(el=>el.remove());
    const selectedId=profile?.selectedLandingSiteId;
    radar.insertAdjacentHTML('beforeend',(profile?.landingSites||[]).map(site=>{
      const left=clamp(site.globe?.x??.5,.08,.92)*100, top=clamp(site.globe?.y??.5,.08,.92)*100, c=color(site);
      const mc=['landing-site-marker',site.id===selectedId?'selected':'',site.id===hoverId?'hovered':''].filter(Boolean).join(' ');
      const lc=['landing-site-label',site.id===selectedId?'selected':'',site.id===hoverId?'hovered':''].filter(Boolean).join(' ');
      return `<button type="button" class="${mc}" style="left:${left}%;top:${top}%;--c:${c}" data-landing-site="${esc(site.id)}"></button><span class="${lc}" style="left:${left}%;top:${top}%" data-landing-site="${esc(site.id)}">${esc(site.name)}</span>`;
    }).join(''));
    const tooltip=tip();
    radar.querySelectorAll('.landing-site-marker').forEach(btn=>{
      const site=siteById(profile,btn.dataset.landingSite); if(!site) return;
      const choose=ev=>{ ev.preventDefault(); ev.stopPropagation(); selectLandingSite(site.id); };
      btn.addEventListener('pointerdown',choose);
      btn.addEventListener('click',choose);
      btn.addEventListener('pointerenter',()=>{ hoverId=site.id; updateHoverClasses(radar); });
      btn.addEventListener('pointermove',ev=>{
        tooltip.innerHTML=`<b>${esc(site.name)}</b><small>${esc(site.labels?.subtitle||'')}<br>Score ${score(site)}/100 · Risco ${avg(site.risks)} · Recursos ${avg(site.resources)}</small>`;
        tooltip.style.left=`${ev.clientX+16}px`; tooltip.style.top=`${ev.clientY+16}px`; tooltip.classList.add('show');
      });
      btn.addEventListener('pointerleave',()=>{ hoverId=null; tooltip.classList.remove('show'); updateHoverClasses(radar); });
    });
  }

  function selectMarkerNearPointer(radar,ev){
    const markers=[...radar.querySelectorAll('.landing-site-marker')];
    let best=null,bestDist=Infinity;
    for(const marker of markers){
      const rect=marker.getBoundingClientRect();
      const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      const dist=Math.hypot(ev.clientX-cx,ev.clientY-cy);
      if(dist<bestDist){ best=marker; bestDist=dist; }
    }
    if(!best||bestDist>34) return;
    ev.preventDefault();
    ev.stopPropagation();
    selectLandingSite(best.dataset.landingSite);
  }

  function updateHoverClasses(radar=document.querySelector('.scan-radar')){
    if(!radar) return;
    radar.querySelectorAll('.landing-site-marker,.landing-site-label').forEach(el=>{
      el.classList.toggle('hovered',el.dataset?.landingSite===hoverId);
    });
  }

  function bar(label,value,danger=false){ const v=clamp(value,0,100); return `<div class="landing-row"><span>${esc(label)}</span><div class="landing-bar ${danger?'danger':''}"><i style="width:${v}%"></i></div><b>${v}</b></div>`; }
  function rows(site,list,danger=false){ const src=danger?site.risks:site.resources; return list.map(([l,k])=>bar(l,src?.[k]||0,danger)).join(''); }
  function verdict(site){ const t=tier(site); if(t==='extreme') return 'Recompensa alta, risco alto e início exigente.'; if(t==='hard') return 'Bom para uma campanha tensa, com decisões rápidas.'; if(t==='favorable') return 'Excelente para expansão e base confortável.'; if(t==='safe') return 'Pouso seguro para estabilizar a colônia cedo.'; return 'Pouso equilibrado com vantagens e problemas claros.'; }
  function plan(site){ const a=[]; if((site.resources?.wood||0)>70)a.push('Aproveite madeira próxima para abrigo e estoque cedo.'); if((site.resources?.metal||0)>60)a.push('Priorize bancada e tecnologia.'); if((site.risks?.weather||0)>65)a.push('Cubra estoque e quartos antes de expandir.'); if((site.risks?.fauna||0)>55)a.push('Evite coleta distante com colonos sozinhos.'); if((site.risks?.raids||0)>55)a.push('Monte defesa simples nos primeiros dias.'); if(!a.length)a.push('Expanda em ritmo gradual, mantendo comida e madeira perto.'); return a.slice(0,4); }

  function drawPreview(site){
    const canvas=document.getElementById('scanLandingPreviewCanvas'), sample=site?.preview?.terrainSample||[];
    if(!canvas||!sample.length) return;
    const H=sample.length,W=sample[0]?.length||1,S=14; canvas.width=W*S; canvas.height=H*S;
    const c=canvas.getContext('2d'); c.clearRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const t=sample[y]?.[x]?.type||'grass'; c.fillStyle=TILE_COLOR[t]||TILE_COLOR.grass; c.fillRect(x*S,y*S,S,S); if(['forest','stone','ruin','water','spawn','snow'].includes(t)){ c.fillStyle=t==='spawn'?'#020617':'rgba(255,255,255,.72)'; c.font='900 10px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(({forest:'♣',stone:'◆',ruin:'▣',water:'~',spawn:'⌂',snow:'✧'})[t],x*S+S/2,y*S+S/2); }}
    c.strokeStyle='rgba(255,255,255,.22)'; c.lineWidth=2; c.strokeRect(1,1,canvas.width-2,canvas.height-2);
  }

  function previewLegend(site){
    const used=new Set(); (site?.preview?.terrainSample||[]).forEach(r=>r.forEach(c=>used.add(c.type||'grass'))); used.add('spawn');
    const lab={grass:'Área verde',dirt:'Solo aberto',stone:'Rocha',sand:'Areia',forest:'Mata',water:'Água',ruin:'Ruína',snow:'Frio',spawn:'Pouso'};
    return [...used].filter(k=>TILE_COLOR[k]).map(k=>`<span><i style="--c:${TILE_COLOR[k]}"></i>${esc(lab[k]||k)}</span>`).join('');
  }

  function compare(profile,selectedId){
    return [...(profile?.landingSites||[])].sort((a,b)=>score(b)-score(a)).map(site=>`<button type="button" class="landing-compare-row ${site.id===selectedId?'selected':''}" data-landing-site-compare="${esc(site.id)}"><b>${esc(site.name)}</b><small>${score(site)}</small><small>${avg(site.resources)}</small><small>${avg(site.risks)}</small></button>`).join('');
  }

  function renderAnalysis(profile){
    const panel=document.getElementById('scanLandingAnalysis') || (()=>{ const p=document.createElement('div'); p.id='scanLandingAnalysis'; p.className='landing-analysis'; const grid=document.querySelector('.scan-grid'); grid?.insertBefore(p,document.getElementById('scanMetrics')?.parentElement||grid.children[1]||null); return p; })();
    const site=selected(profile);
    if(!panel||!site){ if(panel) panel.innerHTML='<div class="landing-warning">Selecione um ponto no globo para analisar o pouso.</div>'; return; }
    const warn=tier(site)==='extreme'?'<div class="landing-warning"><b>Alerta orbital:</b> local de alto risco, mas com recompensas fortes.</div>':tier(site)==='hard'?'<div class="landing-warning"><b>Atenção:</b> pouso exigente. Planeje abrigo, comida e defesa.</div>':'';
    panel.innerHTML=`${warn}<div class="landing-hero"><div><h2>${esc(site.name)}</h2><p>${esc(verdict(site))}</p><div class="landing-mini-tags">${[BIOME[site.biomes?.primary]||site.biomes?.primary,site.difficulty?.label,...(site.biomes?.secondary||[]).slice(0,3).map(x=>BIOME[x]||x)].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div><div class="landing-score"><small>Score</small><b>${score(site)}</b><small>${esc(site.difficulty?.label||'Moderado')}</small></div></div><div class="landing-grid"><div class="landing-card"><h3>Recursos próximos</h3>${rows(site,RES,false)}</div><div class="landing-card"><h3>Riscos do setor</h3>${rows(site,RISK,true)}</div><div class="landing-card"><h3>Vantagens reais</h3><ul class="landing-list">${(site.positives||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="landing-card"><h3>Problemas esperados</h3><ul class="landing-list">${(site.negatives||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="landing-card full"><h3>Plano recomendado</h3><ul class="landing-list">${plan(site).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="landing-card full"><h3>Prévia aproximada do pouso</h3><div class="landing-preview-wrap"><canvas id="scanLandingPreviewCanvas" class="landing-preview"></canvas><div class="landing-preview-legend">${previewLegend(site)}</div></div><small>Preview leve. O mapa final ainda passa pelo gerador completo.</small></div><div class="landing-card full"><h3>Comparação rápida</h3><div class="landing-compare"><div class="landing-compare-row" style="cursor:default"><b>Local</b><small>Score</small><small>Rec.</small><small>Risco</small></div>${compare(profile,site.id)}</div></div></div>`;
    drawPreview(site);
    panel.querySelectorAll('[data-landing-site-compare]').forEach(b=>b.addEventListener('click',ev=>{ ev.preventDefault(); ev.stopPropagation(); selectLandingSite(b.dataset.landingSiteCompare); }));
  }

  function metricRows(profile){ const m=profile?.metrics||{}; return [['Densidade geológica',m.geology],['Atividade biológica',m.biology],['Instabilidade climática',m.climate,true],['Ruído atmosférico',m.noise,true],['Integridade orbital',m.landing]].map(([l,v,a])=>{const n=clamp(Math.round(v||0),0,100); return `<div class="scan-data-row"><span>${esc(l)}</span><div class="scan-segments ${a?'amber':''}">${Array.from({length:10},(_,i)=>`<i class="${i<Math.round(n/10)?'on':''}"></i>`).join('')}</div><b>${n}%</b></div>`;}).join('');}
  function sigCards(profile){ const site=selected(profile), list=site?.signatures?.length?site.signatures:(profile?.signatures||[]); return list.map((s,i)=>`<div class="scan-signature-card"><b>${esc(s.name||s.kind||'Assinatura orbital')}</b><small>Assinatura ${String(i+1).padStart(2,'0')} · risco ${esc(s.risk||'moderado')}${s.positive?` · ${esc(s.positive)}`:''}</small></div>`).join('');}
  function legend(profile){ return Object.entries(profile?.biomeStats||{}).filter(([,v])=>Number(v)>0).sort((a,b)=>Number(b[1])-Number(a[1])).map(([k,v])=>`<span class="scan-biome-chip"><i style="background:${TIER_COLOR.moderate}"></i>${esc(BIOME[k]||k)} ${Number(v)}%</span>`).join('');}

  function selectLandingSite(id){
    const next=typeof selectLandingSiteInConfig==='function'?selectLandingSiteInConfig(ensure(),id):{...ensure(),selectedLandingSiteId:id};
    if(typeof newGameConfig!=='undefined') newGameConfig=next;
    refreshPlanetScan(next);
    if(typeof updateSetupSummary==='function') updateSetupSummary();
  }

  function refreshPlanetScan(config=null){
    injectStyle();
    const active=ensure(config);
    if(typeof newGameConfig!=='undefined') newGameConfig=active;
    const profile=active.planetScan, site=selected(profile);
    drawPlanet(profile,active); renderMarkers(profile); renderAnalysis(profile);
    const title=document.getElementById('scanSectorTitle'), meta=document.getElementById('scanSectorMeta'), metrics=document.getElementById('scanMetrics'), sig=document.getElementById('scanSignatures'), log=document.getElementById('scanProcessingLog'), label=document.getElementById('scanRadarLabel');
    let bio=document.getElementById('scanBiomeLegend'); if(!bio){ bio=document.createElement('div'); bio.id='scanBiomeLegend'; bio.className='scan-biome-legend'; document.querySelector('.scan-hologram-panel')?.appendChild(bio); }
    if(title) title.textContent=active.colonyName||'Primeiro Refúgio';
    if(meta) meta.textContent=`Seed ${active.seed||'sem seed'} · ${profile?.sectorId||'setor'} · pouso ${site?.name||'não selecionado'}`;
    if(metrics) metrics.innerHTML=metricRows(profile);
    if(sig) sig.innerHTML=sigCards(profile);
    if(label) label.innerHTML=`<span>VARREDURA</span><b>${(profile?.landingSites||[]).length} LOCAIS</b>`;
    if(bio) bio.innerHTML=legend(profile);
    const proceed=dom?.buttons?.scanProceed||document.getElementById('scanProceedBtn'); if(proceed){ proceed.disabled=!site; proceed.classList.toggle('pulse-ready',!!site); proceed.textContent=site?`Continuar com ${site.name}`:'Selecione um ponto no globo'; }
    if(log) log.innerHTML=['Varredura planetária estabilizada.',`${(profile?.landingSites||[]).length} locais de pouso encontrados.`,site?`Selecionado: ${site.name} · score ${score(site)}/100 · risco ${avg(site.risks)}.`:'Selecione um ponto no globo.','O ponto escolhido altera spawn, clareira, recursos, clima e pontos de interesse.'].map(x=>`<span>${esc(x)}</span>`).join('');
    window.HavenfallPlanetScanDebug={config:active,planetScan:profile,selectedLandingSite:site,landingSites:profile?.landingSites||[]};
  }

  window.refreshPlanetScan=refreshPlanetScan;
  window.selectLandingSite=selectLandingSite;
})();
