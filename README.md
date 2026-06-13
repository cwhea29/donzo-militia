# DONZO — Operations Map (v3 / Supabase)

GTA V roleplay faction operations database: interactive shared map for Los Santos + Cayo Perico, access-level gated markers, comments, groups, heist planning sequences, and admin tools.

## Quick Start (for members)

1. Open `dm5/index.html` (or the deployed equivalent).
2. Log in with your callsign + password.
3. The map loads with realtime synced pins. Use layers (Atlas / Roadmap / Satellite), switch between mainland and Cayo.
4. Authorized users (Gunner+) can place new locations. Higher ranks can edit/delete and manage users.

**Controls summary**
- Scroll / pinch: zoom
- Drag: pan
- Place Marker button → crosshair → click map to drop
- Sidebar (Locations): search + filter by category or custom groups. Click entry to jump.
- Popup on marker: details, comments (live), edit/delete if you have perms.
- Heist Plans: build ordered step-by-step ops from the Locations panel.
- Users (Commanders+): manage roster, levels, audit log (Boss), bug reports.

## Project Structure

```
dm5/
  index.html          # Login entry
  map.html            # The main interactive operations map (core of the site)
  crafting.html       # Field recipes & reference (now populated)
  instructions.html   # Full Map Guide + access levels + how-tos
  css/style.css
  js/
    config.js         # Supabase URL/key + ACCESS levels + MAPS + CATS
    auth.js           # Session (sessionStorage) + login against users table
    db.js             # All Supabase queries, realtime, image uploads, heist plans, groups, audit, bugs
    map.js            # Map rendering, placement (normalized 0-1 coords), popups, filters, modals
    nav.js            # Shared top nav + drawer injected on protected pages
  images/
    dm_2.png          # Logo (fixed case)
    maps/             # Background layers (see images/maps/readme.md)
  manifest.json       # PWA manifest
  sql/                # One-time DB setup scripts (run in Supabase SQL editor)
```

## Important Security Notes

- Passwords are **stored in plain text** in the `users` table. This is a deliberate simplification for the current internal tool.
- The Supabase publishable/anon key is embedded in the client. Anyone who can load the page can in principle talk to the DB (subject to whatever RLS you have — currently tables often have RLS disabled for convenience).
- **Recommendation for real/long-term use**: Switch to Supabase Auth (email + password or magic links), proper JWT sessions, hashed passwords, and strict Row Level Security policies that tie `auth.uid()` or custom claims to `access_level` / `created_by`. Move privileged actions (user creation, level changes) to Edge Functions or a small admin backend.

See the big red warning box in `instructions.html` and the footer note on the login screen.

## Local Development / Testing

Just open the HTML files directly in a browser (double-click `dm5/index.html`), or serve the `dm5` folder:

- Python: `python -m http.server 5173 -d dm5`
- Node (if installed): `npx serve dm5`
- VS Code Live Server extension also works great.

You still need a working Supabase project with the tables created from the `sql/` folder (and the `marker-images` storage bucket, public).

## Map Image Layers

See [dm5/images/maps/readme.md](dm5/images/maps/readme.md). Coordinates are stored as normalized 0–1 fractions of the source image so they survive layer swaps and image replacements.

## Key Features & Recent Improvements

- Realtime marker sync via Supabase Postgres changes
- 11-tier access control (invisible markers below your level)
- Image attachments per marker (Supabase Storage)
- Comments thread per location (owner can edit/delete their own)
- Marker Groups for ad-hoc tagging + sidebar filtering
- Heist Plans: ordered sequences of markers with reordering UI
- Audit log (create/update/delete/comment) — Boss level
- Automatic + manual bug reporting to DB
- Fully working fallback when map images 404
- Touch friendly pan + pinch zoom
- PWA manifest

## Deployment

Copy the entire `dm5/` folder (or the whole repo) to your static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, an S3 bucket behind CloudFront, etc.). Update `SUPABASE_URL` / `SUPABASE_KEY` in `js/config.js` if you migrate projects.

No build step required.

## Contributing / Internal

- Keep changes inside `dm5/`.
- When adding new DB tables/columns, also drop a migration note in `sql/`.
- Test placement accuracy at 1:1 zoom (the Place button forces reset).
- New high-clearance markers (level 7+) trigger a toast notification for everyone currently online.

---

DONZO — Pack Watch. Stay frosty.
