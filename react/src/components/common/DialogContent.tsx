import { cn } from '@/lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { AnimatePresence, motion } from 'motion/react'

type CommonDialogProps = {
  open: boolean
  children: React.ReactNode
  className?: string
  transformPerspective?: number
  title?: string
}

const CommonDialogContent: React.FC<CommonDialogProps> = ({
  open,
  children,
  className,
  transformPerspective = 500,
  title,
}) => {
  const openState = {
    opacity: 1,
    filter: 'blur(0px)',
    rotateX: 0,
    rotateY: 0,
    z: 0,
    transition: {
      duration: 0.5,
      ease: [0.17, 0.67, 0.51, 1],
      opacity: {
        delay: 0.2,
        duration: 0.4,
        ease: 'easeOut',
      },
    },
  }

  const initialState = {
    opacity: 0,
    filter: 'blur(12px)',
    z: -100,
    rotateY: 5,
    rotateX: 25,
    transition: {
      duration: 0.3,
      ease: [0.67, 0.17, 0.62, 0.64],
    },
  }

  return (
    <AnimatePresence>
      {open ? (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild>
            <motion.div
              className="fixed inset-0 z-45 bg-black/50 backdrop-blur-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          </Dialog.Overlay>
          <Dialog.Content asChild>
            <div className="fixed inset-0 flex items-center justify-center z-50">
              <motion.div
                className={cn(
                  'grid rounded-lg p-4 min-w-[300px] w-full max-w-lg gap-4 border bg-background shadow-lg sm:rounded-lg',
                  className
                )}
                initial={initialState}
                animate={openState}
                exit={initialState}
                style={{ transformPerspective }}
              >
                {/* Required DialogTitle for accessibility */}
                {title ? (
                  <Dialog.Title className="sr-only">{title}</Dialog.Title>
                ) : (
                  <VisuallyHidden.Root asChild>
                    <Dialog.Title>Dialog</Dialog.Title>
                  </VisuallyHidden.Root>
                )}
                {children}
              </motion.div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </AnimatePresence>
  )
}

export default CommonDialogContent
