/**
 * DONZO MILITIA — FIREBASE CONFIG
 * Credentials are already set. No editing required.
 */

// ─── FIREBASE CREDENTIALS ────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCTkJ-Sd-dV74nJ6_ed-Q9rrPCCSKuC-k4",
  authDomain:        "test1-3-6520d.firebaseapp.com",
  projectId:         "test1-3-6520d",
  storageBucket:     "test1-3-6520d.firebasestorage.app",
  messagingSenderId: "1023664151151",
  appId:             "1:1023664151151:web:eccff674e060eb6c404b9a"
};

// ─── ACCESS LEVELS ───────────────────────────────────────────
const ACCESS_LEVELS = {
  1: { name: 'Recruit',    color: '#8a9a7a', bgColor: 'rgba(138,154,122,0.15)', canAddMarkers: false, canDeleteOwn: false, canDeleteAll: false },
  2: { name: 'Operative',  color: '#4e6443', bgColor: 'rgba(78,100,67,0.15)',   canAddMarkers: false, canDeleteOwn: false, canDeleteAll: false },
  3: { name: 'Lieutenant', color: '#c9a84c', bgColor: 'rgba(201,168,76,0.15)',  canAddMarkers: true,  canDeleteOwn: true,  canDeleteAll: false },
  4: { name: 'Commander',  color: '#c0392b', bgColor: 'rgba(192,57,43,0.15)',   canAddMarkers: true,  canDeleteOwn: true,  canDeleteAll: true  }
};

// ─── VISIBILITY LEVELS ───────────────────────────────────────
const VISIBILITY_LEVELS = {
  1: { label: 'Public',       icon: '🌐', color: '#8a9a7a' },
  2: { label: 'Restricted',   icon: '🔒', color: '#4e6443' },
  3: { label: 'Confidential', icon: '🔐', color: '#c9a84c' },
  4: { label: 'Top Secret',   icon: '⛔', color: '#c0392b' }
};

// ─── MAP IMAGES ──────────────────────────────────────────────
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

// ─── CATEGORY ICONS ──────────────────────────────────────────
const CAT_ICONS = {
  poi:     { icon: '📍', label: 'Point of Interest' },
  base:    { icon: '🏠', label: 'Base / Safe House'  },
  mission: { icon: '🎯', label: 'Mission Location'   },
  loot:    { icon: '💰', label: 'Loot / Stash'       },
  danger:  { icon: '⚠️', label: 'Danger Zone'        },
  vehicle: { icon: '🚗', label: 'Vehicle Spawn'      },
  other:   { icon: '📌', label: 'Other'              }
};

// ─── INIT ────────────────────────────────────────────────────
// Called by each page before anything else runs
function initFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    window.db = firebase.firestore();
    return true;
  } catch (err) {
    console.error('Firebase init failed:', err);
    return false;
  }
}

// Always returns true — config is hardcoded, no setup needed
function isConfigured() {
  return true;
}
