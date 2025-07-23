import * as React from "react"
import { cn } from "../../lib/utils"
import { 
  HelpCircle, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play,

  RotateCcw,
  Check,
  Lightbulb,
  BookOpen,
  Video,
  Keyboard
} from "lucide-react"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Badge } from "./badge"
import { ScrollArea } from "./scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import { EnhancedTooltip } from "./enhanced-tooltip"
import { FadeIn, SlideIn } from "./animations"

// Help context for managing help state
interface HelpContextType {
  isHelpMode: boolean
  setHelpMode: (enabled: boolean) => void
  currentTour: string | null
  setCurrentTour: (tour: string | null) => void
  completedTours: string[]
  markTourCompleted: (tour: string) => void
  showTooltip: (id: string) => void
  hideTooltip: (id: string) => void
  activeTooltips: Set<string>
}

const HelpContext = React.createContext<HelpContextType | undefined>(undefined)

export const useHelp = () => {
  const context = React.useContext(HelpContext)
  if (!context) {
    throw new Error("useHelp must be used within a HelpProvider")
  }
  return context
}

// Help provider component
export interface HelpProviderProps {
  children: React.ReactNode
  storageKey?: string
}

export const HelpProvider: React.FC<HelpProviderProps> = ({ 
  children, 
  storageKey = "aether-editor-help" 
}) => {
  const [isHelpMode, setIsHelpMode] = React.useState(false)
  const [currentTour, setCurrentTour] = React.useState<string | null>(null)
  const [completedTours, setCompletedTours] = React.useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}-completed-tours`)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [activeTooltips, setActiveTooltips] = React.useState<Set<string>>(new Set())

  const setHelpMode = React.useCallback((enabled: boolean) => {
    setIsHelpMode(enabled)
    if (!enabled) {
      setCurrentTour(null)
      setActiveTooltips(new Set())
    }
  }, [])

  const markTourCompleted = React.useCallback((tour: string) => {
    setCompletedTours(prev => {
      const updated = [...prev, tour]
      localStorage.setItem(`${storageKey}-completed-tours`, JSON.stringify(updated))
      return updated
    })
  }, [storageKey])

  const showTooltip = React.useCallback((id: string) => {
    setActiveTooltips(prev => new Set([...prev, id]))
  }, [])

  const hideTooltip = React.useCallback((id: string) => {
    setActiveTooltips(prev => {
      const updated = new Set(prev)
      updated.delete(id)
      return updated
    })
  }, [])

  const value = React.useMemo(() => ({
    isHelpMode,
    setHelpMode,
    currentTour,
    setCurrentTour,
    completedTours,
    markTourCompleted,
    showTooltip,
    hideTooltip,
    activeTooltips,
  }), [
    isHelpMode,
    setHelpMode,
    currentTour,
    completedTours,
    markTourCompleted,
    showTooltip,
    hideTooltip,
    activeTooltips,
  ])

  return (
    <HelpContext.Provider value={value}>
      {children}
    </HelpContext.Provider>
  )
}

// Interactive help tooltip
export interface HelpTooltipProps {
  id: string
  title: string
  content: string
  position?: "top" | "bottom" | "left" | "right"
  children: React.ReactNode
  tourStep?: number
  tourTotal?: number
  onNext?: () => void
  onPrevious?: () => void
  onComplete?: () => void
  className?: string
}

export const InteractiveHelpTooltip = React.forwardRef<HTMLDivElement, HelpTooltipProps>(
  ({ 
    id,
    title,
    content,
    position = "top",
    children,
    tourStep,
    tourTotal,
    onNext,
    onPrevious,
    onComplete,
    className
  }, ref) => {
    const { isHelpMode, activeTooltips, hideTooltip } = useHelp()
    const [isVisible, setIsVisible] = React.useState(false)

    React.useEffect(() => {
      setIsVisible(isHelpMode && activeTooltips.has(id))
    }, [isHelpMode, activeTooltips, id])

    if (!isVisible) {
      return <div ref={ref} className={className}>{children}</div>
    }

    return (
      <div ref={ref} className={cn("relative", className)}>
        {children}
        <div className="absolute inset-0 ring-2 ring-primary ring-offset-2 rounded-md pointer-events-none z-10" />
        <div 
          className={cn(
            "absolute z-20 w-80 p-4 bg-popover border border-border rounded-lg shadow-lg",
            position === "top" && "bottom-full mb-2 left-1/2 -translate-x-1/2",
            position === "bottom" && "top-full mt-2 left-1/2 -translate-x-1/2",
            position === "left" && "right-full mr-2 top-1/2 -translate-y-1/2",
            position === "right" && "left-full ml-2 top-1/2 -translate-y-1/2"
          )}
        >
          <FadeIn>
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{title}</h4>
                  {tourStep && tourTotal && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      Step {tourStep} of {tourTotal}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => hideTooltip(id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground">{content}</p>
              
              {(onPrevious || onNext || onComplete) && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <div>
                    {onPrevious && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onPrevious}
                        className="h-8 px-2"
                      >
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        Previous
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {onNext && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={onNext}
                        className="h-8 px-3"
                      >
                        Next
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                    {onComplete && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={onComplete}
                        className="h-8 px-3"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </FadeIn>
        </div>
      </div>
    )
  }
)
InteractiveHelpTooltip.displayName = "InteractiveHelpTooltip"

// Help center modal
export interface HelpCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ open, onOpenChange }) => {
  const [activeSection, setActiveSection] = React.useState("getting-started")

  const helpSections = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: <Play className="h-4 w-4" />,
      content: [
        {
          title: "Welcome to Aether Editor",
          description: "Learn the basics of video editing with our intuitive interface.",
          steps: [
            "Upload your media files to the Asset Library",
            "Drag assets to the Timeline to create clips",
            "Use the Preview Window to see your video",
            "Adjust properties in the Property Inspector",
            "Export your finished video"
          ]
        }
      ]
    },
    {
      id: "interface",
      title: "Interface Guide",
      icon: <BookOpen className="h-4 w-4" />,
      content: [
        {
          title: "Four-Panel Layout",
          description: "Understanding the main interface components.",
          steps: [
            "Asset Library (left): Manage your media files",
            "Preview Window (center): See your video in real-time",
            "Property Inspector (right): Edit clip properties",
            "Timeline (bottom): Arrange and edit your clips"
          ]
        }
      ]
    },
    {
      id: "editing",
      title: "Video Editing",
      icon: <Video className="h-4 w-4" />,
      content: [
        {
          title: "Timeline Editing",
          description: "Master the timeline for professional editing.",
          steps: [
            "Drag clips to reorder them",
            "Use trim handles to adjust clip length",
            "Split clips with the 'C' key",
            "Select multiple clips with Ctrl+click",
            "Apply Ken Burns animations for dynamic movement"
          ]
        }
      ]
    },
    {
      id: "shortcuts",
      title: "Keyboard Shortcuts",
      icon: <Keyboard className="h-4 w-4" />,
      content: [
        {
          title: "Essential Shortcuts",
          description: "Speed up your workflow with keyboard shortcuts.",
          steps: [
            "Spacebar: Play/Pause",
            "Ctrl+Z: Undo",
            "Ctrl+Y: Redo",
            "C: Split clip at playhead",
            "Delete: Remove selected clips",
            "Arrow keys: Frame-by-frame navigation"
          ]
        }
      ]
    }
  ]

  const currentSection = helpSections.find(s => s.id === activeSection)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help Center
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-6 h-[60vh]">
          {/* Sidebar */}
          <div className="w-64 border-r pr-6">
            <nav className="space-y-2">
              {helpSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors",
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {section.icon}
                  <span className="text-sm font-medium">{section.title}</span>
                </button>
              ))}
            </nav>
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <ScrollArea className="h-full">
              {currentSection && (
                <div className="space-y-6">
                  {currentSection.content.map((item, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <ol className="space-y-2">
                          {item.steps.map((step, stepIndex) => (
                            <li key={stepIndex} className="flex items-start gap-3">
                              <Badge variant="outline" className="mt-0.5 h-6 w-6 p-0 flex items-center justify-center text-xs">
                                {stepIndex + 1}
                              </Badge>
                              <span className="text-sm">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Quick tips component
export interface QuickTipProps {
  tip: string
  category?: "editing" | "shortcuts" | "features" | "performance"
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

export const QuickTip = React.forwardRef<HTMLDivElement, QuickTipProps>(
  ({ tip, category = "editing", dismissible = true, onDismiss, className }, ref) => {
    const getCategoryIcon = () => {
      switch (category) {
        case "shortcuts":
          return <Keyboard className="h-4 w-4" />
        case "features":
          return <Video className="h-4 w-4" />
        case "performance":
          return <RotateCcw className="h-4 w-4" />
        default:
          return <Lightbulb className="h-4 w-4" />
      }
    }

    const getCategoryColor = () => {
      switch (category) {
        case "shortcuts":
          return "border-blue-200 bg-blue-50 text-blue-900"
        case "features":
          return "border-green-200 bg-green-50 text-green-900"
        case "performance":
          return "border-yellow-200 bg-yellow-50 text-yellow-900"
        default:
          return "border-purple-200 bg-purple-50 text-purple-900"
      }
    }

    return (
      <SlideIn direction="down">
        <div
          ref={ref}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg border",
            getCategoryColor(),
            className
          )}
        >
          {getCategoryIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium">{tip}</p>
          </div>
          {dismissible && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </SlideIn>
    )
  }
)
QuickTip.displayName = "QuickTip"

// Help button component
export interface HelpButtonProps {
  onClick?: () => void
  className?: string
  size?: "sm" | "default" | "lg"
}

export const HelpButton = React.forwardRef<HTMLButtonElement, HelpButtonProps>(
  ({ onClick, className, size = "default" }, ref) => {
    const getSizeClasses = () => {
      switch (size) {
        case "sm":
          return "h-8 w-8"
        case "lg":
          return "h-12 w-12"
        default:
          return "h-10 w-10"
      }
    }

    return (
      <EnhancedTooltip
        content="Get help and learn keyboard shortcuts"
        title="Help & Support"
        icon="help"
      >
        <Button
          ref={ref}
          variant="ghost"
          onClick={onClick}
          className={cn(
            "rounded-full border border-border hover:bg-accent hover:text-accent-foreground",
            getSizeClasses(),
            className
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </EnhancedTooltip>
    )
  }
)
HelpButton.displayName = "HelpButton"