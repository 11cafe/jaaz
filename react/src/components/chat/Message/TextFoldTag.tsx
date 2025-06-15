import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronUpIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type TextFoldTagProps = {
  children: ReactNode
  isExpanded: boolean
  onToggleExpand: () => void
  buttonText?: string
}

const TextFoldTag: React.FC<TextFoldTagProps> = ({
  children,
  isExpanded,
  onToggleExpand,
  buttonText,
}) => {
  const { t } = useTranslation()
  return (
    <div className="w-full min-w-0 border rounded-lg overflow-hidden mb-4 bg-[rgb(254,252,232)] dark:bg-[rgb(50,40,16)]">
      <Button
        variant={'secondary'}
        onClick={onToggleExpand}
        className={cn(
          'w-full justify-start text-left bg-[rgb(254,249,195)] hover:bg-[rgb(254,252,232)] dark:bg-[rgb(81,66,27)] dark:hover:bg-[rgb(50,40,16)]',
          isExpanded && 'rounded-t-md rounded-b-none'
        )}
      >
        <ChevronUpIcon
          className={cn(
            isExpanded && 'rotate-180',
            'transition-transform duration-300'
          )}
        />
        <span className="truncate max-w-[80%] inline-block">
          <span className="font-semibold text-muted-foreground flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path clipRule="evenodd" fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"></path>
            </svg>
            {buttonText || t('chat:thinking.title')}
          </span>
        </span>
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0.8, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="p-3 break-all">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TextFoldTag