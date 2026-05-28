/** DONZO — DATABASE (Supabase) */

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
    console.log('[updateMarker] Called for', markerId);

    // Reuse delete permission for edit permission (creator or high rank)
    const tempMarker = { id: markerId, created_by: m.created_by };
    if (!DM.auth.canDelete(tempMarker, user)) {
      console.warn('[updateMarker] Permission denied');
      throw new Error('No permission to edit this location');
    }

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

  // ── COMMENTS ────────────────────────────────────────────
  async function getComments(markerId) {
    const { data, error } = await dmDB
      .from('marker_comments')
      .select('*')
      .eq('marker_id', markerId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function addComment(user, markerId, commentText) {
    const { error } = await dmDB.from('marker_comments').insert({
      marker_id: markerId,
      username: user.username,
      comment: commentText
    });
    if (error) throw new Error(error.message);

    await logAudit(markerId, 'comment', user.username, { comment: commentText });
  }

  async function updateComment(commentId, newText, username) {
    const { error } = await dmDB
      .from('marker_comments')
      .update({ comment: newText })
      .eq('id', commentId)
      .eq('username', username); // only allow owner to edit

    if (error) throw new Error(error.message);
  }

  async function deleteComment(commentId, username) {
    const { error } = await dmDB
      .from('marker_comments')
      .delete()
      .eq('id', commentId)
      .eq('username', username); // only allow owner to delete

    if (error) throw new Error(error.message);
  }

  // ── GROUPS ───────────────────────────────────────────────
  async function getGroups() {
    const { data, error } = await dmDB
      .from('marker_groups')
      .select('*')
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function createGroup(user, name) {
    const { data, error } = await dmDB.from('marker_groups').insert({
      name: name.trim(),
      created_by: user.username
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function addMarkerToGroup(markerId, groupId) {
    const { error } = await dmDB.from('marker_group_members').insert({
      marker_id: markerId,
      group_id: groupId
    });
    if (error && error.code !== '23505') throw new Error(error.message); // ignore duplicate
  }

  async function removeMarkerFromGroup(markerId, groupId) {
    const { error } = await dmDB.from('marker_group_members')
      .delete()
      .eq('marker_id', markerId)
      .eq('group_id', groupId);
    if (error) throw new Error(error.message);
  }

  async function getMarkerGroups(markerId) {
    const { data, error } = await dmDB
      .from('marker_group_members')
      .select('group_id, marker_groups(name)')
      .eq('marker_id', markerId);
    if (error) throw new Error(error.message);
    return data.map(r => r.marker_groups);
  }

  // ── HEIST PLANS (Operation Sequences) ────────────────────
  async function getHeistPlans() {
    const { data, error } = await dmDB
      .from('heist_plans')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function createHeistPlan(user, name, description = '') {
    const { data, error } = await dmDB.from('heist_plans').insert({
      name: name.trim(),
      description: description.trim(),
      created_by: user.username
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function getHeistPlanSteps(planId) {
    const { data, error } = await dmDB
      .from('heist_plan_steps')
      .select(`
        id,
        step_order,
        notes,
        markers (id, name, category, zone, min_access_level)
      `)
      .eq('plan_id', planId)
      .order('step_order', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function addStepToPlan(planId, markerId, stepOrder, notes = '') {
    const { error } = await dmDB.from('heist_plan_steps').insert({
      plan_id: planId,
      marker_id: markerId,
      step_order: stepOrder,
      notes: notes.trim()
    });
    if (error) throw new Error(error.message);
  }

  async function updateStepOrder(planId, steps) {
    // steps = [{ id, step_order }, ...]
    const updates = steps.map(step => 
      dmDB.from('heist_plan_steps')
        .update({ step_order: step.step_order })
        .eq('id', step.id)
    );
    await Promise.all(updates);
  }

  async function removeStepFromPlan(stepId) {
    const { error } = await dmDB
      .from('heist_plan_steps')
      .delete()
      .eq('id', stepId);
    if (error) throw new Error(error.message);
  }

  async function deleteHeistPlan(planId) {
    const { error } = await dmDB
      .from('heist_plans')
      .delete()
      .eq('id', planId);
    if (error) throw new Error(error.message);
  }

  // ── AUDIT LOG ────────────────────────────────────────────
  async function logAudit(markerId, action, performedBy, details = {}) {
    await dmDB.from('marker_audit_log').insert({
      marker_id: markerId,
      action,
      performed_by: performedBy,
      details
    });
  }

  async function getAuditLog(limit = 50) {
    const { data, error } = await dmDB
      .from('marker_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }

  // ── ENHANCED UPDATE (with audit) ─────────────────────────
  async function updateMarker(user, markerId, m) {
    console.log('[updateMarker] Called for', markerId);

    const tempMarker = { id: markerId, created_by: m.created_by };
    if (!DM.auth.canDelete(tempMarker, user)) {
      console.warn('[updateMarker] Permission denied');
      throw new Error('No permission to edit this location');
    }

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

    // Log audit
    await logAudit(markerId, 'update', user.username, {
      name: m.name,
      category: m.category
    });
  }

  // ── ENHANCED ADD (with audit) ────────────────────────────
  async function addMarker(user, m) {
    if (!user.canAdd) throw new Error('Insufficient access level');

    const { data, error } = await dmDB.from('markers').insert({
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
    }).select().single();

    if (error) throw new Error(error.message);

    // Log audit
    await logAudit(data.id, 'create', user.username, { name: m.name });

    return data;
  }

  return { 
    uploadImage, 
    listenMarkers, 
    addMarker, 
    deleteMarker, 
    updateMarker, 
    getUsers, 
    addUser, 
    updateLevel, 
    deleteUser,
    // New features
    getComments,
    addComment,
    updateComment,
    deleteComment,
    getGroups,
    createGroup,
    addMarkerToGroup,
    removeMarkerFromGroup,
    getMarkerGroups,
    getAuditLog,
    // Heist Plans
    getHeistPlans,
    createHeistPlan,
    getHeistPlanSteps,
    addStepToPlan,
    updateStepOrder,
    removeStepFromPlan,
    deleteHeistPlan
  };
})();
