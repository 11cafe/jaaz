import { eventBus } from './event'

type NotificationType = 'canvas_update' | 'session_done' | 'error' | 'info' | 'success'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  canvasId?: string
  sessionId?: string
  timestamp: Date
  read: boolean
  imageUrl?: string
}

class NotificationManager {
  private notifications: Notification[] = []
  private listeners: ((notifications: Notification[]) => void)[] = []
  private currentCanvasId: string | null = null

  constructor() {
    this.initializeEventListeners()
  }

  public setCurrentCanvasId(canvasId: string | null) {
    this.currentCanvasId = canvasId
  }

  private initializeEventListeners() {
    // Image Generated
    eventBus.on('Socket::Session::ImageGenerated', (data) => {
      this.addNotification({
        type: 'canvas_update',
        title: 'Image generated',
        message: 'Image added to canvas',
        canvasId: data.canvas_id,
        imageUrl: data.image_url,
      })
    })

    // Info
    eventBus.on('Socket::Session::Info', (data) => {
      this.addNotification({
        type: 'info',
        title: 'Info',
        message: data.info,
      })
    })
  }

  private addNotification(
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) {
    if (
      notification.type === 'canvas_update' &&
      notification.canvasId === this.currentCanvasId
    ) {
      return
    }

    const uniqueKey = `${notification.type}_${notification.title}_${notification.canvasId || ''}_${notification.sessionId || ''}`
    if (
      this.notifications.some(
        (n) =>
          `${n.type}_${n.title}_${n.canvasId || ''}_${n.sessionId || ''}` ===
          uniqueKey
      )
    ) {
      return
    }

    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    }

    this.notifications.unshift(newNotification)

    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50)
    }

    this.notifyListeners()
  }

  public getNotifications(): Notification[] {
    return [...this.notifications]
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length
  }

  public markAsRead(id: string) {
    const notification = this.notifications.find((n) => n.id === id)
    if (notification) {
      notification.read = true
      this.notifyListeners()
    }
  }

  public markAllAsRead() {
    this.notifications.forEach((n) => (n.read = true))
    this.notifyListeners()
  }

  public clearNotifications() {
    this.notifications = []
    this.notifyListeners()
  }

  public subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.notifications))
  }

  // Get canvas notifications
  public getCanvasNotifications(canvasId: string): Notification[] {
    return this.notifications.filter((n) => n.canvasId === canvasId)
  }

  // Get session notifications
  public getSessionNotifications(sessionId: string): Notification[] {
    return this.notifications.filter((n) => n.sessionId === sessionId)
  }

  // Public methods to show notifications
  public showSuccess(title: string, message: string) {
    this.addNotification({
      type: 'success',
      title,
      message
    })
  }

  public showError(title: string, message: string) {
    this.addNotification({
      type: 'error',
      title,
      message
    })
  }

  public showInfo(title: string, message: string) {
    this.addNotification({
      type: 'info',
      title,
      message
    })
  }
}

export const notificationManager = new NotificationManager()
