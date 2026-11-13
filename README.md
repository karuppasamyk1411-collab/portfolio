# Cyber Planet Portfolio

An interactive portfolio built with Three.js and Vite. It has two pages:

- **`index.html`**: a professional portfolio page with a 3D SOC desk, CRT screens and live-looking security logs.
- **`world.html`**: an interactive 3D world. Drive a neon rover around a tiny cyber planet; each landmark opens a section of the CV.

Live: <https://karuppasec.co.uk>

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

## ⚠️ Not included in this repo

Some personal files are deliberately **left out** (they are listed in `.gitignore`), so a fresh clone
won't look like the live site until you add your own:

| Missing file | What it is | What you need to do |
| --- | --- | --- |
| `.env` | All the site content: name, role, about text, experience, projects, skills, contact links… | Copy `.env.example` to `.env` and fill in your own details. |
| `public/me.jpg` | Profile photo (shown on the portfolio page and as a hologram in the 3D world) | Add your own photo at `public/me.jpg`, or point `VITE_PHOTO` at another file in `public/`. Leave `VITE_PHOTO` empty to hide the photo. |
| `public/og.jpg` | Link-preview image (Open Graph / Twitter card, 1200×630) | Add your own 1200×630 image at `public/og.jpg`, e.g. a screenshot of your finished site. |

## Make it yours

```bash
git clone <this repo>
cd portfolio
npm install
cp .env.example .env        # Windows: copy .env.example .env
# edit .env and add public/me.jpg + public/og.jpg (see table above)
npm run dev
```

Notes on `.env` (also written at the top of `.env.example`):

- Only keys starting with `VITE_` are read, and **every value ends up on the public website**.
  Never put passwords, API keys, tokens or a phone number in it.
- Long text, HTML and lists go inside backticks `` `...` ``. Lists are JSON, so keep `[ ] { } ,` and `"quotes"` exact.
- Don't use the `$` character.
- `VITE_SITE_URL` must be your real domain, otherwise link previews and canonical URLs will point to the wrong place.

Other things to change:

- **Custom domain**: `routes` in `wrangler.jsonc` (or remove them to use only the free `*.workers.dev` address).
- **Landmark positions**: bottom of `src/landmarks.js` (`dirFrom(angleFromStart, bearing)`).
- **Colours**: `NEON` in `src/utils.js` and CSS variables in `src/style.css` / `src/portfolio/style.css`.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the build
```

## Deploy

The build bakes the `.env` values and the files in `public/` into `dist/`. Because those files are not in the repo,
**a build running on a CI server or on Cloudflare/Netlify/Vercel from this repo won't have them**. Choose one of these:

1. **Build locally and upload** (simplest). Run `npm run build`, then `npx wrangler deploy` (Cloudflare, uses `wrangler.jsonc`),
   or upload `dist/` to Netlify, Vercel or GitHub Pages.
2. **Build on the host from git.** Add every `VITE_*` key from your `.env` as a build environment variable in the host's
   dashboard (Vite reads `VITE_*` variables from the environment as well as from `.env`). Then make your photos available
   to the build some other way, e.g. a private repo or storage bucket, because the images aren't in this repo.

## Links

- `/world.html?play` skips the intro.
- `/world.html?play#projects` (or `#about`, `#skills`, `#experience`, `#certs`, `#contact`) drops the rover at that section.
- The **2D** button opens a plain, recruiter-friendly version of the same content.

## Controls

WASD / arrows drive · Shift boost · Space jump · R reset · drag to look · scroll to zoom.
On touch devices, a joystick plus Boost/Jump buttons appear.
