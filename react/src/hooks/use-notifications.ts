import { Notification, notificationManager } from '@/lib/notifications'
import { useEffect, useState } from 'react'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    setNotifications(notificationManager.getNotifications())
    const unsubscribe = notificationManager.subscribe(setNotifications)

    return unsubscribe
  }, [])

  return {
    notifications,
    unreadCount: notificationManager.getUnreadCount(),
    markAsRead: notificationManager.markAsRead.bind(notificationManager),
    markAllAsRead: notificationManager.markAllAsRead.bind(notificationManager),
    clearNotifications:
      notificationManager.clearNotifications.bind(notificationManager),
    getCanvasNotifications:
      notificationManager.getCanvasNotifications.bind(notificationManager),
    getSessionNotifications:
      notificationManager.getSessionNotifications.bind(notificationManager),
    showSuccess: notificationManager.showSuccess.bind(notificationManager),
    showError: notificationManager.showError.bind(notificationManager),
    showInfo: notificationManager.showInfo.bind(notificationManager),
  }
}
