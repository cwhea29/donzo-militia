/** DONZO — ACCOUNT PAGE */
DM.account = (() => {
  function el(id) { return document.getElementById(id); }

  function toast(msg) {
    const t = el('account-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function setStatus(id, msg, type = '') {
    const node = el(id);
    if (!node) return;
    node.textContent = msg || '';
    node.className = 'account-status' + (type ? ` ${type}` : '');
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function renderProfile(profile) {
    const lvl = ACCESS[profile.access_level] || ACCESS[1];

    el('acct-username').textContent = `@${profile.username}`;
    el('acct-display').value = profile.display_name || profile.username || '';
    el('acct-level').innerHTML = `<span class="badge l${profile.access_level}">Level ${profile.access_level} — ${lvl.name}</span>`;
    el('acct-registered').textContent = formatDate(profile.created_at);
    el('acct-created-by').textContent = profile.created_by ? `@${profile.created_by}` : '—';
  }

  async function loadProfile() {
    const user = DM.auth.get();
    if (!user) return;

    setStatus('acct-profile-status', 'Loading profile...');

    try {
      const profile = await DM.db.getOwnProfile(user);
      renderProfile(profile);
      setStatus('acct-profile-status', '');
    } catch (e) {
      setStatus('acct-profile-status', e.message, 'err');
    }
  }

  async function saveDisplayName() {
    const user = DM.auth.get();
    if (!user) return;

    const btn = el('acct-save-display-btn');
    const displayName = el('acct-display')?.value || '';
    btn.disabled = true;
    setStatus('acct-profile-status', 'Saving...');

    try {
      const savedName = displayName.trim() || user.username;
      await DM.db.updateOwnDisplayName(user, displayName);
      DM.auth.updateSession({ display: savedName });
      const navName = document.querySelector('.nav-name');
      if (navName) navName.textContent = savedName;
      setStatus('acct-profile-status', 'Display name updated.', 'ok');
      toast('Display name saved');
      await loadProfile();
    } catch (e) {
      setStatus('acct-profile-status', e.message, 'err');
      toast('Error: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function changePassword() {
    const user = DM.auth.get();
    if (!user) return;

    const current = el('acct-current-pw')?.value || '';
    const next = el('acct-new-pw')?.value || '';
    const confirm = el('acct-confirm-pw')?.value || '';
    const btn = el('acct-save-pw-btn');

    if (next !== confirm) {
      setStatus('acct-pw-status', 'New passwords do not match.', 'err');
      return;
    }

    btn.disabled = true;
    setStatus('acct-pw-status', 'Updating password...');

    try {
      await DM.db.updateOwnPassword(user, current, next);
      el('acct-current-pw').value = '';
      el('acct-new-pw').value = '';
      el('acct-confirm-pw').value = '';
      setStatus('acct-pw-status', 'Password updated successfully.', 'ok');
      toast('Password updated');
    } catch (e) {
      setStatus('acct-pw-status', e.message, 'err');
      toast('Error: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  function init() {
    const user = DM.auth.require();
    if (!user) return;
    loadProfile();
  }

  return { init, loadProfile, saveDisplayName, changePassword };
})();