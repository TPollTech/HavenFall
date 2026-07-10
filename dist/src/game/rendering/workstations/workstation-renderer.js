'use strict';

(() => {
  const core = window.HavenfallWorkstationCore;
  const styles = window.HavenfallWorkstationStyle;
  const {
    tileAnchor,
    drawEllipse,
    drawRoundRect,
    drawLine,
    drawCircle,
    drawTriangle,
    drawShadow,
    drawBoard,
    drawLegs
  } = core;

  function drawWorkstation(obj) {
    if (!obj || obj.type === 'blueprint' || !styles.canRender(obj.type)) return false;
    const p = tileAnchor(obj);
    ctx.save();
    if (obj.type === 'bench') drawBench(p.x, p.y, styles.profile(obj.type));
    else if (obj.type === 'research_desk') drawResearchDesk(p.x, p.y, styles.profile(obj.type));
    else if (obj.type === 'forge') drawForge(p.x, p.y, styles.profile(obj.type));
    else if (obj.type === 'stove') drawStove(p.x, p.y, styles.profile(obj.type));
    else if (obj.type === 'med_station') drawMedStation(p.x, p.y, styles.profile(obj.type));
    else if (obj.type === 'sewing_table') drawSewingTable(p.x, p.y, styles.profile(obj.type));
    else if (obj.type === 'smokehouse') drawSmokehouse(p.x, p.y, styles.profile(obj.type));
    else if (obj.type === 'butcher_table') drawButcherTable(p.x, p.y, styles.profile(obj.type));
    ctx.restore();
    return true;
  }

  function drawBench(x, y, s) {
    drawShadow(x, y, 25, 8);
    drawLegs(x, y + 5, 34, 16, s.darkWood);
    drawBoard(x, y, 38, 13, s.wood);
    drawRoundRect(x - 17, y - 10, 18, 5, 2, '#8b6a49', '#2c2118', 1);
    drawLine(x + 6, y - 8, x + 17, y - 14, '#2c2118', 2.2);
    drawCircle(x + 19, y - 15, 3.2, s.metal, '#2c2118', 1);
    drawLine(x - 10, y - 3, x - 2, y + 5, s.metal, 2);
    drawLine(x - 2, y - 3, x - 10, y + 5, s.metal, 2);
    drawRoundRect(x + 9, y + 2, 11, 5, 2, s.accent, '#2c2118', 1);
  }

  function drawResearchDesk(x, y, s) {
    drawShadow(x, y, 25, 8);
    drawLegs(x, y + 5, 36, 16, s.darkWood);
    drawBoard(x, y, 40, 14, s.wood);
    drawRoundRect(x - 14, y - 8, 15, 10, 2, s.paper, '#4c3b2b', 1);
    drawLine(x - 11, y - 5, x - 3, y - 5, '#7d6b57', 1);
    drawLine(x - 11, y - 2, x - 5, y - 2, '#7d6b57', 1);
    drawRoundRect(x + 4, y - 10, 12, 12, 2, '#31424d', '#1c242a', 1);
    drawLine(x + 6, y - 6, x + 14, y - 2, s.accent, 1.5);
    drawLine(x + 19, y - 15, x + 13, y - 7, '#6c5843', 2);
    drawCircle(x + 20, y - 17, 4.2, '#e9c46a', '#4c3b2b', 1);
  }

  function drawForge(x, y, s) {
    drawShadow(x, y, 27, 9);
    drawRoundRect(x - 20, y - 7, 40, 24, 5, s.stone, '#252520', 1.5);
    drawRoundRect(x - 15, y - 2, 30, 14, 4, s.darkStone, '#1f1d1a', 1.3);
    drawEllipse(x, y + 4, 11, 5, '#2b1710', '#1b100b', 1);
    drawCircle(x - 4, y + 2, 4.5, s.fire);
    drawCircle(x + 3, y + 3, 5.5, '#facc15');
    drawRoundRect(x + 9, y - 22, 9, 18, 3, '#484741', '#252520', 1.3);
    drawEllipse(x + 13.5, y - 23, 5, 2.4, '#2f2f2b', '#1f1f1d', 1);
    drawTriangle([{ x: x - 23, y: y + 8 }, { x: x - 9, y: y + 1 }, { x: x - 6, y: y + 11 }], s.metal, '#252520', 1);
  }

  function drawStove(x, y, s) {
    drawShadow(x, y, 24, 8);
    drawRoundRect(x - 18, y - 9, 36, 25, 5, s.stone, '#2f2c27', 1.5);
    drawRoundRect(x - 12, y - 3, 24, 13, 3, s.darkStone, '#211f1b', 1.2);
    drawCircle(x, y - 11, 9, '#25231f', '#171511', 1.2);
    drawEllipse(x, y - 11, 12, 4, s.metal, '#25231f', 1.1);
    drawRoundRect(x - 5, y - 20, 10, 5, 2, s.metal, '#25231f', 1);
    drawCircle(x - 3, y + 3, 3.8, s.fire);
    drawCircle(x + 3, y + 3, 3.8, '#facc15');
  }

  function drawMedStation(x, y, s) {
    drawShadow(x, y, 25, 8);
    drawLegs(x, y + 7, 38, 15, '#4a3d32');
    drawRoundRect(x - 20, y - 8, 40, 16, 5, s.cloth, '#51483d', 1.4);
    drawRoundRect(x - 18, y - 9, 13, 10, 3, '#ebe8dd', '#51483d', 1);
    drawRoundRect(x + 7, y - 17, 15, 14, 3, '#c9c2b5', '#51483d', 1.1);
    drawLine(x + 14.5, y - 14, x + 14.5, y - 6, s.accent, 2);
    drawLine(x + 10.5, y - 10, x + 18.5, y - 10, s.accent, 2);
    drawLine(x - 15, y + 5, x + 17, y + 5, s.metal, 1.2);
  }

  function drawSewingTable(x, y, s) {
    drawShadow(x, y, 25, 8);
    drawLegs(x, y + 5, 36, 16, '#493325');
    drawBoard(x, y, 40, 13, s.wood);
    drawEllipse(x - 9, y - 7, 11, 5, s.cloth, '#342a3c', 1.1, -0.12);
    drawLine(x - 16, y - 5, x - 3, y - 9, '#b9a8cf', 1.2);
    drawRoundRect(x + 6, y - 14, 10, 17, 3, s.metal, '#2b2723', 1.2);
    drawCircle(x + 11, y - 16, 4.2, s.thread, '#4b3b28', 1);
    drawLine(x + 11, y - 10, x + 16, y - 1, '#2b2723', 1.5);
    drawCircle(x + 17, y, 2.2, '#2b2723');
  }

  function drawSmokehouse(x, y, s) {
    drawShadow(x, y, 24, 8);
    drawRoundRect(x - 15, y - 22, 30, 38, 4, s.wood, '#211811', 1.5);
    for (const ox of [-7, 0, 7]) drawLine(x + ox, y - 19, x + ox, y + 14, 'rgba(255,255,255,.08)', 1);
    drawRoundRect(x - 10, y - 9, 20, 17, 3, s.darkWood, '#1d140f', 1.2);
    drawLine(x - 8, y - 1, x + 8, y - 1, '#806047', 1.4);
    drawCircle(x - 4, y + 9, 3.8, s.ember, '#3a2012', 1);
    drawCircle(x + 4, y + 10, 3.2, '#facc15', '#3a2012', 1);
    drawEllipse(x - 6, y - 27, 5, 9, s.smoke, null, 1, -0.3);
    drawEllipse(x + 3, y - 31, 5, 10, s.smoke, null, 1, 0.2);
    drawTriangle([{ x: x - 18, y: y - 22 }, { x, y: y - 35 }, { x: x + 18, y: y - 22 }], '#4a3426', '#211811', 1.3);
  }

  function drawButcherTable(x, y, s) {
    drawShadow(x, y, 26, 8);
    drawLegs(x, y + 6, 38, 16, s.darkWood);
    drawBoard(x, y, 42, 14, s.wood);
    drawRoundRect(x - 17, y - 11, 17, 9, 3, s.meat, '#4b1515', 1.1);
    drawLine(x - 15, y - 6, x - 2, y - 6, 'rgba(255,255,255,.18)', 1);
    drawLine(x + 4, y - 10, x + 18, y - 15, s.metal, 2.2);
    drawRoundRect(x + 15, y - 17, 8, 4, 2, '#5b3a27', '#2b1d14', 1);
    drawCircle(x + 3, y + 1, 3.4, s.bone, '#6b5b47', 1);
    drawCircle(x + 13, y + 3, 3.1, s.bone, '#6b5b47', 1);
    drawLine(x + 4, y + 1, x + 12, y + 3, s.bone, 3);
  }

  function installWorkstationRenderer() {
    if (window.HavenfallContext?.workstationRendererInstalled) return;
    window.HavenfallContext = window.HavenfallContext || {};
    window.GameSystems?.registerObjectRenderer?.('workstations.procedural', drawWorkstation, { order: 30 });
    window.HavenfallWorkstationRenderer = Object.freeze({
      drawObject: drawWorkstation
    });
    window.HavenfallContext.workstationRendererInstalled = true;
  }

  installWorkstationRenderer();
})();
