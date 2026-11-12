import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative base so the build works on any host, including GitHub Pages sub-paths.
const tunnels = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev'];

export default defineConfig({
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
});
