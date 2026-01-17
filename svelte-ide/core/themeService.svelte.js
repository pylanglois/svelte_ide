const STORAGE_KEY = 'side-theme-mode'

const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem'
}

const lightColors = {
  primary: '#3b82f6',
  secondary: '#64748b',
  background: '#ffffff',
  surface: '#f8fafc',
  surfaceAlt: '#f1f5f9',
  surfaceRaised: '#ffffff',
  surfaceHover: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  textOnPrimary: '#ffffff',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  danger: '#dc2626'
}

const darkColors = {
  primary: '#007acc',
  secondary: '#9ca3af',
  background: '#1e1e1e',
  surface: '#2d2d30',
  surfaceAlt: '#252526',
  surfaceRaised: '#383838',
  surfaceHover: '#3e3e42',
  text: '#cccccc',
  textMuted: '#9ca3af',
  textOnPrimary: '#ffffff',
  border: '#3e3e42',
  borderStrong: '#4d4d52',
  danger: '#fca5a5'
}

const lightShadows = {
  xs: '0 1px 1px 0 rgb(0 0 0 / 0.04)',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  menu: '0 8px 16px -4px rgb(15 23 42 / 0.25)'
}

const darkShadows = {
  xs: '0 1px 1px 0 rgb(0 0 0 / 0.35)',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.35)',
  md: '0 6px 10px -2px rgb(0 0 0 / 0.4)',
  lg: '0 12px 18px -3px rgb(0 0 0 / 0.45)',
  menu: '0 10px 20px -6px rgb(0 0 0 / 0.6)'
}

const themes = {
  light: { colors: lightColors, shadows: lightShadows },
  dark: { colors: darkColors, shadows: darkShadows }
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

function getInitialMode(defaultMode) {
  if (typeof window === 'undefined') return defaultMode

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && themes[stored]) return stored

  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'

  return defaultMode
}

let mode = $state(getInitialMode('dark'))
let customColors = $state({})
let customShadows = $state({})

let currentTheme = $derived({
  colors: { ...themes[mode].colors, ...customColors },
  shadows: { ...themes[mode].shadows, ...customShadows },
  spacing
})

function configure(options = {}) {
  if (options.colors) {
    customColors = options.colors
  }
  if (options.shadows) {
    customShadows = options.shadows
  }
  if (options.defaultMode && themes[options.defaultMode] && !localStorage.getItem(STORAGE_KEY)) {
    mode = options.defaultMode
  }
  injectCssVars()
}

function setMode(nextMode) {
  if (themes[nextMode]) {
    mode = nextMode
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, nextMode)
    }
    injectCssVars()
  }
}

function toggleMode() {
  setMode(mode === 'dark' ? 'light' : 'dark')
}

function getColor(name) {
  return currentTheme.colors[name]
}

function getShadow(name) {
  return currentTheme.shadows[name]
}

function getSpacing(name) {
  return currentTheme.spacing[name]
}

function injectCssVars() {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  for (const [key, value] of Object.entries(currentTheme.colors)) {
    root.style.setProperty(`--${toKebabCase(key)}`, value)
  }

  for (const [key, value] of Object.entries(currentTheme.shadows)) {
    root.style.setProperty(`--shadow-${key}`, value)
  }

  for (const [key, value] of Object.entries(currentTheme.spacing)) {
    root.style.setProperty(`--spacing-${key}`, value)
  }

  root.dataset.theme = mode
}

injectCssVars()

export const themeService = {
  get theme() { return currentTheme },
  get mode() { return mode },
  configure,
  setMode,
  toggleMode,
  getColor,
  getShadow,
  getSpacing
}
