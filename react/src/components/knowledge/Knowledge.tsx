import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Switch } from '../ui/switch'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { ScrollArea } from '../ui/scroll-area'
import { Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import {
  getKnowledgeList,
  saveEnabledKnowledgeDataToSettings,
  type KnowledgeBase,
  type KnowledgeListParams,
  getKnowledgeById,
} from '@/api/knowledge'
import TopMenu from '../TopMenu'

// 获取本地设置的API
async function getSettings(): Promise<{
  enabled_knowledge_data?: KnowledgeBase[]
}> {
  try {
    const response = await fetch('/api/settings')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to get settings:', error)
    return {}
  }
}

export default function Knowledge() {
  const { t } = useTranslation()
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [enabledKnowledge, setEnabledKnowledge] = useState<Set<string>>(
    new Set()
  )

  // 详情弹窗状态
  const [selectedKnowledge, setSelectedKnowledge] =
    useState<KnowledgeBase | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  const pageSize = 12

  // Load enabled knowledge from settings
  useEffect(() => {
    const loadEnabledKnowledge = async () => {
      try {
        const settings = await getSettings()
        const enabledData = settings.enabled_knowledge_data || []
        const enabledIds = enabledData.map((kb) => kb.id)
        setEnabledKnowledge(new Set(enabledIds))
      } catch (error) {
        console.error('Failed to load enabled knowledge from settings:', error)
      }
    }

    loadEnabledKnowledge()
  }, [])

  // Fetch knowledge list
  const fetchKnowledgeList = async (params: KnowledgeListParams = {}) => {
    try {
      setLoading(true)
      const response = await getKnowledgeList({
        pageSize,
        pageNumber: currentPage,
        search: searchTerm.trim() || undefined,
        ...params,
      })

      setKnowledgeList(response.data.list)
      setTotalPages(response.data.pagination.total_pages)
    } catch (error) {
      console.error('Failed to fetch knowledge list:', error)
      toast.error('获取知识库列表失败')
      setKnowledgeList([])
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchKnowledgeList({ pageNumber: currentPage })
  }, [currentPage])

  // Search handler
  const handleSearch = () => {
    setCurrentPage(1)
    fetchKnowledgeList({ pageNumber: 1, search: searchTerm })
  }

  // Enter key search
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Toggle knowledge enable/disable
  const toggleKnowledge = async (knowledgeId: string, enabled: boolean) => {
    const newEnabled = new Set(enabledKnowledge)
    if (enabled) {
      newEnabled.add(knowledgeId)
    } else {
      newEnabled.delete(knowledgeId)
    }

    // Update local state immediately for UI responsiveness
    setEnabledKnowledge(newEnabled)

    // Get full knowledge data for enabled items and save to settings
    try {
      const enabledKnowledgeData: KnowledgeBase[] = []

      for (const id of newEnabled) {
        // Find in current list first
        let kb = knowledgeList.find((k) => k.id === id)

        // If not found or missing content, fetch full data
        if (!kb || !kb.content) {
          try {
            console.log(`Fetching full data for knowledge: ${id}`)
            kb = await getKnowledgeById(id)
          } catch (error) {
            console.error(`Failed to fetch knowledge ${id}:`, error)
            // Use partial data if available
            kb = knowledgeList.find((k) => k.id === id)
          }
        }

        if (kb) {
          enabledKnowledgeData.push(kb)
        }
      }

      // Save complete data to settings
      await saveEnabledKnowledgeDataToSettings(enabledKnowledgeData)
      console.log(
        `Saved ${enabledKnowledgeData.length} enabled knowledge items to settings`
      )
      toast.success('知识库设置已保存')
    } catch (error) {
      console.error('Failed to save knowledge data to settings:', error)
      toast.error('保存知识库设置失败')
      // Revert UI state on error
      const revertedEnabled = new Set(enabledKnowledge)
      if (enabled) {
        revertedEnabled.delete(knowledgeId)
      } else {
        revertedEnabled.add(knowledgeId)
      }
      setEnabledKnowledge(revertedEnabled)
    }
  }

  // Show knowledge detail
  const showKnowledgeDetail = (knowledge: KnowledgeBase) => {
    setSelectedKnowledge(knowledge)
    setShowDetailDialog(true)
  }

  // Close detail dialog
  const closeDetailDialog = () => {
    setShowDetailDialog(false)
    setSelectedKnowledge(null)
  }

  // Pagination handlers
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div>
      <TopMenu />
      <div className="flex flex-col px-6">
        <h1 className="text-2xl font-bold mb-4">知识库</h1>

        {/* Search Bar */}
        {/* <div className="flex gap-2 mb-4 max-w-md">
          <Input
            placeholder="搜索知识库..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button onClick={handleSearch} size="icon" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div> */}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            加载中...
          </div>
        )}

        {/* Empty State */}
        {!loading && knowledgeList.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? '没有找到相关知识库' : '暂无知识库'}
          </div>
        )}

        {/* Knowledge Grid */}
        {!loading && knowledgeList.length > 0 && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {knowledgeList.map((knowledge) => {
                const isEnabled = enabledKnowledge.has(knowledge.id)
                return (
                  <Card
                    key={knowledge.id}
                    className="relative cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                  >
                    {/* Cover Image */}
                    {knowledge.cover && (
                      <div
                        className="w-full h-32 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${knowledge.cover})` }}
                        onClick={() => showKnowledgeDetail(knowledge)}
                      />
                    )}

                    <CardHeader className={knowledge.cover ? 'pb-2' : 'pb-2'}>
                      <div className="flex items-start justify-between">
                        <h3
                          className="text-lg font-semibold truncate flex-1 mr-2"
                          onClick={() => showKnowledgeDetail(knowledge)}
                        >
                          {knowledge.name}
                        </h3>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) =>
                            toggleKnowledge(knowledge.id, checked)
                          }
                          className="flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </CardHeader>
                    <CardContent
                      className="pt-0"
                      onClick={() => showKnowledgeDetail(knowledge)}
                    >
                      {knowledge.description && (
                        <p className="text-sm text-muted-foreground text-ellipsis overflow-hidden">
                          <span className="block max-h-[3.6em] overflow-hidden leading-6">
                            {knowledge.description}
                          </span>
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{knowledge.is_public ? '公开' : '私有'}</span>
                        <div className="flex items-center gap-2">
                          <span>{isEnabled ? '已启用' : '未启用'}</span>
                          <Eye className="h-3 w-3 opacity-60" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>

                <span className="text-sm text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 知识库详情弹窗 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedKnowledge?.name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedKnowledge?.is_public ? '公开' : '私有'})
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedKnowledge && (
            <div className="flex-1 space-y-4">
              {/* Cover Image in Dialog */}
              {selectedKnowledge.cover && (
                <div className="w-full h-48 rounded-lg overflow-hidden">
                  <img
                    src={selectedKnowledge.cover}
                    alt={selectedKnowledge.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide image if it fails to load
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">
                    创建时间：
                  </span>
                  <span>
                    {new Date(selectedKnowledge.created_at).toLocaleString(
                      'zh-CN'
                    )}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    更新时间：
                  </span>
                  <span>
                    {new Date(selectedKnowledge.updated_at).toLocaleString(
                      'zh-CN'
                    )}
                  </span>
                </div>
              </div>

              {/* 描述 */}
              {selectedKnowledge.description && (
                <div>
                  <h4 className="font-medium mb-2">描述</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedKnowledge.description}
                  </p>
                </div>
              )}

              {/* 内容 */}
              {selectedKnowledge.content && (
                <div className="flex-1">
                  <h4 className="font-medium mb-2">内容</h4>
                  <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                    <pre className="text-sm whitespace-pre-wrap break-words">
                      {selectedKnowledge.content}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {/* 如果没有内容 */}
              {!selectedKnowledge.content && (
                <div className="flex-1 flex items-center justify-center py-12">
                  <p className="text-muted-foreground">暂无内容</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
