import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import commonEn from './locales/en/common.json'
import homeEn from './locales/en/home.json'
import canvasEn from './locales/en/canvas.json'
import chatEn from './locales/en/chat.json'
import settingsEn from './locales/en/settings.json'

import commonZh from './locales/zh-CN/common.json'
import homeZh from './locales/zh-CN/home.json'
import canvasZh from './locales/zh-CN/canvas.json'
import chatZh from './locales/zh-CN/chat.json'
import settingsZh from './locales/zh-CN/settings.json'

import commonFr from './locales/fr/common.json'
import homeFr from './locales/fr/home.json'
import canvasFr from './locales/fr/canvas.json'
import chatFr from './locales/fr/chat.json'
import settingsFr from './locales/fr/settings.json'

import commonEs from './locales/es/common.json'
import homeEs from './locales/es/home.json'
import canvasEs from './locales/es/canvas.json'
import chatEs from './locales/es/chat.json'
import settingsEs from './locales/es/settings.json'

import commonKo from './locales/ko/common.json'
import homeKo from './locales/ko/home.json'
import canvasKo from './locales/ko/canvas.json'
import chatKo from './locales/ko/chat.json'
import settingsKo from './locales/ko/settings.json'

const resources = {
  en: {
    common: commonEn,
    home: homeEn,
    canvas: canvasEn,
    chat: chatEn,
    settings: settingsEn,
  },
  'zh-CN': {
    common: commonZh,
    home: homeZh,
    canvas: canvasZh,
    chat: chatZh,
    settings: settingsZh,
  },
  fr: {
    common: commonFr,
    home: homeFr,
    canvas: canvasFr,
    chat: chatFr,
    settings: settingsFr,
  },
  es: {
    common: commonEs,
    home: homeEs,
    canvas: canvasEs,
    chat: chatEs,
    settings: settingsEs,
  },
  ko: {
    common: commonKo,
    home: homeKo,
    canvas: canvasKo,
    chat: chatKo,
    settings: settingsKo,
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'home', 'canvas', 'chat', 'settings'],

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
