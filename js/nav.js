/**
 * DONZO MILITIA — NAV MODULE
 */
window.DM = window.DM || {};

DM.nav = (() => {
  const PAGES = [
    { href: 'map.html',          label: 'MAP',       icon: '🗺️' },
    { href: 'instructions.html', label: 'MAP GUIDE', icon: '📖' },
    { href: 'crafting.html',     label: 'CRAFTING',  icon: '⚙️'  }
  ];

  function init() {
    const user = DM.auth.requireAuth();
    if (!user) return null;
    const cur = window.location.pathname.split('/').pop() || 'map.html';
    const lvl = ACCESS_LEVELS[user.accessLevel] || {};

    const navEl = document.createElement('div');
    navEl.id = 'nav-wrapper';
    navEl.innerHTML = `
      <nav class="top-nav">
        <div class="nav-brand">
          <img src="DM_2.png" class="nav-logo" alt="DM" onerror="this.style.display='none'">
          <div class="nav-brand-text">
            <span class="nav-org">DONZO MILITIA</span>
            <span class="nav-sub">LOS SANTOS OPS</span>
          </div>
        </div>
        <div class="nav-links">
          ${PAGES.map(p => `<a href="${p.href}" class="nav-link${cur===p.href?' active':''}">${p.icon} ${p.label}</a>`).join('')}
        </div>
        <div class="nav-user">
          <span class="nav-badge" style="color:${lvl.color};border-color:${lvl.color};background:${lvl.bgColor}">
            LVL ${user.accessLevel} — ${lvl.name}
          </span>
          <div class="nav-user-info">
            <span class="nav-name">${user.displayName}</span>
            <span class="nav-uname">@${user.username}</span>
          </div>
          <button class="nav-logout" onclick="DM.auth.logout()">LOGOUT</button>
        </div>
        <button class="nav-burger" onclick="this.nextElementSibling.classList.toggle('open')">☰</button>
      </nav>
      <div class="nav-mobile">
        ${PAGES.map(p => `<a href="${p.href}" class="nav-mobile-link">${p.icon} ${p.label}</a>`).join('')}
        <button onclick="DM.auth.logout()" style="margin:8px;padding:8px;background:none;border:1px solid #2a3824;color:#5a6e52;cursor:pointer;font-family:Oswald,sans-serif;letter-spacing:2px;">LOGOUT</button>
      </div>`;
    document.body.insertBefore(navEl, document.body.firstChild);
    return user;
  }

  return { init };
})();
