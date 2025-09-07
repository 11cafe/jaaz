import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import TopMenu from '@/components/TopMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const { t } = useTranslation('pricing')

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

  const plans = [
    {
      key: 'starter',
      name: t('plans.starter.name'),
      price: t('plans.starter.price'),
      period: t('plans.starter.period'),
      description: t('plans.starter.description'),
      features: t('plans.starter.features', { returnObjects: true }) as string[],
      popular: false,
      buttonText: t('plans.starter.buttonText'),
      buttonVariant: 'outline' as const,
    },
    {
      key: 'basic',
      name: t('plans.basic.name'),
      price: t('plans.basic.price'),
      period: t('plans.basic.period'),
      description: t('plans.basic.description'),
      features: t('plans.basic.features', { returnObjects: true }) as string[],
      popular: true,
      buttonText: t('plans.basic.buttonText'),
      buttonVariant: 'default' as const,
    },
    {
      key: 'pro',
      name: t('plans.pro.name'),
      price: t('plans.pro.price'),
      period: t('plans.pro.period'),
      description: t('plans.pro.description'),
      features: t('plans.pro.features', { returnObjects: true }) as string[],
      popular: false,
      buttonText: t('plans.pro.buttonText'),
      buttonVariant: 'outline' as const,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <TopMenu />
      
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card key={plan.key} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                  {t('mostPopular')}
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
                  onClick={plan.buttonText === t('buttons.getStarted') && plan.price !== '$0' ? handleUpgrade : undefined}
                  disabled={plan.buttonText === t('buttons.getStarted') && plan.price !== '$0' && isLoading}
                >
                  {plan.buttonText === t('buttons.getStarted') && plan.price !== '$0' && isLoading ? t('buttons.processing') : plan.buttonText}
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