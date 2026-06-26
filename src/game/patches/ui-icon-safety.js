'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};

  function safeLoadedIconSrc(name) {
    const key = name || 'icon_warn';
    if (typeof images === 'object' && images?.[key]?.src) return images[key].src;
    return null;
  }

  window.iconFrame = function iconFrame(icon, label = '', extraClass = '') {
    const src = safeLoadedIconSrc(icon);
    const title = typeof escapeHtml === 'function' ? escapeHtml(label || icon || 'Item') : String(label || icon || 'Item');
    const baseStyle = 'width:40px;height:40px;display:grid;place-items:center;border-radius:10px;border:1px solid rgba(255,255,255,.12);overflow:hidden;flex:0 0 40px;';

    if (!src) {
      return `<span class="ui-icon-fallback ${extraClass}" title="${title}" aria-hidden="true" style="${baseStyle}background:rgba(58,58,58,.88);color:#b8b0a0;font-size:16px;">▣</span>`;
    }

    const safeSrc = typeof escapeHtml === 'function' ? escapeHtml(src) : String(src);
    return `<span class="ui-icon-frame ${extraClass}" title="${title}" style="${baseStyle}background:rgba(8,11,16,.72);"><span style="display:none;color:#b8b0a0;font-size:16px;">▣</span><img src="${safeSrc}" alt="" style="max-width:34px;max-height:34px;object-fit:contain;display:block;" onerror="this.style.display='none';this.previousElementSibling.style.display='grid';"></span>`;
  };

  window.HavenfallContext.uiIconSafetyInstalled = true;
})();
