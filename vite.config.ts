
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: The base path must match your GitHub repository name "/record/"
  base: '/record/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    // Security: Do not hardcode the key here for GitHub. 
    // The app will look for the key in localStorage (User Settings).
    'process.env.API_KEY': JSON.stringify("")
  }
});
