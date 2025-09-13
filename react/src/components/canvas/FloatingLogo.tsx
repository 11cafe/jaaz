import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOGO_URL } from '@/constants'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Home, FileText, Plus, Trash2, ImagePlus } from 'lucide-react'

export function FloatingLogo() {
  const navigate = useNavigate()
  const { t } = useTranslation('common')

  return (
    <div className="absolute top-4 left-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 h-auto w-auto rounded-full bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-lg hover:bg-white hover:scale-105 transition-all duration-200 group"
          >
            <img
              src={LOGO_URL}
              alt="MagicArt"
              className="w-8 h-8 transition-transform duration-200 group-hover:rotate-12"
              draggable={false}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          className="w-56 bg-white/90 backdrop-blur-md border-white/40 shadow-xl"
        >
          <DropdownMenuItem
            onClick={() => navigate({ to: '/' })}
            className="flex items-center gap-3 cursor-pointer hover:bg-white/60 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => navigate({ to: '/templates' })}
            className="flex items-center gap-3 cursor-pointer hover:bg-white/60 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Templates</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/30" />

          <DropdownMenuItem className="flex items-center gap-3 cursor-pointer hover:bg-white/60 transition-colors">
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </DropdownMenuItem>

          <DropdownMenuItem className="flex items-center gap-3 cursor-pointer hover:bg-red-500/10 text-red-600 hover:text-red-700 transition-colors">
            <Trash2 className="w-4 h-4" />
            <span>Delete Project</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/30" />

          <DropdownMenuItem className="flex items-center gap-3 cursor-pointer hover:bg-white/60 transition-colors">
            <ImagePlus className="w-4 h-4" />
            <span>Import Images</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}