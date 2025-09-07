import i18next from "i18next"

export function formatDate(isoString: string): string {
    if (!isoString) return ''
    const date = new Date(isoString)
    const locale = i18next.language || 'en'
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

export function generateChatSessionTitle(): string {
    const now = new Date()
    const locale = i18next.language || 'en'
    
    if (locale.startsWith('zh')) {
      // 中文格式：1月15日 14:30
      return now.toLocaleString('zh-CN', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } else {
      // 英文格式：Jan 15, 14:30
      return now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  }

export function formatSessionTitle(session: { title?: string; created_at?: string }): string {
    // 如果有自定义标题且不是默认的"New Chat"，则使用它
    if (session.title && session.title.trim() && session.title !== 'New Chat' && session.title !== '新聊天') {
      return session.title
    }
    
    // 如果没有created_at字段（前端临时session），返回当前生成的时间标题
    if (!session.created_at) {
      return generateChatSessionTitle()
    }
    
    // 基于created_at生成时间标题
    const createdDate = new Date(session.created_at)
    
    // 检查日期是否有效
    if (isNaN(createdDate.getTime())) {
      return generateChatSessionTitle()
    }
    
    const locale = i18next.language || 'en'
    
    if (locale.startsWith('zh')) {
      // 中文格式：1月15日 14:30
      return createdDate.toLocaleString('zh-CN', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } else {
      // 英文格式：Jan 15, 14:30
      return createdDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  }
  
