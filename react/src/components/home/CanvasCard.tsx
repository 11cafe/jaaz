import { deleteCanvas, ListCanvasesResponse } from '@/api/canvas'
import { ImageIcon, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { formatDate } from '@/utils/formatDate'
import CanvasDeleteDialog from './CanvasDeleteDialog'

type CanvasCardProps = {
  index: number
  canvas: ListCanvasesResponse
  handleCanvasClick: (id: string) => void
  handleDeleteCanvas: () => void
}

const CanvasCard: React.FC<CanvasCardProps> = ({
  index,
  canvas,
  handleCanvasClick,
  handleDeleteCanvas,
}) => {
  const { t } = useTranslation()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDelete = async () => {
    try {
      await deleteCanvas(canvas.id)
      handleDeleteCanvas()
      toast.success(t('canvas:messages.canvasDeleted'))
    } catch (error) {
      toast.error(t('canvas:messages.failedToDelete'))
    }
    setShowDeleteDialog(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="border border-primary/20 rounded-xl cursor-pointer hover:border-primary/40 transition-all duration-300 hover:shadow-md hover:bg-primary/5 active:scale-99 relative group"
    >
      <CanvasDeleteDialog
        show={showDeleteDialog}
        setShow={setShowDeleteDialog}
        handleDeleteCanvas={handleDelete}
      >
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CanvasDeleteDialog>

      <div
        className="p-3 flex flex-col gap-2"
        onClick={() => handleCanvasClick(canvas.id)}
      >
        {canvas.thumbnail ? (
          <img
            src={canvas.thumbnail}
            alt={canvas.name}
            className="w-full h-40 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-40 bg-primary/10 rounded-lg flex items-center justify-center">
            <ImageIcon className="w-10 h-10 opacity-10" />
          </div>
        )}
        <div className="flex flex-col">
          <h3 className="text-lg font-bold">{canvas.name}</h3>
          <p className="text-sm text-gray-500">{formatDate(canvas.created_at)}</p>
        </div>
      </div>
    </motion.div>
  )
}

export default CanvasCard
