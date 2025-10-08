import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import { fileURLToPath } from 'url'

const filePath = fileURLToPath(import.meta.url)
const dirPath = path.dirname(filePath)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const alias = {
    '@': path.resolve(dirPath, './src')
  }

  let toolRoot = env.VITE_TOOL_ROOT
  if (toolRoot) {
    toolRoot = toolRoot.trim()
  }

  if (toolRoot) {
    if (toolRoot.startsWith('./')) {
      toolRoot = toolRoot.slice(2)
    }
    if (toolRoot.startsWith('src/')) {
      toolRoot = toolRoot.slice(4)
    }
    const toolsAlias = path.resolve(dirPath, './src', toolRoot)
    alias['@tools'] = toolsAlias
  }

  return {
    plugins: [svelte()],
    server: {
      port: 5173,
      host: true
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    },
    resolve: {
      alias
    }
  }
})
