import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

// Relative base so the build works on any host, including GitHub Pages sub-paths.
const tunnels = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev'];

export default defineConfig(({ command, mode }) => {
  // All site content lives in .env, which is not in the repo. Without it the site would be blank,
  // so stop production builds (e.g. an automatic build on Cloudflare) instead of deploying an empty page.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (!env.VITE_NAME) {
    const msg = 'No site content found: copy .env.example to .env and fill it in (see README → "Make it yours").';
    if (command === 'build') throw new Error(msg);
    console.warn(`\n⚠  ${msg}\n`);
  }

  return {
    base: './',
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'), // professional portfolio
          world: resolve(__dirname, 'world.html'), // interactive 3D driving world
        },
      },
    },
    // allow tunnels (ngrok) to reach the dev/preview servers
    server: { allowedHosts: tunnels },
    preview: { port: 4173, allowedHosts: tunnels },
  };
});
