// Chat Components
export { default as ChatInterface } from './components/chat/Chat'
export { default as ChatTextarea } from './components/chat/ChatTextarea'
export { default as ChatHistory } from './components/chat/ChatHistory'
export { default as ChatMagicGenerator } from './components/chat/ChatMagicGenerator'
// export { default as ModelSelector } from './components/chat/ModelSelector'
export { default as ModelSelectorV2 } from './components/chat/ModelSelectorV2'
export { default as SessionSelector } from './components/chat/SessionSelector'
export { default as ChatSpinner } from './components/chat/Spinner'

// UI Components
export { Button, buttonVariants } from './components/ui/button'
export { Input } from './components/ui/input'
export { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar'
export { Badge } from './components/ui/badge'
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from './components/ui/card'
export { Skeleton } from './components/ui/skeleton'
export { default as ShinyText } from './components/ui/shiny-text'
export { ScrollArea } from './components/ui/scroll-area'
export { Separator } from './components/ui/separator'
export { Switch } from './components/ui/switch'
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/ui/tooltip'
export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './components/ui/resizable'

// Dialog Components
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog'

// Dropdown Components
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './components/ui/dropdown-menu'

// Select Components
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'

// Context Menu Components
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
} from './components/ui/context-menu'

// Sheet Components
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './components/ui/sheet'

// Sidebar Components
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './components/ui/sidebar'

// Auth Components
export { LoginDialog } from './components/auth/LoginDialog'
export { UserMenu } from './components/auth/UserMenu'

// Common Components
export { default as Blur } from './components/common/Blur'
export { default as ErrorBoundary } from './components/common/ErrorBoundary'

// Theme Components
export { default as ThemeButton } from './components/theme/ThemeButton'
export { ThemeProvider } from './components/theme/ThemeProvider'

// Types
export type {
  Message,
  MessageContent,
  Model,
  Session,
  ChatSession,
  AssistantMessage,
  PendingType,
} from './types/types'

// Contexts
export { AuthProvider, useAuth } from './contexts/AuthContext'
export { ConfigsProvider, useConfigs } from './contexts/configs'
export { CanvasProvider, useCanvas } from './contexts/canvas'

// Hooks
export { useBalance } from './hooks/use-balance'
export { default as useDebounce } from './hooks/use-debounce'
export { useLanguage } from './hooks/use-language'
export { useTheme } from './hooks/use-theme'

// Utils
export { cn } from './lib/utils'
export { eventBus } from './lib/event'
export { formatDate } from './utils/formatDate'
export { compressImageFile, processImageFiles } from './utils/imageUtils'
export { readPNGMetadata, isPNGFile } from './utils/pngMetadata'

// API
export { sendMessages } from './api/chat'
export { uploadImage } from './api/upload'
export { listModels } from './api/model'
export type { ModelInfo, ToolInfo } from './api/model'
export { getCanvas, createCanvas, renameCanvas } from './api/canvas'
