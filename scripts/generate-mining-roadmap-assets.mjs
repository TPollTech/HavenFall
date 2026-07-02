import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputRoot = path.join(root, 'assets', 'ui', 'mining_automation');
const docsPath = path.join(root, 'docs', 'MINING_AUTOMATION_ASSET_ROADMAP.md');
const manifestPath = path.join(outputRoot, 'asset-pack.json');
const overviewPath = path.join(outputRoot, 'overview.svg');

const COLORS = Object.freeze({
  line: '#111827',
  shadow: '#020617',
  highlight: '#f8fafc',
  metalDark: '#344155',
  metal: '#607089',
  metalLight: '#a8c7dd',
  steel: '#6b7c93',
  iron: '#7a4034',
  copper: '#d07a3d',
  bronze: '#b88449',
  gold: '#d3b04b',
  silver: '#cfd7df',
  lead: '#5f6677',
  woodDark: '#4c2f1d',
  wood: '#8e5f35',
  woodLight: '#d6a36d',
  coal: '#1f2430',
  stoneDark: '#374151',
  stone: '#5b6472',
  stoneLight: '#a4afbe',
  slag: '#7d5543',
  quartz: '#dce9ff',
  energy: '#49c774',
  energyDark: '#18623a',
  water: '#4aa7d9',
  fire: '#ef8d32',
  fireCore: '#ffd16b',
  clay: '#b46d4e',
  sulfur: '#d9d259',
  sand: '#d7bc83',
  circuit: '#1f8a70',
  hazard: '#f6b93b'
});

function attrString(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ` ${key}="${String(value)}"`)
    .join('');
}

function tag(name, attributes = {}, content = '') {
  return `<${name}${attrString(attributes)}>${content}</${name}>`;
}

function voidTag(name, attributes = {}) {
  return `<${name}${attrString(attributes)}/>`;
}

function polygon(points, attributes = {}) {
  return voidTag('polygon', { points: points.map(([x, y]) => `${x},${y}`).join(' '), ...attributes });
}

function polyline(points, attributes = {}) {
  return voidTag('polyline', { points: points.map(([x, y]) => `${x},${y}`).join(' '), ...attributes });
}

function circle(cx, cy, r, attributes = {}) {
  return voidTag('circle', { cx, cy, r, ...attributes });
}

function rect(x, y, width, height, attributes = {}) {
  return voidTag('rect', { x, y, width, height, ...attributes });
}

function line(x1, y1, x2, y2, attributes = {}) {
  return voidTag('line', { x1, y1, x2, y2, ...attributes });
}

function pathTag(d, attributes = {}) {
  return voidTag('path', { d, ...attributes });
}

function group(content, attributes = {}) {
  return tag('g', attributes, content);
}

