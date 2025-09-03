/**
 * Cookie 管理工具
 * 提供安全的认证信息存储和跨标签页状态同步
 */

interface CookieOptions {
  expires?: Date | number  // 过期时间（Date对象或天数）
  path?: string           // 路径
  domain?: string         // 域名
  secure?: boolean        // 只在HTTPS下传输
  sameSite?: 'strict' | 'lax' | 'none'  // CSRF保护
}

/**
 * 设置Cookie
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  // 设置过期时间
  if (options.expires) {
    const expires = typeof options.expires === 'number' 
      ? new Date(Date.now() + options.expires * 24 * 60 * 60 * 1000)
      : options.expires
    cookieString += `; expires=${expires.toUTCString()}`
  }

  // 设置路径（默认为根路径）
  cookieString += `; path=${options.path || '/'}`

  // 设置域名
  if (options.domain) {
    cookieString += `; domain=${options.domain}`
  }

  // 安全设置
  if (options.secure !== false) {
    // 生产环境或HTTPS下设置secure
    if (location.protocol === 'https:' || process.env.NODE_ENV === 'production') {
      cookieString += '; secure'
    }
  }

  // SameSite设置（默认lax，平衡安全性和兼容性）
  const sameSite = options.sameSite || 'lax'
  cookieString += `; samesite=${sameSite}`

  document.cookie = cookieString
  
  console.log(`🍪 Cookie set: ${name}`)
}

/**
 * 获取Cookie
 */
export function getCookie(name: string): string | null {
  const encodedName = encodeURIComponent(name)
  const cookies = document.cookie.split(';')
  
  for (let cookie of cookies) {
    cookie = cookie.trim()
    if (cookie.startsWith(`${encodedName}=`)) {
      const value = cookie.substring(encodedName.length + 1)
      return decodeURIComponent(value)
    }
  }
  
  return null
}

/**
 * 删除Cookie
 */
export function deleteCookie(name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void {
  setCookie(name, '', {
    ...options,
    expires: new Date(0) // 设置为过去时间
  })
  console.log(`🗑️ Cookie deleted: ${name}`)
}

/**
 * 检查Cookie是否存在
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null
}

/**
 * 获取所有Cookie
 */
export function getAllCookies(): Record<string, string> {
  const cookies: Record<string, string> = {}
  
  document.cookie.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=')
    if (name && value) {
      cookies[decodeURIComponent(name)] = decodeURIComponent(value)
    }
  })
  
  return cookies
}

// 认证相关的Cookie名称常量
export const AUTH_COOKIES = {
  ACCESS_TOKEN: 'jaaz_access_token',
  USER_INFO: 'jaaz_user_info',
  TOKEN_EXPIRES: 'jaaz_token_expires'
} as const

/**
 * 设置认证Cookie（带安全配置）
 */
export function setAuthCookie(name: string, value: string, expiresInDays: number = 30): void {
  // 🚨 检查是否在退出登录过程中，如果是则阻止设置cookie
  const isLoggingOut = sessionStorage.getItem('is_logging_out')
  const forceLogout = sessionStorage.getItem('force_logout')
  
  if (isLoggingOut === 'true' || forceLogout === 'true') {
    console.error(`🚨 BLOCKED: Attempted to set auth cookie '${name}' during logout process!`)
    return
  }
  
  console.log(`🍪 Setting auth cookie: ${name}`)
  setCookie(name, value, {
    expires: expiresInDays,
    secure: location.protocol === 'https:' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  })
}

/**
 * 获取认证Cookie
 */
export function getAuthCookie(name: string): string | null {
  return getCookie(name)
}

/**
 * 删除认证Cookie
 */
export function deleteAuthCookie(name: string): void {
  deleteCookie(name, { path: '/' })
}

/**
 * 清理所有认证Cookie
 */
export function clearAuthCookies(): void {
  Object.values(AUTH_COOKIES).forEach(cookieName => {
    deleteAuthCookie(cookieName)
  })
  console.log('🧹 All auth cookies cleared')
}