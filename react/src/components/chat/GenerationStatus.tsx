import React from 'react'
import { motion, AnimatePresence } from 'motion/react'

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
  // 只在思考中时显示，完成和错误时不显示
  const shouldShow = isVisible && !isComplete && !isError

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            duration: 0.2
          }}
          className="flex items-center gap-3 mb-4"
        >
          {/* 旋转的magicart图标 */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
            className="w-6 h-6 flex-shrink-0"
          >
            <img
              src="/magicart.svg"
              alt="MagicArt"
              className="w-full h-full"
              style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.3))' }}
            />
          </motion.div>

          {/* 简单的黑色文字 */}
          <span className="text-black dark:text-white font-medium text-sm">
            Thinking...
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default GenerationStatus