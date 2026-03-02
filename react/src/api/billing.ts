import { BASE_API_URL } from '../constants'
import { authenticatedFetch } from './auth'

export interface BalanceResponse {
  balance: string
}

export interface UserInfoResponse {
  is_logged_in: boolean
  current_level: string | null
  user_info?: {
    id: number
    email: string
    username: string
    level: string
    image_url?: string
  }
  available_plans?: string[]
  message?: string
}

export async function getBalance(): Promise<BalanceResponse> {
  const response = await authenticatedFetch(
    `${BASE_API_URL}/api/billing/getBalance`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch balance: ${response.status}`)
  }

  return await response.json()
}

export async function getUserInfo(): Promise<UserInfoResponse> {
  const response = await authenticatedFetch(
    `${BASE_API_URL}/api/pricing`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`)
  }

  return await response.json()
}
