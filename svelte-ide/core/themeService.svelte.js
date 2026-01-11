const lightTheme = {
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceAlt: '#f1f5f9',
    surfaceRaised: '#ffffff',
    surfaceHover: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1'
  },
  shadows: {
    xs: '0 1px 1px 0 rgb(0 0 0 / 0.04)',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    menu: '0 8px 16px -4px rgb(15 23 42 / 0.25)'
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  }
}

const darkTheme = {
  colors: {
    primary: '#007acc',
    secondary: '#9ca3af',
    background: '#1e1e1e',
    surface: '#2d2d30',
    surfaceAlt: '#252526',
    surfaceRaised: '#383838',
    surfaceHover: '#3e3e42',
    text: '#cccccc',
    textMuted: '#9ca3af',
    border: '#3e3e42',
    borderStrong: '#4d4d52'
  },
  shadows: {
    xs: '0 1px 1px 0 rgb(0 0 0 / 0.35)',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.35)',
    md: '0 6px 10px -2px rgb(0 0 0 / 0.4)',
    lg: '0 12px 18px -3px rgb(0 0 0 / 0.45)',
    menu: '0 10px 20px -6px rgb(0 0 0 / 0.6)'
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  }
}

const themes = {
  light: lightTheme,
  dark: darkTheme
}

function mergeTheme(base, overrides) {
  const baseColors = base?.colors ?? {}
  const baseShadows = base?.shadows ?? {}
  const baseSpacing = base?.spacing ?? {}
  const overrideColors = overrides?.colors ?? {}
  const overrideShadows = overrides?.shadows ?? {}
  const overrideSpacing = overrides?.spacing ?? {}

  return {
    ...base,
    ...overrides,
    colors: { ...baseColors, ...overrideColors },
    shadows: { ...baseShadows, ...overrideShadows },
    spacing: { ...baseSpacing, ...overrideSpacing }
  }
}

let mode = $state('dark')
let customTheme = $state({})
let currentTheme = $derived(mergeTheme(themes[mode] ?? lightTheme, customTheme))

function setTheme(theme) {
  customTheme = theme ?? {}
}

function setMode(nextMode) {
  if (themes[nextMode]) {
    mode = nextMode
  }
}

function toggleMode() {
  mode = mode === 'dark' ? 'light' : 'dark'
}

function getColor(name) {
  return currentTheme.colors?.[name] || themes[mode]?.colors?.[name] || lightTheme.colors[name]
}

function getShadow(name) {
  return currentTheme.shadows?.[name] || themes[mode]?.shadows?.[name] || lightTheme.shadows[name]
}

function getSpacing(name) {
  return currentTheme.spacing?.[name] || themes[mode]?.spacing?.[name] || lightTheme.spacing[name]
}

export const themeService = {
  get theme() { return currentTheme },
  get mode() { return mode },
  setTheme,
  setMode,
  toggleMode,
  getColor,
  getShadow,
  getSpacing
}
