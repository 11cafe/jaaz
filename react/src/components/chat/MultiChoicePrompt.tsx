import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SparkleIcon } from 'lucide-react'
import { Markdown } from './Markdown'

export default function MultiChoicePrompt() {
  const data = [
    '[Best under the radar AI tools for marketers?](https://www.reddit.com/r/digital_marketing/comments/1btayyg/best_under_the_radar_ai_tools_for_marketers/) - Posted 1 year ago on r/digital_marketing. This thread could be a good place to discuss innovative AI tools including yours.',

    '[How Do You Find AI Tools for Marketing?](https://www.reddit.com/r/marketing/comments/1gdgfyt/how_do_you_find_ai_tools_for_marketing/) - Posted 6 months ago on r/marketing. Relevant to share your tool as a solution to their query.',

    '[What AI tools are you using to help with performance marketing?](https://www.reddit.com/r/DigitalMarketing/comments/1k65uxz/what_ai_tools_are_you_using_to_help_with/) - Posted 17 days ago on r/DigitalMarketing. Your tool fits into this discussion on performance marketing tools.',

    '[What AI marketing tool do you WISH existed?](https://www.reddit.com/r/smallbusiness/comments/1k65uxz/what_ai_marketing_tool_do_you_wish_existed/) - Posted 10 months ago on r/smallbusiness. Presenting your tool here could answer the question of the requester.',

    '[Recommended AI Tools for Marketing](https://www.reddit.com/r/DigitalMarketing/comments/1k65uxz/recommended_ai_tools_for_marketing/) - Posted 4 months ago on r/DigitalMarketing. This thread discussing recommended tools is ideal for mentioning your product.',

    "[What's the most impressive AI tool you have ever tried for marketing?](https://www.reddit.com/r/marketing/comments/1gdgfyt/whats_the_most_impressive_ai_tool_you_have_ever/) - Posted 1 year ago on r/marketing. A good opportunity to introduce an impressive aspect of your tool.",

    'AI Tools for Content Creation - Older post on r/digital_marketing. Your tool’s features in content creation can be mentioned here.',

    'How effective have AI tools been in your marketing strategies? - Older thread on r/marketing where effectiveness of AI tools is discussed.',

    'AI Tools to Boost Your Marketing Efficiency - Posted some time ago in r/smallbusiness, a good space to show how your tool could be effective.',

    'Future of AI in Digital Marketing - Discussion of AI’s role in the future of digital marketing where your product could be highlighted.',
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Checkbox />
          <label>Select all</label>
        </div>
        <Button size={'sm'} variant={'outline'}>
          <SparkleIcon className="w-4 h-4" />
          Generate Reply 🤖 (10)
        </Button>
      </div>
      {data.map((item) => (
        <div key={item} className="flex items-center gap-2">
          <Checkbox />
          <Card className="w-full px-3 py-3">
            <Markdown>{item}</Markdown>
          </Card>
        </div>
      ))}
    </div>
  )
}
