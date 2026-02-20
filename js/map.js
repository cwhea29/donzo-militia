/**
 * DONZO MILITIA — MAP MODULE
 */
window.DM = window.DM || {};

DM.map = (() => {
  let user, allMarkers = [], currentMarkerId = null;
  let currentMap = 'atlas', currentZone = 'mainland';
  let placingMode = false, pendingCoords = null;
  let scale = 1, panX = 0, panY = 0;
  let isPanning = false, mouseHasMoved = false, lastPX = 0, lastPY = 0;
  let toastTimer, unsubscribe;

  function init(u) {
    user = u;
    setupEvents();
    loadMap();
    unsubscribe = DM.db.listenToMarkers(user, m => {
      allMarkers = m;
      renderMarkers();
      renderSidebar();
      document.getElementById('marker-count').textContent = m.length;
    });
    if (user.canAddMarkers) document.getElementById('place-btn').classList.remove('hidden');
    if (user.accessLevel >= 4) {
      const b = document.getElementById('user-mgmt-btn');
      if (b) b.classList.remove('hidden');
    }
  }

  // ── MAP IMAGE ──
  function loadMap() {
    const img = document.getElementById('map-img');
    const src = MAP_IMAGES[currentZone][currentMap];
    img.style.opacity = '0';
    img.src = src;
    img.onload  = () => { img.style.opacity = '1'; document.getElementById('map-no-img').classList.add('hidden'); };
    img.onerror = () => { document.getElementById('map-no-img').classList.remove('hidden'); };
  }

  function switchMap(key, btn) {
    currentMap = key;
    document.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    loadMap();
  }

  function switchZone(zone, btn) {
    currentZone = zone;
    document.querySelectorAll('.zone-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    scale = 1; panX = 0; panY = 0; applyTransform();
    loadMap(); renderMarkers(); closePopup();
    const zl = document.getElementById('zone-label');
    zl.textContent = zone === 'cayo' ? 'CAYO PERICO' : 'LOS SANTOS';
    zl.className = 'sval' + (zone === 'cayo' ? ' cayo' : '');
  }

  // ── PAN/ZOOM ──
  function setupEvents() {
    const wrap = document.getElementById('map-wrap');
    wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const f = e.deltaY < 0 ? 1.12 : 0.89;
      const ns = Math.max(0.4, Math.min(12, scale * f));
      panX = mx - (mx - panX) * (ns / scale);
      panY = my - (my - panY) * (ns / scale);
      scale = ns; applyTransform();
    }, { passive: false });

    wrap.addEventListener('mousedown', e => {
      if (e.button === 0 && placingMode) return;
      isPanning = true; mouseHasMoved = false;
      lastPX = e.clientX - panX; lastPY = e.clientY - panY;
      wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mousemove', e => {
      if (!isPanning) return;
      mouseHasMoved = true;
      panX = e.clientX - lastPX; panY = e.clientY - lastPY;
      applyTransform();
    });
    window.addEventListener('mouseup', () => {
      isPanning = false;
      const w = document.getElementById('map-wrap');
      if (w) w.style.cursor = placingMode ? 'crosshair' : 'default';
    });

    // Touch pinch zoom
    let lastDist = null;
    wrap.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (lastDist) { scale = Math.max(0.4, Math.min(12, scale * d/lastDist)); applyTransform(); }
        lastDist = d;
      }
    }, { passive: false });
    wrap.addEventListener('touchend', () => lastDist = null);
  }

  function applyTransform() {
    document.getElementById('zoom-layer').style.transform = `translate(${panX}px,${panY}px) scale(${scale})`;
  }

  function resetView() { scale = 1; panX = 0; panY = 0; applyTransform(); }

  // ── CLICK ──
  function onMapClick(e) {
    if (!placingMode || !user.canAddMarkers || mouseHasMoved) return;
    const r = document.getElementById('zoom-layer').getBoundingClientRect();
    pendingCoords = { x: ((e.clientX-r.left)/r.width)*100, y: ((e.clientY-r.top)/r.height)*100 };
    openAddModal();
  }

  function onMouseMove(e) {
    if (!placingMode) return;
    const r = document.getElementById('zoom-layer').getBoundingClientRect();
    document.getElementById('coords-disp').textContent =
      `X: ${(((e.clientX-r.left)/r.width)*100).toFixed(1)}% / Y: ${(((e.clientY-r.top)/r.height)*100).toFixed(1)}%`;
  }

  // ── PLACE MODE ──
  function togglePlaceMode() {
    if (!user.canAddMarkers) return;
    placingMode = !placingMode;
    const btn = document.getElementById('place-btn');
    btn.classList.toggle('active', placingMode);
    btn.textContent = placingMode ? '✕ Cancel' : '📍 Place Marker';
    document.getElementById('map-wrap').style.cursor = placingMode ? 'crosshair' : 'default';
    document.getElementById('sdot').className = 'sdot' + (placingMode ? ' placing' : '');
    document.getElementById('smode').textContent = placingMode ? 'PLACING MARKER' : 'VIEW MODE';
    showToast(placingMode ? 'CLICK MAP TO PLACE A MARKER' : 'PLACING MODE OFF');
  }

  // ── ADD MODAL ──
  function openAddModal() {
    ['m-name','m-desc','m-img'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-cat').value = 'poi';
    document.getElementById('m-vis').value = '1';
    document.getElementById('add-modal').classList.remove('hidden');
    document.getElementById('m-name').focus();
  }

  function closeAddModal() { document.getElementById('add-modal').classList.add('hidden'); pendingCoords = null; }

  async function saveMarker() {
    const name = document.getElementById('m-name').value.trim();
    if (!name) { showToast('Name is required'); return; }
    const btn = document.getElementById('save-marker-btn');
    btn.textContent = 'SAVING...'; btn.disabled = true;
    try {
      await DM.db.addMarker(user, {
        name, zone: currentZone,
        description:    document.getElementById('m-desc').value.trim(),
        imageFile:      document.getElementById('m-img').value.trim(),
        category:       document.getElementById('m-cat').value,
        minAccessLevel: parseInt(document.getElementById('m-vis').value),
        x: pendingCoords.x, y: pendingCoords.y
      });
      closeAddModal();
      if (placingMode) togglePlaceMode();
      showToast('✓ LOCATION SAVED — ' + name.toUpperCase());
    } catch(err) { showToast('Error: ' + err.message); }
    finally { btn.textContent = 'SAVE LOCATION'; btn.disabled = false; }
  }

  // ── MARKERS ──
  function renderMarkers() {
    const layer = document.getElementById('markers-layer');
    layer.innerHTML = '';
    const pinCols = { 1:'#4e6443', 2:'#2a6a8a', 3:'#8a7020', 4:'#8a2020' };
    const strCols = { 1:'#2e3d27', 2:'#1a4a6a', 3:'#5a4a10', 4:'#5a1010' };
    allMarkers.filter(m => m.zone === currentZone).forEach(m => {
      const el = document.createElement('div');
      el.className = 'marker' + (m.zone==='cayo'?' cayo':'');
      el.style.cssText = `left:${m.x}%;top:${m.y}%;`;
      const fill = pinCols[m.minAccessLevel]||pinCols[1];
      const strk = strCols[m.minAccessLevel]||strCols[1];
      const ico  = (CAT_ICONS[m.category]||CAT_ICONS.other).icon;
      el.innerHTML = `<div class="mpin">
        <svg viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 1C7.3 1 1 7.3 1 15c0 11 14 24 14 24S29 26 29 15C29 7.3 22.7 1 15 1z" fill="${fill}" stroke="${strk}" stroke-width="1.5"/>
          <text x="15" y="18" text-anchor="middle" dominant-baseline="middle" font-size="10" font-family="Arial">${ico}</text>
        </svg>
      </div><div class="mpulse"></div>`;
      el.addEventListener('click', e => { e.stopPropagation(); showPopup(m, e); });
      layer.appendChild(el);
    });
  }

  // ── POPUP ──
  function showPopup(m, e) {
    if (placingMode) return;
    currentMarkerId = m.id;
    const isCayo  = m.zone === 'cayo';
    const vis     = VISIBILITY_LEVELS[m.minAccessLevel] || VISIBILITY_LEVELS[1];
    const cat     = CAT_ICONS[m.category] || CAT_ICONS.other;
    const lvl     = ACCESS_LEVELS[m.createdByLevel] || {};
    const popup   = document.getElementById('marker-popup');

    document.getElementById('pp-name').textContent = m.name;
    document.getElementById('pp-name').className = 'pp-name' + (isCayo?' cayo':'');
    document.getElementById('pp-desc').textContent = m.description || '';
    document.getElementById('pp-zone').textContent = isCayo ? '☠ Cayo Perico' : '📍 Los Santos';
    document.getElementById('pp-zone').className = 'pp-zone' + (isCayo?' cayo':'');
    document.getElementById('pp-vis').innerHTML = `<span style="color:${vis.color}">${vis.icon} ${vis.label}</span>`;
    document.getElementById('pp-cat').textContent = cat.label;
    document.getElementById('pp-meta').textContent = `Added by ${m.createdBy||'—'} (${lvl.name||'Unknown'})`;

    const iw = document.getElementById('pp-img');
    iw.innerHTML = m.imageFile
      ? `<img class="pp-img" src="images/locations/${m.imageFile}" alt="${m.name}" onerror="this.parentElement.innerHTML='<div class=pp-nimg>// IMAGE NOT FOUND</div>'">`
      : '<div class="pp-nimg">// NO IMAGE</div>';

    const foot = document.getElementById('pp-footer');
    DM.auth.canDeleteMarker(m, user) ? foot.classList.remove('hidden') : foot.classList.add('hidden');

    popup.classList.remove('hidden');
    const pw=300, ph=420;
    let px = e.clientX+14, py = e.clientY-20;
    if (px+pw > window.innerWidth-10)  px = e.clientX-pw-14;
    if (py+ph > window.innerHeight-10) py = window.innerHeight-ph-10;
    if (py < 70) py = 70;
    popup.style.left = px+'px'; popup.style.top = py+'px';
  }

  function closePopup() { document.getElementById('marker-popup').classList.add('hidden'); currentMarkerId = null; }

  async function deleteMarker() {
    if (!currentMarkerId) return;
    const m = allMarkers.find(x => x.id === currentMarkerId);
    if (!m || !confirm(`Delete "${m.name}"?`)) return;
    try { await DM.db.deleteMarker(user, currentMarkerId, m.createdBy); closePopup(); showToast('LOCATION DELETED'); }
    catch(err) { showToast('Error: ' + err.message); }
  }

  // ── SIDEBAR ──
  function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

  function renderSidebar(filter='') {
    const list = document.getElementById('sb-list');
    const q = filter.toLowerCase();
    const main = allMarkers.filter(m=>m.zone==='mainland');
    const cayo = allMarkers.filter(m=>m.zone==='cayo');
    document.getElementById('stat-main').textContent = main.length;
    document.getElementById('stat-cayo').textContent = cayo.length;
    if (!allMarkers.length) { list.innerHTML='<div class="sb-empty">// NO LOCATIONS YET</div>'; return; }
    const sec = (title, arr) => {
      const f = arr.filter(m=>m.name.toLowerCase().includes(q)||(m.description||'').toLowerCase().includes(q));
      if (!f.length) return '';
      return `<div class="sb-sec">${title} <span>(${f.length})</span></div>`
        + f.map(m=>{
          const vis = VISIBILITY_LEVELS[m.minAccessLevel]||VISIBILITY_LEVELS[1];
          const ico = (CAT_ICONS[m.category]||CAT_ICONS.other).icon;
          return `<div class="sb-item${m.zone==='cayo'?' cayo':''}" onclick="DM.map.jumpTo('${m.id}')">
            <span class="sb-ico">${ico}</span>
            <div><div class="sb-name">${m.name}</div>
            <div class="sb-meta" style="color:${vis.color}">${vis.icon} ${vis.label}</div></div>
          </div>`;
        }).join('');
    };
    const html = sec('LOS SANTOS', main) + sec('☠ CAYO PERICO', cayo);
    list.innerHTML = html || '<div class="sb-empty">// NO RESULTS</div>';
  }

  function jumpTo(id) {
    const m = allMarkers.find(x=>x.id===id); if(!m) return;
    const doJump = () => {
      const wrap = document.getElementById('map-wrap');
      const r = wrap.getBoundingClientRect();
      panX = r.width/2  - (m.x/100)*r.width*scale;
      panY = r.height/2 - (m.y/100)*r.height*scale;
      applyTransform();
      showPopup(m, { clientX:r.left+r.width/2, clientY:r.top+r.height/2, stopPropagation:()=>{} });
    };
    if (m.zone !== currentZone) {
      switchZone(m.zone, document.querySelector(`.zone-tab[data-zone="${m.zone}"]`));
      setTimeout(doJump, 400);
    } else doJump();
    if (window.innerWidth < 768) toggleSidebar();
  }

  // ── USER MGMT ──
  async function openUserMgmt() {
    document.getElementById('user-modal').classList.remove('hidden');
    await refreshUsers();
  }

  function closeUserMgmt() { document.getElementById('user-modal').classList.add('hidden'); }

  async function refreshUsers() {
    const c = document.getElementById('user-list');
    c.innerHTML = '<div style="padding:16px;font-family:monospace;font-size:11px;color:#5a6e52;">// LOADING...</div>';
    try {
      const users = await DM.db.getAllUsers();
      c.innerHTML = users.map(u => {
        const lv = ACCESS_LEVELS[u.accessLevel]||{};
        return `<div class="urow">
          <div><div class="uname">${u.displayName||u.username}</div><div class="uun">@${u.username}</div></div>
          <select class="ulvl" data-id="${u.id}" onchange="DM.map.changeLevel(this)">
            ${[1,2,3,4].map(l=>`<option value="${l}" ${u.accessLevel===l?'selected':''}>${l} — ${ACCESS_LEVELS[l].name}</option>`).join('')}
          </select>
          <button class="udel" onclick="DM.map.removeUser('${u.id}','${u.username}')">✕</button>
        </div>`;
      }).join('') || '<div style="padding:16px;font-size:12px;color:#5a6e52;">No users found</div>';
    } catch(err) { c.innerHTML = `<div style="padding:16px;color:#c0392b;font-size:12px;">${err.message}</div>`; }
  }

  async function addUser() {
    const un=document.getElementById('nu-un').value.trim();
    const pw=document.getElementById('nu-pw').value;
    const dn=document.getElementById('nu-dn').value.trim();
    const lv=document.getElementById('nu-lv').value;
    if (!un||!pw) { showToast('Username and password required'); return; }
    try {
      await DM.db.addUser(user,{username:un,password:pw,displayName:dn,accessLevel:lv});
      ['nu-un','nu-pw','nu-dn'].forEach(id=>document.getElementById(id).value='');
      showToast('✓ USER ADDED: '+un.toUpperCase()); await refreshUsers();
    } catch(err) { showToast('Error: '+err.message); }
  }

  async function changeLevel(sel) {
    try { await DM.db.updateUserLevel(user, sel.dataset.id, sel.value); showToast('✓ Level updated'); }
    catch(err) { showToast('Error: '+err.message); }
  }

  async function removeUser(id, un) {
    if (!confirm(`Remove "${un}"?`)) return;
    try { await DM.db.deleteUser(user,id); showToast('User removed'); await refreshUsers(); }
    catch(err) { showToast('Error: '+err.message); }
  }

  // ── TOAST ──
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>t.classList.remove('show'), 2800);
  }

  document.addEventListener('click', e => {
    const p = document.getElementById('marker-popup');
    if (p && !p.classList.contains('hidden') && !p.contains(e.target)) closePopup();
  });

  return { init, switchMap, switchZone, togglePlaceMode, onMapClick, onMouseMove,
           closeAddModal, saveMarker, toggleSidebar, renderSidebar, jumpTo, closePopup,
           deleteMarker, openUserMgmt, closeUserMgmt, addUser, changeLevel, removeUser, resetView };
})();
