import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, CheckCircle, XCircle, Sparkles, Upload, Brain } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export interface GenerationStatusProps {
  isVisible: boolean
  message: string
  progress: number
  isComplete: boolean
  isError: boolean
  timestamp?: number
}

const GenerationStatus: React.FC<GenerationStatusProps> = ({
  isVisible,
  message,
  progress,
  isComplete,
  isError,
  timestamp
}) => {
  const getStatusIcon = () => {
    if (isError) {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
    if (isComplete) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    
    // 根据进度显示不同图标
    if (progress <= 0.3) {
      return <Brain className="w-5 h-5 text-blue-500 animate-pulse" />
    } else if (progress <= 0.7) {
      return <Sparkles className="w-5 h-5 text-purple-500 animate-bounce" />
    } else {
      return <Upload className="w-5 h-5 text-orange-500 animate-pulse" />
    }
  }

  const getProgressColor = () => {
    if (isError) return 'bg-red-500'
    if (isComplete) return 'bg-green-500'
    if (progress <= 0.3) return 'bg-blue-500'
    if (progress <= 0.7) return 'bg-purple-500'
    return 'bg-orange-500'
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 25,
            duration: 0.3 
          }}
          className="mb-4 p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-700 
                     border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm"
        >
          <div className="flex items-center space-x-3 mb-3">
            <div className="flex-shrink-0">
              {isError || isComplete ? (
                getStatusIcon()
              ) : (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                isError 
                  ? 'text-red-700 dark:text-red-300' 
                  : isComplete 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-slate-700 dark:text-slate-300'
              }`}>
                {message}
              </p>
              {timestamp && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {new Date(timestamp).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          
          {!isError && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>进度</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${getProgressColor()}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                />
              </div>
            </div>
          )}
          
          {/* 装饰性动画点 */}
          {!isError && !isComplete && (
            <div className="flex justify-center mt-3 space-x-1">
              {[0, 1, 2].map((index) => (
                <motion.div
                  key={index}
                  className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: index * 0.2,
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default GenerationStatus