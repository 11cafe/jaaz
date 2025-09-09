import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import TopMenu from '@/components/TopMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const { t } = useTranslation('pricing')
  const { authStatus } = useAuth()

  const handleUpgrade = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/create_checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(t('messages.paymentError'))
      }

      const data = await response.json()
      
      if (data.success && data.checkout_url) {
        // 在新窗口中打开支付页面
        window.open(data.checkout_url, '_blank', 'noopener,noreferrer')
      } else {
        throw new Error(data.error || t('messages.paymentError'))
      }
    } catch (error) {
      console.error('支付处理失败:', error)
      alert(t('messages.paymentErrorRetry'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getFeatures = (planKey: string): string[] => {
    const features = t(`plans.${planKey}.features`, { returnObjects: true })
    return Array.isArray(features) ? features : []
  }

  const getPlanPricing = (planKey: string) => {
    const pricing = t(`plans.${planKey}.pricing`, { returnObjects: true })
    return pricing && typeof pricing === 'object' ? pricing : {}
  }

  // 只有在用户已登录时才判断当前计划
  const currentUserLevel = authStatus.is_logged_in ? (authStatus.user_info?.level || 'free') : null

  const plans = [
    {
      key: 'free',
      name: t('plans.free.name'),
      pricing: getPlanPricing('free'),
      description: t('plans.free.description'),
      features: getFeatures('free'),
      popular: false,
      buttonText: (authStatus.is_logged_in && currentUserLevel === 'free') ? t('plans.current') : t('plans.free.buttonText'),
      buttonVariant: (authStatus.is_logged_in && currentUserLevel === 'free') ? 'default' as const : 'outline' as const,
      isCurrent: authStatus.is_logged_in && currentUserLevel === 'free',
    },
    {
      key: 'base',
      name: t('plans.base.name'),
      pricing: getPlanPricing('base'),
      description: t('plans.base.description'),
      features: getFeatures('base'),
      popular: true,
      buttonText: (authStatus.is_logged_in && currentUserLevel === 'base') ? t('plans.current') : (authStatus.is_logged_in ? t('plans.base.buttonTextLoggedIn') : t('plans.base.buttonText')),
      buttonVariant: (authStatus.is_logged_in && currentUserLevel === 'base') ? 'default' as const : 'default' as const,
      isCurrent: authStatus.is_logged_in && currentUserLevel === 'base',
    },
    {
      key: 'pro',
      name: t('plans.pro.name'),
      pricing: getPlanPricing('pro'),
      description: t('plans.pro.description'),
      features: getFeatures('pro'),
      popular: false,
      buttonText: (authStatus.is_logged_in && currentUserLevel === 'pro') ? t('plans.current') : (authStatus.is_logged_in ? t('plans.pro.buttonTextLoggedIn') : t('plans.pro.buttonText')),
      buttonVariant: (authStatus.is_logged_in && currentUserLevel === 'pro') ? 'default' as const : 'outline' as const,
      isCurrent: authStatus.is_logged_in && currentUserLevel === 'pro',
    },
    {
      key: 'max',
      name: t('plans.max.name'),
      pricing: getPlanPricing('max'),
      description: t('plans.max.description'),
      features: getFeatures('max'),
      popular: false,
      buttonText: (authStatus.is_logged_in && currentUserLevel === 'max') ? t('plans.current') : (authStatus.is_logged_in ? t('plans.max.buttonTextLoggedIn') : t('plans.max.buttonText')),
      buttonVariant: (authStatus.is_logged_in && currentUserLevel === 'max') ? 'default' as const : 'outline' as const,
      isCurrent: authStatus.is_logged_in && currentUserLevel === 'max',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <TopMenu />
      
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('subtitle')}
          </p>
          
          {/* Monthly/Yearly Toggle */}
          <div className="inline-flex items-center bg-muted p-1 rounded-lg">
            <button
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setBillingPeriod('monthly')}
            >
              {t('monthlyYearly.monthly')}
            </button>
            <button
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                billingPeriod === 'yearly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setBillingPeriod('yearly')}
            >
              {t('monthlyYearly.yearly')}
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <Card key={plan.key} className={`relative flex flex-col ${plan.isCurrent ? 'border-green-500 shadow-lg ring-2 ring-green-500/20' : plan.popular ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border'}`}>
              {plan.isCurrent && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-1">
                  {t('currentPlan')}
                </Badge>
              )}
              {!plan.isCurrent && plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-1">
                  {t('mostPopular')}
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-semibold">{plan.name}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">{plan.description}</CardDescription>
                <div className="mt-4">
                  {plan.key === 'free' ? (
                    <>
                      <span className="text-4xl font-bold">0</span>
                      <div className="text-sm text-muted-foreground mt-1">
                        {plan.pricing[billingPeriod]?.period || 'Forever Free'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center">
                        <span className="text-4xl font-bold">
                          {plan.pricing[billingPeriod]?.price || '$0'}
                        </span>
                        <span className="text-muted-foreground">
                          {plan.pricing[billingPeriod]?.period || '/Monthly'}
                        </span>
                        {billingPeriod === 'yearly' && plan.pricing[billingPeriod]?.originalPrice && (
                          <div className="mt-1">
                            <span className="text-sm text-muted-foreground line-through">
                              {plan.pricing[billingPeriod].originalPrice}
                            </span>
                            <span className="text-sm text-green-600 ml-2 font-medium">
                              Save {Math.round((1 - parseFloat(plan.pricing[billingPeriod].price.replace('$', '')) / parseFloat(plan.pricing[billingPeriod].originalPrice.replace('$', ''))) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-4 w-4 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter className="pt-4">
                <Button 
                  variant={plan.isCurrent ? 'secondary' : (plan.key === 'base' && plan.popular ? 'default' : 'outline')} 
                  className={`w-full ${plan.isCurrent ? 'cursor-not-allowed' : plan.key === 'base' && plan.popular ? 'bg-black text-white hover:bg-gray-800' : ''}`}
                  size="lg"
                  onClick={plan.isCurrent ? undefined : (plan.key !== 'free' ? handleUpgrade : undefined)}
                  disabled={plan.isCurrent || (plan.key !== 'free' && isLoading)}
                >
                  {plan.key !== 'free' && isLoading ? t('buttons.processing') : plan.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t('faq.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-2">{t('faq.questions.cancel.question')}</h3>
              <p className="text-muted-foreground">{t('faq.questions.cancel.answer')}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">{t('faq.questions.trial.question')}</h3>
              <p className="text-muted-foreground">{t('faq.questions.trial.answer')}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">{t('faq.questions.upgrade.question')}</h3>
              <p className="text-muted-foreground">{t('faq.questions.upgrade.answer')}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">{t('faq.questions.enterprise.question')}</h3>
              <p className="text-muted-foreground">{t('faq.questions.enterprise.answer')}</p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold mb-4">{t('contact.title')}</h3>
          <p className="text-muted-foreground mb-6">
            {t('contact.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" size="lg">
              {t('contact.customerService')}
            </Button>
            <Button variant="outline" size="lg">
              {t('contact.documentation')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}