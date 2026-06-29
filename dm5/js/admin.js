/** DONZO — ADMIN PANEL */
DM.admin = (() => {
  const ADMIN_LEVEL = 7;
  const DEFAULT_LIMIT = 500;

  function el(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    const t = el('admin-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function setStatus(msg, type = '') {
    const node = el('admin-item-status');
    if (!node) return;
    node.textContent = msg || '';
    node.className = 'account-status' + (type ? ` ${type}` : '');
  }

  function requireAdmin() {
    const user = DM.auth.get();
    if (!user) { location.href = 'index.html'; return null; }
    if (user.level < ADMIN_LEVEL) { location.href = 'map.html'; return null; }
    return user;
  }

  const ACTION_LABELS = {
    add:         'Added stock',
    remove:      'Removed stock',
    create_item: 'Item created',
    delete_item: 'Item deleted'
  };

  function actionLabel(action) {
    return ACTION_LABELS[action] || (action || '').toUpperCase();
  }

  function actionClass(action) {
    if (action === 'add' || action === 'create_item') return 'audit-act-create';
    if (action === 'remove') return 'audit-act-update';
    if (action === 'delete_item') return 'audit-act-delete';
    return 'audit-act-other';
  }

  // ── ITEMS ────────────────────────────────────────────────
  let items = [];

  function renderItems() {
    const wrap = el('admin-items-wrap');
    if (!wrap) return;

    if (!items.length) {
      wrap.innerHTML = '<div class="audit-empty">No items yet. Add one above to make it selectable on the Storage page.</div>';
      return;
    }

    const rows = items.map(it => `<tr>
      <td>${esc(it.name)}</td>
      <td class="store-qty-cell">${it.quantity}</td>
      <td class="audit-time">${esc(it.created_by || '—')}</td>
      <td style="text-align:right;">
        <button class="u-del" title="Delete item" onclick="DM.admin.deleteItem('${esc(it.id)}', '${esc(it.name).replace(/'/g, "\\'")}')">✕</button>
      </td>
    </tr>`).join('');

    wrap.innerHTML = `
      <div class="audit-table-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Item</th><th>In Stock</th><th>Added By</th><th></th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  async function loadItems() {
    const wrap = el('admin-items-wrap');
    try {
      items = await DM.db.getStorageItems();
      renderItems();
    } catch (e) {
      if (wrap) wrap.innerHTML = `<div class="audit-error">Failed to load items: ${esc(e.message)}</div>`;
    }
  }

  async function addItem() {
    const user = DM.auth.get();
    if (!user) { location.href = 'index.html'; return; }

    const input = el('admin-item-name');
    const btn = el('admin-add-btn');
    const name = input?.value || '';

    if (!name.trim()) { setStatus('Enter an item name.', 'err'); return; }

    btn.disabled = true;
    setStatus('Adding item…');

    try {
      await DM.db.addStorageItemName(user, name);
      input.value = '';
      setStatus(`Added "${name.trim()}" to the item list.`, 'ok');
      toast('Item added');
      await loadItems();
    } catch (e) {
      setStatus(e.message, 'err');
      toast('Error: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteItem(itemId, name) {
    const user = DM.auth.get();
    if (!user) { location.href = 'index.html'; return; }
    if (!confirm(`Delete "${name}" from the storage item list? This removes it from the Storage page.`)) return;

    try {
      await DM.db.deleteStorageItemName(user, itemId);
      toast('Item deleted');
      setStatus(`Deleted "${name}".`, 'ok');
      await loadItems();
    } catch (e) {
      setStatus(e.message, 'err');
      toast('Error: ' + e.message);
    }
  }

  // ── ACTIVITY LOG ─────────────────────────────────────────
  let logs = [];

  function renderLog() {
    const wrap = el('admin-log-wrap');
    const count = el('admin-log-count');
    if (!wrap) return;

    if (count) count.textContent = logs.length ? `${logs.length} entries` : 'No entries';

    if (!logs.length) {
      wrap.innerHTML = '<div class="audit-empty">No storage activity yet. Add or remove items on the Storage page to populate this log.</div>';
      return;
    }

    const rows = logs.map(log => {
      const time = esc(new Date(log.created_at).toLocaleString());
      const qty = (log.quantity === null || log.quantity === undefined) ? '—' : esc(log.quantity);
      const bal = (log.balance_after === null || log.balance_after === undefined) ? '—' : esc(log.balance_after);
      const by = esc(log.performed_by || '—');
      const lvl = (log.performed_level === null || log.performed_level === undefined) ? '' : ` (L${esc(log.performed_level)})`;
      return `<tr>
        <td class="audit-time">${time}</td>
        <td><span class="audit-act ${actionClass(log.action)}">${esc(actionLabel(log.action))}</span></td>
        <td>${esc(log.item_name)}</td>
        <td class="store-qty-cell">${qty}</td>
        <td class="store-qty-cell">${bal}</td>
        <td>${by}${lvl}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div class="audit-table-wrap">
        <table class="tbl audit-tbl">
          <thead>
            <tr><th>Time</th><th>Action</th><th>Item</th><th>Qty</th><th>Balance</th><th>By</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  async function loadLog() {
    const wrap = el('admin-log-wrap');
    const refreshBtn = el('admin-log-refresh-btn');
    if (refreshBtn) refreshBtn.disabled = true;

    if (!DM.db || typeof DM.db.getStorageAuditLog !== 'function') {
      if (wrap) wrap.innerHTML = '<div class="audit-error">Database not ready — refresh the page and try again.</div>';
      if (refreshBtn) refreshBtn.disabled = false;
      return;
    }

    try {
      logs = await DM.db.getStorageAuditLog(DEFAULT_LIMIT);
      renderLog();
    } catch (e) {
      if (wrap) wrap.innerHTML = `<div class="audit-error">Failed to load activity log: ${esc(e.message)}</div>`;
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  // ── CSV EXPORT ───────────────────────────────────────────
  function csvCell(value) {
    const s = (value === null || value === undefined) ? '' : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    if (!logs.length) { toast('Nothing to export yet'); return; }

    const header = ['Timestamp', 'Action', 'Item', 'Quantity', 'Balance After', 'Performed By', 'Level'];
    const lines = [header.map(csvCell).join(',')];

    logs.forEach(log => {
      lines.push([
        csvCell(new Date(log.created_at).toISOString()),
        csvCell(actionLabel(log.action)),
        csvCell(log.item_name),
        csvCell(log.quantity ?? ''),
        csvCell(log.balance_after ?? ''),
        csvCell(log.performed_by ?? ''),
        csvCell(log.performed_level ?? '')
      ].join(','));
    });

    const csv = lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    const a = document.createElement('a');
    a.href = url;
    a.download = `storage-audit-log-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast(`Exported ${logs.length} entries`);
  }

  function init() {
    if (!requireAdmin()) return;
    loadItems();
    loadLog();
  }

  return { init, loadItems, addItem, deleteItem, loadLog, exportCsv };
})();
