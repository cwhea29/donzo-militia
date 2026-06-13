# Donzo — Custom Map Images

The map images currently in use live in this folder.

## Currently Used Files

### Los Santos (mainland)
- `GTAV_ATLUS_8192x8192.png` — Main atlas/overview (very high resolution)
- `GTAV-HD-MAP-roadmap.jpg` — Road map layer
- `GTAV-HD-MAP-satellite.jpg` — Satellite layer (large file ~27MB)

### Cayo Perico
- `CayoPerico-GTAO-SnapmaticAtlasMap.webp` — Atlas view
- `CayoPerico-GTAO-Map.webp` — Roadmap style
- `CayoPerico-GTAO-SatelliteMap.webp` — Satellite view

These paths are wired up in `dm5/js/config.js` under the `MAPS` constant.

## Notes
- The site uses `object-fit: contain`, so the exact pixel dimensions don't have to be identical between layers.
- Marker coordinates are stored as normalized 0–1 fractions of the source image (not screen % or pixels). This keeps them stable across layers, zooms, and different screen sizes.
- Some files are quite large (especially the satellite layers). This can cause slower initial loads on slower connections. Consider optimizing or using lighter versions if needed.
- If any individual layer fails to load, the map automatically shows a nice stylized fallback while keeping every interactive feature (panning, zooming, placing markers, realtime updates, etc.) fully working.

## Changing / Replacing Maps Later
Edit `dm5/js/config.js` → the `MAPS` object and point the six entries to whatever filenames you want to use.

## Deployment
Make sure the entire `images/` folder (including this one) is included when you publish the site.
