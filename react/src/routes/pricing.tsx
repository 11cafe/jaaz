import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import TopMenu from '@/components/TopMenu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthCookie, AUTH_COOKIES } from '@/utils/cookies'
import { toast } from 'sonner'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingOperation, setLoadingOperation] = useState<'cancel' | 'upgrade' | string | null>(null) // 追踪具体的操作类型
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [apiCurrentLevel, setApiCurrentLevel] = useState<string | null>(null)
  const [apiIsLoggedIn, setApiIsLoggedIn] = useState<boolean | null>(null)
  const [apiDataLoaded, setApiDataLoaded] = useState(false)
  const { t } = useTranslation('pricing')
  const { authStatus, refreshAuth } = useAuth()
  
  // 🎯 根据用户等级自动设置billing period的辅助函数
  const setBillingPeriodFromLevel = useCallback((level: string | null) => {
    if (!level) return
    
    console.log(`🔧 PRICING: 根据用户等级自动设置billing period，level: "${level}"`)
    
    if (level.endsWith('_yearly')) {
      console.log('🔧 PRICING: 检测到yearly等级，自动切换到Yearly标签')
      setBillingPeriod('yearly')
    } else if (level.endsWith('_monthly')) {
      console.log('🔧 PRICING: 检测到monthly等级，自动切换到Monthly标签')
      setBillingPeriod('monthly')
    } else if (level === 'free') {
      console.log('🔧 PRICING: 检测到free等级，保持Monthly标签')
      setBillingPeriod('monthly')
    }
    // 其他情况保持当前设置不变
  }, [])
  
  // 🎯 监听AuthContext的用户等级变化，自动设置billing period
  useEffect(() => {
    const currentUserLevel = authStatus.is_logged_in ? authStatus.user_info?.level : null
    if (currentUserLevel && !apiDataLoaded) {
      // 只在API数据还未加载时才使用AuthContext数据，避免重复设置
      console.log('🔧 PRICING: 从AuthContext检测到用户等级变化，自动设置billing period')
      setBillingPeriodFromLevel(currentUserLevel)
    }
  }, [authStatus.user_info?.level, apiDataLoaded, setBillingPeriodFromLevel])
  
  // 🔄 页面加载时强制刷新认证状态，确保用户等级是最新的
  useEffect(() => {
    console.log('🔄 PRICING: 页面加载，强制刷新用户认证状态以获取最新等级')
    console.log('🔄 PRICING: 当前authStatus:', authStatus)
    
    // 🎯 调用专门的后端pricing接口获取用户level信息
    const fetchPricingInfo = async () => {
      try {
        console.log('🔄 PRICING: 调用后端/api/pricing接口获取用户等级信息...')
        const response = await fetch('/api/pricing', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (response.ok) {
          const pricingData = await response.json()
          console.log('✅ PRICING: 后端返回的定价数据:', pricingData)
          
          // 🎯 将API返回的数据存储到state中
          setApiIsLoggedIn(pricingData.is_logged_in)
          setApiCurrentLevel(pricingData.current_level)
          
          // 🎯 根据获取到的等级自动设置billing period
          setBillingPeriodFromLevel(pricingData.current_level)
          
          if (pricingData.is_logged_in) {
            console.log(`🎯 PRICING: 从后端获取到用户level: "${pricingData.current_level}"`)
            console.log(`🎯 PRICING: 用户信息:`, pricingData.user_info)
            console.log(`🎯 PRICING: 可用套餐:`, pricingData.available_plans)
            console.log(`🎯 PRICING: 已设置apiCurrentLevel为: "${pricingData.current_level}"`)
          } else {
            console.log('⚠️ PRICING: 用户未登录，显示默认套餐')
            console.log(`⚠️ PRICING: 原因: ${pricingData.message}`)
            console.log(`🎯 PRICING: 已设置apiCurrentLevel为: null`)
          }
        } else {
          console.log(`❌ PRICING: 后端pricing接口调用失败，状态码: ${response.status}`)
          setApiIsLoggedIn(false)
          setApiCurrentLevel(null)
        }
        
        // 🎯 标记API数据已加载完成（无论成功或失败）
        setApiDataLoaded(true)
        console.log('✅ PRICING: API数据加载完成，可以渲染套餐状态')
      } catch (error) {
        console.error('❌ PRICING: 调用后端pricing接口异常:', error)
        // 即使出错也要标记为已加载，避免无限loading
        setApiDataLoaded(true)
      }
    }
    
    // 同时执行pricing接口检查和常规刷新
    fetchPricingInfo()
    
    // 清除可能过期的缓存数据
    localStorage.removeItem('auth_cache_timestamp')
    // 强制刷新认证状态
    refreshAuth().then(() => {
      console.log('🔄 PRICING: refreshAuth完成，更新后的authStatus:', authStatus)
    }).catch(error => {
      console.error('❌ PRICING: refreshAuth失败:', error)
    })
  }, [])
  
  // 🎉 监听支付成功事件，实时更新用户等级
  useEffect(() => {
    const handlePaymentSuccess = () => {
      console.log('🎉 检测到支付成功，刷新用户等级')
      setTimeout(() => {
        refreshAuth() // 延迟刷新，确保后端数据已更新
      }, 1000)
    }
    
    const handleAuthRefresh = () => {
      console.log('🔄 检测到认证状态刷新')
      refreshAuth()
    }
    
    // 监听自定义事件
    window.addEventListener('auth-force-refresh', handleAuthRefresh)
    
    // 清理事件监听器
    return () => {
      window.removeEventListener('auth-force-refresh', handleAuthRefresh)
    }
  }, [refreshAuth])

  const handleUpgrade = useCallback(async (planType: string) => {
    try {
      setIsLoading(true)
      setLoadingOperation(`upgrade-${planType}`) // 设置具体的升级操作
      
      // 🔧 构建请求头，包含多种认证方式
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      // 尝试添加Bearer token（如果存在）
      const token = getAuthCookie(AUTH_COOKIES.ACCESS_TOKEN)
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
        console.log('🔑 Added Bearer token to request')
      } else {
        console.log('🍪 Using httpOnly cookies for authentication')
      }
      
      // 🆕 构建请求体，包含计划类型和计费周期
      const requestBody = {
        plan_type: planType,
        billing_period: billingPeriod
      }
      
      console.log('🎯 PRICING: 创建订单请求:', requestBody)
      
      const response = await fetch('/api/billing/create_order', {
        method: 'POST',
        credentials: 'include', // 重要：包含httpOnly cookies
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(t('messages.paymentError'))
      }

      const data = await response.json()
      
      if (data.success && data.checkout_url) {
        // 直接跳转到支付页面
        window.location.href = data.checkout_url
      } else {
        throw new Error(data.error || t('messages.paymentError'))
      }
    } catch (error) {
      console.error('支付处理失败:', error)
      toast.error(t('messages.paymentErrorRetry'))
    } finally {
      setIsLoading(false)
      setLoadingOperation(null) // 清除loading操作状态
    }
  }, [billingPeriod, t])

  const handleCancelSubscription = useCallback(async () => {
    try {
      setIsLoading(true)
      setLoadingOperation('cancel') // 设置取消订阅操作
      
      console.log('🚀 PRICING: 开始取消订阅...')
      
      // 🔧 构建请求头，包含多种认证方式
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      // 尝试添加Bearer token（如果存在）
      const token = getAuthCookie(AUTH_COOKIES.ACCESS_TOKEN)
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
        console.log('🔑 Added Bearer token to cancel request')
      } else {
        console.log('🍪 Using httpOnly cookies for cancel authentication')
      }
      
      const response = await fetch('/api/billing/cancel_subscription', {
        method: 'POST',
        credentials: 'include', // 重要：包含httpOnly cookies
        headers
      })

      if (!response.ok) {
        throw new Error(t('messages.paymentError'))
      }

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ PRICING: 订阅取消成功')
        toast.success('Subscription cancelled successfully!', {
          duration: 4000,
        })
        
        // 强制刷新认证状态以更新用户等级
        setTimeout(() => {
          refreshAuth()
          // 强制触发页面数据重新加载
          window.dispatchEvent(new CustomEvent('auth-force-refresh'))
          // 重新获取定价信息
          window.location.reload()
        }, 1000)
      } else {
        throw new Error(data.message || 'Failed to cancel subscription')
      }
    } catch (error) {
      console.error('取消订阅失败:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to cancel subscription: ${errorMessage}`, {
        duration: 4000,
      })
      
      // 即使失败也要刷新状态，以防服务器状态已变更
      setTimeout(() => {
        refreshAuth()
        window.dispatchEvent(new CustomEvent('auth-force-refresh'))
      }, 1000)
    } finally {
      setIsLoading(false)
      setLoadingOperation(null) // 清除loading操作状态
    }
  }, [t, refreshAuth])

  const getFeatures = (planKey: string): string[] => {
    const features = t(`plans.${planKey}.features`, { returnObjects: true })
    return Array.isArray(features) ? features : []
  }

  const getPlanPricing = (planKey: string): Record<string, any> => {
    const pricing = t(`plans.${planKey}.pricing`, { returnObjects: true })
    return pricing && typeof pricing === 'object' ? pricing as Record<string, any> : {}
  }

  const calculateDiscount = (currentPrice: string, originalPrice: string) => {
    const current = parseFloat(currentPrice.replace('$', ''))
    const original = parseFloat(originalPrice.replace('$', ''))
    return Math.round((1 - current / original) * 100)
  }

  // 🔧 获取用户当前等级，支持实时更新 - 修复fallback逻辑
  const currentUserLevel = authStatus.is_logged_in ? authStatus.user_info?.level : null
  
  console.log('==================================================')
  console.log('🔍 PRICING: 用户认证状态详细分析')
  console.log('==================================================')
  console.log('📋 原始authStatus对象:', authStatus)
  console.log('📋 详细认证状态:', {
    is_logged_in: authStatus.is_logged_in,
    user_info_exists: !!authStatus.user_info,
    user_info_raw: authStatus.user_info,
    user_level_raw: authStatus.user_info?.level,
    user_level_type: typeof authStatus.user_info?.level,
    user_email: authStatus.user_info?.email,
    user_id: authStatus.user_info?.id,
    final_computed_level: currentUserLevel
  })
  
  console.log('🎯 PRICING: 等级获取结果:')
  console.log(`   - 用户是否登录: ${authStatus.is_logged_in}`)
  console.log(`   - 用户信息是否存在: ${!!authStatus.user_info}`)
  console.log(`   - 原始level值: "${authStatus.user_info?.level}" (${typeof authStatus.user_info?.level})`)
  console.log(`   - 最终使用的level: "${currentUserLevel}"`)
  
  // 🚨 如果用户已登录但level为undefined，强制刷新认证状态
  if (authStatus.is_logged_in && !authStatus.user_info?.level) {
    console.log('⚠️ PRICING: 用户已登录但level为undefined，强制刷新认证状态')
    setTimeout(() => {
      console.log('🔄 PRICING: 执行强制刷新...')
      refreshAuth()
    }, 100)
  }

  // 🎯 修复套餐状态判断逻辑 - 支持新的7种level格式
  const isCurrentPlan = (planLevel: string) => {
    // 🚨 如果API数据还没加载完成，不显示任何计划为当前计划，避免闪烁
    if (!apiDataLoaded) {
      console.log(`🎯 PRICING: 套餐判断 "${planLevel.toUpperCase()}": API数据未加载，返回false避免闪烁`)
      return false
    }
    
    // 优先使用API返回的数据，如果不可用则使用AuthContext数据
    const isLoggedIn = apiIsLoggedIn !== null ? apiIsLoggedIn : authStatus.is_logged_in
    const userLevel = apiCurrentLevel !== null ? apiCurrentLevel : currentUserLevel
    const hasLevel = !!userLevel
    
    // 🆕 新的匹配逻辑：支持具体的monthly/yearly计划对比
    let isMatch = false
    
    if (planLevel === 'free') {
      // Free计划直接匹配
      isMatch = userLevel === 'free'
    } else {
      // 付费计划需要结合billing period进行匹配
      const expectedLevel = `${planLevel}_${billingPeriod}`
      isMatch = userLevel === expectedLevel
    }
    
    const result = isLoggedIn && hasLevel && isMatch
    
    console.log(`🎯 PRICING: 套餐判断 "${planLevel.toUpperCase()}" (${billingPeriod}):`)
    console.log(`   - API数据已加载: ${apiDataLoaded}`)
    console.log(`   - 数据源: ${apiCurrentLevel !== null ? 'API数据' : 'AuthContext数据'}`)
    console.log(`   - 用户已登录: ${isLoggedIn}`)
    console.log(`   - 有等级信息: ${hasLevel} (level="${userLevel}")`)
    console.log(`   - 期望等级: ${planLevel === 'free' ? 'free' : `${planLevel}_${billingPeriod}`}`)
    console.log(`   - 等级匹配: ${isMatch}`)
    console.log(`   - 最终结果: ${result ? '✅ 当前计划' : '❌ 非当前计划'}`)
    
    return result
  }
  
  const plans = [
    {
      id: 'free',
      key: 'free',
      name: t('plans.free.name'),
      pricing: getPlanPricing('free'),
      description: t('plans.free.description'),
      features: getFeatures('free'),
      popular: false,
      isCurrent: isCurrentPlan('free'),
    },
    {
      id: 'base',
      key: 'base',
      name: t('plans.base.name'),
      pricing: getPlanPricing('base'),
      description: t('plans.base.description'),
      features: getFeatures('base'),
      popular: false, // 🔄 移除Most Popular样式
      isCurrent: isCurrentPlan('base'),
    },
    {
      id: 'pro',
      key: 'pro',
      name: t('plans.pro.name'),
      pricing: getPlanPricing('pro'),
      description: t('plans.pro.description'),
      features: getFeatures('pro'),
      popular: false,
      isCurrent: isCurrentPlan('pro'),
    },
    {
      id: 'max',
      key: 'max',
      name: t('plans.max.name'),
      pricing: getPlanPricing('max'),
      description: t('plans.max.description'),
      features: getFeatures('max'),
      popular: false,
      isCurrent: isCurrentPlan('max'),
    },
  ]

  // 🎯 套餐状态总结日志 - 反映实际渲染状态 (包括按钮文本)
  console.log('==================================================')
  console.log('🎯 PRICING: 套餐状态总结 (实际渲染状态)')
  console.log('==================================================')
  plans.forEach(plan => {
    // 模拟按钮文本计算逻辑
    const getButtonText = () => {
      if (plan.isCurrent) return 'Current Plan'
      if (!apiDataLoaded) return '...'
      if (plan.key === 'free') return 'Get Started'
      return authStatus.is_logged_in ? `Upgrade to ${plan.name}` : `Get ${plan.name}`
    }
    
    const status = plan.isCurrent ? '✅ 当前计划' : '⭕ 可选择'
    const border = plan.isCurrent ? '绿色边框' : '普通边框'
    const badge = plan.isCurrent ? 'Current Plan' : '无标签'
    const buttonText = getButtonText()
    const renderState = apiDataLoaded ? '数据已加载' : '等待API数据'
    
    console.log(`${plan.id.toUpperCase()}: ${status} | ${border} | ${badge} | 按钮:"${buttonText}" | ${renderState}`)
  })
  
  const currentPlan = plans.find(plan => plan.isCurrent)
  const finalUserLevel = apiCurrentLevel !== null ? apiCurrentLevel : currentUserLevel
  
  console.log(`📊 PRICING: 渲染状态总结:`)
  console.log(`   - API数据已加载: ${apiDataLoaded}`)
  console.log(`   - 最终用户level: "${finalUserLevel}" (源: ${apiCurrentLevel !== null ? 'API' : 'AuthContext'})`)
  
  if (currentPlan) {
    console.log(`🎉 PRICING: 当前选中的计划是: ${currentPlan.id.toUpperCase()}`)
  } else {
    const reason = !apiDataLoaded ? '等待API数据加载' : `用户level="${finalUserLevel}"`
    console.log(`⚠️ PRICING: 没有找到当前计划，原因: ${reason}`)
  }
  console.log('==================================================')

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
          {plans.map((plan) => {
            
            // 🎯 动态计算按钮文本和变体，防止闪烁
            const getButtonText = () => {
              if (plan.isCurrent) {
                // 🎯 Free计划显示"Current Plan"，付费计划显示"Cancel Subscription"
                if (plan.key === 'free') {
                  return t('plans.current') // "Current Plan"
                } else {
                  return 'Cancel Subscription' // 付费计划当前计划显示取消订阅
                }
              }
              
              // 🚨 关键：如果API数据未加载，显示加载状态而不是升级文本
              if (!apiDataLoaded) {
                return '...' // 或者使用 t('buttons.loading')
              }
              
              // API数据已加载，安全显示升级文本
              if (plan.key === 'free') {
                // 🎯 Free计划只显示"Get Started"，不显示"Cancel Subscription"
                return t('plans.free.buttonText')
              } else {
                return authStatus.is_logged_in 
                  ? t(`plans.${plan.key}.buttonTextLoggedIn`)
                  : t(`plans.${plan.key}.buttonText`)
              }
            }
            
            const getButtonVariant = () => {
              if (plan.isCurrent) {
                // 🎯 Free计划用secondary样式，付费计划的取消订阅用低调的outline样式
                if (plan.key === 'free') {
                  return 'secondary' as const // Free计划的"Current Plan"
                } else {
                  return 'outline' as const // 付费计划的"Cancel Subscription" - 低调样式
                }
              }
              
              // 如果API数据未加载，使用中性样式
              if (!apiDataLoaded) {
                return 'outline' as const
              }
              
              // API数据已加载，使用outline样式
              return 'outline' as const
            }
            
            const buttonText = getButtonText()
            const buttonVariant = getButtonVariant()
            
            // 🎯 卡片样式：当前计划特殊样式，其他为普通样式
            const cardClassName = plan.isCurrent 
              ? 'border-green-500 shadow-lg ring-2 ring-green-500/20' 
              : 'border-border'
            
            return (
              <Card key={plan.key} id={plan.id} className={`relative flex flex-col ${cardClassName}`}>
                {/* 🎯 只显示当前计划标签 */}
                {plan.isCurrent ? (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-1">
                    {t('currentPlan')}
                  </Badge>
                ) : null}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-semibold">{plan.name}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">{plan.description}</CardDescription>
                <div className="mt-4">
                  {plan.key === 'free' ? (
                    <>
                      <span className="text-4xl font-bold">0</span>
                      <div className="text-sm text-muted-foreground mt-1">
                        {(plan.pricing as any)[billingPeriod]?.period || 'Forever Free'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold">
                            {(plan.pricing as any)[billingPeriod]?.price || '$0'}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {(plan.pricing as any)[billingPeriod]?.period || '/Monthly'}
                          </span>
                        </div>
                        {billingPeriod === 'yearly' && (plan.pricing as any)[billingPeriod]?.originalPrice && (
                          <div className="mt-1">
                            <span className="text-sm text-muted-foreground line-through">
                              {(plan.pricing as any)[billingPeriod].originalPrice}
                            </span>
                            <span className="text-sm text-green-600 ml-2 font-medium">
                              {t('discount.save', { 
                                percent: calculateDiscount((plan.pricing as any)[billingPeriod].price, (plan.pricing as any)[billingPeriod].originalPrice)
                              })}
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
                {/* 🎯 Free计划完全不显示任何按钮 */}
                {plan.key !== 'free' && (
                  <Button 
                    variant={buttonVariant} 
                    className="w-full"
                    size="lg"
                    onClick={(() => {
                      // 🎯 简化的点击逻辑：只处理付费计划（Free已被排除）
                      if (plan.isCurrent) {
                        // 当前付费计划：取消订阅
                        return () => handleCancelSubscription()
                      } else {
                        // 非当前付费计划：升级
                        return () => handleUpgrade(plan.key)
                      }
                    })()}
                    disabled={(() => {
                      // 🎯 只有在当前按钮的操作进行时才禁用此按钮
                      if (!apiDataLoaded) return true // API数据未加载时禁用
                      if (plan.isCurrent && loadingOperation === 'cancel') return true // 当前计划取消中
                      if (!plan.isCurrent && loadingOperation === `upgrade-${plan.key}`) return true // 升级到此计划中
                      return false // 其他情况允许点击
                    })()}
                  >
                    {(() => {
                      // 🎯 只在当前操作的按钮上显示loading
                      if (plan.isCurrent && loadingOperation === 'cancel') {
                        return t('buttons.processing') // 当前计划取消订阅中
                      } else if (!plan.isCurrent && loadingOperation === `upgrade-${plan.key}`) {
                        return t('buttons.processing') // 升级到此计划中
                      } else {
                        return buttonText // 显示正常文本
                      }
                    })()}
                  </Button>
                )}
              </CardFooter>
            </Card>
            )
          })}
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