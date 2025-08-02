import { listCanvases } from '@/api/canvas'
import CanvasCard from '@/components/home/CanvasCard'
import { useQuery } from '@tanstack/react-query'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

const CanvasList: React.FC = () => {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)

  const { data: canvases, refetch } = useQuery({
    queryKey: ['canvases'],
    queryFn: listCanvases,
    enabled: true, // 每次进入首页时都重新查询
    refetchOnMount: 'always',
  })

  const handleCanvasClick = (id: string) => {
    window.location.href = `/canvas/${id}`
  }

  const maxInitialItems = 8 // 2 rows × 4 columns
  const displayedCanvases = showAll
    ? canvases
    : canvases?.slice(0, maxInitialItems)
  const hasMoreProjects = canvases && canvases.length > maxInitialItems

  return (
    <div className='flex flex-col px-10 mt-10 gap-4 select-none max-w-[1200px] mx-auto'>
      <div className='flex items-center gap-8'>
        {canvases && canvases.length > 0 && (
          <span className='text-2xl font-bold'>{t('home:allProjects')}</span>
        )}
        <Button
          onClick={() => {
            fetch('/api/canvas/create', {
              method: 'POST',
              body: JSON.stringify({ name: 'Untitled' }),
            }).then((res) => {
              if (res.ok) {
                res.json().then((data) => {
                  window.location.href = `/canvas/${data.id}`
                })
              } else {
                res.json().then((data) => {
                  toast.error(data.error)
                })
              }
            })
          }}
        >
          <PlusIcon className='w-4 h-4' />
          {t('home:newProject', 'New Project')}
        </Button>
      </div>

      <div className='grid grid-cols-4 gap-4 w-full pb-4'>
        {displayedCanvases?.map((canvas, index) => (
          <CanvasCard
            key={canvas.id}
            index={index}
            canvas={canvas}
            handleCanvasClick={handleCanvasClick}
            handleDeleteCanvas={() => refetch()}
          />
        ))}
      </div>

      {hasMoreProjects && (
        <Button
          className='w-full'
          onClick={() => setShowAll(!showAll)}
          size={'lg'}
        >
          {showAll
            ? t('home:showLessProjects', 'Show Less Projects')
            : t('home:showMoreProjects', 'Show All Projects')}{' '}
          ({canvases?.length})
        </Button>
      )}
    </div>
  )
}

export default memo(CanvasList)
