/**
 * DONZO MILITIA — DYNAMIC CONFIG
 * Reads Firebase config from localStorage (set by setup wizard).
 * No manual code editing required.
 */

// ─── CONSTANTS (never need editing) ──────────────────────
const ACCESS_LEVELS = {
  1: { name: 'Recruit',     color: '#8a9a7a', bgColor: 'rgba(138,154,122,0.15)', canAddMarkers: false, canDeleteOwn: false, canDeleteAll: false },
  2: { name: 'Operative',   color: '#4e6443', bgColor: 'rgba(78,100,67,0.15)',   canAddMarkers: false, canDeleteOwn: false, canDeleteAll: false },
  3: { name: 'Lieutenant',  color: '#c9a84c', bgColor: 'rgba(201,168,76,0.15)',  canAddMarkers: true,  canDeleteOwn: true,  canDeleteAll: false },
  4: { name: 'Commander',   color: '#c0392b', bgColor: 'rgba(192,57,43,0.15)',   canAddMarkers: true,  canDeleteOwn: true,  canDeleteAll: true  }
};

const VISIBILITY_LEVELS = {
  1: { label: 'Public',       icon: '🌐', color: '#8a9a7a' },
  2: { label: 'Restricted',   icon: '🔒', color: '#4e6443' },
  3: { label: 'Confidential', icon: '🔐', color: '#c9a84c' },
  4: { label: 'Top Secret',   icon: '⛔', color: '#c0392b' }
};

const MAP_IMAGES = {
  mainland: {
    atlas:     'images/maps/GTAV_ATLUS.jpg',
    roadmap:   'images/maps/GTAV-HD-MAP-roadmap.jpg',
    satellite: 'images/maps/GTAV-HD-MAP-satellite.jpg'
  },
  cayo: {
    atlas:     'images/maps/GTAV-CAYO-atlas.jpg',
    roadmap:   'images/maps/GTAV-CAYO-roadmap.jpg',
    satellite: 'images/maps/GTAV-CAYO-satellite.jpg'
  }
};

const CAT_ICONS = {
  poi:     { icon: '📍', label: 'Point of Interest' },
  base:    { icon: '🏠', label: 'Base / Safe House'  },
  mission: { icon: '🎯', label: 'Mission Location'   },
  loot:    { icon: '💰', label: 'Loot / Stash'       },
  danger:  { icon: '⚠️', label: 'Danger Zone'        },
  vehicle: { icon: '🚗', label: 'Vehicle Spawn'      },
  other:   { icon: '📌', label: 'Other'              }
};

// ─── LOAD FIREBASE CONFIG FROM STORAGE ───────────────────
window.DM_CONFIG = null;

function loadFirebaseConfig() {
  try {
    const raw = localStorage.getItem('dm_firebase_config');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function isConfigured() {
  const cfg = loadFirebaseConfig();
  return cfg && cfg.apiKey && cfg.projectId;
}

// ─── INIT FIREBASE (called by each page) ─────────────────
function initFirebase() {
  const cfg = loadFirebaseConfig();
  if (!cfg || !cfg.apiKey) {
    // Redirect to setup if not configured
    if (!window.location.pathname.endsWith('setup.html')) {
      window.location.href = 'setup.html';
    }
    return false;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }
    window.db = firebase.firestore();
    return true;
  } catch (err) {
    console.error('Firebase init failed:', err);
    return false;
  }
}
