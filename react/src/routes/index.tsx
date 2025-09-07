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
    <div className='flex flex-col h-screen relative overflow-hidden'>
      {/* 主背景渐变层 - 温暖米白色调 */}
      <div className='absolute inset-0 bg-gradient-to-br from-stone-50 via-gray-50 to-slate-100 dark:from-slate-900 dark:via-stone-900 dark:to-gray-900'></div>
      
      {/* 大型渐变装饰背景 - 微妙的暖色点缀 */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute left-1/2 -translate-x-1/2 -top-20 w-[400%] sm:w-[200%] lg:w-[150%] aspect-square 
                        opacity-30 animate-pulse-gentle'
             style={{
               background: 'radial-gradient(circle at center, rgba(255, 237, 213, 0.6) 0%, rgba(254, 243, 199, 0.4) 25%, rgba(245, 245, 244, 0.3) 50%, transparent 75%)',
               mask: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
               WebkitMask: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)'
             }}>
        </div>
      </div>

      {/* 微妙的纹理覆盖层 - 更细腻的网格 */}
      <div className='absolute inset-0 opacity-20 dark:opacity-10'
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23374151' fill-opacity='0.015'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3Cpath d='M20 20m-1 0a1 1 0 1 1 2 0a1 1 0 1 1-2 0'/%3E%3C/g%3E%3C/svg%3E")`,
             backgroundSize: '40px 40px'
           }}>
      </div>

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
      </ScrollArea>
    </div>
  )
}
