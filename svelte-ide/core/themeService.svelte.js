const defaultTheme = {
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    border: '#e2e8f0'
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  }
}

let currentTheme = $state(defaultTheme)

function setTheme(theme) {
  currentTheme = { ...defaultTheme, ...theme }
}

function getColor(name) {
  return currentTheme.colors[name] || defaultTheme.colors[name]
}

function getShadow(name) {
  return currentTheme.shadows[name] || defaultTheme.shadows[name]
}

function getSpacing(name) {
  return currentTheme.spacing[name] || defaultTheme.spacing[name]
}

export const themeService = {
  get theme() { return currentTheme },
  setTheme,
  getColor,
  getShadow,
  getSpacing
}
