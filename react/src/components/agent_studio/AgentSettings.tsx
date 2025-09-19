import { BotIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_SYSTEM_PROMPT } from '@/constants'

export default function AgentSettings() {
  const [systemPrompt, setSystemPrompt] = useState(
    localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT
  )

  const handleSave = () => {
    localStorage.setItem('system_prompt', systemPrompt)
    toast.success('System prompt saved')
  }

  const handleReset = () => {
    localStorage.setItem('system_prompt', DEFAULT_SYSTEM_PROMPT)
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
    toast.success('System prompt reset to default')
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={'sm'} variant="ghost">
          <BotIcon size={30} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-2xl font-bold">Agent Settings</DialogTitle>
        </div>
        <div className="flex items-center justify-between">
          <p className="font-bold">System Prompt</p>
          <Button size={'sm'} variant={'outline'} onClick={handleReset}>
            Reset to Default
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Enter your system prompt here"
            className="h-[60vh]"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={handleSave}>
          Save
        </Button>
      </DialogContent>
    </Dialog>
  )
}
