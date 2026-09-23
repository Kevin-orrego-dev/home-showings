import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Dev proxy: the browser talks to localhost:5173/api and Vite forwards it to the API.
    // To the browser everything is the SAME origin, so the httpOnly auth cookie just works
    // (no CORS preflights, no third-party-cookie issues).
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
