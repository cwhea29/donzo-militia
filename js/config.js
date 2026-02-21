/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║   DONZO MILITIA — FIREBASE CONFIGURATION                  ║
 * ║                                                           ║
 * ║   SETUP STEPS:                                            ║
 * ║   1. Go to https://console.firebase.google.com           ║
 * ║   2. Create a new project (e.g. "donzo-militia-map")     ║
 * ║   3. Click "Web" app icon to register a web app          ║
 * ║   4. Copy your firebaseConfig object below               ║
 * ║   5. Go to Firestore Database → Create database          ║
 * ║      → Start in TEST MODE                                ║
 * ║   6. Then add your first Commander user via the          ║
 * ║      Firebase Console → Firestore → "users" collection   ║
 * ║                                                           ║
 * ║   FIRST USER (add manually in Firestore Console):        ║
 * ║   Collection: users                                       ║
 * ║   Document fields:                                        ║
 * ║     username:    "commander"                              ║
 * ║     password:    "yourpassword"                           ║
 * ║     displayName: "Commander"                              ║
 * ║     accessLevel: 4                                        ║
 * ╚══════════════════════════════════════════════════════════╝
 */

const firebaseConfig = {
  apiKey:            "AIzaSyCTkJ-Sd-dV74nJ6_ed-Q9rrPCCSKuC-k4",
  authDomain:        "test1-3-6520d.firebaseapp.com",
  projectId:         "test1-3-6520d",
  storageBucket:     "test1-3-6520d.firebasestorage.app",
  messagingSenderId: "1023664151151",
  appId:             "1:1023664151151:web:eccff674e060eb6c404b9a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ─── ACCESS LEVELS ──────────────────────────────────────────
const ACCESS_LEVELS = {
  1: {
    name:          'Recruit',
    color:         '#8a9a7a',
    bgColor:       'rgba(138,154,122,0.15)',
    canAddMarkers: false,
    canDeleteOwn:  false,
    canDeleteAll:  false
  },
  2: {
    name:          'Operative',
    color:         '#4e6443',
    bgColor:       'rgba(78,100,67,0.15)',
    canAddMarkers: false,
    canDeleteOwn:  false,
    canDeleteAll:  false
  },
  3: {
    name:          'Lieutenant',
    color:         '#c9a84c',
    bgColor:       'rgba(201,168,76,0.15)',
    canAddMarkers: true,
    canDeleteOwn:  true,
    canDeleteAll:  false
  },
  4: {
    name:          'Commander',
    color:         '#c0392b',
    bgColor:       'rgba(192,57,43,0.15)',
    canAddMarkers: true,
    canDeleteOwn:  true,
    canDeleteAll:  true
  }
};

// ─── MARKER VISIBILITY LABELS ───────────────────────────────
const VISIBILITY_LEVELS = {
  1: { label: 'Public',      icon: '🌐', color: '#8a9a7a' },
  2: { label: 'Restricted',  icon: '🔒', color: '#4e6443' },
  3: { label: 'Confidential',icon: '🔐', color: '#c9a84c' },
  4: { label: 'Top Secret',  icon: '⛔', color: '#c0392b' }
};

// ─── MAP IMAGES ─────────────────────────────────────────────
// Place map images inside images/maps/ folder
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

// ─── CATEGORY ICONS ─────────────────────────────────────────
const CAT_ICONS = {
  poi:     { icon: '📍', label: 'Point of Interest' },
  base:    { icon: '🏠', label: 'Base / Safe House'  },
  mission: { icon: '🎯', label: 'Mission Location'   },
  loot:    { icon: '💰', label: 'Loot / Stash'       },
  danger:  { icon: '⚠️', label: 'Danger Zone'        },
  vehicle: { icon: '🚗', label: 'Vehicle Spawn'      },
  other:   { icon: '📌', label: 'Other'              }
};
