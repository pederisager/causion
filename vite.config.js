import { defineConfig } from 'vite'
import os from 'node:os'
import path from 'node:path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Keep Vite cache out of Dropbox-synced folders to avoid EBUSY rename locks.
  cacheDir: path.join(os.tmpdir(), 'causion-app-vite-cache'),
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
})
