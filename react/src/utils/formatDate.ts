import i18next from "i18next"

export function formatDate(isoString: string): string {
    if (!isoString) return ''
    const date = new Date(isoString)
    const locale = i18next.language || 'en'
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