function text(x, y, value, attributes = {}) {
  return tag('text', { x, y, ...attributes }, value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeLabel(label) {
  return String(label).replace(/[&<>"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[char]);
}

function gearPath(cx, cy, innerRadius, outerRadius, teeth = 8) {
  const steps = teeth * 2;
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (-Math.PI / 2) + (index / steps) * Math.PI * 2;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return `M ${points.map(([x, y], index) => `${index === 0 ? '' : 'L '}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')} Z`;
}

function hexPoints(cx, cy, radius) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (-Math.PI / 2) + (index / 6) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

function iconFrame(accent) {
  return [
    voidTag('ellipse', { cx: 48, cy: 80, rx: 28, ry: 9, fill: COLORS.shadow, opacity: 0.16 }),
    pathTag('M16 73 C22 69 28 71 35 72 C46 74 56 74 66 70 C71 68 76 68 81 72', {
      fill: 'none',
      stroke: accent,
      'stroke-width': 3,
      'stroke-linecap': 'round',
      opacity: 0.24
    })
  ].join('');
}

function bolt(cx, cy, fill = COLORS.highlight) {
  return circle(cx, cy, 2.2, { fill, stroke: COLORS.line, 'stroke-width': 0.9 });
}

function plate(x, y, width, height, fill, accent = null) {
  return [
    rect(x, y, width, height, { rx: 8, fill, stroke: COLORS.line, 'stroke-width': 2.4 }),
    accent ? rect(x + 5, y + 5, width - 10, 6, { rx: 3, fill: accent, opacity: 0.7 }) : '',
    bolt(x + 7, y + 7),
    bolt(x + width - 7, y + 7),
    bolt(x + 7, y + height - 7),
    bolt(x + width - 7, y + height - 7)
  ].join('');
}

function hazardStripe(x, y, width, height) {
  const stripes = [];
  for (let cursor = x - 4; cursor < x + width + 8; cursor += 8) {
    stripes.push(pathTag(`M${cursor} ${y + height} L${cursor + 8} ${y}`, {
      stroke: COLORS.line,
      'stroke-width': 4,
      opacity: 0.42
    }));
  }
  return [
    rect(x, y, width, height, { rx: 4, fill: COLORS.hazard, stroke: COLORS.line, 'stroke-width': 1.8 }),
    ...stripes
  ].join('');
}

function rockBase(mainFill, accentFill, detail = 'specks') {
  const layers = [
    polygon([[18, 60], [24, 36], [43, 22], [66, 24], [80, 43], [74, 66], [54, 78], [30, 74]], {
      fill: mainFill,
      stroke: COLORS.line,
      'stroke-width': 2.8,
      'stroke-linejoin': 'round'
    }),
    polygon([[28, 56], [34, 40], [49, 32], [62, 35], [69, 49], [62, 62], [44, 68], [33, 64]], {
      fill: accentFill,
      opacity: 0.28,
      stroke: COLORS.line,
      'stroke-width': 1.1,
      'stroke-linejoin': 'round'
    }),
    line(31, 35, 48, 28, { stroke: COLORS.stoneLight, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.34 }),
    line(23, 56, 34, 66, { stroke: COLORS.stoneLight, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.28 })
  ];

  if (detail === 'layers') {
    layers.push(line(25, 46, 71, 40, { stroke: accentFill, 'stroke-width': 3.6, opacity: 0.6, 'stroke-linecap': 'round' }));
    layers.push(line(23, 58, 68, 51, { stroke: accentFill, 'stroke-width': 3.6, opacity: 0.44, 'stroke-linecap': 'round' }));
  } else if (detail === 'veins') {
    layers.push(pathTag('M29 57 L40 48 L49 53 L61 39 L69 46', { stroke: accentFill, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    layers.push(pathTag('M40 48 L35 39 M49 53 L48 65 M61 39 L67 28', { stroke: accentFill, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.7 }));
  } else if (detail === 'cracks') {
    layers.push(pathTag('M32 38 L41 49 L52 44 L61 59', { stroke: accentFill, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    layers.push(pathTag('M41 49 L36 62 M52 44 L59 30', { stroke: accentFill, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.7 }));
  } else if (detail === 'specks') {
    layers.push(circle(38, 43, 4.5, { fill: accentFill, stroke: COLORS.line, 'stroke-width': 1.4, opacity: 0.85 }));
    layers.push(circle(56, 50, 5.5, { fill: accentFill, stroke: COLORS.line, 'stroke-width': 1.4, opacity: 0.85 }));
    layers.push(circle(47, 61, 4, { fill: accentFill, stroke: COLORS.line, 'stroke-width': 1.4, opacity: 0.85 }));
  } else if (detail === 'basalt') {
    layers.push(...hexPoints(38, 50, 9).length ? [
      polygon(hexPoints(38, 50, 9), { fill: accentFill, opacity: 0.7, stroke: COLORS.line, 'stroke-width': 1.4 }),
      polygon(hexPoints(56, 55, 10), { fill: accentFill, opacity: 0.6, stroke: COLORS.line, 'stroke-width': 1.4 })
    ] : []);
  } else if (detail === 'coal') {
    layers.push(polygon([[32, 55], [39, 37], [51, 41], [54, 58], [42, 67]], { fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 1.5 }));
    layers.push(polygon([[52, 51], [62, 38], [70, 48], [66, 62], [55, 66]], { fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 1.5 }));
    layers.push(line(36, 40, 43, 34, { stroke: COLORS.highlight, 'stroke-width': 2.4, opacity: 0.25, 'stroke-linecap': 'round' }));
  }

  return layers.join('');
}

function crystalCluster(mainFill, accentFill, count = 3) {
  const spikes = [
    [[29, 67], [36, 34], [43, 67]],
    [[41, 71], [49, 23], [58, 71]],
    [[56, 67], [64, 38], [70, 67]],
    [[18, 69], [24, 46], [30, 69]]
  ].slice(0, count);
  return [
    ...spikes.map((points, index) => polygon(points, {
      fill: index % 2 === 0 ? mainFill : accentFill,
      stroke: COLORS.line,
      'stroke-width': 2.2,
      'stroke-linejoin': 'round'
    })),
    ...spikes.map(points => line(points[1][0], points[1][1] + 6, points[1][0], points[2][1] - 5, {
      stroke: COLORS.highlight,
      'stroke-width': 2,
      opacity: 0.34,
      'stroke-linecap': 'round'
    }))
  ].join('');
}

function powderPile(mainFill, accentFill) {
  return [
    pathTag('M20 67 C24 54 35 45 47 45 C59 45 70 52 76 67 L76 74 L20 74 Z', {
      fill: mainFill,
      stroke: COLORS.line,
      'stroke-width': 2.4,
      'stroke-linejoin': 'round'
    }),
    circle(34, 56, 4.2, { fill: accentFill, opacity: 0.55 }),
    circle(49, 54, 5, { fill: accentFill, opacity: 0.4 }),
    circle(61, 59, 4, { fill: accentFill, opacity: 0.5 }),
    ...[27, 38, 46, 57, 68].map((cx, index) => circle(cx, 71 - (index % 2), 2.4, {
      fill: accentFill,
      stroke: COLORS.line,
      'stroke-width': 0.8,
      opacity: 0.9
    }))
  ].join('');
}

function ingotShape(fill, accent) {
  return [
    polygon([[24, 59], [34, 34], [66, 34], [58, 59]], {
      fill,
      stroke: COLORS.line,
      'stroke-width': 2.8,
      'stroke-linejoin': 'round'
    }),
    polygon([[34, 34], [44, 26], [75, 26], [66, 34]], {
      fill: accent,
      stroke: COLORS.line,
      'stroke-width': 1.8,
      'stroke-linejoin': 'round'
    }),
    polygon([[58, 59], [66, 34], [75, 26], [68, 51]], {
      fill: COLORS.line,
      opacity: 0.18
    }),
    line(38, 40, 57, 40, { stroke: COLORS.highlight, 'stroke-width': 2.4, opacity: 0.42, 'stroke-linecap': 'round' })
  ].join('');
}

function wireSpool(accent, support = COLORS.metalLight) {
  const loops = [];
  for (let index = 0; index < 5; index += 1) {
    loops.push(circle(48, 49, 8 + index * 4, {
      fill: 'none',
      stroke: accent,
      'stroke-width': 2.6,
      opacity: clamp(0.95 - index * 0.14, 0.22, 0.95)
    }));
  }
  return [
    loops.join(''),
    rect(28, 34, 7, 32, { rx: 3, fill: support, stroke: COLORS.line, 'stroke-width': 1.8 }),
    rect(61, 34, 7, 32, { rx: 3, fill: support, stroke: COLORS.line, 'stroke-width': 1.8 })
  ].join('');
}

function boardBase(fill = COLORS.circuit) {
  return [
    rect(21, 24, 54, 42, {
      rx: 10,
      fill,
      stroke: COLORS.line,
      'stroke-width': 2.6
    }),
    rect(30, 33, 16, 14, { rx: 4, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 1.8 }),
    ...[24, 36, 48, 60].map(x => rect(x, 66, 4, 7, { rx: 1.6, fill: COLORS.gold, stroke: COLORS.line, 'stroke-width': 1 }))
  ].join('');
}

function powerBox(accent, extra = '') {
  return [
    plate(18, 26, 58, 42, COLORS.metal, accent),
    rect(28, 36, 19, 21, { rx: 4, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 1.8 }),
    rect(52, 36, 13, 8, { rx: 3, fill: accent, stroke: COLORS.line, 'stroke-width': 1.4, opacity: 0.85 }),
    rect(52, 48, 13, 10, { rx: 3, fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 1.4, opacity: 0.76 }),
    extra
  ].join('');
}

function conveyorBody(accent, speed = 'basic') {
  const arrows = speed === 'fast'
    ? [30, 45, 60].map(x => pathTag(`M${x} 40 L${x + 10} 48 L${x} 56`, {
      fill: 'none',
      stroke: accent,
      'stroke-width': 4.4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }))
    : [34, 52].map(x => pathTag(`M${x} 40 L${x + 10} 48 L${x} 56`, {
      fill: 'none',
      stroke: accent,
      'stroke-width': 4.4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));

  return [
    rect(18, 34, 60, 28, { rx: 14, fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 2.6 }),
    rect(24, 40, 48, 16, { rx: 8, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 1.6 }),
    ...[22, 74].map(cx => circle(cx, 63, 6, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 2 })),
    arrows.join('')
  ].join('');
}

function drillBit(x, y, length, accent) {
  const tipY = y + length;
  return [
    pathTag(`M${x} ${y} L${x} ${tipY}`, { stroke: accent, 'stroke-width': 5, 'stroke-linecap': 'round' }),
    pathTag(`M${x - 6} ${y + 10} L${x + 6} ${y + 16} L${x - 6} ${y + 22} L${x + 6} ${y + 28} L${x - 6} ${y + 34} L${x + 6} ${y + 40}`, {
      fill: 'none',
      stroke: COLORS.line,
      'stroke-width': 2,
      opacity: 0.75,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }),
    polygon([[x - 5, tipY], [x + 5, tipY], [x, tipY + 10]], { fill: accent, stroke: COLORS.line, 'stroke-width': 1.6 })
  ].join('');
}

function minerBody(accent, variant = 'mk1') {
  const platform = variant === 'heavy' || variant === 'excavator'
    ? rect(18, 60, 58, 10, { rx: 5, fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 2.2 })
    : rect(24, 60, 48, 9, { rx: 5, fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 2.2 });

  const trackWheels = variant === 'heavy' || variant === 'excavator'
    ? [28, 44, 60].map(cx => circle(cx, 71, 6, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 1.8 })).join('')
    : [32, 48, 64].map(cx => circle(cx, 69, 5, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 1.8 })).join('');

  const shell = plate(22, 32, 46, 28, COLORS.metal, accent);
  const mast = rect(42, 18, 6, 16, { rx: 2.5, fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 1.8 });
  const drill = variant === 'mk2'
    ? [drillBit(38, 31, 30, accent), drillBit(56, 31, 30, accent)].join('')
    : variant === 'deep'
      ? [rect(38, 10, 20, 12, { rx: 4, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2 }), drillBit(48, 22, 44, accent)].join('')
      : drillBit(48, 31, variant === 'assisted' ? 24 : 32, accent);

  const extras = [];
  if (variant === 'assisted') {
    extras.push(line(24, 50, 14, 39, { stroke: COLORS.woodLight, 'stroke-width': 4, 'stroke-linecap': 'round' }));
    extras.push(line(72, 50, 82, 39, { stroke: COLORS.woodLight, 'stroke-width': 4, 'stroke-linecap': 'round' }));
  }
  if (variant === 'heavy') {
    extras.push(rect(54, 22, 8, 12, { rx: 2, fill: COLORS.fire, stroke: COLORS.line, 'stroke-width': 1.4 }));
    extras.push(hazardStripe(23, 41, 14, 8));
  }
  if (variant === 'excavator') {
    extras.push(pathTag('M57 35 L69 25 L78 31 L72 42 L83 52', {
      fill: 'none',
      stroke: accent,
      'stroke-width': 6,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));
    extras.push(polygon([[79, 49], [87, 57], [74, 61]], { fill: COLORS.hazard, stroke: COLORS.line, 'stroke-width': 1.8 }));
  }
  return [platform, trackWheels, shell, mast, drill, extras.join('')].join('');
}

function renderTool(def) {
  if (def.variant === 'bare_hands') {
    return [
      pathTag('M27 58 C24 47 30 38 37 38 C42 38 46 41 47 46 C48 38 54 34 59 34 C66 34 72 41 71 50 C70 60 64 68 57 69 C51 70 47 67 44 62 C42 66 37 69 31 68 C28 67 27 64 27 58 Z', {
        fill: '#d8a67b',
        stroke: COLORS.line,
        'stroke-width': 2.4,
        'stroke-linejoin': 'round'
      }),
      line(40, 42, 39, 57, { stroke: COLORS.woodDark, 'stroke-width': 1.4, opacity: 0.3 }),
      line(52, 38, 51, 58, { stroke: COLORS.woodDark, 'stroke-width': 1.4, opacity: 0.3 }),
      line(61, 40, 59, 56, { stroke: COLORS.woodDark, 'stroke-width': 1.4, opacity: 0.3 })
    ].join('');
  }

  if (def.variant === 'lantern') {
    return [
      rect(31, 29, 34, 41, { rx: 10, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2.4 }),
      rect(36, 34, 24, 31, { rx: 8, fill: '#f3e9be', stroke: COLORS.line, 'stroke-width': 1.8, opacity: 0.78 }),
      pathTag('M48 38 C43 46 42 52 48 59 C54 52 53 45 48 38 Z', {
        fill: COLORS.fireCore,
        stroke: COLORS.fire,
        'stroke-width': 1.6
      }),
      pathTag('M37 29 C39 21 45 17 48 17 C52 17 58 21 59 29', {
        fill: 'none',
        stroke: COLORS.metalLight,
        'stroke-width': 4,
        'stroke-linecap': 'round'
      }),
      line(41, 35, 41, 64, { stroke: COLORS.highlight, 'stroke-width': 2, opacity: 0.32 }),
      line(55, 35, 55, 64, { stroke: COLORS.highlight, 'stroke-width': 2, opacity: 0.24 })
    ].join('');
  }

  if (def.variant === 'helmet_lamp') {
    return [
      pathTag('M19 57 C21 37 34 24 48 24 C63 24 76 37 77 57 L19 57 Z', {
        fill: COLORS.steel,
        stroke: COLORS.line,
        'stroke-width': 2.6,
        'stroke-linejoin': 'round'
      }),
      rect(21, 53, 54, 11, { rx: 5, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2 }),
      circle(48, 44, 7, { fill: COLORS.fireCore, stroke: COLORS.line, 'stroke-width': 2 }),
      pathTag('M55 39 L74 28 M57 45 L79 45 M55 51 L74 62', {
        fill: 'none',
        stroke: COLORS.fireCore,
        'stroke-width': 3.2,
        'stroke-linecap': 'round',
        opacity: 0.7
      }),
      line(32, 35, 43, 30, { stroke: COLORS.highlight, 'stroke-width': 2.4, opacity: 0.28, 'stroke-linecap': 'round' })
    ].join('');
  }

  const shaft = rect(42, 18, 8, 52, {
    rx: 4,
    fill: COLORS.wood,
    stroke: COLORS.woodDark,
    'stroke-width': 2.2,
    transform: 'rotate(-34 46 44)'
  });

  if (def.variant === 'manual_drill') {
    return [
      rect(39, 24, 16, 10, { rx: 5, fill: COLORS.woodLight, stroke: COLORS.line, 'stroke-width': 2 }),
      rect(44, 34, 6, 30, { rx: 3, fill: COLORS.metal, stroke: COLORS.line, 'stroke-width': 2 }),
      pathTag('M31 41 C25 43 20 46 18 52', {
        fill: 'none',
        stroke: COLORS.woodDark,
        'stroke-width': 4.6,
        'stroke-linecap': 'round'
      }),
      line(18, 52, 26, 57, { stroke: COLORS.woodLight, 'stroke-width': 4.8, 'stroke-linecap': 'round' }),
      drillBit(47, 58, 13, def.accent)
    ].join('');
  }

  if (def.variant === 'geological_hammer') {
    return [
      shaft,
      pathTag('M33 25 L65 33 L58 43 L30 37 Z', {
        fill: def.accent,
        stroke: COLORS.line,
        'stroke-width': 2.2,
        'stroke-linejoin': 'round'
      }),
      pathTag('M61 31 L78 18 L73 42 L58 40 Z', {
        fill: COLORS.metalLight,
        stroke: COLORS.line,
        'stroke-width': 2
      }),
      circle(24, 59, 7, { fill: COLORS.quartz, stroke: COLORS.line, 'stroke-width': 1.8 }),
      line(20, 59, 28, 59, { stroke: COLORS.energyDark, 'stroke-width': 1.4 })
    ].join('');
  }

  const head = pathTag('M31 25 C41 18 54 18 67 24 L72 30 L50 38 L27 33 Z', {
    fill: def.accent,
    stroke: COLORS.line,
    'stroke-width': 2.2,
    'stroke-linejoin': 'round'
  });

  const point = polygon([[67, 24], [78, 20], [70, 35]], {
    fill: def.secondary || COLORS.metalLight,
    stroke: COLORS.line,
    'stroke-width': 1.8,
    'stroke-linejoin': 'round'
  });

  return [
    shaft,
    head,
    point,
    rect(42, 45, 8, 14, {
      rx: 3,
      fill: COLORS.woodLight,
      stroke: COLORS.woodDark,
      'stroke-width': 1.6,
      transform: 'rotate(-34 46 52)'
    }),
    line(38, 22, 51, 18, { stroke: COLORS.highlight, 'stroke-width': 2.2, opacity: 0.34, 'stroke-linecap': 'round' })
  ].join('');
}

function renderWorkstation(def) {
  if (def.variant === 'simple_bench') {
    return [
      rect(20, 40, 56, 12, { rx: 4, fill: COLORS.wood, stroke: COLORS.woodDark, 'stroke-width': 2.4 }),
      rect(24, 52, 8, 18, { rx: 3, fill: COLORS.woodDark, stroke: COLORS.line, 'stroke-width': 1.6 }),
      rect(64, 52, 8, 18, { rx: 3, fill: COLORS.woodDark, stroke: COLORS.line, 'stroke-width': 1.6 }),
      line(36, 35, 46, 47, { stroke: COLORS.metalLight, 'stroke-width': 4.2, 'stroke-linecap': 'round' }),
      line(50, 33, 59, 45, { stroke: COLORS.copper, 'stroke-width': 4.2, 'stroke-linecap': 'round' }),
      circle(41, 34, 3, { fill: COLORS.line }),
      circle(55, 33, 3, { fill: COLORS.line })
    ].join('');
  }
  if (def.variant === 'stone_mortar') {
    return [
      pathTag('M21 54 C24 39 34 31 48 31 C62 31 72 39 75 54 C76 60 71 67 64 69 L32 69 C25 67 20 60 21 54 Z', {
        fill: COLORS.stone,
        stroke: COLORS.line,
        'stroke-width': 2.6,
        'stroke-linejoin': 'round'
      }),
      pathTag('M37 31 C42 25 47 23 50 22 C55 21 60 23 64 28', {
        fill: 'none',
        stroke: COLORS.stoneLight,
        'stroke-width': 4,
        'stroke-linecap': 'round'
      }),
      rect(56, 18, 10, 28, {
        rx: 5,
        fill: COLORS.stoneLight,
        stroke: COLORS.line,
        'stroke-width': 2,
        transform: 'rotate(24 61 32)'
      })
    ].join('');
  }
  if (def.variant === 'sorting_table') {
    return [
      polygon([[18, 36], [70, 30], [78, 49], [26, 56]], { fill: COLORS.wood, stroke: COLORS.woodDark, 'stroke-width': 2.4 }),
      rect(24, 56, 8, 14, { rx: 3, fill: COLORS.woodDark, stroke: COLORS.line, 'stroke-width': 1.6 }),
      rect(66, 50, 8, 18, { rx: 3, fill: COLORS.woodDark, stroke: COLORS.line, 'stroke-width': 1.6 }),
      circle(35, 43, 4.5, { fill: COLORS.copper, stroke: COLORS.line, 'stroke-width': 1.2 }),
      circle(48, 41, 4.5, { fill: COLORS.iron, stroke: COLORS.line, 'stroke-width': 1.2 }),
      circle(60, 39, 4.5, { fill: COLORS.sand, stroke: COLORS.line, 'stroke-width': 1.2 })
    ].join('');
  }
  if (def.variant === 'simple_furnace') {
    return [
      plate(21, 24, 54, 47, COLORS.stone, COLORS.fire),
      rect(31, 41, 34, 21, { rx: 8, fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 2.2 }),
      pathTag('M48 40 C41 48 40 54 48 60 C56 54 55 47 48 40 Z', {
        fill: COLORS.fireCore,
        stroke: COLORS.fire,
        'stroke-width': 1.8
      }),
      rect(40, 18, 16, 10, { rx: 4, fill: COLORS.stoneLight, stroke: COLORS.line, 'stroke-width': 1.8 })
    ].join('');
  }
  if (def.variant === 'anvil') {
    return [
      pathTag('M22 46 L40 46 L49 33 L67 33 L61 46 L74 46 L74 54 L58 54 L53 62 L33 62 L26 54 L22 54 Z', {
        fill: COLORS.metalLight,
        stroke: COLORS.line,
        'stroke-width': 2.4,
        'stroke-linejoin': 'round'
      }),
      rect(39, 62, 12, 11, { rx: 3, fill: COLORS.wood, stroke: COLORS.woodDark, 'stroke-width': 2 }),
      line(27, 49, 44, 36, { stroke: COLORS.highlight, 'stroke-width': 2.4, opacity: 0.26, 'stroke-linecap': 'round' })
    ].join('');
  }
  if (def.variant === 'coal_crate') {
    return [
      rect(22, 31, 52, 38, { rx: 6, fill: COLORS.wood, stroke: COLORS.woodDark, 'stroke-width': 2.4 }),
      line(28, 39, 68, 39, { stroke: COLORS.woodLight, 'stroke-width': 3.2, opacity: 0.8, 'stroke-linecap': 'round' }),
      line(28, 48, 68, 48, { stroke: COLORS.woodLight, 'stroke-width': 3.2, opacity: 0.8, 'stroke-linecap': 'round' }),
      ...[[33, 46], [46, 41], [58, 47], [41, 54], [55, 57]].map(([cx, cy]) => circle(cx, cy, 6, {
        fill: COLORS.coal,
        stroke: COLORS.line,
        'stroke-width': 1.4
      }))
    ].join('');
  }
  return '';
}

function renderResource(def) {
  if (def.variant === 'rock') return rockBase(def.base, def.accent, def.detail);
  if (def.variant === 'ore') return rockBase(COLORS.stone, def.accent, def.detail || 'specks');
  if (def.variant === 'crystal') return crystalCluster(def.base, def.accent, def.count || 3);
  if (def.variant === 'powder') return powderPile(def.base, def.accent);
  if (def.variant === 'ingot') return ingotShape(def.base, def.accent);
  if (def.variant === 'part') return renderPart(def);
  if (def.variant === 'power') return renderPower(def);
  if (def.variant === 'logistics') return renderLogistics(def);
  if (def.variant === 'machine') return renderMachine(def);
  if (def.variant === 'deposit') return renderDeposit(def);
  return '';
}

function renderDeposit(def) {
  if (def.depositType === 'vein') {
    return [
      pathTag('M16 60 C16 41 29 23 48 22 C67 21 80 38 80 57 C80 69 71 75 58 76 L31 76 C22 75 16 68 16 60 Z', {
        fill: COLORS.stoneDark,
        stroke: COLORS.line,
        'stroke-width': 2.8,
        'stroke-linejoin': 'round'
      }),
      pathTag('M28 64 L39 50 L48 56 L60 40 L70 49', {
        fill: 'none',
        stroke: def.accent,
        'stroke-width': 5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }),
      pathTag('M39 50 L35 39 M48 56 L47 68 M60 40 L67 28', {
        fill: 'none',
        stroke: def.secondary || COLORS.highlight,
        'stroke-width': 3.2,
        'stroke-linecap': 'round',
        opacity: 0.75
      }),
      circle(71, 25, 7, { fill: def.secondary || COLORS.fireCore, stroke: COLORS.line, 'stroke-width': 1.8 }),
      line(67, 25, 75, 25, { stroke: COLORS.line, 'stroke-width': 1.4, opacity: 0.7 })
    ].join('');
  }
  if (def.depositType === 'purity') {
    const stars = { impure: 1, normal: 2, rich: 3, exceptional: 4 }[def.level] || 1;
    const starX = [48, 40, 56, 48];
    const starY = [48, 52, 52, 38];
    return [
      circle(48, 49, 26, { fill: def.base, stroke: COLORS.line, 'stroke-width': 2.8 }),
      circle(48, 49, 16, { fill: COLORS.stoneLight, opacity: 0.22 }),
      ...Array.from({ length: stars }, (_, index) => text(starX[index], starY[index], '*', {
        'font-family': 'monospace',
        'font-size': index === 3 ? 20 : 24,
        'text-anchor': 'middle',
        fill: def.accent,
        stroke: COLORS.line,
        'stroke-width': 0.8
      })),
      circle(48, 49, 4, { fill: def.accent, stroke: COLORS.line, 'stroke-width': 1.4 })
    ].join('');
  }
  if (def.depositType === 'scanner') {
    return [
      rect(24, 36, 48, 26, { rx: 7, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2.4 }),
      line(32, 70, 25, 80, { stroke: COLORS.metalLight, 'stroke-width': 4.2, 'stroke-linecap': 'round' }),
      line(64, 70, 71, 80, { stroke: COLORS.metalLight, 'stroke-width': 4.2, 'stroke-linecap': 'round' }),
      line(48, 62, 48, 80, { stroke: COLORS.metalLight, 'stroke-width': 4.2, 'stroke-linecap': 'round' }),
      pathTag('M31 52 C37 40 59 40 65 52', {
        fill: 'none',
        stroke: def.accent,
        'stroke-width': 4,
        'stroke-linecap': 'round'
      }),
      pathTag('M34 52 C38 48 42 46 48 46 C54 46 58 48 62 52', {
        fill: 'none',
        stroke: COLORS.highlight,
        'stroke-width': 2,
        'stroke-linecap': 'round',
        opacity: 0.55
      })
    ].join('');
  }
  if (def.depositType === 'probe') {
    return [
      rect(42, 17, 12, 14, { rx: 4, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2 }),
      drillBit(48, 29, 34, def.accent),
      line(28, 54, 42, 37, { stroke: COLORS.metalLight, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
      line(68, 54, 54, 37, { stroke: COLORS.metalLight, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
      pathTag('M25 63 C31 58 38 56 48 56 C58 56 65 58 71 63', {
        fill: 'none',
        stroke: COLORS.stone,
        'stroke-width': 4.6,
        'stroke-linecap': 'round'
      })
    ].join('');
  }
  if (def.depositType === 'sensor') {
    return [
      rect(23, 27, 50, 36, { rx: 8, fill: COLORS.metal, stroke: COLORS.line, 'stroke-width': 2.4 }),
      pathTag('M29 50 L37 50 L43 40 L49 57 L56 33 L62 50 L67 50', {
        fill: 'none',
        stroke: def.accent,
        'stroke-width': 4,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }),
      line(30, 68, 25, 79, { stroke: COLORS.metalLight, 'stroke-width': 4, 'stroke-linecap': 'round' }),
      line(66, 68, 71, 79, { stroke: COLORS.metalLight, 'stroke-width': 4, 'stroke-linecap': 'round' })
    ].join('');
  }
  return rockBase(COLORS.stone, def.accent, 'specks');
}

function renderPart(def) {
  switch (def.partType) {
    case 'iron_plate':
      return [
        rect(22, 28, 52, 36, { rx: 8, fill: def.base, stroke: COLORS.line, 'stroke-width': 2.6 }),
        bolt(31, 37),
        bolt(65, 37),
        bolt(31, 55),
        bolt(65, 55),
        line(34, 33, 60, 33, { stroke: COLORS.highlight, 'stroke-width': 2.4, opacity: 0.32, 'stroke-linecap': 'round' })
      ].join('');
    case 'iron_bar':
      return [
        rect(18, 42, 60, 14, { rx: 7, fill: def.base, stroke: COLORS.line, 'stroke-width': 2.4 }),
        rect(25, 38, 46, 6, { rx: 3, fill: def.accent, opacity: 0.44 })
      ].join('');
    case 'gear':
      return [
        pathTag(gearPath(48, 48, 16, 24, 8), { fill: def.base, stroke: COLORS.line, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }),
        circle(48, 48, 8, { fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2 })
      ].join('');
    case 'shaft':
      return [
        rect(22, 43, 52, 10, { rx: 5, fill: def.base, stroke: COLORS.line, 'stroke-width': 2.2 }),
        circle(27, 48, 9, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 2 }),
        circle(69, 48, 9, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 2 }),
        line(33, 48, 63, 48, { stroke: COLORS.highlight, 'stroke-width': 2, opacity: 0.34, 'stroke-linecap': 'round' })
      ].join('');
    case 'screw':
      return [
        rect(30, 26, 36, 12, { rx: 4, fill: def.base, stroke: COLORS.line, 'stroke-width': 2 }),
        rect(43, 38, 10, 28, { rx: 4, fill: def.base, stroke: COLORS.line, 'stroke-width': 2 }),
        ...[40, 46, 52, 58].map(y => line(40, y, 56, y - 4, { stroke: COLORS.line, 'stroke-width': 1.5, opacity: 0.6 })).join('')
      ].join('');
    case 'copper_pipe':
      return [
        pathTag('M26 57 L26 38 C26 30 32 24 40 24 L60 24', {
          fill: 'none',
          stroke: def.base,
          'stroke-width': 12,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }),
        pathTag('M26 57 L26 38 C26 30 32 24 40 24 L60 24', {
          fill: 'none',
          stroke: COLORS.line,
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }),
        line(37, 24, 37, 57, { stroke: COLORS.highlight, 'stroke-width': 2, opacity: 0.32, 'stroke-linecap': 'round' })
      ].join('');
    case 'copper_wire':
      return [
        pathTag('M24 58 C32 43 40 36 47 36 C56 36 62 41 71 29', {
          fill: 'none',
          stroke: def.base,
          'stroke-width': 6,
          'stroke-linecap': 'round'
        }),
        wireSpool(def.base, COLORS.metalLight)
      ].join('');
    case 'coil':
      return [
        wireSpool(def.base, COLORS.metalDark),
        rect(39, 33, 18, 33, { rx: 6, fill: 'none', stroke: COLORS.highlight, 'stroke-width': 1.6, opacity: 0.18 })
      ].join('');
    case 'metal_plate':
      return [
        rect(26, 32, 42, 30, { rx: 8, fill: def.base, stroke: COLORS.line, 'stroke-width': 2.2 }),
        rect(19, 40, 42, 30, { rx: 8, fill: def.accent, stroke: COLORS.line, 'stroke-width': 2.2, opacity: 0.9 }),
        line(28, 45, 52, 45, { stroke: COLORS.highlight, 'stroke-width': 2, opacity: 0.28, 'stroke-linecap': 'round' })
      ].join('');
    case 'mechanical_component':
      return [
        rect(20, 29, 56, 36, { rx: 10, fill: COLORS.metal, stroke: COLORS.line, 'stroke-width': 2.4 }),
        pathTag(gearPath(39, 47, 9, 14, 7), { fill: def.base, stroke: COLORS.line, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
        pathTag(gearPath(58, 47, 7, 11, 6), { fill: def.accent, stroke: COLORS.line, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
        line(46, 47, 51, 47, { stroke: COLORS.line, 'stroke-width': 2.2 })
      ].join('');
    case 'electrical_component':
      return [
        boardBase(COLORS.metalDark),
        rect(49, 38, 15, 8, { rx: 3, fill: def.base, stroke: COLORS.line, 'stroke-width': 1.4 }),
        line(32, 51, 44, 51, { stroke: COLORS.energy, 'stroke-width': 3, 'stroke-linecap': 'round' }),
        line(56, 54, 64, 54, { stroke: COLORS.energy, 'stroke-width': 3, 'stroke-linecap': 'round' }),
        circle(53, 51, 2.2, { fill: COLORS.fireCore })
      ].join('');
    case 'simple_circuit':
      return [
        boardBase(COLORS.circuit),
        pathTag('M46 40 L57 40 L57 51 L67 51', {
          fill: 'none',
          stroke: COLORS.gold,
          'stroke-width': 3,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }),
        pathTag('M33 51 L39 51 L39 41 L46 41', {
          fill: 'none',
          stroke: COLORS.gold,
          'stroke-width': 3,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }),
        circle(57, 51, 3, { fill: COLORS.energy, stroke: COLORS.line, 'stroke-width': 1 })
      ].join('');
    default:
      return ingotShape(def.base, def.accent);
  }
}

function renderPower(def) {
  switch (def.powerType) {
    case 'wood_generator':
      return [
        powerBox(COLORS.woodLight, rect(59, 18, 7, 14, { rx: 2, fill: COLORS.fire, stroke: COLORS.line, 'stroke-width': 1.4 })),
        line(30, 50, 45, 42, { stroke: COLORS.woodLight, 'stroke-width': 5, 'stroke-linecap': 'round' }),
        line(37, 56, 52, 48, { stroke: COLORS.woodLight, 'stroke-width': 5, 'stroke-linecap': 'round' })
      ].join('');
    case 'coal_generator':
      return [
        powerBox(COLORS.fire, rect(59, 18, 7, 14, { rx: 2, fill: COLORS.fire, stroke: COLORS.line, 'stroke-width': 1.4 })),
        ...[[35, 52], [46, 45], [55, 54]].map(([cx, cy]) => circle(cx, cy, 5, { fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 1.4 })).join('')
      ].join('');
    case 'hand_dynamo':
      return [
        circle(47, 49, 18, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 2.4 }),
        circle(47, 49, 8, { fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 1.8 }),
        line(47, 49, 64, 34, { stroke: COLORS.copper, 'stroke-width': 4.2, 'stroke-linecap': 'round' }),
        line(64, 34, 74, 38, { stroke: COLORS.woodLight, 'stroke-width': 4.6, 'stroke-linecap': 'round' }),
        line(47, 31, 47, 18, { stroke: COLORS.metal, 'stroke-width': 4, 'stroke-linecap': 'round' })
      ].join('');
    case 'water_wheel':
      return [
        circle(48, 46, 20, { fill: 'none', stroke: def.base, 'stroke-width': 5 }),
        ...Array.from({ length: 6 }, (_, index) => {
          const angle = index * Math.PI / 3;
          const x = 48 + Math.cos(angle) * 18;
          const y = 46 + Math.sin(angle) * 18;
          return line(48, 46, x, y, { stroke: COLORS.line, 'stroke-width': 2 });
        }).join(''),
        rect(23, 58, 50, 12, { rx: 6, fill: def.accent, opacity: 0.8, stroke: COLORS.line, 'stroke-width': 2 })
      ].join('');
    case 'steam_engine':
      return [
        rect(21, 40, 46, 20, { rx: 10, fill: COLORS.metal, stroke: COLORS.line, 'stroke-width': 2.4 }),
        rect(57, 24, 10, 20, { rx: 3, fill: COLORS.fire, stroke: COLORS.line, 'stroke-width': 1.6 }),
        circle(31, 60, 8, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 1.8 }),
        circle(57, 60, 8, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 1.8 }),
        pathTag('M29 28 C29 21 33 17 38 16 C42 15 47 17 49 22', {
          fill: 'none',
          stroke: COLORS.highlight,
          'stroke-width': 3.2,
          'stroke-linecap': 'round',
          opacity: 0.55
        })
      ].join('');
    case 'pole':
      return [
        rect(44, 18, 8, 55, { rx: 4, fill: COLORS.wood, stroke: COLORS.woodDark, 'stroke-width': 2 }),
        line(26, 28, 70, 28, { stroke: COLORS.metalLight, 'stroke-width': 5, 'stroke-linecap': 'round' }),
        line(22, 38, 74, 38, { stroke: COLORS.metalLight, 'stroke-width': 4, 'stroke-linecap': 'round' }),
        ...[30, 48, 66].map(cx => circle(cx, 28, 3, { fill: COLORS.quartz, stroke: COLORS.line, 'stroke-width': 1 })).join('')
      ].join('');
    case 'connector':
      return [
        pathTag('M28 45 C28 33 36 26 47 26 L56 26 L56 39', {
          fill: 'none',
          stroke: def.base,
          'stroke-width': 8,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }),
        pathTag('M28 45 C28 33 36 26 47 26 L56 26 L56 39', {
          fill: 'none',
          stroke: COLORS.line,
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }),
        rect(54, 39, 16, 18, { rx: 5, fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 2 }),
        line(62, 39, 62, 28, { stroke: COLORS.gold, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
        line(68, 39, 68, 28, { stroke: COLORS.gold, 'stroke-width': 3.2, 'stroke-linecap': 'round' })
      ].join('');
    case 'small_battery':
      return [
        rect(28, 22, 40, 48, { rx: 8, fill: def.base, stroke: COLORS.line, 'stroke-width': 2.6 }),
        rect(39, 16, 18, 10, { rx: 4, fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 2 }),
        pathTag('M48 31 L40 48 L48 48 L42 61 L57 41 L48 41 Z', {
          fill: COLORS.fireCore,
          stroke: COLORS.line,
          'stroke-width': 1.6,
          'stroke-linejoin': 'round'
        }),
        rect(34, 54, 28, 8, { rx: 4, fill: COLORS.energy, opacity: 0.85 })
      ].join('');
    case 'panel':
      return [
        plate(24, 22, 48, 50, COLORS.metalDark, COLORS.energy),
        rect(34, 34, 28, 13, { rx: 4, fill: COLORS.highlight, opacity: 0.84, stroke: COLORS.line, 'stroke-width': 1.4 }),
        circle(40, 57, 5, { fill: COLORS.fireCore, stroke: COLORS.line, 'stroke-width': 1.4 }),
        circle(56, 57, 5, { fill: COLORS.energy, stroke: COLORS.line, 'stroke-width': 1.4 })
      ].join('');
    case 'fuse':
      return [
        rect(24, 39, 48, 18, { rx: 9, fill: COLORS.quartz, stroke: COLORS.line, 'stroke-width': 2.4 }),
        rect(18, 42, 10, 12, { rx: 4, fill: COLORS.gold, stroke: COLORS.line, 'stroke-width': 1.6 }),
        rect(68, 42, 10, 12, { rx: 4, fill: COLORS.gold, stroke: COLORS.line, 'stroke-width': 1.6 }),
        pathTag('M47 41 L42 49 L48 49 L45 56 L53 47 L47 47 Z', {
          fill: COLORS.fire,
          stroke: COLORS.line,
          'stroke-width': 1.4
        })
      ].join('');
    default:
      return powerBox(def.base, '');
  }
}

function renderLogistics(def) {
  switch (def.logisticsType) {
    case 'conveyor_basic':
      return conveyorBody(def.base, 'basic');
    case 'conveyor_fast':
      return conveyorBody(def.base, 'fast');
    case 'splitter':
      return [
        conveyorBody(COLORS.hazard, 'basic'),
        pathTag('M48 48 L33 34 M48 48 L63 34', {
          fill: 'none',
          stroke: COLORS.highlight,
          'stroke-width': 4,
          'stroke-linecap': 'round'
        })
      ].join('');
    case 'merger':
      return [
        conveyorBody(COLORS.energy, 'basic'),
        pathTag('M33 37 L48 48 L63 37', {
          fill: 'none',
          stroke: COLORS.highlight,
          'stroke-width': 4,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        })
      ].join('');
    case 'machine_input':
      return [
        rect(24, 28, 46, 36, { rx: 10, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2.4 }),
        polygon([[44, 26], [68, 26], [59, 38], [53, 49], [47, 38]], { fill: def.base, stroke: COLORS.line, 'stroke-width': 2 }),
        pathTag('M35 48 L52 48', { stroke: COLORS.fireCore, 'stroke-width': 4.4, 'stroke-linecap': 'round' })
      ].join('');
    case 'machine_output':
      return [
        rect(24, 28, 46, 36, { rx: 10, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2.4 }),
        polygon([[42, 54], [66, 54], [58, 65], [50, 74], [44, 65]], { fill: def.base, stroke: COLORS.line, 'stroke-width': 2 }),
        pathTag('M39 44 L56 44', { stroke: COLORS.energy, 'stroke-width': 4.4, 'stroke-linecap': 'round' })
      ].join('');
    case 'industrial_crate':
      return [
        plate(20, 28, 56, 40, COLORS.metal, COLORS.hazard),
        line(31, 28, 31, 68, { stroke: COLORS.line, 'stroke-width': 2 }),
        line(48, 28, 48, 68, { stroke: COLORS.line, 'stroke-width': 2 }),
        line(65, 28, 65, 68, { stroke: COLORS.line, 'stroke-width': 2 })
      ].join('');
    case 'lift_basic':
      return [
        rect(34, 20, 28, 54, { rx: 8, fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 2.4 }),
        ...[28, 46, 64].map(y => pathTag(`M42 ${y} L48 ${y - 8} L54 ${y}`, {
          fill: 'none',
          stroke: def.base,
          'stroke-width': 4,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        })).join(''),
        circle(48, 74, 7, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 2 })
      ].join('');
    case 'filter_sorter':
      return [
        rect(22, 30, 52, 34, { rx: 8, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2.4 }),
        polygon([[32, 36], [64, 36], [54, 51], [42, 51]], { fill: COLORS.silver, stroke: COLORS.line, 'stroke-width': 1.6 }),
        circle(35, 58, 4.6, { fill: COLORS.copper, stroke: COLORS.line, 'stroke-width': 1.2 }),
        circle(48, 58, 4.6, { fill: COLORS.energy, stroke: COLORS.line, 'stroke-width': 1.2 }),
        circle(61, 58, 4.6, { fill: COLORS.gold, stroke: COLORS.line, 'stroke-width': 1.2 })
      ].join('');
    default:
      return conveyorBody(def.base, 'basic');
  }
}

function renderMachine(def) {
  switch (def.machineType) {
    case 'miner_assisted':
      return minerBody(def.base, 'assisted');
    case 'miner_mk1':
      return minerBody(def.base, 'mk1');
    case 'miner_mk2':
      return minerBody(def.base, 'mk2');
    case 'miner_heavy':
      return minerBody(def.base, 'heavy');
    case 'deep_drill':
      return minerBody(def.base, 'deep');
    case 'excavator_industrial':
      return minerBody(def.base, 'excavator');
    case 'crusher':
      return [
        plate(20, 24, 56, 42, COLORS.metal, def.base),
        polygon([[28, 38], [43, 34], [37, 51]], { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 1.8 }),
        polygon([[68, 38], [53, 34], [59, 51]], { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 1.8 }),
        circle(48, 54, 6, { fill: def.base, stroke: COLORS.line, 'stroke-width': 1.4 })
      ].join('');
    case 'sieve':
      return [
        plate(21, 29, 54, 34, COLORS.metal, def.base),
        rect(29, 37, 38, 18, { rx: 5, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 1.6 }),
        ...[34, 42, 50, 58].map(x => line(x, 37, x, 55, { stroke: COLORS.metalLight, 'stroke-width': 1.4, opacity: 0.8 })).join(''),
        ...[42, 50].map(y => line(29, y, 67, y, { stroke: COLORS.metalLight, 'stroke-width': 1.4, opacity: 0.8 })).join('')
      ].join('');
    case 'washer':
      return [
        plate(19, 25, 58, 42, COLORS.metal, COLORS.water),
        circle(48, 46, 14, { fill: COLORS.water, opacity: 0.72, stroke: COLORS.line, 'stroke-width': 1.8 }),
        pathTag('M46 36 C41 43 42 48 46 53 C51 48 51 42 46 36 Z', { fill: COLORS.highlight, opacity: 0.88 }),
        pathTag('M56 42 C52 47 53 51 56 55 C60 51 60 46 56 42 Z', { fill: COLORS.highlight, opacity: 0.64 })
      ].join('');
    case 'industrial_furnace':
      return [
        plate(22, 19, 52, 53, COLORS.stoneDark, COLORS.fire),
        rect(32, 40, 32, 22, { rx: 8, fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 2 }),
        pathTag('M48 38 C40 47 41 54 48 61 C56 54 56 46 48 38 Z', {
          fill: COLORS.fireCore,
          stroke: COLORS.fire,
          'stroke-width': 1.8
        }),
        rect(39, 15, 18, 10, { rx: 4, fill: COLORS.stoneLight, stroke: COLORS.line, 'stroke-width': 1.6 })
      ].join('');
    case 'electric_smelter':
      return [
        plate(22, 19, 52, 53, COLORS.metalDark, COLORS.energy),
        rect(32, 40, 32, 22, { rx: 8, fill: COLORS.coal, stroke: COLORS.line, 'stroke-width': 2 }),
        pathTag('M47 35 L41 48 L47 48 L43 61 L55 43 L47 43 Z', {
          fill: COLORS.fireCore,
          stroke: COLORS.line,
          'stroke-width': 1.6
        }),
        rect(37, 15, 22, 10, { rx: 4, fill: COLORS.energy, stroke: COLORS.line, 'stroke-width': 1.4 })
      ].join('');
    case 'press':
      return [
        rect(24, 20, 48, 14, { rx: 6, fill: COLORS.metal, stroke: COLORS.line, 'stroke-width': 2.2 }),
        rect(40, 34, 16, 22, { rx: 5, fill: def.base, stroke: COLORS.line, 'stroke-width': 2 }),
        rect(29, 56, 38, 12, { rx: 5, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2 }),
        line(48, 35, 48, 24, { stroke: COLORS.highlight, 'stroke-width': 2.2, opacity: 0.3, 'stroke-linecap': 'round' })
      ].join('');
    case 'cutter':
      return [
        plate(21, 30, 54, 34, COLORS.metal, def.base),
        circle(50, 47, 14, { fill: COLORS.metalLight, stroke: COLORS.line, 'stroke-width': 2 }),
        ...Array.from({ length: 8 }, (_, index) => {
          const angle = index * Math.PI / 4;
          const x = 50 + Math.cos(angle) * 18;
          const y = 47 + Math.sin(angle) * 18;
          return polygon([[50, 47], [x - 2, y - 2], [x + 2, y + 2]], { fill: COLORS.silver, opacity: 0.8 });
        }).join('')
      ].join('');
    case 'coiler':
      return [
        plate(20, 26, 56, 40, COLORS.metal, def.base),
        wireSpool(def.base, COLORS.metalDark),
        line(24, 46, 33, 46, { stroke: COLORS.copper, 'stroke-width': 4, 'stroke-linecap': 'round' })
      ].join('');
    case 'assembler':
      return [
        plate(19, 30, 58, 34, COLORS.metal, def.base),
        pathTag(gearPath(48, 47, 9, 14, 7), { fill: COLORS.hazard, stroke: COLORS.line, 'stroke-width': 1.8 }),
        pathTag('M30 40 L39 46 L34 57', { fill: 'none', stroke: COLORS.metalLight, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        pathTag('M66 40 L57 46 L62 57', { fill: 'none', stroke: COLORS.metalLight, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      ].join('');
    case 'mixer':
      return [
        plate(22, 25, 52, 42, COLORS.metal, def.base),
        circle(48, 47, 15, { fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2 }),
        line(48, 33, 48, 61, { stroke: COLORS.metalLight, 'stroke-width': 3.4, 'stroke-linecap': 'round' }),
        pathTag('M41 39 L55 47 L41 55', { fill: 'none', stroke: def.base, 'stroke-width': 3.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      ].join('');
    case 'refinery':
      return [
        rect(25, 24, 18, 44, { rx: 8, fill: COLORS.metal, stroke: COLORS.line, 'stroke-width': 2.2 }),
        rect(50, 17, 18, 51, { rx: 8, fill: COLORS.metalDark, stroke: COLORS.line, 'stroke-width': 2.2 }),
        pathTag('M34 68 L34 76 L58 76 L58 68', { fill: 'none', stroke: COLORS.copper, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        rect(54, 10, 10, 10, { rx: 3, fill: def.base, stroke: COLORS.line, 'stroke-width': 1.4 })
      ].join('');
    default:
      return minerBody(def.base, 'mk1');
  }
}

function wrapSvg(def, content, preview = false) {
  if (preview) {
    return [
      rect(6, 8, 84, 84, { rx: 16, fill: '#0f172a', opacity: 0.92 }),
      rect(11, 13, 74, 74, { rx: 14, fill: '#162033', opacity: 0.55 }),
      iconFrame(def.accent || def.base || COLORS.metalLight),
      content
    ].join('');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
${rect(0, 0, 96, 96, { fill: 'none' })}
${iconFrame(def.accent || def.base || COLORS.metalLight)}
${content}
</svg>
`;
}

function renderIcon(def, preview = false) {
  let body = '';
  switch (def.renderer) {
    case 'tool':
      body = renderTool(def);
      break;
    case 'workstation':
      body = renderWorkstation(def);
      break;
    case 'resource':
      body = renderResource(def);
      break;
    default:
      body = '';
      break;
  }
  return wrapSvg(def, body, preview);
}

function buildTools() {
  return [
    ['mining_tool_bare_hands', 'tools', 'Maos nuas', { renderer: 'tool', variant: 'bare_hands', accent: '#d8a67b' }],
    ['mining_tool_pickaxe_stone', 'tools', 'Picareta de pedra', { renderer: 'tool', variant: 'pickaxe', accent: COLORS.stoneLight, secondary: COLORS.stoneDark }],
    ['mining_tool_pickaxe_copper', 'tools', 'Picareta de cobre', { renderer: 'tool', variant: 'pickaxe', accent: COLORS.copper, secondary: '#4f9a82' }],
    ['mining_tool_pickaxe_iron', 'tools', 'Picareta de ferro', { renderer: 'tool', variant: 'pickaxe', accent: COLORS.iron, secondary: COLORS.metalLight }],
    ['mining_tool_pickaxe_steel', 'tools', 'Picareta de aco', { renderer: 'tool', variant: 'pickaxe', accent: COLORS.steel, secondary: COLORS.highlight }],
    ['mining_tool_manual_drill', 'tools', 'Broca manual', { renderer: 'tool', variant: 'manual_drill', accent: COLORS.metalLight }],
    ['mining_tool_geological_hammer', 'tools', 'Martelo geologico', { renderer: 'tool', variant: 'geological_hammer', accent: COLORS.steel }],
    ['mining_tool_lantern', 'tools', 'Lanterna de mineracao', { renderer: 'tool', variant: 'lantern', accent: COLORS.fireCore }],
    ['mining_tool_helmet_lamp', 'tools', 'Capacete com luz', { renderer: 'tool', variant: 'helmet_lamp', accent: COLORS.fireCore }]
  ].map(([id, folder, label, meta]) => ({ id, folder, category: 'tools', label, ...meta }));
}

function buildWorkstations() {
  return [
    ['mining_station_simple_bench', 'workstations', 'Bancada simples', 'simple_bench'],
    ['mining_station_stone_mortar', 'workstations', 'Pilao de pedra', 'stone_mortar'],
    ['mining_station_sorting_table', 'workstations', 'Mesa de selecao', 'sorting_table'],
    ['mining_station_simple_furnace', 'workstations', 'Fornalha simples', 'simple_furnace'],
    ['mining_station_anvil', 'workstations', 'Bigorna', 'anvil'],
    ['mining_station_coal_crate', 'workstations', 'Caixa de carvao', 'coal_crate']
  ].map(([id, folder, label, variant]) => ({
    id,
    folder,
    category: 'workstations',
    label,
    renderer: 'workstation',
    variant,
    accent: COLORS.fire
  }));
}

function buildRocks() {
  return [
    ['mining_resource_stone', 'resources/rocks', 'Pedra comum', COLORS.stone, COLORS.stoneLight, 'specks'],
    ['mining_resource_granite', 'resources/rocks', 'Granito', '#6f6462', '#c8a8a3', 'specks'],
    ['mining_resource_slate', 'resources/rocks', 'Ardosia', '#475569', '#94a3b8', 'layers'],
    ['mining_resource_sandstone', 'resources/rocks', 'Arenito', '#b98957', '#e6c08b', 'layers'],
    ['mining_resource_basalt', 'resources/rocks', 'Basalto', '#3b424d', '#70798a', 'basalt'],
    ['mining_resource_limestone', 'resources/rocks', 'Calcario', '#bdb9a8', '#ece5cc', 'layers']
  ].map(([id, folder, label, base, accent, detail]) => ({
    id,
    folder,
    category: 'resources',
    label,
    renderer: 'resource',
    variant: 'rock',
    base,
    accent,
    detail
  }));
}

function buildOres() {
  return [
    ['mining_ore_iron_raw', 'resources/ores', 'Minerio bruto de ferro', COLORS.iron, 'specks'],
    ['mining_ore_copper_raw', 'resources/ores', 'Minerio bruto de cobre', COLORS.copper, 'specks'],
    ['mining_ore_tin_raw', 'resources/ores', 'Estanho bruto', '#9cc2d3', 'specks'],
    ['mining_ore_coal_raw', 'resources/ores', 'Carvao bruto', COLORS.coal, 'coal'],
    ['mining_ore_lead_raw', 'resources/ores', 'Chumbo bruto', COLORS.lead, 'specks'],
    ['mining_ore_silver_raw', 'resources/ores', 'Prata bruta', COLORS.silver, 'specks'],
    ['mining_ore_gold_raw', 'resources/ores', 'Ouro bruto', COLORS.gold, 'specks'],
    ['mining_ore_quartz_raw', 'resources/ores', 'Quartzo bruto', COLORS.quartz, 'cracks'],
    ['mining_ore_bauxite_raw', 'resources/ores', 'Bauxita', '#ba5b47', 'layers'],
    ['mining_ore_nickel_raw', 'resources/ores', 'Niquel bruto', '#7cad97', 'specks'],
    ['mining_ore_titanium_raw', 'resources/ores', 'Titanio bruto', '#7488a8', 'specks'],
    ['mining_ore_energy_raw', 'resources/ores', 'Minerio energetico raro', COLORS.energy, 'veins']
  ].map(([id, folder, label, accent, detail]) => ({
    id,
    folder,
    category: 'resources',
    label,
    renderer: 'resource',
    variant: 'ore',
    base: COLORS.stone,
    accent,
    detail
  }));
}

function buildByproducts() {
  return [
    ['mining_byproduct_gravel', 'resources/byproducts', 'Cascalho', COLORS.stone, COLORS.stoneLight],
    ['mining_byproduct_mineral_dust', 'resources/byproducts', 'Poeira mineral', '#8b8178', '#d3c8be'],
    ['mining_byproduct_silica', 'resources/byproducts', 'Silica', '#c7d8e8', '#eef7ff'],
    ['mining_byproduct_clay', 'resources/byproducts', 'Argila', COLORS.clay, '#d49b74'],
    ['mining_byproduct_sulfur', 'resources/byproducts', 'Enxofre', COLORS.sulfur, '#f3f0ab'],
    ['mining_byproduct_saltpeter', 'resources/byproducts', 'Salitre', '#c7d0d8', '#eef2f5'],
    ['mining_byproduct_rare_crystals', 'resources/byproducts', 'Cristais raros', '#6d83ff', '#c3d1ff', 'crystal'],
    ['mining_byproduct_gems', 'resources/byproducts', 'Gemas', '#13b5a0', '#76f1e0', 'crystal']
  ].map(([id, folder, label, base, accent, variant]) => ({
    id,
    folder,
    category: 'resources',
    label,
    renderer: 'resource',
    variant: variant || 'powder',
    base,
    accent,
    count: variant === 'crystal' ? 4 : undefined
  }));
}

function buildDeposits() {
  const surface = [
    {
      id: 'mining_deposit_surface_fragment',
      folder: 'deposits',
      category: 'deposits',
      label: 'Fragmento superficial',
      renderer: 'resource',
      variant: 'deposit',
      depositType: 'vein',
      accent: COLORS.stoneLight,
      secondary: COLORS.highlight
    },
    {
      id: 'mining_deposit_scrap_metal',
      folder: 'deposits',
      category: 'deposits',
      label: 'Restos metalicos',
      renderer: 'resource',
      variant: 'deposit',
      depositType: 'vein',
      accent: COLORS.metalLight,
      secondary: COLORS.copper
    }
  ];

  const veins = [
    ['mining_vein_iron', 'Veio de ferro', COLORS.iron, '#de7e60'],
    ['mining_vein_copper', 'Veio de cobre', COLORS.copper, '#6bc2a9'],
    ['mining_vein_coal', 'Veio de carvao', COLORS.coal, COLORS.highlight],
    ['mining_vein_quartz', 'Veio de quartzo', COLORS.quartz, '#f8fdff']
  ].map(([id, label, accent, secondary]) => ({
    id,
    folder: 'deposits',
    category: 'deposits',
    label,
    renderer: 'resource',
    variant: 'deposit',
    depositType: 'vein',
    accent,
    secondary
  }));

  const purity = [
    ['mining_purity_impure', 'Pureza impura', '#585f6b', '#c5ced8', 'impure'],
    ['mining_purity_normal', 'Pureza normal', '#607089', '#eef2f6', 'normal'],
    ['mining_purity_rich', 'Pureza rica', '#996f38', '#ffd879', 'rich'],
    ['mining_purity_exceptional', 'Pureza excepcional', '#0d6c3d', '#86f7bb', 'exceptional']
  ].map(([id, label, base, accent, level]) => ({
    id,
    folder: 'deposits',
    category: 'deposits',
    label,
    renderer: 'resource',
    variant: 'deposit',
    depositType: 'purity',
    base,
    accent,
    level
  }));

  const geology = [
    ['mining_scanner_geologic', 'Scanner geologico', 'scanner', COLORS.energy],
    ['mining_probe_depth', 'Sonda de profundidade', 'probe', COLORS.copper],
    ['mining_sensor_seismic', 'Analise sismica', 'sensor', COLORS.water]
  ].map(([id, label, depositType, accent]) => ({
    id,
    folder: 'deposits',
    category: 'deposits',
    label,
    renderer: 'resource',
    variant: 'deposit',
    depositType,
    accent
  }));

  return [...surface, ...veins, ...purity, ...geology];
}

function buildMetals() {
  return [
    ['mining_ingot_iron', 'metals', 'Lingote de ferro', COLORS.iron, '#b26f59'],
    ['mining_ingot_copper', 'metals', 'Lingote de cobre', COLORS.copper, '#f3b177'],
    ['mining_ingot_tin', 'metals', 'Lingote de estanho', '#8caabd', '#cde2ef'],
    ['mining_ingot_lead', 'metals', 'Lingote de chumbo', COLORS.lead, '#97a0b1'],
    ['mining_ingot_silver', 'metals', 'Lingote de prata', COLORS.silver, COLORS.highlight],
    ['mining_ingot_gold', 'metals', 'Lingote de ouro', COLORS.gold, '#ffe08d'],
    ['mining_alloy_bronze', 'metals', 'Liga de bronze', COLORS.bronze, '#efc08a'],
    ['mining_alloy_steel', 'metals', 'Liga de aco', COLORS.steel, '#d7dee9'],
    ['mining_alloy_brass', 'metals', 'Liga de latao', '#c89b53', '#f1d38c'],
    ['mining_alloy_aluminum', 'metals', 'Liga de aluminio', '#aab9c9', '#f2f7fb'],
    ['mining_alloy_reinforced_steel', 'metals', 'Aco reforcado', '#51657c', '#a4d6bc'],
    ['mining_alloy_titanium', 'metals', 'Liga de titanio', '#7080b4', '#cbd2ff']
  ].map(([id, folder, label, base, accent]) => ({
    id,
    folder,
    category: 'metals',
    label,
    renderer: 'resource',
    variant: 'ingot',
    base,
    accent
  }));
}

function buildParts() {
  return [
    ['mining_part_iron_plate', 'components', 'Chapa de ferro', 'iron_plate', COLORS.steel, COLORS.highlight],
    ['mining_part_iron_bar', 'components', 'Barra de ferro', 'iron_bar', COLORS.steel, COLORS.highlight],
    ['mining_part_gear', 'components', 'Engrenagem', 'gear', COLORS.steel, COLORS.highlight],
    ['mining_part_shaft', 'components', 'Eixo', 'shaft', COLORS.steel, COLORS.highlight],
    ['mining_part_screw', 'components', 'Parafuso', 'screw', COLORS.silver, COLORS.highlight],
    ['mining_part_copper_pipe', 'components', 'Tubo de cobre', 'copper_pipe', COLORS.copper, '#f2b786'],
    ['mining_part_copper_wire', 'components', 'Fio de cobre', 'copper_wire', COLORS.copper, '#f5c89c'],
    ['mining_part_coil', 'components', 'Bobina', 'coil', COLORS.copper, '#f5c89c'],
    ['mining_part_metal_plate', 'components', 'Placa metalica', 'metal_plate', COLORS.steel, COLORS.metalLight],
    ['mining_part_mechanical_component', 'components', 'Componente mecanico', 'mechanical_component', COLORS.hazard, COLORS.steel],
    ['mining_part_electrical_component', 'components', 'Componente eletrico', 'electrical_component', COLORS.energy, COLORS.fireCore],
    ['mining_part_simple_circuit', 'components', 'Circuito simples', 'simple_circuit', COLORS.energy, COLORS.gold]
  ].map(([id, folder, label, partType, base, accent]) => ({
    id,
    folder,
    category: 'components',
    label,
    renderer: 'resource',
    variant: 'part',
    partType,
    base,
    accent
  }));
}

function buildPower() {
  return [
    ['mining_power_wood_generator', 'energy', 'Gerador a lenha', 'wood_generator', COLORS.woodLight, COLORS.fire],
    ['mining_power_coal_generator', 'energy', 'Gerador a carvao', 'coal_generator', COLORS.fire, COLORS.coal],
    ['mining_power_hand_dynamo', 'energy', 'Dinamo manual', 'hand_dynamo', COLORS.copper, COLORS.metalLight],
    ['mining_power_water_wheel', 'energy', "Roda d'agua", 'water_wheel', COLORS.water, '#8fe0ff'],
    ['mining_power_steam_engine', 'energy', 'Motor a vapor', 'steam_engine', COLORS.metalLight, COLORS.fire],
    ['mining_power_pole', 'energy', 'Poste simples', 'pole', COLORS.metalLight, COLORS.wood],
    ['mining_power_connector', 'energy', 'Conector', 'connector', COLORS.copper, COLORS.gold],
    ['mining_power_small_battery', 'energy', 'Bateria pequena', 'small_battery', COLORS.energyDark, COLORS.energy],
    ['mining_power_panel', 'energy', 'Quadro de energia', 'panel', COLORS.energy, COLORS.highlight],
    ['mining_power_fuse', 'energy', 'Fusivel', 'fuse', COLORS.quartz, COLORS.fire]
  ].map(([id, folder, label, powerType, base, accent]) => ({
    id,
    folder,
    category: 'energy',
    label,
    renderer: 'resource',
    variant: 'power',
    powerType,
    base,
    accent
  }));
}

function buildLogistics() {
  return [
    ['mining_logistics_conveyor_basic', 'logistics', 'Esteira simples', 'conveyor_basic', COLORS.hazard],
    ['mining_logistics_conveyor_fast', 'logistics', 'Esteira rapida', 'conveyor_fast', '#4ba8de'],
    ['mining_logistics_splitter', 'logistics', 'Divisor', 'splitter', COLORS.hazard],
    ['mining_logistics_merger', 'logistics', 'Unificador', 'merger', COLORS.energy],
    ['mining_logistics_machine_input', 'logistics', 'Entrada de maquina', 'machine_input', COLORS.fireCore],
    ['mining_logistics_machine_output', 'logistics', 'Saida de maquina', 'machine_output', COLORS.energy],
    ['mining_logistics_industrial_crate', 'logistics', 'Caixa industrial', 'industrial_crate', COLORS.hazard],
    ['mining_logistics_lift_basic', 'logistics', 'Elevador simples', 'lift_basic', '#7cc7ff'],
    ['mining_logistics_filter_sorter', 'logistics', 'Filtro', 'filter_sorter', COLORS.silver]
  ].map(([id, folder, label, logisticsType, base]) => ({
    id,
    folder,
    category: 'logistics',
    label,
    renderer: 'resource',
    variant: 'logistics',
    logisticsType,
    base,
    accent: base
  }));
}

function buildMachines() {
  return [
    ['mining_machine_miner_assisted', 'machines', 'Mineradora assistida', 'miner_assisted', COLORS.copper],
    ['mining_machine_miner_mk1', 'machines', 'Mineradora MK1', 'miner_mk1', COLORS.steel],
    ['mining_machine_miner_mk2', 'machines', 'Mineradora MK2', 'miner_mk2', COLORS.energy],
    ['mining_machine_miner_heavy', 'machines', 'Mineradora pesada', 'miner_heavy', COLORS.fire],
    ['mining_machine_deep_drill', 'machines', 'Broca profunda', 'deep_drill', COLORS.copper],
    ['mining_machine_excavator_industrial', 'machines', 'Escavadora industrial', 'excavator_industrial', COLORS.hazard],
    ['mining_machine_crusher', 'machines', 'Britador', 'crusher', COLORS.hazard],
    ['mining_machine_sieve', 'machines', 'Peneira', 'sieve', COLORS.silver],
    ['mining_machine_washer', 'machines', 'Lavador', 'washer', COLORS.water],
    ['mining_machine_industrial_furnace', 'machines', 'Fornalha industrial', 'industrial_furnace', COLORS.fire],
    ['mining_machine_electric_smelter', 'machines', 'Fundicao eletrica', 'electric_smelter', COLORS.energy],
    ['mining_machine_press', 'machines', 'Prensa', 'press', COLORS.hazard],
    ['mining_machine_cutter', 'machines', 'Cortadora', 'cutter', COLORS.silver],
    ['mining_machine_coiler', 'machines', 'Bobinadeira', 'coiler', COLORS.copper],
    ['mining_machine_assembler', 'machines', 'Montadora', 'assembler', COLORS.hazard],
    ['mining_machine_mixer', 'machines', 'Misturador', 'mixer', COLORS.energy],
    ['mining_machine_refinery', 'machines', 'Refinaria', 'refinery', COLORS.copper]
  ].map(([id, folder, label, machineType, base]) => ({
    id,
    folder,
    category: 'machines',
    label,
    renderer: 'resource',
    variant: 'machine',
    machineType,
    base,
    accent: base
  }));
}

const assets = [
  ...buildTools(),
  ...buildWorkstations(),
  ...buildRocks(),
  ...buildOres(),
  ...buildByproducts(),
  ...buildDeposits(),
  ...buildMetals(),
  ...buildParts(),
  ...buildPower(),
  ...buildLogistics(),
  ...buildMachines()
];

function assetRelativePath(def) {
  return path.posix.join('assets', 'ui', 'mining_automation', def.folder.replaceAll('\\', '/'), `${def.id}.svg`);
}

function groupByCategory(list) {
  const grouped = {};
  for (const item of list) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return grouped;
}

function buildOverviewSvg(list) {
  const grouped = groupByCategory(list);
  const categories = Object.entries(grouped);
  const cols = 6;
  const cellW = 132;
  const cellH = 136;
  const titleH = 44;
  const sectionGap = 18;
  const width = cols * cellW + 40;
  let cursorY = 28;
  const sections = [
    rect(0, 0, width, 40, { fill: '#020617' }),
    text(20, 26, 'HavenFall Mining Automation Asset Pack', {
      fill: '#f8fafc',
      'font-family': 'monospace',
      'font-size': 18,
      'font-weight': 700
    })
  ];

  for (const [category, items] of categories) {
    const rows = Math.ceil(items.length / cols);
    sections.push(
      rect(12, cursorY - 4, width - 24, titleH, { rx: 14, fill: '#0f172a', opacity: 0.9 }),
      text(24, cursorY + 22, category.toUpperCase(), {
        fill: '#dbeafe',
        'font-family': 'monospace',
        'font-size': 18,
        'font-weight': 700
      })
    );
    cursorY += titleH + 6;

    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = 20 + col * cellW;
      const y = cursorY + row * cellH;
      sections.push(
        group(renderIcon(item, true), { transform: `translate(${x}, ${y}) scale(1)` }),
        text(x + 48, y + 108, safeLabel(item.label), {
          fill: '#e5e7eb',
          'font-family': 'monospace',
          'font-size': 10.2,
          'text-anchor': 'middle'
        }),
        text(x + 48, y + 121, item.id, {
          fill: '#93c5fd',
          'font-family': 'monospace',
          'font-size': 8.1,
          'text-anchor': 'middle'
        })
      );
    });

    cursorY += rows * cellH + sectionGap;
  }

  const height = cursorY + 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${rect(0, 0, width, height, { fill: '#020617' })}
${sections.join('\n')}
</svg>
`;
}

function buildManifest(list) {
  const grouped = groupByCategory(list);
  const categoryCounts = Object.fromEntries(Object.entries(grouped).map(([category, items]) => [category, items.length]));
  return {
    generatedAt: new Date().toISOString(),
    root: 'assets/ui/mining_automation',
    note: 'Pacote isolado para roadmap de mineracao/metalurgia/energia/automacao. O manifesto global assets/manifest.js nao foi regenerado aqui para evitar sobrescrever referencias legadas do projeto.',
    total: list.length,
    categories: categoryCounts,
    assets: list.map(item => ({
      id: item.id,
      label: item.label,
      category: item.category,
      folder: item.folder,
      path: assetRelativePath(item)
    }))
  };
}

function buildRoadmapMarkdown(list) {
  const grouped = groupByCategory(list);
  const lines = [
    '# Mining Automation Asset Roadmap',
    '',
    'Status: asset pack generated for planning and future integration.',
    '',
    '## Goal',
    '',
    'Create a clean SVG pack for the mining, metallurgy, power and automation roadmap without interfering with the current gameplay worktree.',
    '',
    '## Output',
    '',
    `- Root folder: \`assets/ui/mining_automation\``,
    `- Local pack manifest: \`assets/ui/mining_automation/asset-pack.json\``,
    `- Visual overview: \`assets/ui/mining_automation/overview.svg\``,
    `- Total assets: \`${list.length}\``,
    '',
    '## Integration note',
    '',
    'The global runtime manifest in `assets/manifest.js` was intentionally left untouched in this pass. The current repository has stale UI manifest references that do not match the files on disk, so regenerating the global manifest right now would be disruptive. This pack is therefore self-contained and ready for manual runtime registration once the UI asset pipeline is cleaned up.',
    '',
    '## Recommended implementation order',
    '',
    '1. Manual mining package',
    '   Use `tools`, `resources`, `deposits` and `workstations` first.',
    '2. Manual processing package',
    '   Wire `workstations`, `metals` and `components` into inventory and recipes.',
    '3. Early power package',
    '   Use `energy` icons for research, build menu and machine status.',
    '4. Logistics package',
    '   Add `logistics` assets to placement previews and machine ports.',
    '5. Industrial automation package',
    '   Add `machines` after belts and power are stable.',
    '',
    '## Category counts',
    ''
  ];

  Object.entries(grouped).forEach(([category, items]) => {
    lines.push(`- ${category}: ${items.length}`);
  });

  for (const [category, items] of Object.entries(grouped)) {
    lines.push('', `## ${category}`, '');
    items.forEach(item => {
      lines.push(`- ${item.label} -> \`${assetRelativePath(item)}\``);
    });
  }

  return `${lines.join('\n')}\n`;
}

async function writeAsset(def) {
  const filePath = path.join(outputRoot, def.folder, `${def.id}.svg`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, renderIcon(def), 'utf8');
}

async function main() {
  for (const asset of assets) {
    await writeAsset(asset);
  }

  await mkdir(outputRoot, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(buildManifest(assets), null, 2)}\n`, 'utf8');
  await writeFile(overviewPath, buildOverviewSvg(assets), 'utf8');
  await writeFile(docsPath, buildRoadmapMarkdown(assets), 'utf8');

  console.log(`Generated ${assets.length} SVG assets in ${outputRoot}`);
  console.log(`Wrote ${manifestPath}`);
  console.log(`Wrote ${overviewPath}`);
  console.log(`Wrote ${docsPath}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
