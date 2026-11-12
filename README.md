# Cyber Planet Portfolio

An interactive 3D portfolio built with Three.js + Vite. Drive a neon rover around a tiny cyber planet;
each landmark opens a section of the CV.

| Landmark | Section |
| --- | --- |
| Start ring + hologram name | Welcome |
| Command center (terminal screen) | About |
| Floating crystals around a core | Skills |
| SOC radar station | Experience & Education |
| Shield vault with orbiting badges | Certifications |
| Holographic billboards | Projects |
| Comms tower | Contact |
| Flag at the south pole | Easter egg (CTF) |

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the build
```

## Customise

- **All text/content**: `src/data.js` (profile, skills, experience, projects, certifications…).
- **Résumé link**: put your PDF at `public/resume.pdf`.
- **Landmark positions**: bottom of `src/landmarks.js` (`dirFrom(angleFromStart, bearing)`).
- **Colours**: `NEON` in `src/utils.js` and CSS variables in `src/style.css`.

## Links

- `/?play` skips the intro.
- `/?play#projects` (or `#about`, `#skills`, `#experience`, `#certs`, `#contact`) drops the rover at that section.
- The **2D** button opens a plain, recruiter-friendly version of the same content.

## Controls

WASD / arrows drive · Shift boost · Space jump · R reset · drag to look · scroll to zoom.
On touch devices, a joystick plus Boost/Jump buttons appear.

## Deploy

`npm run build` and upload `dist/` to Netlify, Vercel, GitHub Pages or Cloudflare Pages.
