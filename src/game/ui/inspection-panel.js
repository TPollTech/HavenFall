'use strict';
(() => {
  if (window.HavenfallContext?.inspectionPanelInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.inspectionPanelInstalled = true;

  const stateUi = { open: false, target: null, timer: 0, sig: '' };
  const mobNames = { wolf:'Lobo', blood_wolf:'Lobo sangrento', spider:'Aranha', rabbit:'Coelho', deer:'Cervo', goat:'Cabra', sheep:'Ovelha', pig:'Porco', cow:'Vaca', chicken:'Galinha', duck:'Pato', turkey:'Peru', squirrel:'Esquilo', turtle:'Tartaruga' };
  const terrainNames = { grass:'Grama', dirt:'Terra', sand:'Areia', stone:'Pedra', water:'Água' };
  const lifeNames = { baby:'Filhote', juvenile:'Jovem', adult:'Adulto', elder:'Idoso' };
  const mobStates = { wander:'Vagando', grazing:'Pastando', sleep:'Dormindo', flee:'Fugindo', hunting:'Caçando', attack:'Atacando', chasing:'Perseguindo', idle:'Parado' };
  const taskLabels = {
    move: 'Em deslocamento', gather: 'Coletando', build: 'Construindo', haul: 'Transportando', sleep: 'Dormindo',
    research: 'Pesquisando', craft: 'Fabricando', mine: 'Minerando', forge: 'Forjando', cook: 'Cozinhando',
    heal: 'Tratamento médico', inspect: 'Investigando', loot: 'Vasculhando', inspectPoi: 'Investigando ponto',
    combat: 'Em combate', scare: 'Defesa', leisure: 'Lazer'
  };

  function esc(v){ const s=String(v??''); return typeof escapeHtml==='function'?escapeHtml(s):s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function n(v,f=0){ v=Number(v); return Number.isFinite(v)?v:f; }
  function pct(v,max=100){ return Math.max(0,Math.min(100,Math.round(n(v)/Math.max(1,n(max,100))*100))); }
  function bar(label,value,max=100,tone=''){ return { label,value:pct(value,max),tone }; }
  function vital(c,key,fallback=0){
    const direct = Number(c?.[key]);
    if (Number.isFinite(direct)) return Math.max(0, Math.min(100, direct));
    const aliases = { energy:['energy','sleep'], mood:['mood','comfort'], hunger:['hunger'], health:['health'] }[key] || [key];
    for (const alias of aliases) {
      const raw = Number(c?.needs?.[alias]);
      if (Number.isFinite(raw)) return Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));
    }
    return fallback;
  }
  function discovered(x,y){ return typeof isTileDiscovered!=='function'||isTileDiscovered(x,y); }
  function visible(x,y){ return typeof isTileVisible!=='function'||isTileVisible(x,y); }
  function inside(x,y){ return typeof isInside!=='function'||isInside(x,y); }
  function selectedC(){ return typeof selectedColonist==='function'?selectedColonist():state?.colonists?.find(c=>c.id===selectedColonistId); }
  function hostileType(type){ return typeof isHostileMobType==='function'?isHostileMobType(type):['wolf','blood_wolf','spider'].includes(type); }
  function mobRadius(m){ return ({ cow:30, deer:26, goat:24, sheep:24, pig:24, wolf:24, blood_wolf:25, spider:23, rabbit:18, squirrel:17, chicken:16, duck:17, turkey:18, turtle:18 })[m?.type]||22; }

  function worldPointFromEvent(e){
    const r=canvas?.getBoundingClientRect?.(); if(!r||!r.width||!canvas.width||!viewTransform) return null;
    const px=(e.clientX-r.left)*(canvas.width/r.width), py=(e.clientY-r.top)*(canvas.height/r.height), s=Math.max(.01,viewTransform.scale||1);
    return { wx:(px-viewTransform.offsetX)/s, wy:(py-viewTransform.offsetY)/s, x:Math.floor((px-viewTransform.offsetX)/s/TILE), y:Math.floor((py-viewTransform.offsetY)/s/TILE) };
  }
  function distEntity(e,wx,wy){ const px=n(e?.px,(e?.x||0)*TILE+TILE/2), py=n(e?.py,(e?.y||0)*TILE+TILE/2); return Math.hypot(px-wx,py-wy); }
  function findById(list,id){ return (list||[]).find(x=>String(x.id)===String(id)); }
  function mobsAll(){ return [...(state?.mobs||[]),...(state?.wolves||[]).map(w=>({...w,type:w.type||'wolf'})),...(state?.hostiles||[])]; }
  function entityAtMobile(list,kind,wx,wy){ let best=null,bd=9999; for(const m of list){ if(!visible(Math.round(m.x),Math.round(m.y))) continue; const d=distEntity(m,wx,wy); if(d<=mobRadius(m)&&d<bd){best=m;bd=d;} } return best?{kind,id:best.id,type:best.type,x:best.x,y:best.y}:null; }
  function hitColonist(wx,wy){ let best=null,bd=9999; for(const c of state?.colonists||[]){ if(!visible(Math.round(c.x),Math.round(c.y))) continue; const d=distEntity(c,wx,wy); if(d<28&&d<bd){best=c;bd=d;} } return best?{kind:'colonist',id:best.id,x:best.x,y:best.y}:null; }
  function objKind(o){ if(o?.type==='blueprint')return'blueprint'; if(o?.itemKey)return'item'; const d=objectDefs?.[o?.type]||{}; if(d.interactable||o?.poiId||['ruin','cache','supply_crate'].includes(o?.type))return'poi'; if(d.gather||['tree','bush','rock','ore','logs','berry','herbs','mushrooms','dry_twigs','oak_tree','birch_tree','pine_tree','palm_tree','willow_tree'].includes(o?.type))return'resource'; return'building'; }
  function hitObject(p){
    const list=state?.objects||state?.world?.objects||[], out=[];
    for(const o of list){ if(!discovered(o.x,o.y)||Math.abs(o.x-p.x)>2||Math.abs(o.y-p.y)>3) continue; const tall=['tree','oak_tree','birch_tree','pine_tree','palm_tree','willow_tree'].includes(o.type); const bx=o.x*TILE+TILE/2, by=(o.y+1)*TILE, w=TILE*.82, h=tall?TILE*2:TILE*1.15; if(p.wx>=bx-w/2&&p.wx<=bx+w/2&&p.wy>=by-h&&p.wy<=by+TILE*.12) out.push(o); }
    out.sort((a,b)=>b.y-a.y); const o=out[0]||(discovered(p.x,p.y)&&typeof getObjectAt==='function'?getObjectAt(p.x,p.y):null); return o?{kind:objKind(o),id:o.id,x:o.x,y:o.y}:null;
  }
  function hitRock(p){ if(!discovered(p.x,p.y)||typeof getRockAt!=='function') return null; const r=getRockAt(p.x,p.y); return r?.solid?{kind:'rock',x:p.x,y:p.y}:null; }
  function hitPoi(p){ if(!discovered(p.x,p.y)||typeof getPoiAt!=='function')return null; const poi=getPoiAt(p.x,p.y); return poi?{kind:'poi',id:poi.id||`${poi.x},${poi.y}`,x:poi.x,y:poi.y}:null; }
  function resolveAt(wx,wy,tile=null){ const p=tile?{...tile,wx,wy}:{wx,wy,x:Math.floor(wx/TILE),y:Math.floor(wy/TILE)}; if(!inside(p.x,p.y))return null; const host=mobsAll().filter(m=>hostileType(m.type)||m.hostile); const animals=mobsAll().filter(m=>!hostileType(m.type)&&!m.hostile); return hitColonist(wx,wy)||entityAtMobile(host,'hostile',wx,wy)||entityAtMobile(animals,'animal',wx,wy)||hitObject(p)||hitRock(p)||hitPoi(p)||{kind:'tile',x:p.x,y:p.y}; }
  function inspectCanvasEvent(e,opt={}){ if(!state||appScreen!==SCREEN.PLAYING) return false; const p=worldPointFromEvent(e); if(!p) return false; const t=resolveAt(p.wx,p.wy,opt.tile); if(!t) return false; selectTarget(t); return true; }

  function entity(){ const t=stateUi.target; if(!t)return null; if(t.kind==='colonist')return state?.colonists?.find(c=>Number(c.id)===Number(t.id)); if(t.kind==='animal'||t.kind==='hostile')return findById(mobsAll(),t.id); if(['building','resource','blueprint','item'].includes(t.kind))return findById(state?.objects||state?.world?.objects,t.id); if(t.kind==='poi')return findById(state?.objects||state?.world?.objects,t.id)||(state?.world?.pointsOfInterest||[]).find(p=>String(p.id||`${p.x},${p.y}`)===String(t.id)||p.x===t.x&&p.y===t.y); if(t.kind==='rock')return typeof getRockAt==='function'?getRockAt(t.x,t.y):{solid:true}; if(t.kind==='tile')return state?.terrain?.[t.y]?.[t.x]?{terrain:state.terrain[t.y][t.x],x:t.x,y:t.y}:null; return null; }
  function biomeAtLabel(x,y){ const id=state?.world?.biomes?.[y]?.[x]||(typeof biomeAt==='function'?biomeAt(x,y):null); return window.BiomeRegistry?.get?.(id)?.label||id||'—'; }
  function zoneAtLabel(x,y){ const type=window.zoneSystem?.getZoneAt?.(x,y); return typeof zoneLabel==='function'?zoneLabel(type):type||'Sem zona'; }
  function roofAtLabel(x,y){ return typeof hasRoofAt==='function'&&hasRoofAt(x,y)?'coberto':'sem cobertura'; }
  function lightAtLabel(x,y){ const v=state?.world?.lightMap?.[y]?.[x]; return v===undefined?'—':`${Math.round(n(v)*100)}%`; }
  function resText(g){ return g?Object.entries(g).map(([k,v])=>`${v} ${({wood:'madeira',stone:'pedra',metal:'metal',food:'comida',medicine:'remédio'})[k]||k}`).join(' · '):'—'; }
  function actionList(...ids){ return ids.map(([id,label])=>({id,label})); }

  function colonistTaskLabel(c) {
    const task = c?.task;
    if (!task?.type) return 'Ocioso';
    const base = taskLabels[task.type] || task.type;
    if (task.type === 'move' && Number.isFinite(Number(task.x)) && Number.isFinite(Number(task.y))) return `${base} para ${Math.round(task.x)}, ${Math.round(task.y)}`;
    if (task.type === 'sleep') return task.bedId ? 'Dormindo na cama' : 'Descansando onde está';
    if (task.type === 'leisure') return 'Relaxando';
    return base;
  }

  function colonistStatus(c) {
    const health = vital(c, 'health', 100);
    const hunger = vital(c, 'hunger', 100);
    const energy = vital(c, 'energy', 100);
    const mood = vital(c, 'mood', 70);
    if (health <= 20) return { label: 'Saúde crítica', danger: 2 };
    if (hunger <= 15) return { label: 'Fome crítica', danger: 2 };
    if (energy <= 8) return { label: 'Exausto', danger: 2 };
    if (mood <= 10) return { label: 'Humor crítico', danger: 2 };
    if (health <= 35) return { label: 'Ferido', danger: 1 };
    if (hunger <= 30) return { label: 'Com fome', danger: 1 };
    if (energy <= 12) return { label: 'Exausto', danger: 1 };
    if (mood <= 25) return { label: 'Humor baixo', danger: 1 };
    if (c?.task?.type === 'sleep') return { label: 'Dormindo', danger: 0 };
    if (c?.task?.type === 'leisure') return { label: energy < 35 ? 'Recuperando energia' : 'Relaxando', danger: 0 };
    if (c?.task?.type && c.task.type !== 'move') return { label: 'Trabalhando', danger: 0 };
    if (energy >= 90) return { label: 'Totalmente descansado', danger: 0 };
    return { label: 'Estável', danger: 0 };
  }

  function model(){ const t=stateUi.target,e=entity(); if(!t) return null; if(!e&&t.kind!=='tile'&&t.kind!=='rock') return {kind:t.kind,title:'Alvo indisponível',subtitle:'referência perdida',status:'Não está mais disponível',danger:1,bars:[],chips:['desatualizado'],sections:[['Estado',[['Referência',t.id||`${t.x},${t.y}`]]]],actions:actionList(['close','Fechar'])}; if(t.kind==='colonist')return modelColonist(e); if(t.kind==='animal')return modelAnimal(e,false); if(t.kind==='hostile')return modelAnimal(e,true); if(['resource','building','blueprint','item','poi'].includes(t.kind))return modelObject(e,t.kind); if(t.kind==='rock')return modelRock(e,t.x,t.y); return modelTile(t.x,t.y); }

  function modelColonist(c){
    if(typeof ensureColonistMeta==='function')ensureColonistMeta(c);
    if(typeof ensureEquipment==='function')ensureEquipment(c);
    const traits=[...(c.physicalTraits||[]),...(c.positiveTraits||[]),...(c.negativeTraits||[])].filter(Boolean);
    const sk=c.skills||{}, eq=c.equipment||{};
    const status = colonistStatus(c);
    const taskLabel = colonistTaskLabel(c);
    const note = c.note && ![status.label, taskLabel].includes(c.note) ? c.note : null;
    const currentRows = [
      ['Estado', status.label],
      ['Tarefa', taskLabel],
      ['Prioridade', priorityDefs?.[c.priority]?.label||c.priority||'—'],
      ['Local', `${Math.round(c.x)}, ${Math.round(c.y)}`]
    ];
    if (note) currentRows.push(['Nota', note]);
    return {
      kind:'colonist',
      title:c.name||'Colono',
      subtitle:`Colono · ${c.role||'sem função'} · ${c.age??'?'} anos`,
      status:status.label,
      danger:status.danger,
      bars:[bar('Saúde',vital(c,'health',100)),bar('Fome',vital(c,'hunger',100)),bar('Energia',vital(c,'energy',100)),bar('Humor',vital(c,'mood',70))],
      chips:traits.length?traits:['sem traços'],
      sections:[
        ['Estado atual', currentRows],
        ['Habilidades',[['Coleta',sk.coleta??'—'],['Construção',sk.construcao??'—'],['Defesa',sk.defesa??'—'],['Pesquisa',sk.pesquisa??'—'],['Medicina',sk.medicina??'—']]],
        ['Equipamento',[['Ferramenta',itemDefs?.[eq.tool]?.label||eq.tool||'vazio'],['Arma',itemDefs?.[eq.weapon]?.label||eq.weapon||'vazio'],['Apoio',itemDefs?.[eq.offhand]?.label||eq.offhand||'vazio']]]
      ],
      actions:actionList(['center','Centralizar'],['colonistDetails','Ficha completa'],['close','Fechar'])
    };
  }

  function modelAnimal(m,hostile){ const hp=m.hp??m.health??100,max=m.maxHp??m.maxHealth??100,stage=m.ageStage||m.lifeStage||'adult'; return {kind:hostile?'hostile':'animal',title:m.name||mobNames[m.type]||m.type||'Animal',subtitle:`${hostile?'Hostil':'Animal'} · ${lifeNames[stage]||stage} · ${hostile?'ameaça':'neutro'}`,status:mobStates[m.state]||m.state||'Vagando',danger:hostile?2:hp<max*.35?1:0,bars:[bar('Saúde',hp,max,hostile?'danger':''),bar('Fome',m.hunger??70),bar('Medo',m.fear??0)],chips:[lifeNames[stage]||stage,hostile?'hostil':'selvagem',m.domesticState||'não domesticado'],sections:[['Comportamento',[['Estado',mobStates[m.state]||m.state||'—'],['Espécie',mobNames[m.type]||m.type||'—'],['Local',`${Math.round(m.x)}, ${Math.round(m.y)}`]]],['Leitura',[['Bioma',biomeAtLabel(Math.round(m.x),Math.round(m.y))],['Perigo',hostile?'alto':'baixo'],['Alvo',m.target||'—']]]],actions:actionList(['center','Centralizar'],['close','Fechar'])}; }
  function modelObject(o,kind){ if(kind==='blueprint'){const b=buildDefs?.[o.buildType]||{};return{kind,title:`Planta: ${b.label||o.buildType}`,subtitle:'Construção planejada',status:'Aguardando trabalho',danger:0,bars:[bar('Progresso',o.progress||0,b.work||1)],chips:['blueprint',b.type||'obra'],sections:[['Obra',[['Materiais',typeof itemCostText==='function'?itemCostText(b.cost||{},b.itemCost||{}):'—'],['Local',`${o.x}, ${o.y}`]]]],actions:actionList(['center','Centralizar'],['buildNow','Construir'],['close','Fechar'])};} if(kind==='item'){const it=itemDefs?.[o.itemKey]||{};return{kind,title:it.label||o.lootLabel||o.itemKey||'Item',subtitle:`Item · x${o.amount||1}`,status:o.reservedBy?'Reservado':'Disponível',danger:0,bars:[],chips:['item',it.slot?`equipável`:'coletável'],sections:[['Informações',[['Quantidade',o.amount||1],['Categoria',it.category||it.slot||'geral'],['Local',`${o.x}, ${o.y}`]]]],actions:actionList(['center','Centralizar'],['haulItem','Levar ao estoque'],['close','Fechar'])};} const d=objectDefs?.[o.type]||{},g=d.gather,title=d.name||({oak_tree:'Carvalho',birch_tree:'Bétula',pine_tree:'Pinheiro',palm_tree:'Palmeira',willow_tree:'Salgueiro'})[o.type]||o.type; const isRes=kind==='resource'; const actions=[['center','Centralizar']]; if(isRes&&g)actions.push(['toggleGather',o.markedForGather?'Desmarcar coleta':'Marcar coleta'],['gatherNow','Coletar agora']); if(['bench','forge','stove','med_station','sewing_table','smokehouse','butcher_table'].includes(o.type))actions.push(['openCraft','Abrir estação']); if(d.interactable)actions.push(['inspectPoi',o.inspected?'Examinar':'Investigar']); actions.push(['close','Fechar']); return{kind,title,subtitle:`${isRes?'Recurso natural':d.interactable?'Ponto de interesse':'Construção'} · ${o.type}`,status:o.markedForGather?'Marcado para coleta':o.inspected?'Inspecionado':'Disponível',danger:d.interactable&&!o.inspected?1:0,bars:o.growth!==undefined?[bar('Crescimento',o.growth)]:[],chips:[isRes?'recurso':'construção',d.blocks?'bloqueia':'caminhável',g?'coletável':''],sections:[isRes?['Coleta',[['Produz',resText(g)],['Trabalho',`${d.work||1}`],['Marcado',o.markedForGather?'sim':'não']]]:['Estado',[['Função',({bed:'descanso',campfire:'calor',crate:'armazenamento',research_desk:'pesquisa',forge:'metalurgia',stove:'cozinha',med_station:'tratamento',crop:'plantio'})[o.type]||'objeto'],['Bloqueia',d.blocks?'sim':'não'],['Local',`${o.x}, ${o.y}`]]]],actions:actionList(...actions)}; }
  function modelRock(r,x,y){ const label=typeof geologyLabelAt==='function'?geologyLabelAt(x,y):'Rocha'; return{kind:'rock',title:label,subtitle:'Terreno rochoso · mineração',status:r.markedForMining?'Marcado para mineração':'Disponível',danger:0,bars:[bar('Dureza',r.hardness||70)],chips:['rocha','mineração',r.markedForMining?'marcada':'não marcada'],sections:[['Mineração',[['Local',`${x}, ${y}`],['Bloqueia','sim'],['Minério',r.ore?'possível':'não detectado']]]],actions:actionList(['center','Centralizar'],['mineNow','Minerar'],['toggleMine',r.markedForMining?'Desmarcar':'Marcar'],['close','Fechar'])}; }
  function modelTile(x,y){ const terrain=state?.terrain?.[y]?.[x]||'grass',blocked=typeof isBlocked==='function'?isBlocked(x,y):terrain==='stone',buildable=typeof canPlace==='function'?canPlace('campfire',x,y):!blocked; return{kind:'tile',title:'Terreno',subtitle:`${terrainNames[terrain]||terrain} · ${x}, ${y}`,status:visible(x,y)?'Visível':discovered(x,y)?'Descoberto':'Desconhecido',danger:blocked?1:0,bars:[],chips:[terrainNames[terrain]||terrain,blocked?'bloqueado':'caminhável',buildable?'construível':'não construível'],sections:[['Informações',[['Coordenada',`${x}, ${y}`],['Bioma',biomeAtLabel(x,y)],['Zona',zoneAtLabel(x,y)],['Caminhável',blocked?'não':'sim'],['Construível',buildable?'sim':'não'],['Cobertura',roofAtLabel(x,y)],['Luz',lightAtLabel(x,y)]]]],actions:actionList(['moveHere','Mover para cá'],['center','Centralizar'],['close','Fechar'])}; }

  function selectTarget(t){ if(!t)return false; stateUi.open=true; stateUi.target={...t,id:t.id??undefined}; stateUi.timer=0; stateUi.sig=''; state.ui=state.ui||{}; state.ui.inspection={open:true,targetKind:t.kind,targetId:t.id??null,x:t.x??null,y:t.y??null,selectedAt:performance.now()}; if(t.kind==='colonist')selectedColonistId=Number(t.id); else if(t.id&&['building','resource','blueprint','item','poi'].includes(t.kind))selectedWorldObjectId=t.id; else selectedWorldObjectId=null; render(true); return true; }
  function selectById(kind,id){ return selectTarget({kind,id}); }
  function clear(){ stateUi.open=false; stateUi.target=null; stateUi.sig=''; selectedWorldObjectId=null; if(state?.ui?.inspection)state.ui.inspection={...state.ui.inspection,open:false,targetKind:null,targetId:null,x:null,y:null}; const p=document.getElementById('inspectionPanel'); if(p){p.classList.remove('show');p.setAttribute('aria-hidden','true');} }
  function ensure(){ styles(); let p=document.getElementById('inspectionPanel'); if(!p){p=document.createElement('aside');p.id='inspectionPanel';p.className='inspection-panel';p.setAttribute('aria-hidden','true');p.addEventListener('click',panelClick);document.body.appendChild(p);} return p; }

  function styles(){
    if(document.getElementById('inspection-panel-styles'))return;
    const s=document.createElement('style');
    s.id='inspection-panel-styles';
    s.textContent=`
      .inspection-panel{position:fixed;left:18px;top:12px;bottom:104px;width:min(432px,calc(100vw - 36px));max-height:none;z-index:6200;display:none;overflow:hidden;box-sizing:border-box;border:1px solid rgba(121,199,232,.25);border-radius:18px;background:linear-gradient(180deg,rgba(13,21,34,.97),rgba(7,12,20,.95));box-shadow:0 24px 70px rgba(0,0,0,.45);color:#f4efe4;backdrop-filter:blur(10px)}
      .inspection-panel.show{display:block}.inspection-scroll{height:100%;max-height:none;overflow:auto;padding:16px;box-sizing:border-box;scrollbar-width:thin;scrollbar-color:rgba(121,199,232,.48) rgba(7,12,20,.92)}
      .inspection-scroll::-webkit-scrollbar{width:9px}.inspection-scroll::-webkit-scrollbar-track{background:rgba(7,12,20,.92);border-radius:99px}.inspection-scroll::-webkit-scrollbar-thumb{background:linear-gradient(180deg,rgba(121,199,232,.72),rgba(58,103,136,.86));border-radius:99px;border:2px solid rgba(7,12,20,.94)}.inspection-scroll::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,rgba(151,219,246,.9),rgba(76,128,164,.95))}
      .inspection-head{position:sticky;top:-16px;z-index:2;display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.09);padding:16px 0 12px;margin:-16px 0 12px;background:linear-gradient(180deg,rgba(13,21,34,.99),rgba(13,21,34,.96))}.inspection-k{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#79c7e8;font-weight:950}.inspection-title{margin:3px 0;font-size:22px;line-height:1.05}.inspection-sub{font-size:13px;color:#aeb8c7;font-weight:800}.inspection-close{flex:0 0 auto;width:38px;height:38px;border-radius:13px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.075);color:#f4efe4;font-size:22px;font-weight:950;cursor:pointer}.inspection-close:hover{background:rgba(255,255,255,.13)}
      .inspection-status{padding:12px 14px;border-radius:15px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.085);font-size:15px;font-weight:950;margin-bottom:12px}.inspection-panel.danger-1 .inspection-status{background:rgba(244,196,107,.13);border-color:rgba(244,196,107,.32);color:#ffd37a}.inspection-panel.danger-2 .inspection-status{background:rgba(255,105,97,.13);border-color:rgba(255,105,97,.36);color:#ff9c94}
      .inspection-bars{display:grid;gap:10px;margin:12px 0}.inspection-bar{display:grid;grid-template-columns:92px 1fr 48px;align-items:center;gap:10px;font-size:14px}.inspection-bar>span{white-space:nowrap}.inspection-track{height:10px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden}.inspection-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#79c7e8,#9bd36a)}.inspection-fill.warn{background:linear-gradient(90deg,#f4c46b,#e69d42)}.inspection-fill.danger{background:linear-gradient(90deg,#ff6961,#d74e45)}
      .inspection-chips{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.inspection-chip{border:1px solid rgba(121,199,232,.24);background:rgba(121,199,232,.10);border-radius:99px;padding:6px 10px;font-size:12px;font-weight:900;color:#d9edf7}.inspection-section{border-top:1px solid rgba(255,255,255,.08);padding-top:13px;margin-top:13px}.inspection-section h4{margin:0 0 10px;font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:#f4c46b}.inspection-row{display:grid;grid-template-columns:136px 1fr;gap:12px;font-size:14px;padding:5px 0}.inspection-row span{color:#9da9b8;font-weight:900}.inspection-row b{min-width:0;overflow-wrap:anywhere}.inspection-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.inspection-actions button{border:1px solid rgba(121,199,232,.22);background:rgba(121,199,232,.10);color:#f4efe4;border-radius:10px;padding:8px 10px;font-weight:950;cursor:pointer}.inspection-actions button:hover{background:rgba(121,199,232,.17)}
      @media(max-width:760px){.inspection-panel{left:10px;right:10px;top:8px;bottom:88px;width:auto;max-height:none}.inspection-scroll{height:100%;max-height:none}.inspection-row{grid-template-columns:98px 1fr}.inspection-bar{grid-template-columns:76px 1fr 42px}}
    `;
    document.head.appendChild(s);
  }

  function kindLabel(k){return({colonist:'colono',animal:'animal',hostile:'ameaça',resource:'recurso',building:'construção',blueprint:'planta',item:'item',poi:'POI',rock:'rocha',tile:'terreno'})[k]||k||'alvo';}
  function barsHtml(b){return b?.length?`<div class="inspection-bars">${b.map(x=>{const tone=x.tone||(x.value<30?'danger':x.value<55?'warn':'');return`<div class="inspection-bar"><span>${esc(x.label)}</span><div class="inspection-track"><div class="inspection-fill ${tone}" style="width:${x.value}%"></div></div><b>${x.value}%</b></div>`}).join('')}</div>`:'';}
  function sectionsHtml(sections){return(sections||[]).map(([title,rows])=>`<section class="inspection-section"><h4>${esc(title)}</h4>${(rows||[]).map(r=>`<div class="inspection-row"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}</section>`).join('');}
  function render(force=false){ if(!stateUi.open)return; const m=model(); if(!m){clear();return;} const sig=JSON.stringify(m); if(!force&&sig===stateUi.sig)return; stateUi.sig=sig; const p=ensure(); p.className=`inspection-panel show danger-${m.danger||0}`; p.setAttribute('aria-hidden','false'); p.innerHTML=`<div class="inspection-scroll"><header class="inspection-head"><div><div class="inspection-k">Inspeção · ${esc(kindLabel(m.kind))}</div><h3 class="inspection-title">${esc(m.title)}</h3><div class="inspection-sub">${esc(m.subtitle||'')}</div></div><button class="inspection-close" data-inspection-action="close">×</button></header>${m.status?`<div class="inspection-status">${esc(m.status)}</div>`:''}${barsHtml(m.bars)}<div class="inspection-chips">${(m.chips||[]).filter(Boolean).slice(0,14).map(c=>`<span class="inspection-chip">${esc(c)}</span>`).join('')}</div>${sectionsHtml(m.sections)}<div class="inspection-actions">${(m.actions||[]).map(a=>`<button data-inspection-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div></div>`; }
  function panelClick(e){ const b=e.target.closest?.('[data-inspection-action]'); if(!b)return; e.preventDefault(); runAction(b.dataset.inspectionAction); }
  function runAction(id){ const t=stateUi.target,e=entity(),c=selectedC(); if(id==='close')return clear(); if(id==='center')return centerOnTarget(); if(id==='colonistDetails'&&t?.kind==='colonist'&&typeof openColonistDetailsModal==='function')return openColonistDetailsModal(Number(t.id)); if(id==='toggleGather'&&e&&typeof toggleGatherMark==='function')toggleGatherMark(e); if(id==='gatherNow'&&e&&c&&typeof assignGather==='function')assignGather(c,e); if(id==='openCraft'&&e&&typeof openCraftingForStation==='function')openCraftingForStation(e); if(id==='buildNow'&&e&&c&&typeof assignBuild==='function')assignBuild(c,e); if(id==='haulItem'&&e&&c&&typeof assignHaulTask==='function'&&!assignHaulTask(c,e)&&typeof log==='function')log('Crie uma zona de estoque ou depósito para guardar esse item.'); if(id==='inspectPoi'&&e&&c&&typeof assignInspect==='function')assignInspect(c,e); if(id==='mineNow'&&t&&c&&typeof assignMine==='function')assignMine(c,t.x,t.y,true); if(id==='toggleMine'&&t&&typeof toggleRockMiningMark==='function')toggleRockMiningMark(t.x,t.y); if(id==='moveHere'&&t&&c&&typeof assignMove==='function')assignMove(c,t.x,t.y); render(true); if(typeof updateUI==='function')updateUI(true); }
  function centerOnTarget(){ const t=stateUi.target,e=entity(); const x=n(e?.px,((t?.x??e?.x??0)*TILE+TILE/2)),y=n(e?.py,((t?.y??e?.y??0)*TILE+TILE/2)); camera.x=x;camera.y=y; if(typeof clampCamera==='function')clampCamera(); if(typeof resizeGameCanvas==='function')resizeGameCanvas(true); }
  function tick(dt){ if(!stateUi.open)return; stateUi.timer+=dt*(state?.speed||1); if(stateUi.timer>.35){stateUi.timer=0;render(false);} }
  function color(k){return k==='colonist'?'#79c7e8':k==='animal'?'#79d7a5':k==='hostile'?'#ff6961':k==='tile'||k==='rock'?'#a6c8ff':'#f4c46b';}
  function rgba(hex,a){const n=parseInt(hex.slice(1),16);return`rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}
  function draw(){ if(!stateUi.open||!stateUi.target)return; const t=stateUi.target,e=entity(); if(!e&&t.kind!=='tile'&&t.kind!=='rock')return; const col=color(t.kind); ctx.save();ctx.lineWidth=2.4;ctx.strokeStyle=col;ctx.fillStyle=rgba(col,.16);ctx.shadowColor=col;ctx.shadowBlur=12; if(t.kind==='tile'||t.kind==='rock'){ctx.fillRect(t.x*TILE+2,t.y*TILE+2,TILE-4,TILE-4);ctx.strokeRect(t.x*TILE+2,t.y*TILE+2,TILE-4,TILE-4);}else if(['building','resource','blueprint','item','poi'].includes(t.kind)){const x=e.x*TILE+TILE/2,y=e.y*TILE+TILE/2;ctx.beginPath();ctx.ellipse(x,y+16,22,10,0,0,Math.PI*2);ctx.fill();ctx.stroke();}else{const x=n(e.px,e.x*TILE+TILE/2),y=n(e.py,e.y*TILE+TILE/2);ctx.beginPath();ctx.ellipse(x,y+20,t.kind==='hostile'?24:20,t.kind==='hostile'?10:8,0,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore(); }

  window.GameSystems?.registerWorldOverlay('inspection.selection',draw,{order:92});
  window.GameSystems?.registerTick('inspection.refresh',tick,{order:90});
  window.InspectionPanel=Object.freeze({inspectCanvasEvent,resolveInspectionTargetAt:resolveAt,selectTarget,selectById,clear,isOpen:()=>stateUi.open,refresh:()=>render(true),getTarget:()=>stateUi.target});
})();
