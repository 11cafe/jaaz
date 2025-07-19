import { ReactNode, Dispatch, SetStateAction } from 'react'

// Types
export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
  model: string
  provider: string
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | any[]
  tool_calls?: any[]
  tool_call_id?: string
}

export interface Model {
  provider: string
  model: string
}

export interface ChatInterfaceProps {
  canvasId: string
  sessionList: Session[]
  setSessionList: Dispatch<SetStateAction<Session[]>>
  sessionId: string
}

export interface ButtonProps {
  children: ReactNode
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon'
  className?: string
  onClick?: () => void
  disabled?: boolean
  asChild?: boolean
}

// Chat Components
export declare const ChatInterface: React.FC<ChatInterfaceProps>
export declare const ChatTextarea: React.FC<any>
export declare const ChatHistory: React.FC<any>
export declare const ChatMagicGenerator: React.FC<any>
export declare const ModelSelector: React.FC<any>
export declare const ModelSelectorV2: React.FC<any>
export declare const SessionSelector: React.FC<any>
export declare const ChatSpinner: React.FC<any>

// UI Components
export declare const Button: React.FC<ButtonProps>
export declare const Input: React.FC<any>
export declare const Avatar: React.FC<any>
export declare const AvatarImage: React.FC<any>
export declare const AvatarFallback: React.FC<any>
export declare const Badge: React.FC<any>
export declare const Card: React.FC<any>
export declare const CardHeader: React.FC<any>
export declare const CardFooter: React.FC<any>
export declare const CardTitle: React.FC<any>
export declare const CardAction: React.FC<any>
export declare const CardDescription: React.FC<any>
export declare const CardContent: React.FC<any>
export declare const Skeleton: React.FC<any>
export declare const ShinyText: React.FC<any>
export declare const ScrollArea: React.FC<any>
export declare const Separator: React.FC<any>
export declare const Switch: React.FC<any>
export declare const Tooltip: React.FC<any>
export declare const TooltipContent: React.FC<any>
export declare const TooltipProvider: React.FC<any>
export declare const TooltipTrigger: React.FC<any>

// Dialog Components
export declare const Dialog: React.FC<any>
export declare const DialogClose: React.FC<any>
export declare const DialogContent: React.FC<any>
export declare const DialogDescription: React.FC<any>
export declare const DialogFooter: React.FC<any>
export declare const DialogHeader: React.FC<any>
export declare const DialogOverlay: React.FC<any>
export declare const DialogPortal: React.FC<any>
export declare const DialogTitle: React.FC<any>
export declare const DialogTrigger: React.FC<any>

// Contexts & Hooks
export declare const AuthProvider: React.FC<{ children: ReactNode }>
export declare const useAuth: () => any
export declare const ConfigsProvider: React.FC<{ children: ReactNode }>
export declare const useConfigs: () => any
export declare const useDebounce: (callback: any, delay: number) => any
export declare const useTheme: () => any

// Utils
export declare const cn: (...classes: any[]) => string
export declare const eventBus: any
export declare const formatDate: (date: string | Date) => string
