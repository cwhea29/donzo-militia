/** DONZO — NAV */
DM.nav = (() => {
  const PAGES = [
    { href:'map.html',          label:'MAP',       icon:'🗺️' },
    { href:'instructions.html', label:'MAP GUIDE', icon:'📖' },
    { href:'crafting.html',     label:'CRAFTING',  icon:'⚙️'  }
  ];

  function init() {
    const user = DM.auth.require();
    if (!user) return null;

    const cur = location.pathname.split('/').pop() || 'map.html';
    const lvl = ACCESS[user.level] || {};

    const el = document.createElement('div');
    el.id = 'nav-root';
    el.innerHTML = `
      <nav class="top-nav">
        <div class="nav-brand">
          <img class="nav-logo" src="images/DM_2.png" alt="Donzo" onerror="this.style.display='none'">
          <div>
            <div class="nav-org">DONZO</div>
            <div class="nav-sub">Ops Map</div>
          </div>
        </div>
        <div class="nav-links">
          ${PAGES.map(p=>`<a href="${p.href}" class="nav-link${cur===p.href?' active':''}">${p.icon} ${p.label}</a>`).join('')}
          ${user.level >= 8 && !user.canManageUsers ? `<a href="#" onclick="DM.map.openAuditLogFromNav(); return false;" class="nav-link">📜 AUDIT LOG</a>` : ''}
          ${user.level >= 8 && !user.canManageUsers ? `<a href="#" onclick="DM.map.openBugsFromNav(); return false;" class="nav-link">🐛 BUGS</a>` : ''}
        </div>
        <div class="nav-right">
          <span class="nav-badge" style="color:${lvl.color};border-color:${lvl.color};background:${lvl.bg}">
            LVL ${user.level} — ${lvl.name}
          </span>
          <div class="nav-uinfo">
            <span class="nav-name">${user.display}</span>
            <span class="nav-uname">@${user.username}</span>
          </div>
          <button class="nav-logout" onclick="DM.auth.logout()">LOGOUT</button>
        </div>
        <button class="nav-burger" onclick="document.getElementById('nav-drawer').classList.toggle('open')">☰</button>
      </nav>
      <div class="nav-drawer" id="nav-drawer">
        ${PAGES.map(p=>`<a href="${p.href}" onclick="document.getElementById('nav-drawer').classList.remove('open')">${p.icon} ${p.label}</a>`).join('')}
        ${user.level >= 8 && !user.canManageUsers ? `<a href="#" onclick="DM.map.openAuditLogFromNav(); document.getElementById('nav-drawer').classList.remove('open'); return false;">📜 AUDIT LOG</a>` : ''}
        ${user.level >= 8 && !user.canManageUsers ? `<a href="#" onclick="DM.map.openBugsFromNav(); document.getElementById('nav-drawer').classList.remove('open'); return false;">🐛 BUGS</a>` : ''}
        <div class="nav-drawer-foot">
          <span class="nav-badge" style="color:${lvl.color};border-color:${lvl.color};background:${lvl.bg}">LVL ${user.level} — ${lvl.name}</span>
          <button class="nav-logout" onclick="DM.auth.logout()">LOGOUT</button>
        </div>
      </div>`;
    document.body.insertBefore(el, document.body.firstChild);
    return user;
  }

  return { init };
})();
