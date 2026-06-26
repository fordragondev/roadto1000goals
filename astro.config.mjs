// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";

import './src/styles/global.css';

// https://astro.build/config
export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
      },
    site: 'https://roadto1000goals.com/',
});
