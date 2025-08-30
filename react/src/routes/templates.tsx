import { createFileRoute } from '@tanstack/react-router'
import TopMenu from '@/components/TopMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Star, Download, Eye } from 'lucide-react'

export const Route = createFileRoute('/templates')({
  component: TemplatesPage,
})

function TemplatesPage() {
  const templates = [
    {
      id: 1,
      title: '拟真手办',
      description: '生成精美的手办模型图片，适合收藏和展示',
      image: '/api/placeholder/300/200',
      tags: ['midjourney', '3D'],
      downloads: 1200,
      rating: 4.8,
      category: 'nano-banana'
    },
    {
      id: 2,
      title: '复古风景动画',
      description: '创建具有复古风格的风景动画效果',
      image: '/api/placeholder/300/200',
      tags: ['midjourney'],
      downloads: 856,
      rating: 4.9,
      category: 'midjourney'
    },
    {
      id: 3,
      title: '撞色杂志封面',
      description: '设计时尚的杂志封面，色彩搭配丰富',
      image: '/api/placeholder/300/200',
      tags: ['midjourney'],
      downloads: 945,
      rating: 4.7,
      category: 'midjourney'
    },
    {
      id: 4,
      title: '蓝色',
      description: '蓝色主题的设计模板，适合科技类项目',
      image: '/api/placeholder/300/200',
      tags: ['midjourney'],
      downloads: 723,
      rating: 4.6,
      category: 'midjourney'
    },
    {
      id: 5,
      title: '浮世绘风格',
      description: '日式浮世绘艺术风格的创作模板',
      image: '/api/placeholder/300/200',
      tags: ['midjourney'],
      downloads: 1156,
      rating: 4.9,
      category: 'midjourney'
    },
    {
      id: 6,
      title: '复古黑板画',
      description: '复古黑板绘画风格，适合教育类内容',
      image: '/api/placeholder/300/200',
      tags: ['midjourney'],
      downloads: 634,
      rating: 4.5,
      category: 'midjourney'
    },
    {
      id: 7,
      title: '多彩线条风',
      description: '彩色线条艺术风格，现代感十足',
      image: '/api/placeholder/300/200',
      tags: ['midjourney'],
      downloads: 892,
      rating: 4.8,
      category: 'midjourney'
    },
    {
      id: 8,
      title: '撞色插画风',
      description: '撞色插画设计，适合品牌宣传',
      image: '/api/placeholder/300/200',
      tags: ['midjourney'],
      downloads: 567,
      rating: 4.4,
      category: 'midjourney'
    }
  ]

  const categories = [
    { name: '全部', value: 'all', count: templates.length },
    { name: 'Midjourney', value: 'midjourney', count: 7 },
    { name: 'Nano Banana', value: 'nano-banana', count: 1 },
    { name: 'GPT-Image', value: 'gpt-image', count: 0 }
  ]

  return (
    <div className="min-h-screen bg-background">
      <TopMenu />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">模板库</h1>
          <p className="text-muted-foreground">
            精选优质模板，助您快速创作出色作品
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="搜索模板..." 
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category.value}
                variant={category.value === 'all' ? 'default' : 'outline'}
                size="sm"
                className="whitespace-nowrap"
              >
                {category.name} ({category.count})
              </Button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="group hover:shadow-lg transition-shadow">
              <div className="relative overflow-hidden rounded-t-lg">
                <div className="aspect-[3/2] bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <Eye className="h-8 w-8" />
                  </div>
                </div>
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="text-xs">
                    {template.tags[0]}
                  </Badge>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary">
                      <Eye className="h-4 w-4 mr-1" />
                      预览
                    </Button>
                    <Button size="sm" variant="secondary">
                      <Download className="h-4 w-4 mr-1" />
                      使用
                    </Button>
                  </div>
                </div>
              </div>
              
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{template.title}</CardTitle>
                <CardDescription className="text-sm">
                  {template.description}
                </CardDescription>
              </CardHeader>
              
              <CardFooter className="pt-2">
                <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{template.rating}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Download className="h-4 w-4" />
                    <span>{template.downloads}</span>
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg">
            加载更多模板
          </Button>
        </div>
      </div>
    </div>
  )
}