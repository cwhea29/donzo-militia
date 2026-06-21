/**
 * DONZO — CONFIG
 * Supabase backend (auth + realtime markers + storage)
 * Map images (optional): place in dm5/images/maps/ — site degrades gracefully
 *
 * Current project: kypeaqpeeywtrqyserrc (new project)
 */

const SUPABASE_URL   = 'https://kypeaqpeeywtrqyserrc.supabase.co';
const SUPABASE_KEY   = 'sb_publishable_VeM0fsus2vSjZ1vIZyBGtg_ypXSWEMm';
const STORAGE_BUCKET = 'marker-images';

const ACCESS = {
  1:  { name:'Hangy',      color:'#6b5b4f', bg:'rgba(107,91,79,0.15)',   add:false, delOwn:false, delAll:false, manageUsers:false },
  2:  { name:'Cadet',      color:'#8a7a6a', bg:'rgba(138,122,106,0.15)', add:false, delOwn:false, delAll:false, manageUsers:false },
  3:  { name:'Private',    color:'#7a9a6a', bg:'rgba(122,154,106,0.15)', add:false, delOwn:false, delAll:false, manageUsers:false },
  4:  { name:'Gunner',     color:'#5a8a5a', bg:'rgba(90,138,90,0.15)',   add:true,  delOwn:false, delAll:false, manageUsers:false },
  5:  { name:'Corporal',   color:'#4e7a4e', bg:'rgba(78,122,78,0.15)',   add:true,  delOwn:true,  delAll:false, manageUsers:false },
  6:  { name:'Commander',  color:'#c9a84c', bg:'rgba(201,168,76,0.15)',  add:true,  delOwn:true,  delAll:false, manageUsers:false },
  7:  { name:'Captain',    color:'#b87a3a', bg:'rgba(184,122,58,0.15)',  add:true,  delOwn:true,  delAll:false, manageUsers:false },
  8:  { name:'Chief',      color:'#a05a2a', bg:'rgba(160,90,42,0.15)',   add:true,  delOwn:true,  delAll:true,  manageUsers:false },
  9:  { name:'Warboss',    color:'#8a3a3a', bg:'rgba(138,58,58,0.15)',   add:true,  delOwn:true,  delAll:true,  manageUsers:false },
  10: { name:'Underboss',  color:'#6a2a5a', bg:'rgba(106,42,90,0.15)',   add:true,  delOwn:true,  delAll:true,  manageUsers:false },
  11: { name:'Boss',       color:'#c0392b', bg:'rgba(192,57,43,0.15)',   add:false, delOwn:false, delAll:false, manageUsers:true  }
};

const VIS = {
  1:  { label:'Hangy+',      icon:'🌐', color:'#6b5b4f' },
  2:  { label:'Cadet+',      icon:'🔒', color:'#8a7a6a' },
  3:  { label:'Private+',    icon:'🔐', color:'#7a9a6a' },
  4:  { label:'Gunner+',     icon:'🔒', color:'#5a8a5a' },
  5:  { label:'Corporal+',   icon:'🔐', color:'#4e7a4e' },
  6:  { label:'Commander+',  icon:'🔒', color:'#c9a84c' },
  7:  { label:'Captain+',    icon:'🔐', color:'#b87a3a' },
  8:  { label:'Chief+',      icon:'⛔', color:'#a05a2a' },
  9:  { label:'Warboss+',    icon:'⛔', color:'#8a3a3a' },
  10: { label:'Underboss+',  icon:'⛔', color:'#6a2a5a' },
  11: { label:'Boss Only',   icon:'👑', color:'#c0392b' }
};

const MAPS = {
  mainland: {
    atlas:     'images/maps/GTAV_ATLUS_8192x8192.png',
    roadmap:   'images/maps/GTAV-HD-MAP-roadmap.jpg',
    satellite: 'images/maps/GTAV-HD-MAP-satellite.jpg'
  },
  cayo: {
    atlas:     'images/maps/CayoPerico-GTAO-SnapmaticAtlasMap.webp',
    roadmap:   'images/maps/CayoPerico-GTAO-Map.webp',
    satellite: 'images/maps/CayoPerico-GTAO-SatelliteMap.webp'
  }
};

const CATS = {
  poi:         { icon:'📍', label:'Point of Interest' },
  base:        { icon:'🏠', label:'Base / Safe House'  },
  mission:     { icon:'🎯', label:'Mission Location'   },
  heist:       { icon:'💥', label:'Heist Starting Point' },
  extraction:  { icon:'🚁', label:'Extraction Point'   },
  loot:        { icon:'💰', label:'Loot / Stash'       },
  drop:        { icon:'📦', label:'Supply Drop / Cache' },
  danger:      { icon:'⚠️', label:'Danger Zone'        },
  ambush:      { icon:'🔫', label:'Ambush Site'        },
  surveillance:{ icon:'👁️', label:'Surveillance Point' },
  vehicle:     { icon:'🚗', label:'Vehicle Spawn'      },
  other:       { icon:'📌', label:'Other'              }
};

// Initialize the global DM namespace (only once, across all scripts)
const DM = window.DM || {};
window.DM = DM;

window.dmDB      = null;
window.dmStorage = null;

function initDB() {
  try {
    console.log('%c[Supabase] Initializing with URL:', 'color:#6a8a5a', SUPABASE_URL);
    window.dmDB      = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.dmStorage = window.dmDB.storage;
    console.log('%c[Supabase] Client created successfully', 'color:#6a8a5a');

    // Note: Error reporting is now set up in map.js init() after DM.db is guaranteed to exist.
    return true;
  } catch (e) {
    console.error('%c[Supabase] Init failed:', 'color:#c0392b', e);
    return false;
  }
}

// Error reporting setup moved to map.js for proper initialization order.
