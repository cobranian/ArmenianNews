import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Firebase Hosting serves from the domain root.
// Override with BASE_PATH env if deploying under a subpath.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
})
