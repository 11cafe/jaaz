import { createFileRoute, useNavigate } from '@tanstack/react-router'
import TopMenu from '@/components/TopMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Eye, Play, Loader2 } from 'lucide-react'
import { getTemplates, type Template, type TemplateSearchParams } from '@/api/templates'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'

export const Route = createFileRoute('/templates')({
  component: TemplatesPage,
})

function TemplatesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  
  const searchParams: TemplateSearchParams = useMemo(() => ({
    search: searchTerm || undefined,
    page: 1,
    limit: 50, // 使用后端允许的最大值来获取所有模版
    sort_by: 'downloads',
    sort_order: 'desc'
  }), [searchTerm])

  const { data: templatesData, isLoading, error } = useQuery({
    queryKey: ['templates', searchParams],
    queryFn: () => getTemplates(searchParams),
    staleTime: 5 * 60 * 1000,
  })


  const templates = templatesData?.templates || []


  return (
    <div className="min-h-screen bg-background">
      <TopMenu />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">模板</h1>
          <p className="text-muted-foreground">
            精选优质模板，助您快速创作出色作品
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="搜索模板..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
              }}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              加载模板时出现错误，请稍后重试
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              重新加载
            </Button>
          </div>
        )}

        {/* Templates Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {templates.map((template) => (
            <Card key={template.id} className="group hover:shadow-lg transition-shadow overflow-hidden p-0">
              <div className="relative overflow-hidden">
                <div className="aspect-[3/2] bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                  {template.image ? (
                    <img 
                      src={template.image} 
                      alt={template.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 flex items-center justify-center text-muted-foreground ${template.image ? 'hidden' : ''}`}>
                    <Eye className="h-8 w-8" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => navigate({ to: `/template-use/${template.id}` })}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    使用
                  </Button>
                </div>
              </div>
              
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-lg">{template.title}</CardTitle>
                <CardDescription className="text-sm">
                  {template.description}
                </CardDescription>
              </CardHeader>
              
            </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && templates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchTerm ? '没有找到匹配的模板' : '暂无模板'}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}