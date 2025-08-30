import { createFileRoute } from '@tanstack/react-router'
import TopMenu from '@/components/TopMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  const plans = [
    {
      name: '免费版',
      price: '¥0',
      period: '永久免费',
      description: '适合个人用户和小团队',
      features: [
        '基础 AI 对话功能',
        '每月 100 条消息',
        '基础模板库',
        '标准客服支持',
      ],
      popular: false,
      buttonText: '开始使用',
      buttonVariant: 'outline' as const,
    },
    {
      name: '专业版',
      price: '¥29',
      period: '每月',
      description: '适合专业用户和中小企业',
      features: [
        '无限 AI 对话',
        '高级模板库',
        '自定义工作流',
        '优先客服支持',
        '团队协作功能',
        '数据导出功能',
      ],
      popular: true,
      buttonText: '立即升级',
      buttonVariant: 'default' as const,
    },
    {
      name: '企业版',
      price: '¥99',
      period: '每月',
      description: '适合大型企业和团队',
      features: [
        '专业版所有功能',
        '私有部署选项',
        '定制化开发',
        '专属客户经理',
        '24/7 技术支持',
        '高级安全保障',
        'API 接入支持',
      ],
      popular: false,
      buttonText: '联系销售',
      buttonVariant: 'outline' as const,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <TopMenu />
      
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">选择适合您的方案</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            无论您是个人用户还是企业团队，我们都有合适的定价方案满足您的需求
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card key={plan.name} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                  最受欢迎
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-2">{plan.period}</span>
                </div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button 
                  variant={plan.buttonVariant} 
                  className="w-full"
                  size="lg"
                >
                  {plan.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">常见问题</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-2">可以随时取消订阅吗？</h3>
              <p className="text-muted-foreground">是的，您可以随时取消订阅，取消后将在当前计费周期结束时生效。</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">是否支持免费试用？</h3>
              <p className="text-muted-foreground">免费版永久可用，专业版和企业版支持 7 天免费试用。</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">如何升级或降级方案？</h3>
              <p className="text-muted-foreground">您可以在设置页面随时更改您的订阅方案，更改将立即生效。</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">企业版是否支持定制？</h3>
              <p className="text-muted-foreground">是的，企业版支持根据您的具体需求进行定制开发和部署。</p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold mb-4">还有疑问？</h3>
          <p className="text-muted-foreground mb-6">
            我们的团队随时为您提供帮助
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" size="lg">
              联系客服
            </Button>
            <Button variant="outline" size="lg">
              查看文档
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}