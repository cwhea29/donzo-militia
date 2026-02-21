/**
 * DONZO MILITIA — NAV MODULE
 * Call DM.nav.init() on each protected page to render the top nav.
 * Automatically handles auth check and logout.
 */

window.DM = window.DM || {};

DM.nav = (() => {

  const PAGES = [
    { href: 'map.html',          label: 'MAP',          icon: '🗺️' },
    { href: 'instructions.html', label: 'MAP GUIDE',    icon: '📖' },
    { href: 'crafting.html',     label: 'CRAFTING',     icon: '⚙️' }
  ];

  function getCurrentPage() {
    const path = window.location.pathname;
    const file = path.split('/').pop() || 'map.html';
    return file;
  }

  function getLevelBadgeHTML(user) {
    const lvl = user.accessLevel;
    const info = ACCESS_LEVELS[lvl] || {};
    return `
      <span class="nav-level-badge" style="color:${info.color};border-color:${info.color};background:${info.bgColor}">
        LVL ${lvl} — ${info.name || 'Unknown'}
      </span>
    `;
  }

  function buildNavHTML(user) {
    const currentPage = getCurrentPage();
    const linksHTML = PAGES.map(p => {
      const isActive = currentPage === p.href;
      return `<a href="${p.href}" class="nav-link${isActive ? ' active' : ''}">
        <span class="nav-link-icon">${p.icon}</span>
        <span>${p.label}</span>
      </a>`;
    }).join('');

    return `
      <nav class="top-nav" id="top-nav">
        <div class="nav-brand">
          <img src="DM_2.png" class="nav-logo" alt="DM" onerror="this.style.display='none'">
          <div class="nav-brand-text">
            <span class="nav-org-name">DONZO MILITIA</span>
            <span class="nav-tagline">LOS SANTOS OPERATIONS</span>
          </div>
        </div>

        <div class="nav-links" id="nav-links">
          ${linksHTML}
        </div>

        <div class="nav-user">
          ${getLevelBadgeHTML(user)}
          <div class="nav-user-info">
            <span class="nav-display-name">${user.displayName}</span>
            <span class="nav-username">@${user.username}</span>
          </div>
          <button class="nav-logout-btn" onclick="DM.auth.logout()">LOGOUT</button>
        </div>

        <!-- Mobile hamburger -->
        <button class="nav-hamburger" id="nav-hamburger" onclick="DM.nav.toggleMobile()">
          <span></span><span></span><span></span>
        </button>
      </nav>
      <div class="nav-mobile-menu hidden" id="nav-mobile-menu">
        ${PAGES.map(p => `<a href="${p.href}" class="nav-mobile-link${getCurrentPage()===p.href?' active':''}">${p.icon} ${p.label}</a>`).join('')}
        <div class="nav-mobile-user">
          ${getLevelBadgeHTML(user)}
          <button onclick="DM.auth.logout()">LOGOUT</button>
        </div>
      </div>
    `;
  }

  function init() {
    const user = DM.auth.requireAuth();
    if (!user) return null;

    // Inject nav at top of body
    const navWrapper = document.createElement('div');
    navWrapper.id = 'nav-wrapper';
    navWrapper.innerHTML = buildNavHTML(user);
    document.body.insertBefore(navWrapper, document.body.firstChild);

    return user;
  }

  function toggleMobile() {
    document.getElementById('nav-mobile-menu').classList.toggle('hidden');
  }

  return { init, toggleMobile };

})();
