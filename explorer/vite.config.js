import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import { fileURLToPath } from 'url'

const filePath = fileURLToPath(import.meta.url)
const dirPath = path.dirname(filePath)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirPath, '')
  const serverPort = Number(env.VITE_PORT) || 5177
  const serverHost = env.VITE_HOST === 'false' ? false :
                     env.VITE_HOST === 'true' ? true :
                     env.VITE_HOST || true

  return {
    plugins: [svelte()],
    server: {
      port: serverPort,
      host: serverHost
    },
    resolve: {
      alias: {
        '@svelte-ide/core': path.resolve(dirPath, '../svelte-ide')
      }
    }
  }
})
