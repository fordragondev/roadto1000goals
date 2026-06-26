// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";

import './src/styles/global.css';

// https://astro.build/config
export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
        server: {
            watch: {
                // Only poll in container/WSL2 environments where inotify doesn't cross the filesystem boundary
                usePolling: !!process.env.CHOKIDAR_USEPOLLING,
            },
        },
      },
    site: 'https://roadto1000goals.com/',
});
