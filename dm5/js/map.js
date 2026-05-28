/** DONZO MILITIA — MAP MODULE */
DM.map = (() => {
  let user, markers = [], activeId = null;
  let curMap = 'atlas', curZone = 'mainland', placing = false, pending = null;
  let scale = 1, px = 0, py = 0;
  let panning = false, moved = false, lpx = 0, lpy = 0;
  let toastT, pendingImageUrl = null;

  function el(id) { return document.getElementById(id); }

  // ── INIT ────────────────────────────────────────────────
  function init(u) {
    user = u;
    setupEvents();
    loadMap();
    if (DM.db && DM.db.listenMarkers) {
      DM.db.listenMarkers(user, m => {
        markers = m;
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
    loadMap(); renderMarkers(); closePopup();
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

  // ── ADD MODAL ────────────────────────────────────────────
  function openAddModal() {
    el('m-name').value = '';
    el('m-desc').value = '';
    el('m-cat').value  = 'poi';
    el('m-vis').value  = '1';
    pendingImageUrl    = null;
    resetImageUpload();
    el('add-modal').classList.remove('hidden');
    el('m-name').focus();
  }

  function closeAddModal() {
    el('add-modal').classList.add('hidden');
    pending = null;
    pendingImageUrl = null;
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
    if (!pending) return;

    // Check image still uploading
    if (el('img-file').files[0] && !pendingImageUrl) {
      toast('Wait for image upload to finish'); return;
    }

    const btn = el('save-btn');
    btn.innerHTML = '<span class="spin"></span>SAVING...'; btn.disabled = true;

    try {
      await DM.db.addMarker(user, {
        name,
        zone:        curZone,
        description: el('m-desc').value.trim(),
        imageUrl:    pendingImageUrl || '',
        category:    el('m-cat').value,
        minLevel:    el('m-vis').value,
        x: pending.x, y: pending.y
      });
      closeAddModal();
      if (placing) togglePlace();
      toast('✓ LOCATION SAVED — ' + name.toUpperCase());
    } catch (e) { 
      console.error('Failed to save marker:', e);
      toast('Error saving location: ' + e.message + ' (Check if RLS is disabled on markers table)'); 
    }
    finally { btn.textContent = 'SAVE LOCATION'; btn.disabled = false; }
  }

  // ── RENDER MARKERS ───────────────────────────────────────
  function renderMarkers() {
    const layer = el('marker-layer');
    layer.innerHTML = '';
    const fills = { 1:'#4e6443', 2:'#2a6a8a', 3:'#8a7020', 4:'#8a2020' };
    const strks = { 1:'#2e3d27', 2:'#1a4a6a', 3:'#5a4a10', 4:'#5a1010' };
    markers.filter(m => m.zone === curZone).forEach(m => {
      const div = document.createElement('div');
      div.className = 'marker' + (m.zone==='cayo'?' cayo':'');
      div.style.cssText = `left:${m.x}%;top:${m.y}%;`;
      const ico = (CATS[m.category] || CATS.other).icon;
      const f   = fills[m.min_access_level] || fills[1];
      const s   = strks[m.min_access_level] || strks[1];
      div.innerHTML = `<div class="mpin">
        <svg viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 1C7.3 1 1 7.3 1 15c0 11 14 24 14 24S29 26 29 15C29 7.3 22.7 1 15 1z" fill="${f}" stroke="${s}" stroke-width="1.5"/>
          <text x="15" y="18" text-anchor="middle" dominant-baseline="middle" font-size="10" font-family="Arial">${ico}</text>
        </svg></div><div class="mpulse"></div>`;
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

    // Image — now a URL from Supabase Storage
    const iw = el('pp-img');
    iw.innerHTML = m.image_url
      ? `<img class="popup-img" src="${m.image_url}" alt="${m.name}" onerror="this.parentElement.innerHTML='<div class=popup-noimg>// IMAGE NOT FOUND</div>'">`
      : '<div class="popup-noimg">// NO IMAGE</div>';

    DM.auth.canDelete(m, user)
      ? el('pp-foot').classList.remove('hidden')
      : el('pp-foot').classList.add('hidden');

    popup.classList.remove('hidden');
    const pw=300, ph=420;
    let lx = e.clientX+14, ly = e.clientY-20;
    if (lx+pw > innerWidth -10) lx = e.clientX-pw-14;
    if (ly+ph > innerHeight-10) ly = innerHeight-ph-10;
    if (ly < 70) ly = 70;
    popup.style.left = lx+'px'; popup.style.top = ly+'px';
  }

  function closePopup() { el('popup').classList.add('hidden'); activeId = null; }

  async function deleteMarker() {
    if (!activeId) return;
    const m = markers.find(x => x.id === activeId);
    if (!m || !confirm(`Delete "${m.name}"?`)) return;
    try { await DM.db.deleteMarker(user, m); closePopup(); toast('LOCATION DELETED'); }
    catch (e) { toast('Error: ' + e.message); }
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
      const f = arr.filter(m => m.name.toLowerCase().includes(q) || (m.description||'').toLowerCase().includes(q));
      if (!f.length) return '';
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
    await refreshUsers();
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
    deleteMarker, openUsers, closeUsers, addUser, changeLevel, removeUser, resetView,
    useFallbackMap
  };
})();
