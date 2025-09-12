import { createCanvas } from '@/api/canvas'
import ChatTextarea from '@/components/chat/ChatTextarea'
import CanvasList from '@/components/home/CanvasList'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useConfigs } from '@/contexts/configs'
import { DEFAULT_SYSTEM_PROMPT } from '@/constants'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { nanoid } from 'nanoid'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import TopMenu from '@/components/TopMenu'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { setInitCanvas } = useConfigs()

  const { mutate: createCanvasMutation, isPending } = useMutation({
    mutationFn: createCanvas,
    onSuccess: (data, variables) => {
      setInitCanvas(true)

      // 将用户消息存储到localStorage，供canvas页面立即显示
      if (variables.messages && variables.messages.length > 0) {
        const messageData = {
          sessionId: variables.session_id,
          message: variables.messages[0],
          timestamp: Date.now(),
          canvasId: data.id,
        }
        localStorage.setItem('initial_user_message', JSON.stringify(messageData))
      }

      // 立即跳转到canvas页面，移除不必要的延迟
      navigate({
        to: '/canvas/$id',
        params: { id: data.id },
        search: {
          sessionId: variables.session_id,
        },
      })
    },
    onError: (error) => {
      console.error('[debug] Canvas创建失败:', error)
      toast.error(t('common:messages.error'), {
        description: error.message,
      })
    },
  })

  return (
    <div className='flex flex-col h-screen relative overflow-hidden bg-soft-blue-radial'>

      <ScrollArea className='h-full relative z-10'>
        <TopMenu />

        <div className='relative flex flex-col items-center justify-center h-fit min-h-[calc(100vh-400px)] sm:min-h-[calc(100vh-460px)] pt-[40px] sm:pt-[60px] px-4 sm:px-6 select-none'>
          {/* 主内容区域 - 添加玻璃形态效果 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.21, 1.11, 0.81, 0.99] }}
            className='w-full max-w-4xl mx-auto backdrop-blur-sm bg-white/60 dark:bg-gray-800/40 rounded-3xl p-8 sm:p-12 shadow-lg border border-stone-200/50 dark:border-gray-700/50'
          >
            <h1 className='text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-center 
                           bg-gradient-to-br from-gray-900 via-gray-700 to-stone-600 
                           dark:from-white dark:via-gray-200 dark:to-stone-300 
                           bg-clip-text text-transparent leading-tight'>
              {t('home:title')}
            </h1>
            
            <p className='text-sm sm:text-base md:text-lg lg:text-xl text-stone-600 dark:text-stone-300 
                          mb-8 sm:mb-10 text-center px-2 sm:px-4 leading-relaxed font-medium'>
              {t('home:subtitle')}
            </p>

            <div className='w-full max-w-xl mx-auto'>
              <ChatTextarea
                className='w-full'
                messages={[]}
                onSendMessages={(messages, configs) => {
                  createCanvasMutation({
                    name: t('home:newCanvas'),
                    canvas_id: nanoid(),
                    messages: messages,
                    session_id: nanoid(),
                    text_model: configs.textModel,
                    tool_list: configs.toolList,
                    model_name: configs.modelName,
                    system_prompt: localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT,
                  })
                }}
                pending={isPending}
              />
            </div>
          </motion.div>
        </div>

        {/* Canvas 列表区域 - 添加微妙的背景 */}
        <div className='relative z-10 mt-8 sm:mt-12'>
          <CanvasList />
        </div>

        {/* Footer区域 */}
        <footer className='relative z-10 mt-16 sm:mt-20 border-t border-stone-200/50 dark:border-gray-700/50'>
          <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12'>
            <div className='flex flex-col items-center space-y-6'>
              {/* Logo和标题 */}
              <div className='text-center'>
                <h3 className='text-lg sm:text-xl font-semibold bg-gradient-to-r from-gray-900 via-gray-700 to-stone-600 dark:from-white dark:via-gray-200 dark:to-stone-300 bg-clip-text text-transparent'>
                  MagicArt AI Image Generator
                </h3>
                <p className='mt-2 text-sm text-stone-600 dark:text-stone-400'>
                  Unleash your creativity with AI-powered image generation
                </p>
              </div>

              {/* 链接区域 */}
              <div className='flex items-center space-x-8'>
                <a 
                  href='/privacy' 
                  className='text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors duration-200 hover:underline decoration-2 underline-offset-4'
                >
                  Privacy Policy
                </a>
                <div className='w-px h-4 bg-stone-300 dark:bg-stone-600'></div>
                <a 
                  href='/terms' 
                  className='text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors duration-200 hover:underline decoration-2 underline-offset-4'
                >
                  Terms of Service
                </a>
                <div className='w-px h-4 bg-stone-300 dark:bg-stone-600'></div>
                <a 
                  href='mailto:support@magicart.cc' 
                  className='text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors duration-200 hover:underline decoration-2 underline-offset-4'
                >
                  Contact Support
                </a>
              </div>

              {/* 版权信息 */}
              <div className='text-center pt-4 border-t border-stone-200/30 dark:border-gray-700/30 w-full max-w-md'>
                <p className='text-xs text-stone-500 dark:text-stone-500'>
                  © 2025 MagicArt AI Image Generator. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </ScrollArea>
    </div>
  )
}
