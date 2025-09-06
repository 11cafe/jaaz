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
    <div className='flex flex-col h-screen'>
      <ScrollArea className='h-full'>
        <TopMenu />

        <div className='relative flex flex-col items-center justify-center h-fit min-h-[calc(100vh-400px)] sm:min-h-[calc(100vh-460px)] pt-[40px] sm:pt-[60px] px-4 sm:px-6 select-none'>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className='w-full max-w-4xl mx-auto'
          >
            <h1 className='text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 mt-4 sm:mt-8 text-center'>
              {t('home:title')}
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className='w-full max-w-4xl mx-auto'
          >
            <p className='text-sm sm:text-base md:text-lg lg:text-xl text-gray-500 mb-6 sm:mb-8 text-center px-2 sm:px-4'>
              {t('home:subtitle')}
            </p>
          </motion.div>

          <div className='w-full max-w-xl mx-auto px-2 sm:px-0'>
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
                  system_prompt: localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT,
                })
              }}
              pending={isPending}
            />
          </div>
        </div>

        <CanvasList />
      </ScrollArea>
    </div>
  )
}
