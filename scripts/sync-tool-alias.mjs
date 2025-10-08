import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const filePath = fileURLToPath(import.meta.url)
const dirPath = path.dirname(filePath)
const projectRoot = path.resolve(dirPath, '..')

function getEnvValue(name) {
  if (process.env[name]) {
    return process.env[name]
  }

  const envPath = path.join(projectRoot, '.env')
  if (!existsSync(envPath)) {
    return undefined
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.startsWith('#')) {
      continue
    }
    const index = line.indexOf('=')
    if (index === -1) {
      continue
    }
    const key = line.slice(0, index).trim()
    if (key !== name) {
      continue
    }
    return line.slice(index + 1).trim()
  }

  return undefined
}

const jsconfigPath = path.join(projectRoot, 'jsconfig.json')
const config = JSON.parse(readFileSync(jsconfigPath, 'utf8'))
const compilerOptions = config.compilerOptions || {}
const paths = compilerOptions.paths || {}

let toolRoot = getEnvValue('VITE_TOOL_ROOT')
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
  let base = path.join('src', toolRoot).replace(/\\/g, '/')
  if (base.endsWith('/')) {
    base = base.slice(0, -1)
  }
  paths['@tools/*'] = [`${base}/*`]
} else {
  delete paths['@tools/*']
}

compilerOptions.paths = paths
config.compilerOptions = compilerOptions

const content = JSON.stringify(config, null, 2)
writeFileSync(jsconfigPath, content + '\n')
