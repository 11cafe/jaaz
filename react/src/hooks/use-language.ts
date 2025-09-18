import { useTranslation } from 'react-i18next'

export const useLanguage = () => {
  const { i18n } = useTranslation()

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language)
  }

  const getCurrentLanguage = () => i18n.language

  return {
    currentLanguage: getCurrentLanguage(),
    changeLanguage,
    isEnglish: getCurrentLanguage() === 'en',
    isChinese: getCurrentLanguage() === 'zh-CN',
    isFrench: getCurrentLanguage() === 'fr',
    isSpanish: getCurrentLanguage() === 'es',
    isKorean: getCurrentLanguage() === 'ko',
  }
}
