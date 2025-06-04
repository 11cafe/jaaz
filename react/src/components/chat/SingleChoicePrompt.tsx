import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InfoIcon } from 'lucide-react'
import { Markdown } from './Markdown'

export default function SingleChoicePrompt() {
  return (
    <div className="flex flex-col gap-2">
      <Card className="p-3">
        <div className="flex gap-2">
          <InfoIcon className="w-8 h-8" />
          <Markdown>
            {`**✨Post draft done!** I have made a post draft for you. Please review it. If you want to make any edits, please [open browser](https://www.medium.com) to **edit the post**. If you are happy with the post, please click the button below to submit the post.`}
          </Markdown>
        </div>
        <div className="flex gap-2">
          <Button
            size={'sm'}
            className="flex-1 bg-purple-600 dark:bg-purple-600 text-white"
          >
            Post
          </Button>
          <Button size={'sm'} variant={'secondary'} className="flex-1">
            Cancel
          </Button>
        </div>
        <Markdown>{`![My cat](https://i.imgur.com/gufUD2J.png) \n`}</Markdown>
      </Card>
    </div>
  )
}
