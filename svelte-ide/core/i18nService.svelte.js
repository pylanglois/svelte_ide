const translations = {
  en: {
    'app.title': 'Application',
    'app.welcome': 'Welcome'
  },
  fr: {
    'app.title': 'Application',
    'app.welcome': 'Bienvenue'
  }
}

let currentLocale = $state('en')

function setLocale(locale) {
  if (translations[locale]) {
    currentLocale = locale
  }
}

function t(key) {
  return translations[currentLocale]?.[key] || key
}

function registerTranslations(locale, keys) {
  if (!translations[locale]) {
    translations[locale] = {}
  }
  Object.assign(translations[locale], keys)
}

export const i18nService = {
  get locale() { return currentLocale },
  setLocale,
  t,
  registerTranslations
}
