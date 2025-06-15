import { Button } from '@/components/ui/button'
import { TOOL_CALL_NAME_MAPPING } from '@/constants'
import { cn } from '@/lib/utils'
import { ToolCall } from '@/types/types'
import { ChevronUpIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Markdown from 'react-markdown'
import MultiChoicePrompt from '../MultiChoicePrompt'
import SingleChoicePrompt from '../SingleChoicePrompt'
import { useEffect, useState } from 'react'
import { eventBus, TEvents } from '@/lib/event'

type ToolCallTagProps = {
  toolCall: ToolCall
  isExpanded: boolean
  onToggleExpand: () => void
}

const ToolCallTag: React.FC<ToolCallTagProps> = ({
  toolCall,
  isExpanded,
  onToggleExpand,
}) => {
  const { name, arguments: inputs } = toolCall.function

  let parsedArgs: Record<string, unknown> | null = null
  try {
    parsedArgs = JSON.parse(inputs)
  } catch (error) {
    /* empty */
  }

  if (name == 'prompt_user_multi_choice') {
    return <MultiChoicePrompt />
  }
  if (name == 'prompt_user_single_choice') {
    return <SingleChoicePrompt />
  }

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-[rgb(240,253,244)] dark:bg-[rgb(37,61,22)]">
      <Button
        variant={'secondary'}
        onClick={onToggleExpand}
        className={cn(
          'w-full justify-start text-left bg-[rgb(220,252,231)] hover:bg-[rgb(240,253,244)] dark:bg-[rgb(57,94,34)] dark:hover:bg-[rgb(37,61,22)]',
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
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path clipRule="evenodd" fillRule="evenodd" d="M20.599 1.5c-.376 0-.743.111-1.055.32l-5.08 3.385a18.747 18.747 0 0 0-3.471 2.987 10.04 10.04 0 0 1 4.815 4.815 18.748 18.748 0 0 0 2.987-3.472l3.386-5.079A1.902 1.902 0 0 0 20.599 1.5Zm-8.3 14.025a18.76 18.76 0 0 0 1.896-1.207 8.026 8.026 0 0 0-4.513-4.513A18.75 18.75 0 0 0 8.475 11.7l-.278.5a5.26 5.26 0 0 1 3.601 3.602l.502-.278ZM6.75 13.5A3.75 3.75 0 0 0 3 17.25a1.5 1.5 0 0 1-1.601 1.497.75.75 0 0 0-.7 1.123 5.25 5.25 0 0 0 9.8-2.62 3.75 3.75 0 0 0-3.75-3.75Z"></path>
            </svg>
            {TOOL_CALL_NAME_MAPPING[name]}
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
            <div className="p-2 break-all">
              <Markdown>{inputs}</Markdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ToolCallTag
