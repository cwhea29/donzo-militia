/** DONZO — MAP MODULE */
DM.map = (() => {
  let user, markers = [], activeId = null;
  let curMap = 'atlas', curZone = 'mainland', placing = false, pending = null;
  let scale = 1, px = 0, py = 0;
  let panning = false, moved = false, lpx = 0, lpy = 0;
  let toastT, pendingImageUrl = null;
  let editingMarkerId = null;   // NEW: for editing markers from popup

  // Category filters state
  let activeCategories = new Set(); // empty = show all
  let allCategories = Object.keys(CATS);

  // Group filters state
  let activeGroups = new Set();
  let allGroups = []; // will be loaded from DB
  let markerGroupsMap = new Map(); // markerId -> array of group names

  // Temporary state for group selection in the Add/Edit modal
  let modalSelectedGroups = new Set();

  function el(id) { return document.getElementById(id); }

  // ── INIT ────────────────────────────────────────────────
  function init(u) {
    user = u;
    setupEvents();
    loadMap();
    if (DM.db && DM.db.listenMarkers) {
      let previousMarkerIds = new Set();

      DM.db.listenMarkers(user, async (m) => {
        // Simple notification for new high-value markers
        if (previousMarkerIds.size > 0) {
          const newMarkers = m.filter(marker => !previousMarkerIds.has(marker.id));
          newMarkers.forEach(newMarker => {
            if (newMarker.min_access_level >= 7) { // Captain+ level markers
              toast(`🆕 New high-value location added: ${newMarker.name}`);
            }
          });
        }
        previousMarkerIds = new Set(m.map(marker => marker.id));

        markers = m;
        await refreshMarkerGroups();
        renderMarkers();
        renderSidebar();
        el('marker-count').textContent = m.length;
      });
    }
    if (user.canAdd) {
      const btn = el('place-btn');
      if (btn) btn.classList.remove('hidden');
    }
    if (user.level >= 4){ 
      const b = el('users-btn'); 
      if (b) b.classList.remove('hidden'); 
    }

    // Initialize filters
    activeCategories = new Set();
    activeGroups = new Set();

    loadGroups().then(() => {
      renderCategoryFilters();
      renderGroupFilters();
    });
  }

  // ── MAP IMG ─────────────────────────────────────────────
  function loadMap() {
    const img = el('map-img');
    const no = el('no-img');
    img.style.opacity = '0';
    // Clear any previous fallback
    const fb = el('map-fallback');
    if (fb) fb.remove();

    img.src = MAPS[curZone][curMap];
    img.onload  = () => { img.style.opacity = '1'; no.classList.add('hidden'); };
    img.onerror = () => {
      no.classList.remove('hidden');
      img.style.opacity = '0';
    };
  }

  // Called from the no-img UI - provides a beautiful non-image map so markers are still usable
  function useFallbackMap() {
    const wrap = el('zoom-l');
    const no = el('no-img');
    no.classList.add('hidden');

    // Remove existing fallback if any
    const old = el('map-fallback');
    if (old) old.remove();

    const fb = document.createElement('div');
    fb.id = 'map-fallback';
    fb.className = 'map-fallback ' + (curZone === 'cayo' ? 'cayo' : '');
    fb.innerHTML = `
      <div class="fb-grid"></div>
      <div class="fb-label">${curZone === 'cayo' ? 'CAYO PERICO' : 'LOS SANTOS'} <span class="fb-sub">(FALLBACK • NO IMAGE)</span></div>
      <div class="fb-hint">// Drag to pan • Scroll to zoom • Click to place markers</div>
    `;
    wrap.insertBefore(fb, el('marker-layer'));
  }

  function swapLayer(key, btn) {
    curMap = key;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    btn.classList.add('on');
    loadMap();
  }

  function swapZone(zone, btn) {
    curZone = zone;
    document.querySelectorAll('.ztab').forEach(t => t.classList.remove('on'));
    btn.classList.add('on');
    scale = 1; px = 0; py = 0; applyT();
    loadMap(); 
    refreshMarkerGroups().then(() => {
      renderMarkers(); 
      renderSidebar();
      renderGroupFilters();
    });
    closePopup();
    const zl = el('zone-lbl');
    zl.textContent = zone === 'cayo' ? 'CAYO PERICO' : 'LOS SANTOS';
    zl.className = 'sv' + (zone === 'cayo' ? ' cayo' : '');
  }

  // ── PAN / ZOOM ───────────────────────────────────────────
  function setupEvents() {
    const wrap = el('map-area');
    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const r  = wrap.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const f  = e.deltaY < 0 ? 1.12 : 0.89;
      const ns = Math.max(0.4, Math.min(12, scale * f));
      px = mx - (mx - px) * (ns / scale);
      py = my - (my - py) * (ns / scale);
      scale = ns; applyT();
    }, { passive: false });

    wrap.addEventListener('mousedown', e => {
      if (e.button === 0 && placing) {
        // In placing mode, still reset moved so the upcoming click can place
        moved = false;
        return;
      }
      panning = true; moved = false;
      lpx = e.clientX - px; lpy = e.clientY - py;
      wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('mousemove', e => {
      if (!panning) return;
      moved = true;
      px = e.clientX - lpx; py = e.clientY - lpy; applyT();
    });
    window.addEventListener('mouseup', () => {
      panning = false;
      moved = false;   // ensure we can place after any drag
      const w = el('map-area');
      if (w) w.style.cursor = placing ? 'crosshair' : 'default';
    });

    // ── TOUCH: single finger pan + two finger pinch zoom ─────────────────
    let touchStartX = 0, touchStartY = 0;
    let initialDist = 0, initialScale = 1;
    let activeTouches = 0;

    wrap.addEventListener('touchstart', e => {
      activeTouches = e.touches.length;
      if (activeTouches === 1) {
        if (placing) return; // allow click-to-place on tap
        panning = true; moved = false;
        touchStartX = e.touches[0].clientX - px;
        touchStartY = e.touches[0].clientY - py;
        wrap.style.cursor = 'grabbing';
      } else if (activeTouches === 2) {
        panning = false;
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialDist = Math.sqrt(dx*dx + dy*dy) || 1;
        initialScale = scale;
      }
    }, { passive: false });

    wrap.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && panning) {
        e.preventDefault();
        moved = true;
        px = e.touches[0].clientX - touchStartX;
        py = e.touches[0].clientY - touchStartY;
        applyT();
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const newScale = Math.max(0.4, Math.min(12, initialScale * (dist / initialDist)));
        // zoom around midpoint
        const r = wrap.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
        px = midX - (midX - px) * (newScale / scale);
        py = midY - (midY - py) * (newScale / scale);
        scale = newScale;
        applyT();
      }
    }, { passive: false });

    wrap.addEventListener('touchend', e => {
      activeTouches = e.touches.length;
      if (activeTouches === 0) {
        panning = false;
        const w = el('map-area');
        if (w) w.style.cursor = placing ? 'crosshair' : 'default';
        // treat quick tap (no move) as potential marker placement
        if (placing && !moved && user && user.canAdd) {
          // synthetic click handled by the onclick on map-area already
        }
      } else if (activeTouches === 1) {
        // finger lifted, one remains → restart single pan tracking
        touchStartX = e.touches[0].clientX - px;
        touchStartY = e.touches[0].clientY - py;
      }
    });
  }

  function applyT() {
    el('zoom-l').style.transform = `translate(${px}px,${py}px) scale(${scale})`;
  }

  function resetView() { scale = 1; px = 0; py = 0; applyT(); }

  // ── CLICK / MOVE ─────────────────────────────────────────
  function onMapClick(e) {
    if (!placing || !user.canAdd || moved) {
      // Helpful debug if it keeps failing
      if (placing && moved) {
        console.log('[Map] Click blocked because moved flag was true');
      }
      return;
    }
    const r = el('zoom-l').getBoundingClientRect();
    pending = { x: ((e.clientX-r.left)/r.width)*100, y: ((e.clientY-r.top)/r.height)*100 };
    openAddModal();
  }

  function onMouseMove(e) {
    if (!placing) return;
    const r = el('zoom-l').getBoundingClientRect();
    el('coords').textContent =
      `X: ${(((e.clientX-r.left)/r.width)*100).toFixed(1)}%  Y: ${(((e.clientY-r.top)/r.height)*100).toFixed(1)}%`;
  }

  // ── PLACE MODE ───────────────────────────────────────────
  function togglePlace() {
    if (!user.canAdd) {
      toast('You do not have permission to place markers (requires Lieutenant or higher)');
      return;
    }
    placing = !placing;

    if (placing) {
      moved = false;   // ← Critical: allow the next click to place a marker
    }

    const btn = el('place-btn');
    btn.classList.toggle('on', placing);
    btn.textContent = placing ? '✕ Cancel' : '📍 Place Marker';
    el('map-area').style.cursor = placing ? 'crosshair' : 'default';
    el('sdot').className    = 'sdot' + (placing ? ' placing' : '');
    el('smode').textContent = placing ? 'PLACING MARKER' : 'VIEW MODE';
    toast(placing ? 'CLICK ON THE MAP TO PLACE A MARKER' : 'PLACING MODE OFF');
  }

  // ── ADD / EDIT MODAL ─────────────────────────────────────
  function openAddModal(markerToEdit = null) {
    editingMarkerId = markerToEdit ? markerToEdit.id : null;

    if (markerToEdit) {
      // Editing existing marker
      el('m-name').value = markerToEdit.name || '';
      el('m-desc').value = markerToEdit.description || '';
      el('m-cat').value  = markerToEdit.category || 'poi';
      el('m-vis').value  = markerToEdit.min_access_level || '1';
      pendingImageUrl    = markerToEdit.image_url || null;

      // Show existing image if any
      const preview = el('img-preview');
      if (markerToEdit.image_url) {
        preview.innerHTML = `<img src="${markerToEdit.image_url}" alt="current">`;
        preview.classList.add('has-img');
        el('img-remove').classList.remove('hidden');
      } else {
        resetImageUpload();
      }

      el('save-btn').textContent = 'UPDATE LOCATION';
      el('add-modal').querySelector('.modal-title').textContent = 'EDIT LOCATION';
    } else {
      // Creating new
      el('m-name').value = '';
      el('m-desc').value = '';
      el('m-cat').value  = 'poi';
      el('m-vis').value  = '1';
      pendingImageUrl    = null;
      resetImageUpload();
      el('save-btn').textContent = 'SAVE LOCATION';
      el('add-modal').querySelector('.modal-title').textContent = 'NEW LOCATION';
    }

    // Load current groups for this marker (if editing)
    loadGroupSelectionForModal(markerToEdit ? markerToEdit.id : null);

    el('add-modal').classList.remove('hidden');
    el('m-name').focus();
  }

  function closeAddModal() {
    el('add-modal').classList.add('hidden');
    pending = null;
    pendingImageUrl = null;
    editingMarkerId = null;
    el('save-btn').textContent = 'SAVE LOCATION';
    el('add-modal').querySelector('.modal-title').textContent = 'NEW LOCATION';
  }

  function resetImageUpload() {
    el('img-file').value = '';
    el('img-preview').innerHTML = '<div class="img-placeholder">// No image selected</div>';
    el('img-preview').classList.remove('has-img');
    el('img-remove').classList.add('hidden');
  }

  // Called when user picks a file
  async function onImagePicked(input) {
    const file = input.files[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) { toast('Please select an image file'); return; }
    if (file.size > 8 * 1024 * 1024)     { toast('Image must be under 8MB'); return; }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = ev => {
      el('img-preview').innerHTML = `<img src="${ev.target.result}" alt="preview">`;
      el('img-preview').classList.add('has-img');
      el('img-remove').classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage in background
    el('img-upload-status').textContent = '// Uploading...';
    try {
      pendingImageUrl = await DM.db.uploadImage(file);
      el('img-upload-status').textContent = '✓ Ready';
      el('img-upload-status').style.color = 'var(--green-lt)';
    } catch (e) {
      el('img-upload-status').textContent = '// Upload failed: ' + e.message;
      el('img-upload-status').style.color = '#e05050';
      pendingImageUrl = null;
    }
  }

  function removeImage() {
    pendingImageUrl = null;
    resetImageUpload();
    el('img-upload-status').textContent = '';
  }

  async function saveMarker() {
    const name = el('m-name').value.trim();
    if (!name) { toast('Location name is required'); return; }
    if (name.length > 60) { toast('Name too long (max 60 chars)'); return; }

    // Only require map coordinates when creating a *new* marker
    if (!editingMarkerId && !pending) {
      console.warn('[saveMarker] Blocked: no pending coordinates (not in edit mode)');
      return;
    }

    // Check image still uploading
    if (el('img-file').files[0] && !pendingImageUrl) {
      toast('Wait for image upload to finish'); return;
    }

    const btn = el('save-btn');
    btn.innerHTML = '<span class="spin"></span>SAVING...'; btn.disabled = true;

    console.log('[saveMarker] Called. editingMarkerId =', editingMarkerId);

    try {
      let savedMarkerId = editingMarkerId;

      if (editingMarkerId) {
        // Editing existing marker
        await DM.db.updateMarker(user, editingMarkerId, {
          name,
          description: el('m-desc').value.trim(),
          imageUrl:    pendingImageUrl || '',
          category:    el('m-cat').value,
          minLevel:    el('m-vis').value,
          created_by:  markers.find(x => x.id === editingMarkerId)?.created_by
        });
        toast('✓ LOCATION UPDATED');
      } else {
        // Creating new
        const newMarker = await DM.db.addMarker(user, {
          name,
          zone:        curZone,
          description: el('m-desc').value.trim(),
          imageUrl:    pendingImageUrl || '',
          category:    el('m-cat').value,
          minLevel:    el('m-vis').value,
          x: pending.x, y: pending.y
        });
        savedMarkerId = newMarker.id;
        toast('✓ LOCATION SAVED — ' + name.toUpperCase());
      }

      // Sync group assignments
      if (savedMarkerId) {
        await syncMarkerGroups(savedMarkerId);
      }

      closeAddModal();
      if (placing) togglePlace();
    } catch (e) { 
      console.error('Failed to save marker:', e);
      toast('Error: ' + e.message); 
    }
    finally { btn.textContent = 'SAVE LOCATION'; btn.disabled = false; }
  }

  // ── RENDER MARKERS ───────────────────────────────────────
  function renderMarkers() {
    const layer = el('marker-layer');
    layer.innerHTML = '';
    
    // High contrast colors for better visibility on satellite / dark maps
    const fills = {
      1:  '#f4e9d8',   // Light beige
      2:  '#d4e6c3',
      3:  '#a8d5a2',
      4:  '#7fc97f',
      5:  '#ffeb3b',   // Bright yellow
      6:  '#ffc107',
      7:  '#ff9800',
      8:  '#ff5722',
      9:  '#f44336',
      10: '#e91e63',
      11: '#9c27b0'    // Purple for highest (Boss)
    };
    
    const strks = {
      1:  '#8d7b5a',
      2:  '#5a8a4a',
      3:  '#4a7a3a',
      4:  '#3a6a2a',
      5:  '#c7a000',
      6:  '#c77a00',
      7:  '#c75a00',
      8:  '#c72a00',
      9:  '#a80000',
      10: '#8a0040',
      11: '#4a0050'
    };

    markers
      .filter(m => m.zone === curZone)
      .filter(m => {
        const catMatch = activeCategories.size === 0 || activeCategories.has(m.category);
        const groupNames = markerGroupsMap.get(m.id) || [];
        const groupMatch = activeGroups.size === 0 || groupNames.some(g => activeGroups.has(g));
        return catMatch && groupMatch;
      })
      .forEach(m => {
      const div = document.createElement('div');
      div.className = 'marker' + (m.zone==='cayo'?' cayo':'');
      div.style.cssText = `left:${m.x}%;top:${m.y}%;`;
      const ico = (CATS[m.category] || CATS.other).icon;
      const f   = fills[m.min_access_level] || fills[1];
      const s   = strks[m.min_access_level] || strks[1];

      div.innerHTML = `<div class="mpin">
        <svg viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
          <!-- White halo for better visibility on dark/satellite maps -->
          <path d="M15 1C7.3 1 1 7.3 1 15c0 11 14 24 14 24S29 26 29 15C29 7.3 22.7 1 15 1z" fill="white"/>
          <!-- Colored pin -->
          <path d="M15 2.5C8.1 2.5 2.5 8.1 2.5 15c0 10.2 12.5 22 12.5 22s12.5-11.8 12.5-22c0-6.9-5.6-12.5-12.5-12.5z" fill="${f}" stroke="${s}" stroke-width="1.8"/>
          <text x="15" y="18" text-anchor="middle" dominant-baseline="middle" font-size="11" font-family="Arial" font-weight="bold">${ico}</text>
        </svg>
      </div>
      <div class="mpulse"></div>`;

      div.addEventListener('click', e => { e.stopPropagation(); showPopup(m, e); });
      layer.appendChild(div);
    });
  }

  // ── POPUP ────────────────────────────────────────────────
  function showPopup(m, e) {
    if (placing) return;
    activeId = m.id;
    const vis  = VIS[m.min_access_level]    || VIS[1];
    const cat  = CATS[m.category]           || CATS.other;
    const lvl  = ACCESS[m.created_by_level] || {};
    const popup = el('popup');

    el('pp-name').textContent = m.name;
    el('pp-name').className   = 'popup-name' + (m.zone==='cayo'?' cayo':'');
    el('pp-desc').textContent = m.description || '';
    el('pp-zone').textContent = m.zone==='cayo' ? '☠ Cayo Perico' : '📍 Los Santos';
    el('pp-zone').className   = 'popup-zone' + (m.zone==='cayo'?' cayo':'');
    el('pp-vis').innerHTML    = `<span style="color:${vis.color}">${vis.icon} ${vis.label}</span>`;
    el('pp-cat').textContent  = cat.label;
    el('pp-meta').textContent = `Added by ${m.created_by||'—'} (${lvl.name||'Unknown'})`;

    // Last Updated timestamp
    const updatedEl = el('pp-updated');
    if (m.updated_at) {
      const date = new Date(m.updated_at);
      updatedEl.textContent = `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    } else {
      updatedEl.textContent = '';
    }

    // Image — now a URL from Supabase Storage
    const iw = el('pp-img');
    iw.innerHTML = m.image_url
      ? `<img class="popup-img" src="${m.image_url}" alt="${m.name}" onerror="this.parentElement.innerHTML='<div class=popup-noimg>// IMAGE NOT FOUND</div>'">`
      : '<div class="popup-noimg">// NO IMAGE</div>';

    const canManage = DM.auth.canDelete(m, user);

    const foot = el('pp-foot');
    if (canManage) {
      foot.classList.remove('hidden');
      foot.innerHTML = `
        <button class="btn btn-ghost" onclick="DM.map.editMarker('${m.id}')">✏️ Edit</button>
        <button class="btn-danger" onclick="DM.map.deleteMarker()">🗑 Delete</button>
      `;
    } else {
      foot.classList.add('hidden');
    }

    popup.classList.remove('hidden');

    // Load comments (only if user is logged in)
    if (user) {
      loadCommentsForPopup(m.id);
    } else {
      el('pp-comments-list').innerHTML = '<div style="color:var(--muted); font-size:11px;">Log in to view comments.</div>';
    }
    const pw=300, ph=420;
    let lx = e.clientX+14, ly = e.clientY-20;
    if (lx+pw > innerWidth -10) lx = e.clientX-pw-14;
    if (ly+ph > innerHeight-10) ly = innerHeight-ph-10;
    if (ly < 70) ly = 70;
    popup.style.left = lx+'px'; popup.style.top = ly+'px';
  }

  function closePopup() { 
    el('popup').classList.add('hidden'); 
    activeId = null; 
    el('pp-comments-list').innerHTML = '';
    const input = el('pp-comment-input');
    if (input) input.value = '';
  }

  async function loadCommentsForPopup(markerId) {
    const list = el('pp-comments-list');
    list.innerHTML = '<div style="color:var(--muted); font-size:11px;">Loading comments...</div>';

    try {
      const comments = await DM.db.getComments(markerId);
      if (comments.length === 0) {
        list.innerHTML = '<div style="color:var(--muted); font-size:11px; font-style:italic;">No comments yet.</div>';
        return;
      }
      list.innerHTML = comments.map(c => {
        const isOwner = user && c.username === user.username;
        const actions = isOwner ? `
          <span style="margin-left:8px; font-size:10px;">
            <a href="#" onclick="DM.map.editComment('${c.id}', '${c.comment.replace(/'/g, "\\'")}'); return false;">Edit</a> · 
            <a href="#" onclick="DM.map.deleteComment('${c.id}'); return false;" style="color:#c0392b;">Delete</a>
          </span>
        ` : '';

        return `
          <div style="margin-bottom:6px; border-left:2px solid var(--border); padding-left:6px;">
            <strong>${c.username}</strong> 
            <span style="color:var(--muted); font-size:10px;">${new Date(c.created_at).toLocaleDateString()}</span>
            ${actions}
            <br>
            <span id="comment-text-${c.id}">${c.comment}</span>
          </div>
        `;
      }).join('');
    } catch (e) {
      list.innerHTML = '<div style="color:#e05050; font-size:11px;">Failed to load comments.</div>';
    }
  }

  async function addCommentToMarker() {
    const input = el('pp-comment-input');
    const text = input.value.trim();
    if (!text || !activeId) return;

    try {
      await DM.db.addComment(user, activeId, text);
      input.value = '';
      loadCommentsForPopup(activeId);
      toast('Comment added');
    } catch (e) {
      toast('Error adding comment: ' + e.message);
    }
  }

  // Edit comment inline
  function editComment(commentId, currentText) {
    const span = el(`comment-text-${commentId}`);
    if (!span) return;

    const originalHTML = span.innerHTML;

    span.innerHTML = `
      <input type="text" id="edit-comment-${commentId}" value="${currentText}" style="width: 85%; font-size:11px;">
      <button onclick="DM.map.saveEditedComment('${commentId}')" style="font-size:10px; margin-left:4px;">Save</button>
      <button onclick="DM.map.cancelEditComment('${commentId}', '${originalHTML.replace(/'/g, "\\'")}')" style="font-size:10px;">Cancel</button>
    `;

    const input = el(`edit-comment-${commentId}`);
    input.focus();
    input.select();
  }

  async function saveEditedComment(commentId) {
    const input = el(`edit-comment-${commentId}`);
    if (!input) return;

    const newText = input.value.trim();
    if (!newText) {
      toast('Comment cannot be empty');
      return;
    }

    try {
      await DM.db.updateComment(commentId, newText, user.username);
      loadCommentsForPopup(activeId);
      toast('Comment updated');
    } catch (e) {
      toast('Failed to update comment: ' + e.message);
    }
  }

  function cancelEditComment(commentId, originalHTML) {
    const span = el(`comment-text-${commentId}`);
    if (span) span.innerHTML = originalHTML;
  }

  async function deleteComment(commentId) {
    if (!confirm('Delete this comment?')) return;

    try {
      await DM.db.deleteComment(commentId, user.username);
      loadCommentsForPopup(activeId);
      toast('Comment deleted');
    } catch (e) {
      toast('Failed to delete comment: ' + e.message);
    }
  }

  // ── CATEGORY FILTERS ─────────────────────────────────────
  function renderCategoryFilters() {
    const container = el('category-filters');
    if (!container) return;

    container.innerHTML = '';

    allCategories.forEach(cat => {
      const catInfo = CATS[cat] || CATS.other;
      const isActive = activeCategories.size === 0 || activeCategories.has(cat);

      const btn = document.createElement('button');
      btn.style.cssText = `
        font-size: 10px; 
        padding: 2px 6px; 
        border: 1px solid ${isActive ? 'var(--tan-lt)' : 'var(--border)'}; 
        background: ${isActive ? 'rgba(152,133,88,0.15)' : 'transparent'};
        color: var(--text); 
        cursor: pointer;
        border-radius: 3px;
      `;
      btn.textContent = `${catInfo.icon} ${catInfo.label.split(' ')[0]}`;

      btn.onclick = () => {
        if (activeCategories.size === 0) {
          activeCategories = new Set([cat]);
        } else if (activeCategories.has(cat)) {
          activeCategories.delete(cat);
          if (activeCategories.size === 0) {
            activeCategories = new Set();
          }
        } else {
          activeCategories.add(cat);
        }
        renderCategoryFilters();
        renderSidebar(el('sb-search')?.querySelector('input')?.value || '');
        renderMarkers();
      };

      container.appendChild(btn);
    });

    if (activeCategories.size > 0) {
      const clearBtn = document.createElement('button');
      clearBtn.style.cssText = 'font-size: 9px; padding: 1px 5px; margin-left: 4px;';
      clearBtn.textContent = 'Clear';
      clearBtn.onclick = () => {
        activeCategories = new Set();
        renderCategoryFilters();
        renderSidebar(el('sb-search')?.querySelector('input')?.value || '');
        renderMarkers();
      };
      container.appendChild(clearBtn);
    }
  }

  // ── GROUP FILTERS & MANAGEMENT ───────────────────────────
  async function loadGroups() {
    try {
      allGroups = await DM.db.getGroups();
    } catch (e) {
      console.error('Failed to load groups', e);
      allGroups = [];
    }
  }

  async function refreshMarkerGroups() {
    markerGroupsMap.clear();
    const currentMarkers = markers.filter(m => m.zone === curZone);

    for (const m of currentMarkers) {
      try {
        const groups = await DM.db.getMarkerGroups(m.id);
        markerGroupsMap.set(m.id, groups.map(g => g.name));
      } catch (e) {
        markerGroupsMap.set(m.id, []);
      }
    }
  }

  function renderGroupFilters() {
    const container = el('group-filters');
    if (!container) return;

    container.innerHTML = '';

    allGroups.forEach(group => {
      const isActive = activeGroups.size === 0 || activeGroups.has(group.name);

      const btn = document.createElement('button');
      btn.style.cssText = `
        font-size: 10px; 
        padding: 2px 6px; 
        border: 1px solid ${isActive ? 'var(--tan-lt)' : 'var(--border)'}; 
        background: ${isActive ? 'rgba(152,133,88,0.15)' : 'transparent'};
        color: var(--text); 
        cursor: pointer;
        border-radius: 3px;
      `;
      btn.textContent = group.name;

      btn.onclick = () => {
        if (activeGroups.size === 0) {
          activeGroups = new Set([group.name]);
        } else if (activeGroups.has(group.name)) {
          activeGroups.delete(group.name);
          if (activeGroups.size === 0) activeGroups = new Set();
        } else {
          activeGroups.add(group.name);
        }
        renderGroupFilters();
        renderSidebar(el('sb-search')?.querySelector('input')?.value || '');
        renderMarkers();
      };

      container.appendChild(btn);
    });

    if (activeGroups.size > 0) {
      const clearBtn = document.createElement('button');
      clearBtn.style.cssText = 'font-size: 9px; padding: 1px 5px; margin-left: 4px;';
      clearBtn.textContent = 'Clear';
      clearBtn.onclick = () => {
        activeGroups = new Set();
        renderGroupFilters();
        renderSidebar(el('sb-search')?.querySelector('input')?.value || '');
        renderMarkers();
      };
      container.appendChild(clearBtn);
    }
  }

  function showCreateGroupModal() {
    const name = prompt('Enter new group name (e.g. "Casino Heist", "Stores", "Banks"):');
    if (!name || !name.trim()) return;

    DM.db.createGroup(user, name.trim())
      .then(newGroup => {
        allGroups.push(newGroup);
        toast(`Group "${newGroup.name}" created`);
        renderGroupFilters();
      })
      .catch(e => toast('Failed to create group: ' + e.message));
  }

  async function loadGroupSelectionForModal(markerId = null) {
    const container = el('modal-group-checkboxes');
    if (!container) return;

    container.innerHTML = '';
    modalSelectedGroups = new Set();

    if (allGroups.length === 0) {
      await loadGroups();
    }

    // If editing, pre-load current groups for this marker
    if (markerId) {
      try {
        const currentGroups = await DM.db.getMarkerGroups(markerId);
        currentGroups.forEach(g => modalSelectedGroups.add(g.name));
      } catch (e) {
        console.warn('Could not load current groups for marker', e);
      }
    }

    allGroups.forEach(group => {
      const isChecked = modalSelectedGroups.has(group.name);

      const wrapper = document.createElement('label');
      wrapper.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.onchange = () => {
        if (checkbox.checked) {
          modalSelectedGroups.add(group.name);
        } else {
          modalSelectedGroups.delete(group.name);
        }
      };

      wrapper.appendChild(checkbox);
      wrapper.appendChild(document.createTextNode(group.name));

      container.appendChild(wrapper);
    });
  }

  async function syncMarkerGroups(markerId) {
    try {
      // Get current groups from DB
      const currentGroupObjects = await DM.db.getMarkerGroups(markerId);
      const currentNames = currentGroupObjects.map(g => g.name);

      // Find groups to remove
      const toRemove = currentNames.filter(name => !modalSelectedGroups.has(name));

      // Find groups to add
      const toAdd = [...modalSelectedGroups].filter(name => !currentNames.includes(name));

      // Remove old ones
      for (const name of toRemove) {
        const group = allGroups.find(g => g.name === name);
        if (group) {
          await DM.db.removeMarkerFromGroup(markerId, group.id);
        }
      }

      // Add new ones
      for (const name of toAdd) {
        const group = allGroups.find(g => g.name === name);
        if (group) {
          await DM.db.addMarkerToGroup(markerId, group.id);
        }
      }

      // Refresh local cache
      await refreshMarkerGroups();
    } catch (e) {
      console.error('Failed to sync groups for marker', e);
      toast('Warning: Could not update group assignments');
    }
  }

  // ── HEIST PLANS UI ───────────────────────────────────────
  async function openHeistPlans() {
    const modal = el('heist-plans-modal');
    modal.classList.remove('hidden');
    await loadHeistPlans();
  }

  function closeHeistPlans() {
    el('heist-plans-modal').classList.add('hidden');
  }

  async function loadHeistPlans() {
    const container = el('heist-plans-list');
    container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted);">Loading plans...</div>';

    try {
      const plans = await DM.db.getHeistPlans();

      if (plans.length === 0) {
        container.innerHTML = `
          <div style="padding:20px; text-align:center; color:var(--muted);">
            No Heist Plans yet.<br>
            <button onclick="DM.map.createNewHeistPlan()" style="margin-top:12px;">Create your first plan</button>
          </div>
        `;
        return;
      }

      container.innerHTML = plans.map(plan => `
        <div style="border:1px solid var(--border); padding:12px; margin-bottom:8px; border-radius:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${plan.name}</strong>
            <div>
              <button onclick="DM.map.viewHeistPlan('${plan.id}')" style="font-size:10px;">View</button>
              <button onclick="DM.map.deleteHeistPlan('${plan.id}')" style="font-size:10px; color:#c0392b;">Delete</button>
            </div>
          </div>
          ${plan.description ? `<div style="font-size:11px; color:var(--muted); margin-top:4px;">${plan.description}</div>` : ''}
          <div style="font-size:10px; color:var(--muted); margin-top:6px;">Created by ${plan.created_by}</div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = `<div style="color:#e05050; padding:12px;">Failed to load plans: ${e.message}</div>`;
    }
  }

  async function createNewHeistPlan() {
    const name = prompt('Heist Plan name:');
    if (!name || !name.trim()) return;

    const description = prompt('Description (optional):') || '';

    try {
      await DM.db.createHeistPlan(user, name.trim(), description);
      toast('Heist Plan created!');
      await loadHeistPlans();
    } catch (e) {
      toast('Error creating plan: ' + e.message);
    }
  }

  async function viewHeistPlan(planId) {
    const modal = el('heist-plans-modal');
    const container = el('heist-plans-list');

    try {
      const [plan, steps] = await Promise.all([
        DM.db.getHeistPlans().then(plans => plans.find(p => p.id === planId)),
        DM.db.getHeistPlanSteps(planId)
      ]);

      if (!plan) {
        container.innerHTML = '<div style="color:#e05050;">Plan not found.</div>';
        return;
      }

      let html = `
        <div style="margin-bottom:12px;">
          <button onclick="DM.map.loadHeistPlans()" style="font-size:11px;">← Back to Plans</button>
          <h3 style="margin:8px 0 4px;">${plan.name}</h3>
          ${plan.description ? `<div style="color:var(--muted); margin-bottom:12px;">${plan.description}</div>` : ''}
        </div>
      `;

      if (steps.length === 0) {
        html += `
          <div style="padding:20px; text-align:center; color:var(--muted); border:1px dashed var(--border);">
            No steps added yet.<br>
            <button onclick="DM.map.addMarkerToHeistPlan('${planId}')" style="margin-top:10px;">+ Add First Step</button>
          </div>
        `;
      } else {
        html += `<div style="margin-bottom:12px;"><strong>Steps (${steps.length})</strong></div>`;

        steps.forEach((step, index) => {
          const marker = step.markers;
          const cat = marker ? (CATS[marker.category] || CATS.other) : null;

          html += `
            <div style="display:flex; align-items:center; gap:8px; padding:8px; border:1px solid var(--border); margin-bottom:6px; border-radius:4px;">
              <div style="font-weight:bold; min-width:22px;">${index + 1}.</div>
              <div style="flex:1;">
                ${cat ? cat.icon + ' ' : ''}<strong>${marker ? marker.name : 'Unknown Marker'}</strong>
                ${step.notes ? `<div style="font-size:11px; color:var(--muted);">${step.notes}</div>` : ''}
              </div>
              <div>
                <button onclick="DM.map.removeStepFromPlan('${step.id}', '${planId}')" style="font-size:10px; color:#c0392b;">Remove</button>
              </div>
            </div>
          `;
        });

        html += `
          <div style="margin-top:12px;">
            <button onclick="DM.map.addMarkerToHeistPlan('${planId}')" style="width:100%;">+ Add Another Step</button>
          </div>
        `;
      }

      container.innerHTML = html;

    } catch (e) {
      container.innerHTML = `<div style="color:#e05050;">Failed to load plan: ${e.message}</div>`;
    }
  }

  async function deleteHeistPlan(planId) {
    if (!confirm('Delete this entire Heist Plan?')) return;

    try {
      await DM.db.deleteHeistPlan(planId);
      toast('Plan deleted');
      await loadHeistPlans();
    } catch (e) {
      toast('Error: ' + e.message);
    }
  }

  async function addMarkerToHeistPlan(planId) {
    const currentMarkers = markers.filter(m => m.zone === curZone);

    if (currentMarkers.length === 0) {
      toast('No markers in current zone');
      return;
    }

    // Simple picker using the current markers
    const container = el('heist-plans-list');
    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <button onclick="DM.map.viewHeistPlan('${planId}')">← Back</button>
        <strong style="margin-left:12px;">Select a marker to add as next step</strong>
      </div>
    `;

    const listDiv = document.createElement('div');

    currentMarkers.forEach(marker => {
      const cat = CATS[marker.category] || CATS.other;
      const btn = document.createElement('button');
      btn.style.cssText = 'display:block; width:100%; text-align:left; margin-bottom:4px; padding:6px;';
      btn.innerHTML = `${cat.icon} ${marker.name} <span style="color:var(--muted); font-size:10px;">(Lvl ${marker.min_access_level})</span>`;

      btn.onclick = async () => {
        const nextOrder = (await DM.db.getHeistPlanSteps(planId)).length + 1;

        try {
          await DM.db.addStepToPlan(planId, marker.id, nextOrder);
          toast(`Added "${marker.name}" to plan`);
          await viewHeistPlan(planId);
        } catch (e) {
          toast('Failed to add step: ' + e.message);
          await viewHeistPlan(planId);
        }
      };

      listDiv.appendChild(btn);
    });

    container.appendChild(listDiv);
  }

  async function removeStepFromPlan(stepId, planId) {
    if (!confirm('Remove this step from the plan?')) return;

    try {
      await DM.db.removeStepFromPlan(stepId);
      toast('Step removed');
      await viewHeistPlan(planId);
    } catch (e) {
      toast('Error: ' + e.message);
    }
  }

  // Old separate Audit Log functions removed — now handled as a tab inside User Management
  function closeAuditLog() {
    // Kept for backwards compatibility if any old calls exist
    const modal = el('audit-log-modal');
    if (modal) modal.classList.add('hidden');
  }

  async function deleteMarker() {
    if (!activeId) return;
    const m = markers.find(x => x.id === activeId);
    if (!m || !confirm(`Delete "${m.name}"?`)) return;
    try { await DM.db.deleteMarker(user, m); closePopup(); toast('LOCATION DELETED'); }
    catch (e) { toast('Error: ' + e.message); }
  }

  function editMarker(id) {
    const m = markers.find(x => x.id === id);
    if (!m) return;
    closePopup();
    openAddModal(m);
  }

  // ── SIDEBAR ──────────────────────────────────────────────
  function toggleSidebar() { el('sidebar').classList.toggle('open'); }

  function renderSidebar(filter = '') {
    const list = el('sb-list');
    const q    = filter.toLowerCase();
    const main = markers.filter(m => m.zone === 'mainland');
    const cayo = markers.filter(m => m.zone === 'cayo');
    el('stat-main').textContent = main.length;
    el('stat-cayo').textContent = cayo.length;

    if (!markers.length) { list.innerHTML = '<div class="sb-empty">// NO LOCATIONS YET</div>'; return; }

    const sec = (title, arr) => {
      const f = arr.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(q) || (m.description||'').toLowerCase().includes(q);
        const matchesCategory = activeCategories.size === 0 || activeCategories.has(m.category);
        return matchesSearch && matchesCategory;
      });
      if (!f.length) return '';
      renderMarkers(); // keep map in sync with sidebar filters/search
      return `<div class="sb-sec">${title} <span>(${f.length})</span></div>` +
        f.map(m => {
          const v = VIS[m.min_access_level] || VIS[1];
          const c = (CATS[m.category]||CATS.other).icon;
          return `<div class="sb-item${m.zone==='cayo'?' cayo':''}" onclick="DM.map.jumpTo('${m.id}')">
            <span class="sb-ico">${c}</span>
            <div>
              <div class="sb-name">${m.name}</div>
              <div class="sb-meta" style="color:${v.color}">${v.icon} ${v.label}</div>
            </div>
          </div>`;
        }).join('');
    };

    list.innerHTML = sec('LOS SANTOS', main) + sec('☠ CAYO PERICO', cayo)
      || '<div class="sb-empty">// NO RESULTS</div>';
  }

  function jumpTo(id) {
    const m = markers.find(x => x.id === id);
    if (!m) return;
    const jump = () => {
      const r = el('map-area').getBoundingClientRect();
      px = r.width/2  - (m.x/100)*r.width*scale;
      py = r.height/2 - (m.y/100)*r.height*scale;
      applyT();
      showPopup(m, { clientX: r.left+r.width/2, clientY: r.top+r.height/2, stopPropagation:()=>{} });
    };
    if (m.zone !== curZone) {
      swapZone(m.zone, document.querySelector(`.ztab[data-z="${m.zone}"]`));
      setTimeout(jump, 400);
    } else jump();
    if (innerWidth < 768) toggleSidebar();
  }

  // ── USER MANAGEMENT ──────────────────────────────────────
  async function openUsers() {
    el('user-modal').classList.remove('hidden');

    // Apply visibility immediately in case refresh takes time
    updateUserModalTabVisibility();

    await refreshUsers();

    console.log('[User Management] Current user level:', user?.level, 'User object:', user);

    // Re-apply visibility after user data is confirmed
    updateUserModalTabVisibility();

    // Default to Users tab
    switchUserModalTab('users');
  }

  function updateUserModalTabVisibility() {
    const auditTab = el('tab-audit');
    const bugsTab = el('tab-bugs');

    const userLevel = user?.level ?? 0;

    // Audit Log: Visible for Chief+ (Level 8 and above)
    if (auditTab) {
      const shouldShowAudit = userLevel >= 8;
      auditTab.style.display = shouldShowAudit ? 'block' : 'none';
      console.log('[User Management] Audit Log tab visible for level', userLevel, ':', shouldShowAudit);
    }

    // Bugs tab: ONLY for Boss (Level 11)
    if (bugsTab) {
      const shouldShowBugs = userLevel === 11;
      bugsTab.style.display = shouldShowBugs ? 'block' : 'none';
      console.log('[User Management] Bugs tab visible for level', userLevel, ':', shouldShowBugs);
    }
  }

  function switchUserModalTab(tab) {
    const usersContent = el('user-tab-content');
    const auditContent = el('audit-tab-content');
    const bugsContent = el('bugs-tab-content');

    const usersTab = el('tab-users');
    const auditTab = el('tab-audit');
    const bugsTab = el('tab-bugs');

    // Always re-apply visibility in case something changed
    updateUserModalTabVisibility();

    // Hide all content
    usersContent.style.display = 'none';
    auditContent.style.display = 'none';
    bugsContent.style.display = 'none';

    // Reset tab styles
    if (usersTab) usersTab.style.borderBottom = '2px solid transparent';
    if (auditTab) auditTab.style.borderBottom = '2px solid transparent';
    if (bugsTab) bugsTab.style.borderBottom = '2px solid transparent';

    if (tab === 'users') {
      usersContent.style.display = 'block';
      if (usersTab) usersTab.style.borderBottom = '2px solid var(--tan)';
    } 
    else if (tab === 'audit') {
      const userLevel = user?.level ?? 0;
      if (userLevel < 8) {
        toast('Only Chief and higher can view the Audit Log');
        switchUserModalTab('users');
        return;
      }
      auditContent.style.display = 'block';
      if (auditTab) auditTab.style.borderBottom = '2px solid var(--tan)';
      loadAuditLogIntoTab();
    } 
    else if (tab === 'bugs') {
      const userLevel = user?.level ?? 0;
      if (userLevel !== 11) {
        toast('Only the Boss can access the Bugs section');
        switchUserModalTab('users');
        return;
      }
      bugsContent.style.display = 'block';
      if (bugsTab) bugsTab.style.borderBottom = '2px solid #e07070';
      loadBugReports();
    }
  }

  async function loadAuditLogIntoTab() {
    const content = el('audit-tab-content');
    content.innerHTML = '<div style="padding:20px; text-align:center;">Loading audit log...</div>';

    try {
      const logs = await DM.db.getAuditLog(100);

      if (logs.length === 0) {
        content.innerHTML = '<div style="padding:20px; color:var(--muted);">No audit entries yet.</div>';
        return;
      }

      let html = '<table style="width:100%; border-collapse: collapse; font-size:12px;">';
      html += '<tr style="background: var(--panel2);"><th style="text-align:left; padding:6px;">Time</th><th style="text-align:left; padding:6px;">Action</th><th style="text-align:left; padding:6px;">By</th><th style="text-align:left; padding:6px;">Details</th></tr>';

      logs.forEach(log => {
        const time = new Date(log.created_at).toLocaleString();
        let details = '';
        if (log.details) {
          if (log.details.name) details += `Name: ${log.details.name} `;
          if (log.details.comment) details += `Comment: "${log.details.comment}" `;
        }

        html += `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:6px; font-size:11px; white-space:nowrap;">${time}</td>
          <td style="padding:6px;"><strong>${log.action.toUpperCase()}</strong></td>
          <td style="padding:6px;">${log.performed_by}</td>
          <td style="padding:6px; font-size:11px; color:var(--muted);">${details || '-'}</td>
        </tr>`;
      });

      html += '</table>';
      content.innerHTML = html;

    } catch (e) {
      content.innerHTML = `<div style="color:#e05050; padding:12px;">Failed to load audit log: ${e.message}</div>`;
    }
  }

  // Placeholder for Bug Reports (Boss only)
  async function loadBugReports() {
    const container = el('bug-reports-list');
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #e07070;">
        Bug reporting system not yet implemented.<br>
        We can add a <code>bug_reports</code> table and logging soon.
      </div>
    `;
  }
  function closeUsers() { el('user-modal').classList.add('hidden'); }

  async function refreshUsers() {
    const c = el('user-list');
    c.innerHTML = '<div style="padding:14px;font-family:var(--font-m);font-size:11px;letter-spacing:2px;color:var(--muted);">// LOADING...</div>';
    try {
      const users = await DM.db.getUsers();
      c.innerHTML = users.map(u => {
        return `<div class="urow">
          <div><div class="u-name">${u.display_name||u.username}</div><div class="u-un">@${u.username}</div></div>
          <select class="u-lvl" data-id="${u.id}" onchange="DM.map.changeLevel(this)">
            ${Object.keys(ACCESS).map(Number).sort((a,b)=>a-b).map(l => 
              `<option value="${l}" ${u.access_level===l ? 'selected' : ''}>${l} — ${ACCESS[l].name}</option>`
            ).join('')}
          </select>
          <button class="u-del" onclick="DM.map.removeUser('${u.id}','${u.username}')">✕</button>
        </div>`;
      }).join('') || '<div style="padding:14px;font-size:13px;color:var(--muted);">No users yet</div>';
    } catch (e) { c.innerHTML = `<div style="padding:14px;color:var(--red);font-size:13px;">${e.message}</div>`; }

    // Re-apply tab visibility in case user level was just changed
    updateUserModalTabVisibility();
  }

  async function addUser() {
    const un = el('nu-un').value.trim().toLowerCase();
    const pw = el('nu-pw').value.trim();
    const dn = el('nu-dn').value.trim();
    const lv = el('nu-lv').value;
    if (!un || !pw) { toast('Username and password required'); return; }
    if (un.length < 2 || un.length > 24) { toast('Username must be 2-24 chars'); return; }
    if (pw.length < 4) { toast('Password must be at least 4 characters'); return; }
    try {
      await DM.db.addUser(user, { username:un, password:pw, displayName:dn, level:lv });
      ['nu-un','nu-pw','nu-dn'].forEach(id => el(id).value = '');
      toast('✓ USER ADDED: ' + un.toUpperCase());
      await refreshUsers();
    } catch (e) { toast('Error: ' + e.message); }
  }

  async function changeLevel(sel) {
    try { await DM.db.updateLevel(user, sel.dataset.id, sel.value); toast('✓ Level updated'); }
    catch (e) { toast('Error: ' + e.message); }
  }

  async function removeUser(id, un) {
    if (!confirm(`Remove user "${un}"?`)) return;
    try { await DM.db.deleteUser(user, id); toast('User removed'); await refreshUsers(); }
    catch (e) { toast('Error: ' + e.message); }
  }

  // ── TOAST ────────────────────────────────────────────────
  function toast(msg) {
    const t = el('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2800);
  }

  document.addEventListener('click', e => {
    const p = el('popup');
    if (p && !p.classList.contains('hidden') && !p.contains(e.target)) closePopup();
  });

  // Keyboard shortcuts (map page)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const addM = el('add-modal');
      const userM = el('user-modal');
      const pop = el('popup');
      if (!addM.classList.contains('hidden')) closeAddModal();
      else if (!userM.classList.contains('hidden')) closeUsers();
      else if (!pop.classList.contains('hidden')) closePopup();
      else if (placing) togglePlace();
    }
    if ((e.key === 'r' || e.key === 'R') && !e.target.matches('input,textarea,select')) {
      e.preventDefault();
      resetView();
      toast('VIEW RESET');
    }
    if (e.key === '?' && !e.target.matches('input,textarea')) {
      e.preventDefault();
      toast('R = Reset view • ESC = Close panels • Drag/Scroll = Navigate • Place button for markers');
    }
  });

  return {
    init, swapLayer, swapZone, togglePlace, onMapClick, onMouseMove,
    closeAddModal, onImagePicked, removeImage, saveMarker,
    toggleSidebar, renderSidebar, jumpTo, closePopup,
    deleteMarker, editMarker, openUsers, closeUsers, addUser, changeLevel, removeUser, resetView,
    useFallbackMap, addCommentToMarker, editComment, saveEditedComment, cancelEditComment, deleteComment, renderMarkers, renderCategoryFilters, showCreateGroupModal, renderGroupFilters, loadGroups,
    openHeistPlans, closeHeistPlans, createNewHeistPlan, viewHeistPlan, deleteHeistPlan, addMarkerToHeistPlan, removeStepFromPlan,
    switchUserModalTab, loadAuditLogIntoTab, loadBugReports, updateUserModalTabVisibility, syncMarkerGroups, loadGroupSelectionForModal
  };
})();
