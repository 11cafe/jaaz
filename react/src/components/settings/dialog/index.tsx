import CommonDialogContent from '@/components/common/DialogContent'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useConfigs } from '@/contexts/configs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SettingProviders from './providers'
import SettingProxy from './proxy'
import SettingSidebar, { SettingSidebarType } from './sidebar'
import { X } from 'lucide-react'

const SettingsDialog = () => {
  const { showSettingsDialog: open, setShowSettingsDialog } = useConfigs()
  const { t } = useTranslation()
  const [current, setCurrent] = useState<SettingSidebarType>('provider')

  const renderContent = () => {
    switch (current) {
      case 'proxy':
        return <SettingProxy />
      case 'provider':
      default:
        return <SettingProviders />
    }
  }

  return (
    <Dialog open={open} onOpenChange={setShowSettingsDialog}>
      <CommonDialogContent
        open={open}
        transformPerspective={6000}
        className="flex flex-col p-0 gap-0 w-screen! h-screen! max-h-[100vh]! max-w-[100vw]! rounded-none! border-none! shadow-none!"
        title="Settings"
      >
        <SidebarProvider className="h-[calc(100vh-60px)]! min-h-[calc(100vh-60px)]! flex-1 relative">
          <SettingSidebar
            current={current}
            setCurrent={setCurrent}
            onClose={() => setShowSettingsDialog(false)}
          />
          <ScrollArea className="max-h-[calc(100vh-50px)]! w-full">
            {renderContent()}
          </ScrollArea>
        </SidebarProvider>
      </CommonDialogContent>
    </Dialog>
  )
}

export default SettingsDialog
