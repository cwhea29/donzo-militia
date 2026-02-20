/**
 * DONZO MILITIA — AUTH MODULE
 */
window.DM = window.DM || {};

DM.auth = (() => {
  const SESSION_KEY = 'dm_session_v2';

  function getCurrentUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
  }

  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  async function login(username, password) {
    try {
      const snap = await db.collection('users')
        .where('username', '==', username.trim().toLowerCase())
        .limit(1).get();

      if (snap.empty) return { success: false, error: 'User not found' };

      const doc  = snap.docs[0];
      const data = doc.data();

      if (data.password !== password) return { success: false, error: 'Wrong password' };

      const level    = parseInt(data.accessLevel);
      const lvlInfo  = ACCESS_LEVELS[level] || ACCESS_LEVELS[1];

      const user = {
        id: doc.id, username: data.username,
        displayName:  data.displayName || data.username,
        accessLevel:  level,
        levelName:    lvlInfo.name,
        levelColor:   lvlInfo.color,
        levelBg:      lvlInfo.bgColor,
        canAddMarkers: lvlInfo.canAddMarkers,
        canDeleteOwn:  lvlInfo.canDeleteOwn,
        canDeleteAll:  lvlInfo.canDeleteAll
      };
      setSession(user);
      return { success: true, user };
    } catch (err) {
      console.error(err);
      return { success: false, error: 'Connection error — check Firebase setup' };
    }
  }

  function logout() {
    clearSession();
    window.location.href = 'index.html';
  }

  function requireAuth() {
    const user = getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return null; }
    return user;
  }

  function canViewMarker(marker, user)  { return (marker.minAccessLevel || 1) <= user.accessLevel; }
  function canDeleteMarker(marker, user){ return user.canDeleteAll || (user.canDeleteOwn && marker.createdBy === user.username); }

  return { login, logout, requireAuth, getCurrentUser, clearSession, setSession, canViewMarker, canDeleteMarker };
})();
