/**
 * JWT Token 工具函数
 * 用于解析和验证 JWT Token
 */

interface JWTPayload {
  user_id: string
  email: string
  username: string
  exp: number
  iat?: number
}

/**
 * 解析 JWT Token（不验证签名，仅解析payload）
 */
export function parseJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch (error) {
    console.error('Failed to parse JWT:', error)
    return null
  }
}

/**
 * 检查 Token 是否过期
 */
export function isTokenExpired(token: string): boolean {
  const payload = parseJWT(token)
  if (!payload || !payload.exp) return true
  
  const currentTime = Math.floor(Date.now() / 1000)
  return payload.exp < currentTime
}

/**
 * 检查 Token 是否即将过期（默认30分钟内）
 */
export function isTokenExpiringSoon(token: string, thresholdMinutes: number = 30): boolean {
  const payload = parseJWT(token)
  if (!payload || !payload.exp) return true
  
  const currentTime = Math.floor(Date.now() / 1000)
  const thresholdTime = currentTime + (thresholdMinutes * 60)
  return payload.exp < thresholdTime
}

/**
 * 获取 Token 剩余有效时间（秒）
 */
export function getTokenRemainingTime(token: string): number {
  const payload = parseJWT(token)
  if (!payload || !payload.exp) return 0
  
  const currentTime = Math.floor(Date.now() / 1000)
  return Math.max(0, payload.exp - currentTime)
}

/**
 * 获取用户信息从 Token
 */
export function getUserFromToken(token: string): { id: string; email: string; username: string } | null {
  const payload = parseJWT(token)
  if (!payload) return null
  
  return {
    id: payload.user_id,
    email: payload.email,
    username: payload.username
  }
}