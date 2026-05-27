/**
 * DONZO MILITIA — CONFIG
 * Supabase backend (auth + realtime markers + storage)
 * Map images (optional): place in dm5/images/maps/ — site degrades gracefully
 */

const SUPABASE_URL   = 'https://zcjnyunijtjtpexqyzgo.supabase.co';
const SUPABASE_KEY   = 'sb_publishable_5IQYlkftvBJtVrzpm44uTQ_yJUOhEgA';
const STORAGE_BUCKET = 'marker-images';

const ACCESS = {
  1: { name:'Recruit',    color:'#8a9a7a', bg:'rgba(138,154,122,0.15)', add:false, delOwn:false, delAll:false },
  2: { name:'Operative',  color:'#4e6443', bg:'rgba(78,100,67,0.15)',   add:false, delOwn:false, delAll:false },
  3: { name:'Lieutenant', color:'#c9a84c', bg:'rgba(201,168,76,0.15)',  add:true,  delOwn:true,  delAll:false },
  4: { name:'Commander',  color:'#c0392b', bg:'rgba(192,57,43,0.15)',   add:true,  delOwn:true,  delAll:true  }
};

const VIS = {
  1: { label:'Public',       icon:'🌐', color:'#8a9a7a' },
  2: { label:'Restricted',   icon:'🔒', color:'#4e6443' },
  3: { label:'Confidential', icon:'🔐', color:'#c9a84c' },
  4: { label:'Top Secret',   icon:'⛔', color:'#c0392b' }
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
  poi:     { icon:'📍', label:'Point of Interest' },
  base:    { icon:'🏠', label:'Base / Safe House'  },
  mission: { icon:'🎯', label:'Mission Location'   },
  loot:    { icon:'💰', label:'Loot / Stash'       },
  danger:  { icon:'⚠️', label:'Danger Zone'        },
  vehicle: { icon:'🚗', label:'Vehicle Spawn'      },
  other:   { icon:'📌', label:'Other'              }
};

window.dmDB      = null;
window.dmStorage = null;

function initDB() {
  try {
    window.dmDB      = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.dmStorage = window.dmDB.storage;
    return true;
  } catch (e) {
    console.error('Supabase init error:', e);
    return false;
  }
}
