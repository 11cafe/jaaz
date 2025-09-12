import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('templates')
  
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
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder={t('search.placeholder')} 
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
              {t('messages.error')}
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              {t('buttons.reload')}
            </Button>
          </div>
        )}

        {/* Templates Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {templates.map((template) => (
            <Card key={template.id} className="group hover:shadow-lg hover:shadow-purple-100/40 dark:hover:shadow-purple-900/20 transition-all duration-300 overflow-hidden p-0 border-slate-200/40 dark:border-slate-700/40 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm">
              <div className="relative overflow-hidden">
                <div className="aspect-[3/2] bg-gradient-to-br from-gray-50/70 via-purple-50/60 to-indigo-50/60 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 relative overflow-hidden">
                  {/* 添加微妙的光效 */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
                  
                  {template.image ? (
                    <img 
                      src={template.image} 
                      alt={template.title}
                      className="w-full h-full object-cover transition-all duration-500 ease-out"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  
                  {/* 优化的占位符 */}
                  <div className={`absolute inset-0 flex items-center justify-center ${template.image ? 'hidden' : ''}`}>
                    <div className="flex flex-col items-center space-y-2 text-slate-400 dark:text-slate-500">
                      <Eye className="h-8 w-8 opacity-50" />
                      <span className="text-xs font-medium opacity-75">{t('messages.preview')}</span>
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <Button 
                    size="sm" 
                    className="bg-white/90 hover:bg-white text-slate-800 border-0 shadow-lg backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                    onClick={() => navigate({ to: `/template-use/${template.id}` })}
                  >
                    <Play className="h-4 w-4 mr-1 text-purple-600" />
                    {t('buttons.use')}
                  </Button>
                </div>
              </div>
              
              <CardHeader className="pb-3 pt-4 px-4 bg-gradient-to-b from-transparent to-slate-50/20 dark:to-slate-800/20">
                <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">{template.title}</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
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
              {searchTerm ? t('messages.noResults') : t('messages.empty')}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border text-center">
          <div className="flex items-center justify-center space-x-6 mb-4">
            <a 
              href='mailto:support@magicart.cc' 
              className='text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 hover:underline decoration-2 underline-offset-4'
            >
              Contact Support
            </a>
            <div className='w-px h-4 bg-border'></div>
            <a 
              href='/' 
              className='text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 hover:underline decoration-2 underline-offset-4'
            >
              Back to Home
            </a>
          </div>
          <p className="text-muted-foreground">
            © 2025 MagicArt AI Image Generator. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  )
}