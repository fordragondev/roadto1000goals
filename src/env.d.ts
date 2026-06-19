/// <reference types="astro/client" />

declare global {
  interface Window {
    dataLayer: unknown[];
  }
  // Required for bare `dataLayer` reference inside the GTM inline script.
  // eslint-disable-next-line no-var
  var dataLayer: unknown[];
}

export {};
