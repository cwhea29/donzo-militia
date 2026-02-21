/**
 * DONZO MILITIA — AUTH MODULE
 * Handles login, logout, and session management via sessionStorage.
 * Each page calls DM.auth.requireAuth() to protect itself.
 */

window.DM = window.DM || {};

DM.auth = (() => {

  const SESSION_KEY = 'dm_session';

  // ─── GET CURRENT USER FROM SESSION ──────────────────────
  function getCurrentUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ─── SAVE SESSION ────────────────────────────────────────
  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  // ─── CLEAR SESSION ───────────────────────────────────────
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ─── LOGIN ───────────────────────────────────────────────
  async function login(username, password) {
    try {
      const snap = await db.collection('users')
        .where('username', '==', username.trim().toLowerCase())
        .limit(1)
        .get();

      if (snap.empty) {
        return { success: false, error: 'USER NOT FOUND' };
      }

      const doc = snap.docs[0];
      const userData = doc.data();

      // Simple password check (store hashed in production)
      if (userData.password !== password) {
        return { success: false, error: 'INVALID PASSWORD' };
      }

      const level = parseInt(userData.accessLevel);
      const levelInfo = ACCESS_LEVELS[level];

      const user = {
        id:           doc.id,
        username:     userData.username,
        displayName:  userData.displayName || userData.username,
        accessLevel:  level,
        levelName:    levelInfo ? levelInfo.name : 'Unknown',
        levelColor:   levelInfo ? levelInfo.color : '#666',
        canAddMarkers:levelInfo ? levelInfo.canAddMarkers : false,
        canDeleteOwn: levelInfo ? levelInfo.canDeleteOwn  : false,
        canDeleteAll: levelInfo ? levelInfo.canDeleteAll  : false
      };

      setSession(user);
      return { success: true, user };

    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'CONNECTION ERROR — CHECK FIREBASE CONFIG' };
    }
  }

  // ─── LOGOUT ──────────────────────────────────────────────
  function logout() {
    clearSession();
    window.location.href = 'index.html';
  }

  // ─── REQUIRE AUTH (call on every protected page) ─────────
  // Returns the user object or redirects to login
  function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  }

  // ─── CHECK IF USER CAN VIEW A MARKER ─────────────────────
  function canViewMarker(marker, user) {
    return (marker.minAccessLevel || 1) <= user.accessLevel;
  }

  // ─── CHECK IF USER CAN DELETE A MARKER ───────────────────
  function canDeleteMarker(marker, user) {
    if (user.canDeleteAll) return true;
    if (user.canDeleteOwn && marker.createdBy === user.username) return true;
    return false;
  }

  return {
    login,
    logout,
    requireAuth,
    getCurrentUser,
    canViewMarker,
    canDeleteMarker
  };

})();
