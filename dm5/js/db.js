/** DONZO MILITIA — DATABASE (Supabase) */

DM.db = (() => {

  // ── IMAGE UPLOAD ─────────────────────────────────────────
  // Uploads a File object to Supabase Storage.
  // Returns the public URL string, or throws on error.
  async function uploadImage(file) {
    const ext  = file.name.split('.').pop().toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await dmStorage
      .from(STORAGE_BUCKET)
      .upload(name, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error('Upload failed: ' + error.message);

    const { data: urlData } = dmStorage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  // ── MARKERS ──────────────────────────────────────────────

  function listenMarkers(user, cb) {
    fetchMarkers(user).then(cb);
    const channel = dmDB
      .channel('markers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markers' }, () => {
        fetchMarkers(user).then(cb);
      })
      .subscribe();
    return () => dmDB.removeChannel(channel);
  }

  async function fetchMarkers(user) {
    const { data } = await dmDB
      .from('markers')
      .select('*')
      .lte('min_access_level', user.level)
      .order('created_at', { ascending: false });
    return data || [];
  }

  async function addMarker(user, m) {
    if (!user.canAdd) throw new Error('Insufficient access level');
    const { error } = await dmDB.from('markers').insert({
      name:             m.name,
      description:      m.description    || '',
      image_url:        m.imageUrl       || '',
      category:         m.category       || 'poi',
      zone:             m.zone,
      x:                m.x,
      y:                m.y,
      min_access_level: parseInt(m.minLevel) || 1,
      created_by:       user.username,
      created_by_level: user.level
    });
    if (error) {
      console.error('Supabase markers insert failed:', error);
      throw new Error(error.message || 'Insert failed — check RLS on markers table');
    }
  }

  async function deleteMarker(user, marker) {
    if (!DM.auth.canDelete(marker, user)) throw new Error('No permission');
    const { error } = await dmDB.from('markers').delete().eq('id', marker.id);
    if (error) throw new Error(error.message);
  }

  async function updateMarker(user, markerId, m) {
    // Reuse delete permission for edit permission (creator or high rank)
    const tempMarker = { id: markerId, created_by: m.created_by };
    if (!DM.auth.canDelete(tempMarker, user)) throw new Error('No permission to edit this location');

    const { error } = await dmDB.from('markers').update({
      name:             m.name,
      description:      m.description    || '',
      image_url:        m.imageUrl       || '',
      category:         m.category       || 'poi',
      min_access_level: parseInt(m.minLevel) || 1,
    }).eq('id', markerId);

    if (error) {
      console.error('Supabase markers update failed:', error);
      throw new Error(error.message || 'Update failed');
    }
  }

  // ── USERS ────────────────────────────────────────────────

  async function getUsers() {
    const { data, error } = await dmDB
      .from('users')
      .select('id, username, display_name, access_level')
      .order('access_level', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function addUser(actor, u) {
    if (actor.level < 4) throw new Error('Commanders only');
    const { data: ex } = await dmDB.from('users').select('id').eq('username', u.username.toLowerCase()).limit(1);
    if (ex && ex.length) throw new Error('Username already taken');
    const { error } = await dmDB.from('users').insert({
      username:     u.username.trim().toLowerCase(),
      password:     u.password,
      display_name: u.displayName || u.username,
      access_level: parseInt(u.level) || 1,
      created_by:   actor.username
    });
    if (error) throw new Error(error.message);
  }

  async function updateLevel(actor, userId, level) {
    if (actor.level < 4) throw new Error('Commanders only');
    const { error } = await dmDB.from('users').update({ access_level: parseInt(level) }).eq('id', userId);
    if (error) throw new Error(error.message);
  }

  async function deleteUser(actor, userId) {
    if (actor.level < 4) throw new Error('Commanders only');
    const { error } = await dmDB.from('users').delete().eq('id', userId);
    if (error) throw new Error(error.message);
  }

  return { uploadImage, listenMarkers, addMarker, deleteMarker, updateMarker, getUsers, addUser, updateLevel, deleteUser };
})();
