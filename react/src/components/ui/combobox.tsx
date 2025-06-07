import * as React from "react"
import { ChevronDownIcon, CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import { Button } from "./button"

interface ComboboxOption {
  value: string
  label: string
  data?: unknown
}

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  onDataChange?: (data: unknown) => void
  options: ComboboxOption[]
  placeholder?: string
  className?: string
  id?: string
}

export function Combobox({
  value,
  onChange,
  onDataChange,
  options,
  placeholder,
  className,
  id,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Update input value when external value changes
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setIsOpen(true)
  }

  // Handle option selection
  const handleOptionSelect = (option: ComboboxOption) => {
    setInputValue(option.value)
    onChange(option.value)
    if (option.data && onDataChange) {
      onDataChange(option.data)
    }
    setIsOpen(false)
  }

  // Filter options based on input
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
    option.value.toLowerCase().includes(inputValue.toLowerCase())
  )

  // Handle click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronDownIcon
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </Button>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-md">
          <div className="p-1">
            {filteredOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  value === option.value && "bg-accent text-accent-foreground"
                )}
                onClick={() => handleOptionSelect(option)}
              >
                <span className="flex-1">{option.label}</span>
                {value === option.value && (
                  <CheckIcon className="h-4 w-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
