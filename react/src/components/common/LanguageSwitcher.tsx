import { useLanguage } from '@/hooks/use-language'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Languages } from 'lucide-react'

const LanguageSwitcher = () => {
  const { changeLanguage, currentLanguage } = useLanguage()
  const { t } = useTranslation()

  const languages = [
    { code: 'en', name: t('common:languages.en') },
    { code: 'zh-CN', name: t('common:languages.zh-CN') },
    { code: 'fr', name: t('common:languages.fr') },
    { code: 'es', name: t('common:languages.es') },
    { code: 'ko', name: t('common:languages.ko') },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={'sm'}
          variant={'ghost'}>
          <Languages size={30} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={currentLanguage === language.code ? 'bg-accent' : ''}
          >
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSwitcher
