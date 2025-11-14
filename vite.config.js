import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const filePath = fileURLToPath(import.meta.url)
const dirPath = path.dirname(filePath)

export default defineConfig(() => {
  return {
    plugins: [svelte()],
    server: {
      port: 5177,
      host: true
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    },
    resolve: {
      alias: {
        '@': path.resolve(dirPath, './src')
      }
    }
  }
})
