/** DONZO — STORAGE PAGE */
DM.storage = (() => {
  const MIN_LEVEL = 2;

  function el(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    const t = el('storage-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function setStatus(msg, type = '') {
    const node = el('store-status');
    if (!node) return;
    node.textContent = msg || '';
    node.className = 'account-status' + (type ? ` ${type}` : '');
  }

  function requireAccess() {
    const user = DM.auth.get();
    if (!user) { location.href = 'index.html'; return null; }
    if (user.level < MIN_LEVEL) { location.href = 'map.html'; return null; }
    return user;
  }

  let items = [];

  function renderSelect() {
    const select = el('store-item');
    if (!select) return;
    const prev = select.value;

    if (!items.length) {
      select.innerHTML = '<option value="">No items yet — ask an admin to add some</option>';
      return;
    }

    select.innerHTML = items
      .map(it => `<option value="${esc(it.id)}">${esc(it.name)} (${it.quantity} in stock)</option>`)
      .join('');

    // Restore previous selection if it still exists
    if (prev && items.some(it => it.id === prev)) select.value = prev;
  }

  function renderInventory() {
    const wrap = el('store-inventory-wrap');
    const count = el('store-count');
    if (!wrap) return;

    if (count) count.textContent = items.length ? `${items.length} items` : 'No items';

    if (!items.length) {
      wrap.innerHTML = '<div class="audit-empty">No items in storage yet. An admin can add item names from the Admin Panel.</div>';
      return;
    }

    const rows = items.map(it => `<tr>
      <td>${esc(it.name)}</td>
      <td class="store-qty-cell">${it.quantity}</td>
    </tr>`).join('');

    wrap.innerHTML = `
      <div class="audit-table-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Item</th><th>In Storage</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  async function load() {
    const wrap = el('store-inventory-wrap');
    const refreshBtn = el('store-refresh-btn');
    if (refreshBtn) refreshBtn.disabled = true;

    if (!DM.db || typeof DM.db.getStorageItems !== 'function') {
      if (wrap) wrap.innerHTML = '<div class="audit-error">Database not ready — refresh the page and try again.</div>';
      if (refreshBtn) refreshBtn.disabled = false;
      return;
    }

    try {
      items = await DM.db.getStorageItems();
      renderSelect();
      renderInventory();
    } catch (e) {
      if (wrap) wrap.innerHTML = `<div class="audit-error">Failed to load inventory: ${esc(e.message)}</div>`;
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  async function adjust(direction) {
    const user = DM.auth.get();
    if (!user) { location.href = 'index.html'; return; }

    const itemId = el('store-item')?.value || '';
    const amount = el('store-qty')?.value || '';
    const addBtn = el('store-add-btn');
    const removeBtn = el('store-remove-btn');

    if (!itemId) { setStatus('Select an item first.', 'err'); return; }

    addBtn.disabled = true;
    removeBtn.disabled = true;
    setStatus(direction === 'add' ? 'Adding…' : 'Removing…');

    try {
      const updated = await DM.db.adjustStorageStock(user, itemId, direction, amount);
      const verb = direction === 'add' ? 'Added' : 'Removed';
      setStatus(`${verb} ${parseInt(amount, 10)} × ${updated.name}. Now ${updated.quantity} in storage.`, 'ok');
      toast(`${verb}: ${updated.name}`);
      await load();
    } catch (e) {
      setStatus(e.message, 'err');
      toast('Error: ' + e.message);
    } finally {
      addBtn.disabled = false;
      removeBtn.disabled = false;
    }
  }

  function init() {
    if (!requireAccess()) return;
    load();
  }

  return { init, load, adjust };
})();
