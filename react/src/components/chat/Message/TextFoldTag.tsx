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
    <div className="bg-[rgb(254,252,232)] dark:bg-[rgb(50,40,16)] border border-[rgb(254,249,195)] dark:border-[rgb(81,66,27)] rounded-md shadow-sm overflow-hidden max-w-full mb-4">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[rgb(254,249,195)] dark:hover:bg-[rgb(81,66,27)] transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          <div className="bg-[rgb(254,249,195)] dark:bg-[rgb(81,66,27)] p-1 rounded">
            <svg className="w-4 h-4 text-[rgb(161,98,7)] dark:text-[rgb(253,224,71)]" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path clipRule="evenodd" fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"></path>
            </svg>
          </div>
          <p className="font-bold text-[rgb(161,98,7)] dark:text-[rgb(253,224,71)]">
            {buttonText || t('chat:thinking.title')}
          </p>
        </div>
        <ChevronUpIcon
          className={cn(
            isExpanded && 'rotate-180',
            'h-4 w-4 text-[rgb(161,98,7)] dark:text-[rgb(253,224,71)] transition-transform duration-300'
          )}
        />
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-[rgb(254,249,195)] dark:border-[rgb(81,66,27)]">
              <div className="p-3 max-w-full overflow-hidden">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TextFoldTag