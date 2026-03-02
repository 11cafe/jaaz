import CommonDialogContent from '@/components/common/DialogContent'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type ProjectDeleteDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting?: boolean
  projectName?: string
}

const ProjectDeleteDialog: React.FC<ProjectDeleteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  projectName
}) => {
  const { t } = useTranslation()

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <CommonDialogContent open={isOpen}>
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('canvas:projectDeleteDialog.title')}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <DialogDescription className="text-gray-600 dark:text-gray-300 leading-relaxed">
            {t('canvas:projectDeleteDialog.description')}
          </DialogDescription>

          {projectName && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{t('canvas:projectDeleteDialog.projectNameLabel')}: </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{projectName}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 gap-3 sm:gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 sm:flex-none"
          >
            {t('canvas:projectDeleteDialog.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 sm:flex-none min-w-[100px]"
          >
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>{t('canvas:messages.deleting')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span>{t('canvas:projectDeleteDialog.delete')}</span>
              </div>
            )}
          </Button>
        </DialogFooter>
      </CommonDialogContent>
    </Dialog>
  )
}

export default ProjectDeleteDialog