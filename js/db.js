/**
 * DONZO MILITIA — DATABASE MODULE
 */
window.DM = window.DM || {};

DM.db = (() => {

  function listenToMarkers(user, callback) {
    return db.collection('markers')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        const markers = [];
        snap.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          if ((data.minAccessLevel || 1) <= user.accessLevel) markers.push(data);
        });
        callback(markers);
      }, err => console.error('Markers listener:', err));
  }

  async function addMarker(user, data) {
    if (!user.canAddMarkers) throw new Error('Insufficient access level');
    return (await db.collection('markers').add({
      ...data,
      createdBy:    user.username,
      createdByLevel: user.accessLevel,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    })).id;
  }

  async function deleteMarker(user, markerId, createdBy) {
    if (!DM.auth.canDeleteMarker({ createdBy }, user)) throw new Error('No permission');
    await db.collection('markers').doc(markerId).delete();
  }

  async function getAllUsers() {
    const snap = await db.collection('users').orderBy('accessLevel', 'desc').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data(), password: '••••••••' }));
  }

  async function addUser(currentUser, newUser) {
    if (currentUser.accessLevel < 4) throw new Error('Commanders only');
    const exists = await db.collection('users').where('username', '==', newUser.username.toLowerCase()).get();
    if (!exists.empty) throw new Error('Username already taken');
    await db.collection('users').add({
      username:    newUser.username.trim().toLowerCase(),
      password:    newUser.password,
      displayName: newUser.displayName || newUser.username,
      accessLevel: parseInt(newUser.accessLevel) || 1,
      createdBy:   currentUser.username,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function deleteUser(currentUser, userId) {
    if (currentUser.accessLevel < 4) throw new Error('Commanders only');
    await db.collection('users').doc(userId).delete();
  }

  async function updateUserLevel(currentUser, userId, level) {
    if (currentUser.accessLevel < 4) throw new Error('Commanders only');
    await db.collection('users').doc(userId).update({ accessLevel: parseInt(level) });
  }

  return { listenToMarkers, addMarker, deleteMarker, getAllUsers, addUser, deleteUser, updateUserLevel };
})();
