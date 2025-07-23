import * as React from "react"
import { cn } from "../../lib/utils"
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Bell,
  Settings,
  Zap
} from "lucide-react"
import { Button } from "./button"
import { Badge } from "./badge"
import { ScrollArea } from "./scroll-area"
import { FadeIn, SlideIn } from "./animations"

// Notification types
export type NotificationType = "info" | "success" | "warning" | "error" | "system"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  persistent?: boolean
  timestamp: Date
  read?: boolean
}

// Notification context
interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  clearAll: () => void
  unreadCount: number
}

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined)

// Notification provider
export interface NotificationProviderProps {
  children: React.ReactNode
  maxNotifications?: number
  autoRemoveDelay?: number
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = 5,
  autoRemoveDelay = 5000,
}) => {
  const [notifications, setNotifications] = React.useState<Notification[]>([])

  const addNotification = React.useCallback((notification: Omit<Notification, "id" | "timestamp">) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
    }

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, maxNotifications)
      return updated
    })

    // Auto-remove non-persistent notifications
    if (!notification.persistent) {
      setTimeout(() => {
        removeNotification(id)
      }, autoRemoveDelay)
    }
  }, [maxNotifications, autoRemoveDelay])

  const removeNotification = React.useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const markAsRead = React.useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }, [])

  const clearAll = React.useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = React.useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  )

  const value = React.useMemo(() => ({
    notifications,
    addNotification,
    removeNotification,
    markAsRead,
    clearAll,
    unreadCount,
  }), [notifications, addNotification, removeNotification, markAsRead, clearAll, unreadCount])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// Hook to use notifications
export const useNotifications = () => {
  const context = React.useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}

// Individual notification component
export interface NotificationItemProps {
  notification: Notification
  onRemove: (id: string) => void
  onMarkAsRead: (id: string) => void
  className?: string
}

const NotificationItem = React.forwardRef<HTMLDivElement, NotificationItemProps>(
  ({ notification, onRemove, onMarkAsRead, className }, ref) => {
    const getIcon = () => {
      switch (notification.type) {
        case "success":
          return <CheckCircle className="h-4 w-4 text-green-600" />
        case "error":
          return <XCircle className="h-4 w-4 text-red-600" />
        case "warning":
          return <AlertTriangle className="h-4 w-4 text-yellow-600" />
        case "system":
          return <Settings className="h-4 w-4 text-blue-600" />
        default:
          return <Info className="h-4 w-4 text-blue-600" />
      }
    }

    const getBorderColor = () => {
      switch (notification.type) {
        case "success":
          return "border-l-green-500"
        case "error":
          return "border-l-red-500"
        case "warning":
          return "border-l-yellow-500"
        case "system":
          return "border-l-blue-500"
        default:
          return "border-l-blue-500"
      }
    }

    const handleClick = () => {
      if (!notification.read) {
        onMarkAsRead(notification.id)
      }
    }

    return (
      <SlideIn direction="right" duration={200}>
        <div
          ref={ref}
          className={cn(
            "relative p-4 bg-card border border-border rounded-lg shadow-sm border-l-4 cursor-pointer transition-all hover:shadow-md",
            getBorderColor(),
            !notification.read && "bg-primary/5",
            className
          )}
          onClick={handleClick}
        >
          <div className="flex items-start gap-3">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-foreground">
                  {notification.title}
                </h4>
                {!notification.read && (
                  <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full bg-primary" />
                )}
              </div>
              {notification.message && (
                <p className="text-sm text-muted-foreground mb-2">
                  {notification.message}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {notification.timestamp.toLocaleTimeString()}
                </span>
                {notification.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      notification.action!.onClick()
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    {notification.action.label}
                  </Button>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(notification.id)
              }}
              className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </SlideIn>
    )
  }
)
NotificationItem.displayName = "NotificationItem"

// Notification center component
export interface NotificationCenterProps {
  className?: string
}

export const NotificationCenter = React.forwardRef<HTMLDivElement, NotificationCenterProps>(
  ({ className }, ref) => {
    const { notifications, removeNotification, markAsRead, clearAll } = useNotifications()

    if (notifications.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "p-8 text-center text-muted-foreground",
            className
          )}
        >
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No notifications</p>
        </div>
      )
    }

    return (
      <div ref={ref} className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Notifications</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRemove={removeNotification}
                onMarkAsRead={markAsRead}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }
)
NotificationCenter.displayName = "NotificationCenter"

// Notification bell icon with badge
export interface NotificationBellProps {
  onClick?: () => void
  className?: string
}

export const NotificationBell = React.forwardRef<HTMLButtonElement, NotificationBellProps>(
  ({ onClick, className }, ref) => {
    const { unreadCount } = useNotifications()

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="sm"
        onClick={onClick}
        className={cn("relative p-2", className)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>
    )
  }
)
NotificationBell.displayName = "NotificationBell"

// Toast notification component (for temporary notifications)
export interface ToastNotificationProps {
  notification: Notification
  onRemove: (id: string) => void
  className?: string
}

export const ToastNotification = React.forwardRef<HTMLDivElement, ToastNotificationProps>(
  ({ notification, onRemove, className }, ref) => {
    const getIcon = () => {
      switch (notification.type) {
        case "success":
          return <CheckCircle className="h-5 w-5 text-green-600" />
        case "error":
          return <XCircle className="h-5 w-5 text-red-600" />
        case "warning":
          return <AlertTriangle className="h-5 w-5 text-yellow-600" />
        case "system":
          return <Zap className="h-5 w-5 text-blue-600" />
        default:
          return <Info className="h-5 w-5 text-blue-600" />
      }
    }

    const getBgColor = () => {
      switch (notification.type) {
        case "success":
          return "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
        case "error":
          return "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
        case "warning":
          return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
        case "system":
          return "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
        default:
          return "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
      }
    }

    return (
      <FadeIn>
        <div
          ref={ref}
          className={cn(
            "flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-sm",
            getBgColor(),
            className
          )}
        >
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground mb-1">
              {notification.title}
            </h4>
            {notification.message && (
              <p className="text-sm text-muted-foreground">
                {notification.message}
              </p>
            )}
            {notification.action && (
              <Button
                variant="ghost"
                size="sm"
                onClick={notification.action.onClick}
                className="mt-2 h-6 px-2 text-xs"
              >
                {notification.action.label}
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(notification.id)}
            className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </FadeIn>
    )
  }
)
ToastNotification.displayName = "ToastNotification"

// Toast container for displaying temporary notifications
export const ToastContainer = React.forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    const { notifications, removeNotification } = useNotifications()
    
    // Only show non-persistent notifications as toasts
    const toastNotifications = notifications.filter(n => !n.persistent).slice(0, 3)

    if (toastNotifications.length === 0) return null

    return (
      <div
        ref={ref}
        className={cn(
          "fixed top-4 right-4 z-50 space-y-2",
          className
        )}
      >
        {toastNotifications.map((notification) => (
          <ToastNotification
            key={notification.id}
            notification={notification}
            onRemove={removeNotification}
          />
        ))}
      </div>
    )
  }
)
ToastContainer.displayName = "ToastContainer"

