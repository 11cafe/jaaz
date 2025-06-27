import React, { useState } from 'react'
import HomeHeader from '../home/HomeHeader'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { PlusIcon } from 'lucide-react'

import Editor from './Editor'
import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog'

// Sample data for knowledge base items
const knowledgeItems = [
  { id: 1, title: 'Item 1', description: 'Description for item 1' },
  { id: 2, title: 'Item 2', description: 'Description for item 2' },
]

export default function Knowledge() {
  const [showEditor, setShowEditor] = useState(false)
  const [markdown, setMarkdown] = useState('')

  return (
    <div>
      <HomeHeader />
      <div className="flex flex-col px-6">
        <h1 className="text-2xl font-bold mb-4">Knowledge</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              className="w-fit mb-5"
              onClick={() => setShowEditor((prev) => !prev)}
            >
              <PlusIcon className="mr-2" />
              Add Knowledge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw]">
            <Editor knowledgeID="new" />
          </DialogContent>
        </Dialog>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {knowledgeItems.map((item) => (
            <Card key={item.id}>
              <CardHeader className="text-lg font-bold">
                {item.title}
              </CardHeader>
              <CardContent>{item.description}</CardContent>
            </Card>
          ))}
        </div>
        {/* {showEditor && <Editor curPath={''} setCurPath={() => {}} />} */}
      </div>
    </div>
  )
}
