'use strict';

(() => {
  function skillTotal(key) {
    return (colonistCandidates || []).reduce((sum, c) => sum + Number(c.skills?.[key] || 0), 0);
  }

  function coverageLevel(total) {
    if (total >= 18) return 'high';
    if (total >= 11) return 'ok';
    if (total >= 7) return 'warn';
    return 'gap';
  }

  function coverageLabel(level) {
    return ({ high: 'FORTE', ok: 'ESTÁVEL', warn: 'BAIXA', gap: 'FALHA' })[level] || 'N/D';
  }

  function coverageWarning(level, key) {
    const label = COLONIST_SKILL_LABELS?.[key] || key;
    if (level === 'gap') return `Gap crítico em ${label.toLowerCase()}`;
    if (level === 'warn') return `Cobertura baixa em ${label.toLowerCase()}`;
    return null;
  }

  function renderCoverageBars() {
    const keys = COLONIST_SKILL_KEYS || [];
    return keys.map(key => {
      const total = skillTotal(key);
      const pct = Math.max(8, Math.min(100, Math.round((total / 24) * 100)));
      const level = coverageLevel(total);
      return `<div class="squad-sync-row ${level}">
        <span>${escapeHtml(COLONIST_SKILL_LABELS?.[key] || key)}</span>
        <div class="squad-sync-eq" aria-label="Cobertura ${escapeHtml(key)} ${total}">
          ${Array.from({ length: 12 }, (_, i) => `<i class="${i < Math.ceil(pct / 100 * 12) ? 'on' : ''}"></i>`).join('')}
        </div>
        <b>${coverageLabel(level)}</b>
      </div>`;
    }).join('');
  }

  function renderCoverageAlerts() {
    const alerts = (COLONIST_SKILL_KEYS || [])
      .map(key => coverageWarning(coverageLevel(skillTotal(key)), key))
      .filter(Boolean);

    if (!alerts.length) return '<span class="squad-sync-ok">Compatibilidade operacional aceitável.</span>';
    return alerts.slice(0, 3).map(alert => `<span class="squad-sync-alert">${escapeHtml(alert)}</span>`).join('');
  }

  function renderRecruitmentCoveragePanel() {
    return `<section class="squad-sync-panel" aria-label="Cobertura operacional da equipe">
      <div class="squad-sync-head">
        <div>
          <span>COBERTURA OPERACIONAL</span>
          <b>Equilíbrio da Equipe</b>
        </div>
        <em>${(colonistCandidates || []).length} colono${(colonistCandidates || []).length === 1 ? '' : 's'}</em>
      </div>
      <div class="squad-sync-grid">${renderCoverageBars()}</div>
      <div class="squad-sync-alerts">${renderCoverageAlerts()}</div>
    </section>`;
  }

  function injectRecruitmentCoverageStyle() {
    if (document.getElementById('recruitment-coverage-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'recruitment-coverage-ui-style';
    style.textContent = `
      .squad-sync-panel {
        grid-area: coverage;
        border: 1px solid rgba(125, 211, 252, .16);
        border-radius: 18px;
        background:
          linear-gradient(90deg, rgba(8, 47, 73, .26), rgba(2, 6, 23, .78)),
          rgba(2, 6, 23, .64);
        padding: 13px;
        display: grid;
        gap: 12px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
        min-width: 0;
      }

      .squad-sync-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      .squad-sync-head div {
        display: grid;
        gap: 3px;
      }

      .squad-sync-head span {
        color: rgba(94, 234, 212, .82);
        font: 800 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .22em;
      }

      .squad-sync-head b {
        color: #ecfeff;
        font-size: 14px;
      }

      .squad-sync-head em {
        color: rgba(203, 213, 225, .70);
        font: 800 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-style: normal;
      }

      .squad-sync-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(120px, 1fr));
        gap: 10px;
      }

      .squad-sync-row {
        display: grid;
        gap: 7px;
        min-width: 0;
      }

      .squad-sync-row span {
        color: rgba(226, 232, 240, .72);
        font-size: 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .squad-sync-eq {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 3px;
        height: 34px;
        align-items: end;
      }

      .squad-sync-eq i {
        display: block;
        min-height: 5px;
        height: 22%;
        border-radius: 4px 4px 2px 2px;
        background: rgba(51, 65, 85, .82);
        border: 1px solid rgba(255,255,255,.04);
      }

      .squad-sync-eq i:nth-child(2n) { height: 42%; }
      .squad-sync-eq i:nth-child(3n) { height: 62%; }
      .squad-sync-eq i:nth-child(4n) { height: 82%; }
      .squad-sync-eq i.on {
        background: linear-gradient(180deg, rgba(94, 234, 212, .96), rgba(14, 165, 233, .72));
        box-shadow: 0 0 9px rgba(45, 212, 191, .26);
      }

      .squad-sync-row.warn .squad-sync-eq i.on,
      .squad-sync-row.gap .squad-sync-eq i.on {
        background: linear-gradient(180deg, rgba(251, 191, 36, .96), rgba(217, 119, 6, .74));
        box-shadow: 0 0 9px rgba(251, 191, 36, .24);
      }

      .squad-sync-row b {
        color: #a7f3d0;
        font: 900 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .10em;
      }

      .squad-sync-row.warn b,
      .squad-sync-row.gap b {
        color: #fde68a;
      }

      .squad-sync-alerts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .squad-sync-ok,
      .squad-sync-alert {
        border-radius: 999px;
        padding: 6px 9px;
        font: 800 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .06em;
      }

      .squad-sync-ok {
        color: #99f6e4;
        border: 1px solid rgba(94, 234, 212, .20);
        background: rgba(20, 184, 166, .08);
      }

      .squad-sync-alert {
        color: #fde68a;
        border: 1px solid rgba(251, 191, 36, .28);
        background: rgba(120, 53, 15, .18);
      }

      @media (max-width: 1080px) {
        .squad-sync-grid {
          grid-template-columns: repeat(2, minmax(120px, 1fr));
        }
      }

      @media (max-width: 620px) {
        .squad-sync-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  injectRecruitmentCoverageStyle();
  window.renderRecruitmentCoveragePanel = renderRecruitmentCoveragePanel;
})();
