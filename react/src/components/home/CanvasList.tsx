import { listCanvases } from '@/api/canvas'
import CanvasCard from '@/components/home/CanvasCard'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'

const CanvasList: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { authStatus } = useAuth()
  const isHomePage = location.pathname === '/'

  const { data: canvases, refetch } = useQuery({
    queryKey: ['canvases'],
    queryFn: listCanvases,
    enabled: isHomePage && authStatus.is_logged_in, // 只有在首页且已登录时才查询
    refetchOnMount: 'always',
  })

  // 🔄 监听认证状态变化，当登录/登出时刷新数据
  useEffect(() => {
    if (isHomePage && authStatus.is_logged_in) {
      console.log('🔄 CanvasList: Auth status changed to logged in, refetching canvases')
      refetch()
    }
  }, [authStatus.is_logged_in, isHomePage, refetch])

  const navigate = useNavigate()
  const handleCanvasClick = (id: string) => {
    navigate({ to: '/canvas/$id', params: { id } })
  }

  // 🚨 如果未登录，不显示项目列表
  if (!authStatus.is_logged_in) {
    console.log('🚫 CanvasList: User not logged in, not showing projects')
    return null
  }

  return (
    <div className="flex flex-col px-4 sm:px-6 md:px-10 mt-6 sm:mt-8 md:mt-10 gap-4 select-none max-w-[1200px] mx-auto">
      {canvases && canvases.length > 0 && (
        <motion.span
          className="text-xl sm:text-2xl font-bold px-2 sm:px-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {t('home:allProjects')}
        </motion.span>
      )}

      <AnimatePresence>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full pb-6 sm:pb-10 px-2 sm:px-0">
          {canvases?.map((canvas, index) => (
            <CanvasCard
              key={canvas.id}
              index={index}
              canvas={canvas}
              handleCanvasClick={handleCanvasClick}
              handleDeleteCanvas={() => refetch()}
            />
          ))}
        </div>
      </AnimatePresence>
    </div>
  )
}

export default memo(CanvasList)
