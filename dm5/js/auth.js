/** DONZO MILITIA — AUTH */
DM.auth = (() => {
  const KEY = 'dm_sess';

  function get()  { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; } }
  function set(u) { sessionStorage.setItem(KEY, JSON.stringify(u)); }
  function clear(){ sessionStorage.removeItem(KEY); }

  async function login(username, password) {
    try {
      const u = (username || '').trim().toLowerCase();
      const p = (password || '').trim();
      if (!u || !p) return { ok: false, err: 'Missing credentials' };
      if (p.length < 4) return { ok: false, err: 'Invalid password' };

      const { data, error } = await dmDB
        .from('users')
        .select('*')
        .eq('username', u)
        .limit(1)
        .single();

      if (error || !data) return { ok: false, err: 'User not found' };
      if (data.password !== p) return { ok: false, err: 'Wrong password' };

      const lvl  = parseInt(data.access_level);
      const info = ACCESS[lvl] || ACCESS[1];
      const user = {
        id: data.id, username: data.username,
        display: data.display_name || data.username,
        level: lvl, levelName: info.name, color: info.color, bg: info.bg,
        canAdd: info.add, canDelOwn: info.delOwn, canDelAll: info.delAll
      };
      set(user);
      return { ok: true, user };
    } catch (e) {
      return { ok: false, err: 'Connection error — check Supabase' };
    }
  }

  function logout() { clear(); location.href = 'index.html'; }

  function require() {
    const u = get();
    if (!u) { location.href = 'index.html'; return null; }
    return u;
  }

  function canView(marker, user)   { return (marker.min_access_level || 1) <= user.level; }
  function canDelete(marker, user) { return user.canDelAll || (user.canDelOwn && marker.created_by === user.username); }

  return { login, logout, require, get, canView, canDelete };
})();
