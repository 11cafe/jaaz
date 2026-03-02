import { Session } from '@/types/types'

/**
 * 获取session的显示名称，确保所有地方显示一致
 * @param session 当前session
 * @param sessionList 完整的session列表，用于计算index（可选）
 * @returns 应该显示的session名称
 */
export function getSessionDisplayName(session: Session | undefined, sessionList?: Session[]): string {
  // 如果没有session，返回默认名称
  if (!session) {
    return '新对话'
  }

  // 如果session有标题且不为空，直接使用
  if (session.title && session.title.trim()) {
    return session.title.trim()
  }

  // 如果没有名称，尝试生成基于位置的名称
  if (sessionList) {
    // 按创建时间排序，找到当前session的索引
    const sortedSessions = [...sessionList].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      return timeB - timeA // 按创建时间倒序
    })

    const index = sortedSessions.findIndex(s => s.id === session.id)
    if (index !== -1) {
      return `新对话 ${index + 1}`
    }
  }

  // 最后的回退方案
  return '新对话'
}

/**
 * 获取session的简短ID用于显示
 * @param session 当前session
 * @returns session的简短ID
 */
export function getSessionShortId(session: Session): string {
  return session.id.slice(0, 8)
}