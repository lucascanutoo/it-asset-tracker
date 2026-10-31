'use strict';
// Aplica componentes visuais também aos elementos criados pelos dashboards.
// Diálogos continuam nativos para preservar foco, Escape e o bloqueio do fundo.
(function () {
  const components = [
    ['.button-primary', ['btn','btn-primary']],
    ['.button-secondary', ['btn','btn-outline-primary']],
    ['.button-danger', ['btn','btn-danger']],
    ['.text-button', ['btn','btn-link']],
    ['.field input:not([type=checkbox]):not([type=radio]), .search-field input', ['form-control']],
    ['.field select, .filter-row select, .pagination select', ['form-select']],
    ['.password-toggle input', ['form-check-input']],
    ['.panel, .metric-card', ['card']],
    ['table', ['table','table-hover','align-middle','mb-0']],
    ['.table-scroll', ['table-responsive']],
    ['.log-badge', ['badge']],
    ['.login-brand img, .sidebar-logo', ['img-fluid']]
  ];
  function enhance(root) {
    for (const [selector, classes] of components) {
      if (root.matches?.(selector)) root.classList.add(...classes);
      for (const element of root.querySelectorAll(selector)) element.classList.add(...classes);
    }
  }
  enhance(document);
  // Keep native dialog focus management and Escape behavior. A backdrop
  // dismissal only counts when the pointer both starts and ends outside.
  const configuredDialogs = new WeakSet();
  const busy = dialog => Boolean(dialog.querySelector('button[type="submit"]:disabled, #confirm-delete:disabled'));
  function closeDialog(dialog) {
    if (dialog?.open && !busy(dialog)) dialog.close();
  }
  function enhanceDialogs(root) {
    const dialogs = root.matches?.('dialog.app-dialog') ? [root] : [];
    dialogs.push(...root.querySelectorAll('dialog.app-dialog'));
    for (const dialog of dialogs) {
      if (configuredDialogs.has(dialog)) continue;
      configuredDialogs.add(dialog);
      let header = dialog.querySelector(':scope > .panel-heading, :scope > .modal-header');
      if (!header) {
        header = document.createElement('div'); header.className = 'modal-header'; dialog.prepend(header);
      }
      let close = header.querySelector('.icon-button');
      if (!close) { close = document.createElement('button'); close.className = 'icon-button'; header.append(close); }
      close.type = 'button'; close.classList.add('dialog-close');
      if (!close.getAttribute('aria-label')) close.setAttribute('aria-label', 'Fechar janela');
      close.setAttribute('title', 'Fechar janela'); close.textContent = '×';
      let startedOutside = false;
      const outside = event => {
        const r = dialog.getBoundingClientRect();
        return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
      };
      dialog.addEventListener('pointerdown', event => { startedOutside = event.button === 0 && event.target === dialog && outside(event); });
      dialog.addEventListener('pointercancel', () => { startedOutside = false; });
      dialog.addEventListener('click', event => {
        const dismiss = startedOutside && event.target === dialog && outside(event);
        startedOutside = false;
        if (dismiss) closeDialog(dialog);
      });
      dialog.addEventListener('cancel', event => { if (busy(dialog)) event.preventDefault(); });
      dialog.addEventListener('close', () => { startedOutside = false; });
    }
  }
  enhanceDialogs(document);
  document.addEventListener('click', event => {
    const close = event.target.closest?.('.dialog-close');
    if (!close) return;
    const dialog = close.closest('dialog.app-dialog');
    if (!dialog) return;
    event.preventDefault(); event.stopImmediatePropagation(); closeDialog(dialog);
  }, true);
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) { enhance(node); enhanceDialogs(node); }
  }).observe(document.body, { childList:true, subtree:true });
})();
