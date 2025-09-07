import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import commonEn from './locales/en/common.json'
import homeEn from './locales/en/home.json'
import canvasEn from './locales/en/canvas.json'
import chatEn from './locales/en/chat.json'
import settingsEn from './locales/en/settings.json'
import pricingEn from './locales/en/pricing.json'
import templatesEn from './locales/en/templates.json'

import commonZh from './locales/zh-CN/common.json'
import homeZh from './locales/zh-CN/home.json'
import canvasZh from './locales/zh-CN/canvas.json'
import chatZh from './locales/zh-CN/chat.json'
import settingsZh from './locales/zh-CN/settings.json'
import pricingZh from './locales/zh-CN/pricing.json'
import templatesZh from './locales/zh-CN/templates.json'

const resources = {
  en: {
    common: commonEn,
    home: homeEn,
    canvas: canvasEn,
    chat: chatEn,
    settings: settingsEn,
    pricing: pricingEn,
    templates: templatesEn,
  },
  'zh-CN': {
    common: commonZh,
    home: homeZh,
    canvas: canvasZh,
    chat: chatZh,
    settings: settingsZh,
    pricing: pricingZh,
    templates: templatesZh,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'home', 'canvas', 'chat', 'settings', 'pricing', 'templates'],

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: true,
    },
  })

export default i18n
