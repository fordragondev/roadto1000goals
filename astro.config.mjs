// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";

import partytown from '@astrojs/partytown'

import './src/styles/global.css';

// https://astro.build/config
export default defineConfig({
    vite: {
        plugins: [tailwindcss()],
      },
    site: 'https://roadto1000goals.com/',
    integrations: [
        partytown({
            config: {
              forward: ["dataLayer.push"],
            },
        }),
    ],
});
