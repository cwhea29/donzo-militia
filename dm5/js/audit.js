/** DONZO — AUDIT LOG PAGE */
DM.audit = (() => {
  const BOSS_LEVEL = 11;
  const DEFAULT_LIMIT = 200;

  function el(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function requireBoss() {
    const user = DM.auth.get();
    if (!user) {
      location.href = 'index.html';
      return null;
    }
    if (user.level < BOSS_LEVEL) {
      location.href = 'map.html';
      return null;
    }
    return user;
  }

  function formatDetails(details) {
    if (!details || typeof details !== 'object') return '—';

    const parts = [];
    if (details.name) parts.push(`Name: ${esc(details.name)}`);
    if (details.category) parts.push(`Category: ${esc(details.category)}`);
    if (details.comment) parts.push(`Comment: "${esc(details.comment)}"`);
    if (details.x !== undefined && details.y !== undefined) {
      parts.push(`Position: ${(details.x * 100).toFixed(1)}%, ${(details.y * 100).toFixed(1)}%`);
    }

    return parts.length ? parts.join(' · ') : '—';
  }

  function actionClass(action) {
    const key = (action || '').toLowerCase();
    if (key === 'create') return 'audit-act-create';
    if (key === 'update') return 'audit-act-update';
    if (key === 'delete') return 'audit-act-delete';
    if (key === 'comment') return 'audit-act-comment';
    return 'audit-act-other';
  }

  function renderRows(logs) {
    return logs.map(log => {
      const time = esc(new Date(log.created_at).toLocaleString());
      const action = esc((log.action || 'unknown').toUpperCase());
      const by = esc(log.performed_by || '—');
      const details = formatDetails(log.details);

      return `<tr>
        <td class="audit-time">${time}</td>
        <td><span class="audit-act ${actionClass(log.action)}">${action}</span></td>
        <td>${by}</td>
        <td class="audit-details">${details}</td>
      </tr>`;
    }).join('');
  }

  async function load(limit = DEFAULT_LIMIT) {
    const wrap = el('audit-log-wrap');
    const count = el('audit-log-count');
    const refreshBtn = el('audit-refresh-btn');
    if (!wrap) return;

    wrap.innerHTML = '<div class="audit-loading">// LOADING AUDIT LOG...</div>';
    if (refreshBtn) refreshBtn.disabled = true;

    if (!DM.db || typeof DM.db.getAuditLog !== 'function') {
      wrap.innerHTML = '<div class="audit-error">Database not ready — refresh the page and try again.</div>';
      if (refreshBtn) refreshBtn.disabled = false;
      return;
    }

    try {
      const logs = await DM.db.getAuditLog(limit);

      if (count) {
        count.textContent = logs.length ? `${logs.length} entries` : 'No entries';
      }

      if (!logs.length) {
        wrap.innerHTML = '<div class="audit-empty">No audit entries yet. Marker changes will appear here.</div>';
        return;
      }

      wrap.innerHTML = `
        <div class="audit-table-wrap">
          <table class="tbl audit-tbl">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>By</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>${renderRows(logs)}</tbody>
          </table>
        </div>
      `;
    } catch (e) {
      wrap.innerHTML = `<div class="audit-error">Failed to load audit log: ${e.message}</div>`;
      if (count) count.textContent = 'Error';
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  function init() {
    if (!requireBoss()) return;
    load();
  }

  return { init, load };
})();