import { BASE_API_URL } from '@/constants'

// 类型定义
export interface InviteCode {
  success: boolean
  code?: string
  used_count: number
  max_uses: number
  remaining_uses: number
  error?: string
}

export interface InviteStats {
  invite_code?: string
  used_count: number
  max_uses: number
  remaining_uses: number
  total_invitations: number
  successful_invitations: number
  total_points_earned: number
  pending_invitations: number
}

export interface InviteHistory {
  success: boolean
  history: InviteRecord[]
  total_count: number
}

export interface InviteRecord {
  id: number
  invitee_email: string
  status: 'pending' | 'registered' | 'completed'
  inviter_points_awarded: number
  created_at: string
  completed_at?: string
  invitee_nickname?: string
}

export interface PointsBalance {
  success: boolean
  balance: number
}

export interface PointsHistory {
  success: boolean
  history: PointsTransaction[]
  total_count: number
}

export interface PointsTransaction {
  id: number
  points: number
  type: 'earn_invite' | 'earn_register' | 'spend' | 'admin_adjust'
  description: string
  reference_id?: string
  balance_after: number
  created_at: string
}

export interface PointsStats {
  success: boolean
  stats: {
    current_balance: number
    total_earned: number
    total_spent: number
    net_points: number
    by_type: Record<string, {
      count: number
      earned: number
      spent: number
    }>
  }
}

// API 方法
export async function getMyInviteCode(): Promise<InviteCode> {
  const response = await fetch(`${BASE_API_URL}/api/invite/my-code`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get invite code: ${response.statusText}`)
  }

  return response.json()
}

export async function validateInviteCode(code: string): Promise<{
  is_valid: boolean
  reason?: string
  inviter_nickname?: string
}> {
  const response = await fetch(`${BASE_API_URL}/api/invite/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    throw new Error(`Failed to validate invite code: ${response.statusText}`)
  }

  return response.json()
}

export async function getInviteStats(): Promise<InviteStats> {
  const response = await fetch(`${BASE_API_URL}/api/invite/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get invite stats: ${response.statusText}`)
  }

  return response.json()
}

export async function getInviteHistory(limit: number = 20, offset: number = 0): Promise<InviteHistory> {
  const response = await fetch(`${BASE_API_URL}/api/invite/history?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get invite history: ${response.statusText}`)
  }

  return response.json()
}

export async function getPointsBalance(): Promise<PointsBalance> {
  const response = await fetch(`${BASE_API_URL}/api/points/balance`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get points balance: ${response.statusText}`)
  }

  return response.json()
}

export async function getPointsHistory(limit: number = 50, offset: number = 0): Promise<PointsHistory> {
  const response = await fetch(`${BASE_API_URL}/api/points/history?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get points history: ${response.statusText}`)
  }

  return response.json()
}

export async function getPointsStats(): Promise<PointsStats> {
  const response = await fetch(`${BASE_API_URL}/api/points/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to get points stats: ${response.statusText}`)
  }

  return response.json()
}

// 工具方法
export function generateInviteUrl(code: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/join/${code}`
}

export function copyToClipboard(text: string): boolean {
  try {
    navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // 备用方案，用于不支持clipboard API的浏览器
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      return true
    } catch (err) {
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}