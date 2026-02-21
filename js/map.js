/**
 * DONZO MILITIA — MAP MODULE
 * All map logic: pan/zoom, marker rendering, popup, sidebar, zone switching.
 */

window.DM = window.DM || {};

DM.map = (() => {

  // ─── STATE ────────────────────────────────────────────────
  let currentUser     = null;
  let allMarkers      = [];
  let currentMarkerId = null;
  let currentMap      = 'atlas';
  let currentZone     = 'mainland';
  let placingMode     = false;
  let pendingCoords   = null;
  let unsubscribeDB   = null;

  // Pan/zoom
  let scale = 1, panX = 0, panY = 0;
  let isPanning = false, mouseHasMoved = false;
  let lastPanX = 0, lastPanY = 0;

  // ─── INIT ─────────────────────────────────────────────────
  function init(user) {
    currentUser = user;
    setupMapEvents();
    loadMapImage();
    startMarkerSync();

    // Show place-marker button if user has permission
    if (user.canAddMarkers) {
      document.getElementById('place-btn').classList.remove('hidden');
    }

    // Show user management if Commander
    if (user.accessLevel >= 4) {
      const mgmtBtn = document.getElementById('user-mgmt-btn');
      if (mgmtBtn) mgmtBtn.classList.remove('hidden');
    }

    updateStatusBar();
  }

  // ─── REAL-TIME MARKER SYNC ────────────────────────────────
  function startMarkerSync() {
    if (unsubscribeDB) unsubscribeDB();
    unsubscribeDB = DM.db.listenToMarkers(currentUser, markers => {
      allMarkers = markers;
      renderMarkers();
      renderSidebar();
      document.getElementById('marker-count').textContent = markers.length;
    });
  }

  // ─── MAP IMAGE ────────────────────────────────────────────
  function loadMapImage() {
    const img   = document.getElementById('map-img');
    const src   = MAP_IMAGES[currentZone][currentMap];
    img.style.opacity = '0';
    img.src = src;
    img.onload  = () => {
      img.style.opacity = '1';
      document.getElementById('map-no-image').classList.add('hidden');
    };
    img.onerror = () => {
      document.getElementById('map-no-image').classList.remove('hidden');
    };
  }

  function switchMap(key, btn) {
    currentMap = key;
    document.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    loadMapImage();
    // Markers stay — only image changes
  }

  function switchZone(zone, btn) {
    currentZone = zone;
    document.querySelectorAll('.zone-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    scale = 1; panX = 0; panY = 0;
    applyTransform();
    loadMapImage();
    renderMarkers();
    closePopup();
    updateStatusBar();
  }

  // ─── PAN & ZOOM ───────────────────────────────────────────
  function setupMapEvents() {
    const wrap = document.getElementById('map-wrap');

    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const ns = Math.max(0.4, Math.min(12, scale * factor));
      panX = mx - (mx - panX) * (ns / scale);
      panY = my - (my - panY) * (ns / scale);
      scale = ns;
      applyTransform();
    }, { passive: false });

    wrap.addEventListener('mousedown', e => {
      if (e.button === 2) { e.preventDefault(); return; }
      if (e.button === 0 && placingMode) return;
      isPanning = true;
      mouseHasMoved = false;
      lastPanX = e.clientX - panX;
      lastPanY = e.clientY - panY;
      wrap.style.cursor = 'grabbing';
    });

    wrap.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('mousemove', e => {
      if (!isPanning) return;
      mouseHasMoved = true;
      panX = e.clientX - lastPanX;
      panY = e.clientY - lastPanY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
      const wrap = document.getElementById('map-wrap');
      if (wrap) wrap.style.cursor = placingMode ? 'crosshair' : 'default';
    });

    // Touch support (basic pinch zoom)
    let lastTouchDist = null;
    wrap.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (lastTouchDist) {
          const factor = dist / lastTouchDist;
          scale = Math.max(0.4, Math.min(12, scale * factor));
          applyTransform();
        }
        lastTouchDist = dist;
      }
    }, { passive: false });
    wrap.addEventListener('touchend', () => { lastTouchDist = null; });
  }

  function applyTransform() {
    document.getElementById('zoom-layer').style.transform =
      `translate(${panX}px,${panY}px) scale(${scale})`;
  }

  function resetView() {
    scale = 1; panX = 0; panY = 0;
    applyTransform();
  }

  // ─── MAP CLICK ────────────────────────────────────────────
  function onMapClick(e) {
    if (!placingMode || !currentUser.canAddMarkers) return;
    if (mouseHasMoved) return;
    const layer = document.getElementById('zoom-layer');
    const r     = layer.getBoundingClientRect();
    const pctX  = ((e.clientX - r.left) / r.width)  * 100;
    const pctY  = ((e.clientY - r.top)  / r.height) * 100;
    pendingCoords = { x: pctX, y: pctY };
    openAddModal();
  }

  function onMapMouseMove(e) {
    if (!placingMode) return;
    const layer = document.getElementById('zoom-layer');
    const r = layer.getBoundingClientRect();
    const px = (((e.clientX - r.left) / r.width)  * 100).toFixed(1);
    const py = (((e.clientY - r.top)  / r.height) * 100).toFixed(1);
    document.getElementById('coords-display').textContent = `X: ${px}% / Y: ${py}%`;
  }

  // ─── PLACE MODE ───────────────────────────────────────────
  function togglePlaceMode() {
    if (!currentUser.canAddMarkers) return;
    placingMode = !placingMode;
    const btn = document.getElementById('place-btn');
    btn.classList.toggle('active', placingMode);
    btn.textContent = placingMode ? '✕ Cancel' : '📍 Place Marker';
    document.getElementById('map-wrap').style.cursor = placingMode ? 'crosshair' : 'default';
    document.getElementById('status-dot').className = 'status-dot' + (placingMode ? ' placing' : '');
    document.getElementById('mode-label').textContent = placingMode ? 'PLACING MARKER' : 'VIEW MODE';
    showToast(placingMode ? 'CLICK ON THE MAP TO PLACE A MARKER' : 'PLACING MODE OFF');
  }

  // ─── ADD MARKER MODAL ─────────────────────────────────────
  function openAddModal() {
    document.getElementById('add-modal').classList.remove('hidden');
    document.getElementById('m-name').value = '';
    document.getElementById('m-desc').value = '';
    document.getElementById('m-img').value  = '';
    document.getElementById('m-cat').value  = 'poi';
    document.getElementById('m-vis').value  = '1';
    document.getElementById('m-name').focus();
  }

  function closeAddModal() {
    document.getElementById('add-modal').classList.add('hidden');
    pendingCoords = null;
  }

  async function saveMarker() {
    const name = document.getElementById('m-name').value.trim();
    if (!name) { showToast('// NAME IS REQUIRED'); return; }
    if (!pendingCoords) return;

    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.textContent = 'SAVING...';
    saveBtn.disabled = true;

    try {
      await DM.db.addMarker(currentUser, {
        name,
        description:    document.getElementById('m-desc').value.trim(),
        imageFile:      document.getElementById('m-img').value.trim(),
        category:       document.getElementById('m-cat').value,
        zone:           currentZone,
        x:              pendingCoords.x,
        y:              pendingCoords.y,
        minAccessLevel: parseInt(document.getElementById('m-vis').value)
      });
      closeAddModal();
      if (placingMode) togglePlaceMode();
      showToast('✓ LOCATION SAVED — ' + name.toUpperCase());
    } catch (err) {
      showToast('ERROR: ' + err.message);
    } finally {
      saveBtn.textContent = 'SAVE LOCATION';
      saveBtn.disabled = false;
    }
  }

  // ─── RENDER MARKERS ───────────────────────────────────────
  function renderMarkers() {
    const layer = document.getElementById('markers-layer');
    layer.innerHTML = '';

    const zoneMarkers = allMarkers.filter(m => m.zone === currentZone);

    zoneMarkers.forEach(m => {
      const isCayo   = m.zone === 'cayo';
      const visInfo  = VISIBILITY_LEVELS[m.minAccessLevel] || VISIBILITY_LEVELS[1];
      const catInfo  = CAT_ICONS[m.category] || CAT_ICONS.other;

      // Pin colour based on visibility level
      const pinColors = {
        1: { fill: '#4e6443', stroke: '#2e3d27' },
        2: { fill: '#3a5a6a', stroke: '#1a3a4a' },
        3: { fill: '#9a7a2a', stroke: '#6a5a1a' },
        4: { fill: '#8a2020', stroke: '#5a1010' }
      };
      const colors = pinColors[m.minAccessLevel] || pinColors[1];

      const el = document.createElement('div');
      el.className = 'marker' + (isCayo ? ' cayo' : '');
      el.style.left   = m.x + '%';
      el.style.top    = m.y + '%';
      el.dataset.id   = m.id;
      el.dataset.zone = m.zone;

      el.innerHTML = `
        <div class="marker-pin-wrap">
          <svg viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 1C7.27 1 1 7.27 1 15c0 11 14 24 14 24S29 26 29 15C29 7.27 22.73 1 15 1z"
                  fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5"/>
            <text x="15" y="18" text-anchor="middle" dominant-baseline="middle"
                  font-size="10" font-family="Arial">${catInfo.icon}</text>
          </svg>
        </div>
        <div class="marker-pulse"></div>`;

      el.addEventListener('click', e => {
        e.stopPropagation();
        showPopup(m, e);
      });

      layer.appendChild(el);
    });
  }

  // ─── POPUP ────────────────────────────────────────────────
  function showPopup(m, e) {
    if (placingMode) return;
    currentMarkerId = m.id;
    const popup = document.getElementById('marker-popup');

    const isCayo  = m.zone === 'cayo';
    const visInfo = VISIBILITY_LEVELS[m.minAccessLevel] || VISIBILITY_LEVELS[1];
    const catInfo = CAT_ICONS[m.category] || CAT_ICONS.other;
    const lvlInfo = ACCESS_LEVELS[m.createdByLevel] || {};

    // Name
    const pn = document.getElementById('popup-name');
    pn.textContent = m.name;
    pn.className = 'popup-name' + (isCayo ? ' cayo-name' : '');

    // Description
    document.getElementById('popup-desc').textContent = m.description || '';

    // Image
    const iw = document.getElementById('popup-img-wrap');
    if (m.imageFile) {
      iw.innerHTML = `<img class="popup-img" src="images/locations/${m.imageFile}" alt="${m.name}"
        onerror="this.parentElement.innerHTML='<div class=\\'popup-img-placeholder\\'>//&nbsp;IMAGE&nbsp;NOT&nbsp;FOUND</div>'">`;
    } else {
      iw.innerHTML = '<div class="popup-img-placeholder">// NO IMAGE</div>';
    }

    // Zone badge
    const zb = document.getElementById('popup-zone-badge');
    zb.textContent = isCayo ? '☠ Cayo Perico' : '📍 Los Santos';
    zb.className = 'popup-zone-badge' + (isCayo ? ' cayo' : '');

    // Visibility & meta
    document.getElementById('popup-vis').innerHTML =
      `<span style="color:${visInfo.color}">${visInfo.icon} ${visInfo.label}</span>`;
    document.getElementById('popup-cat').textContent = catInfo.label;
    document.getElementById('popup-meta').textContent =
      `Added by ${m.createdBy || '—'} (${lvlInfo.name || 'Unknown'})`;

    // Delete button
    const footer = document.getElementById('popup-footer');
    const delBtn = document.getElementById('popup-delete');
    if (DM.auth.canDeleteMarker(m, currentUser)) {
      footer.classList.remove('hidden');
      delBtn.dataset.createdBy = m.createdBy;
    } else {
      footer.classList.add('hidden');
    }

    popup.classList.remove('hidden');

    // Position popup smartly
    const pw = 300, ph = 400;
    let px = e.clientX + 14;
    let py = e.clientY - 20;
    if (px + pw > window.innerWidth  - 10) px = e.clientX - pw - 14;
    if (py + ph > window.innerHeight - 10) py = window.innerHeight - ph - 10;
    if (py < 70) py = 70;
    popup.style.left = px + 'px';
    popup.style.top  = py + 'px';
  }

  function closePopup() {
    document.getElementById('marker-popup').classList.add('hidden');
    currentMarkerId = null;
  }

  async function deleteCurrentMarker() {
    if (!currentMarkerId) return;
    const marker = allMarkers.find(m => m.id === currentMarkerId);
    if (!marker) return;
    if (!confirm(`Delete "${marker.name}"?`)) return;

    try {
      await DM.db.deleteMarker(currentUser, currentMarkerId, marker.createdBy);
      closePopup();
      showToast('LOCATION DELETED');
    } catch (err) {
      showToast('ERROR: ' + err.message);
    }
  }

  // ─── SIDEBAR ─────────────────────────────────────────────
  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }

  function renderSidebar(filter = '') {
    const list = document.getElementById('sidebar-list');
    const q    = filter.toLowerCase();

    const mainlandM = allMarkers.filter(m => m.zone === 'mainland');
    const cayoM     = allMarkers.filter(m => m.zone === 'cayo');

    document.getElementById('stat-mainland').textContent = mainlandM.length;
    document.getElementById('stat-cayo').textContent     = cayoM.length;

    if (allMarkers.length === 0) {
      list.innerHTML = '<div class="sidebar-empty">// NO LOCATIONS ADDED YET</div>';
      return;
    }

    const renderSection = (title, markers) => {
      const filtered = markers.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q)
      );
      if (!filtered.length) return '';
      const visInfo  = (m) => VISIBILITY_LEVELS[m.minAccessLevel] || VISIBILITY_LEVELS[1];
      const catIcon  = (m) => (CAT_ICONS[m.category] || CAT_ICONS.other).icon;
      return `
        <div class="sidebar-section-header">${title} <span>(${filtered.length})</span></div>
        ${filtered.map(m => `
          <div class="sidebar-item${m.zone==='cayo'?' cayo-item':''}" onclick="DM.map.jumpToMarker('${m.id}')">
            <span class="si-icon">${catIcon(m)}</span>
            <div class="si-body">
              <div class="si-name">${m.name}</div>
              <div class="si-meta">
                <span style="color:${visInfo(m).color};font-size:9px;">${visInfo(m).icon} ${visInfo(m).label}</span>
              </div>
            </div>
          </div>`).join('')}`;
    };

    const html = renderSection('LOS SANTOS', mainlandM) +
                 renderSection('☠ CAYO PERICO', cayoM);
    list.innerHTML = html ||
      '<div class="sidebar-empty">// NO RESULTS</div>';
  }

  function jumpToMarker(id) {
    const m = allMarkers.find(x => x.id === id);
    if (!m) return;

    const doJump = () => {
      const wrap = document.getElementById('map-wrap');
      const rect = wrap.getBoundingClientRect();
      // Center on marker
      panX = rect.width  / 2 - (m.x / 100) * rect.width  * scale;
      panY = rect.height / 2 - (m.y / 100) * rect.height * scale;
      applyTransform();
      // Show popup near center
      const fakeE = {
        clientX: rect.left + rect.width  / 2,
        clientY: rect.top  + rect.height / 2,
        stopPropagation: () => {}
      };
      showPopup(m, fakeE);
    };

    if (m.zone !== currentZone) {
      const btn = document.querySelector(`.zone-tab[data-zone="${m.zone}"]`);
      if (btn) switchZone(m.zone, btn);
      setTimeout(doJump, 400);
    } else {
      doJump();
    }
    // Close sidebar on mobile
    if (window.innerWidth < 768) toggleSidebar();
  }

  // ─── USER MANAGEMENT MODAL (Commander) ───────────────────
  async function openUserMgmt() {
    if (currentUser.accessLevel < 4) return;
    const modal = document.getElementById('user-modal');
    modal.classList.remove('hidden');
    await refreshUserList();
  }

  function closeUserMgmt() {
    document.getElementById('user-modal').classList.add('hidden');
  }

  async function refreshUserList() {
    const container = document.getElementById('user-list');
    container.innerHTML = '<div class="loading-text">// LOADING...</div>';
    try {
      const users = await DM.db.getAllUsers();
      container.innerHTML = users.map(u => {
        const lvl = ACCESS_LEVELS[u.accessLevel] || {};
        return `
          <div class="user-row">
            <div class="user-row-info">
              <span class="user-row-name">${u.displayName || u.username}</span>
              <span class="user-row-username">@${u.username}</span>
            </div>
            <select class="user-level-select" data-id="${u.id}" onchange="DM.map.updateUserLevel(this)">
              ${[1,2,3,4].map(l =>
                `<option value="${l}" ${u.accessLevel===l?'selected':''}>${l} — ${ACCESS_LEVELS[l].name}</option>`
              ).join('')}
            </select>
            <button class="user-delete-btn" onclick="DM.map.removeUser('${u.id}','${u.username}')">✕</button>
          </div>`;
      }).join('') || '<div class="loading-text">No users found.</div>';
    } catch (err) {
      container.innerHTML = `<div class="loading-text">Error: ${err.message}</div>`;
    }
  }

  async function addNewUser() {
    const un  = document.getElementById('nu-username').value.trim();
    const pw  = document.getElementById('nu-password').value;
    const dn  = document.getElementById('nu-display').value.trim();
    const lvl = document.getElementById('nu-level').value;
    if (!un || !pw) { showToast('USERNAME AND PASSWORD REQUIRED'); return; }
    try {
      await DM.db.addUser(currentUser, { username: un, password: pw, displayName: dn, accessLevel: lvl });
      document.getElementById('nu-username').value = '';
      document.getElementById('nu-password').value = '';
      document.getElementById('nu-display').value  = '';
      showToast('✓ USER ADDED: ' + un.toUpperCase());
      await refreshUserList();
    } catch (err) {
      showToast('ERROR: ' + err.message);
    }
  }

  async function updateUserLevel(select) {
    try {
      await DM.db.updateUserLevel(currentUser, select.dataset.id, select.value);
      showToast('✓ ACCESS LEVEL UPDATED');
    } catch (err) {
      showToast('ERROR: ' + err.message);
    }
  }

  async function removeUser(userId, username) {
    if (!confirm(`Remove user "${username}"?`)) return;
    try {
      await DM.db.deleteUser(currentUser, userId);
      showToast('USER REMOVED');
      await refreshUserList();
    } catch (err) {
      showToast('ERROR: ' + err.message);
    }
  }

  // ─── STATUS / TOAST ───────────────────────────────────────
  function updateStatusBar() {
    const zl = document.getElementById('zone-label');
    if (currentZone === 'cayo') {
      zl.textContent = 'CAYO PERICO';
      zl.className   = 'status-val cayo';
    } else {
      zl.textContent = 'LOS SANTOS';
      zl.className   = 'status-val';
    }
  }

  let toastTimer;
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // Close popup when clicking outside
  document.addEventListener('click', e => {
    const popup = document.getElementById('marker-popup');
    if (popup && !popup.classList.contains('hidden') && !popup.contains(e.target)) {
      closePopup();
    }
  });

  return {
    init,
    switchMap,
    switchZone,
    togglePlaceMode,
    onMapClick,
    onMapMouseMove,
    closeAddModal,
    saveMarker,
    toggleSidebar,
    renderSidebar,
    jumpToMarker,
    closePopup,
    deleteCurrentMarker,
    openUserMgmt,
    closeUserMgmt,
    addNewUser,
    updateUserLevel,
    removeUser,
    resetView
  };

})();
