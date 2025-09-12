import { AlertCircle, CreditCard, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface InsufficientPointsCardProps {
  currentPoints: number
  requiredPoints: number
}

const InsufficientPointsCard: React.FC<InsufficientPointsCardProps> = ({
  currentPoints,
  requiredPoints
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  console.log('🎨 [DEBUG] InsufficientPointsCard 渲染:', {
    currentPoints,
    requiredPoints,
    currentType: typeof currentPoints,
    requiredType: typeof requiredPoints
  })

  const handleViewPricing = () => {
    console.log('🔗 [DEBUG] 用户点击查看定价按钮，跳转到订阅页面')
    navigate({ to: '/pricing' })
  }

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 dark:border-orange-800 mb-4 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-lg">
          <AlertCircle className="h-5 w-5" />
          {t('common:points.insufficientTitle', '积分不足')}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 积分状态显示 */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-white/60 dark:bg-gray-900/60 rounded-lg border border-orange-100 dark:border-orange-800">
          {/* 当前余额 */}
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('common:points.currentBalance', '当前余额')}
            </div>
            <Badge 
              variant="secondary" 
              className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-lg px-3 py-1"
            >
              {currentPoints} {t('common:points.credits', '积分')}
            </Badge>
          </div>
          
          {/* 需要积分 */}
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('common:points.required', '需要')}
            </div>
            <Badge 
              className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-lg px-3 py-1"
            >
              {requiredPoints} {t('common:points.credits', '积分')}
            </Badge>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          <p className="mb-2">
            {t('common:points.insufficientDescription', 
              '抱歉，您的账户余额不足以完成此次图片生成。'
            )}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {t('common:points.upgradeHint', 
              '升级您的订阅计划以获得更多积分，畅享无限创作！'
            )}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="pt-2">
          <Button 
            onClick={handleViewPricing}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-sm"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {t('common:points.viewPricing', '查看定价')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* 功能特性 */}
        <div className="border-t border-orange-100 dark:border-orange-800 pt-3 mt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('common:points.upgradeFeatures', '升级后您将获得：')}
          </p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li className="flex items-center gap-1">
              <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
              {t('common:points.feature1', '更多积分用于图片生成')}
            </li>
            <li className="flex items-center gap-1">
              <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
              {t('common:points.feature2', '优先处理和更快生成速度')}
            </li>
            <li className="flex items-center gap-1">
              <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
              {t('common:points.feature3', '高级AI模型和更多功能')}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default InsufficientPointsCard