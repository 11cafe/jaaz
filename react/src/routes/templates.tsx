import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import TopMenu from '@/components/TopMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    <div className='flex flex-col h-screen relative overflow-hidden bg-soft-blue-radial'>
      <ScrollArea className='h-full relative z-10'>
        <TopMenu />

        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 pt-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-800 dark:text-white drop-shadow-sm">
              {t('title')}
            </h1>
            <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-200 font-medium">
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-12">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-1 shadow-lg border border-white/20">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  placeholder={t('search.placeholder')}
                  className="pl-12 pr-4 py-3 text-lg border-0 bg-transparent focus:ring-0 focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                  }}
                />
              </div>
            </div>
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
          <div className="relative z-10">
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

        </div>

        {/* Footer */}
        <footer className='relative z-10 mt-16 sm:mt-20 border-t border-stone-200/50 dark:border-gray-700/50'>
          <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12'>
            <div className='flex flex-col items-center space-y-6'>
              {/* Logo和标题 */}
              <div className='text-center'>
                <h3 className='text-lg sm:text-xl font-semibold bg-gradient-to-r from-gray-900 via-gray-700 to-stone-600 dark:from-white dark:via-gray-200 dark:to-stone-300 bg-clip-text text-transparent'>
                  MagicArt AI Image Generator
                </h3>
                <p className='mt-2 text-sm text-stone-600 dark:text-stone-400'>
                  Unleash your creativity with AI-powered image generation
                </p>
              </div>

              {/* 链接区域 */}
              <div className='flex items-center space-x-8'>
                <a
                  href='/privacy'
                  className='text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors duration-200 hover:underline decoration-2 underline-offset-4'
                >
                  Privacy Policy
                </a>
                <div className='w-px h-4 bg-stone-300 dark:bg-stone-600'></div>
                <a
                  href='/terms'
                  className='text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors duration-200 hover:underline decoration-2 underline-offset-4'
                >
                  Terms of Service
                </a>
                <div className='w-px h-4 bg-stone-300 dark:bg-stone-600'></div>
                <a
                  href='mailto:support@magicart.cc'
                  className='text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors duration-200 hover:underline decoration-2 underline-offset-4'
                >
                  Contact Support
                </a>
              </div>

              {/* 版权信息 */}
              <div className='text-center pt-4 border-t border-stone-200/30 dark:border-gray-700/30 w-full max-w-md'>
                <p className='text-xs text-stone-500 dark:text-stone-500'>
                  © 2025 MagicArt AI Image Generator. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </ScrollArea>
    </div>
  )
}