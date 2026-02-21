/**
 * DONZO MILITIA — DATABASE MODULE
 * All Firestore read/write operations.
 */

window.DM = window.DM || {};

DM.db = (() => {

  // ─── MARKERS ─────────────────────────────────────────────

  /**
   * Listen to markers in real-time.
   * Calls callback(markersArray) whenever data changes.
   * Filters markers by user's access level client-side.
   * Returns an unsubscribe function.
   */
  function listenToMarkers(user, callback) {
    return db.collection('markers')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        const markers = [];
        snap.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          // Only include markers the user has clearance for
          if ((data.minAccessLevel || 1) <= user.accessLevel) {
            markers.push(data);
          }
        });
        callback(markers);
      }, err => {
        console.error('Markers listener error:', err);
      });
  }

  /**
   * Add a new marker to Firestore.
   */
  async function addMarker(user, markerData) {
    if (!user.canAddMarkers) {
      throw new Error('Insufficient access level to add markers');
    }
    const doc = {
      name:           markerData.name,
      description:    markerData.description || '',
      imageFile:      markerData.imageFile || '',
      category:       markerData.category || 'poi',
      zone:           markerData.zone,
      x:              markerData.x,
      y:              markerData.y,
      minAccessLevel: parseInt(markerData.minAccessLevel) || 1,
      createdBy:      user.username,
      createdByLevel: user.accessLevel,
      createdAt:      firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection('markers').add(doc);
    return ref.id;
  }

  /**
   * Delete a marker. Checks permissions.
   */
  async function deleteMarker(user, markerId, markerCreatedBy) {
    const fakeMarker = { createdBy: markerCreatedBy };
    if (!DM.auth.canDeleteMarker(fakeMarker, user)) {
      throw new Error('Insufficient permission to delete this marker');
    }
    await db.collection('markers').doc(markerId).delete();
  }

  // ─── USERS (Commander only) ───────────────────────────────

  /**
   * Get all users — only Level 4 Commanders should call this.
   */
  async function getAllUsers() {
    const snap = await db.collection('users').orderBy('accessLevel', 'desc').get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      password: '••••••••' // never expose passwords in the UI
    }));
  }

  /**
   * Add a new user (Commander only).
   */
  async function addUser(currentUser, newUserData) {
    if (currentUser.accessLevel < 4) {
      throw new Error('Only Commanders can add users');
    }
    // Check username not already taken
    const existing = await db.collection('users')
      .where('username', '==', newUserData.username.toLowerCase())
      .get();
    if (!existing.empty) {
      throw new Error('Username already exists');
    }
    await db.collection('users').add({
      username:    newUserData.username.trim().toLowerCase(),
      password:    newUserData.password,
      displayName: newUserData.displayName || newUserData.username,
      accessLevel: parseInt(newUserData.accessLevel) || 1,
      createdBy:   currentUser.username,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  /**
   * Delete a user (Commander only).
   */
  async function deleteUser(currentUser, userId) {
    if (currentUser.accessLevel < 4) {
      throw new Error('Only Commanders can remove users');
    }
    await db.collection('users').doc(userId).delete();
  }

  /**
   * Update user access level (Commander only).
   */
  async function updateUserLevel(currentUser, userId, newLevel) {
    if (currentUser.accessLevel < 4) {
      throw new Error('Only Commanders can change access levels');
    }
    await db.collection('users').doc(userId).update({
      accessLevel: parseInt(newLevel)
    });
  }

  return {
    listenToMarkers,
    addMarker,
    deleteMarker,
    getAllUsers,
    addUser,
    deleteUser,
    updateUserLevel
  };

})();
