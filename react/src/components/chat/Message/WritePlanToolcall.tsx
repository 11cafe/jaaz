import React, { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
export default function WritePlanToolCall({ args }: { args: string }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { t } = useTranslation()

  let parsedArgs: {
    steps: {
      title: string
      description: string
    }[]
  } | null = null

  try {
    parsedArgs = JSON.parse(args)
  } catch (error) {}

  return (
    <div className="bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded-md shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="bg-purple-200/70 dark:bg-purple-800 p-1 rounded">
            <FileText className="h-4 w-4 text-purple-700 dark:text-purple-300" />
          </div>

          <p className="font-bold text-purple-900 dark:text-purple-100">
            {t('chat:plan.title')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {parsedArgs && (
            <div className="bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-xs px-2 py-0.5 rounded-full">
              {parsedArgs.steps.length}
            </div>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="border-t border-purple-200 dark:border-purple-950">
          <div className="p-3 space-y-2">
            {parsedArgs?.steps.map((step, index) => (
              <div
                key={`${step.title}-${index}`}
                className="bg-white dark:bg-gray-950 border border-purple-200 dark:border-purple-950 rounded-md p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-2">
                  <div className="bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-950 rounded-full p-0.5 mt-0.5 flex-shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-md font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {index + 1}. {step.title}
                    </h4>
                    {step.description && (
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
