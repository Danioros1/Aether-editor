import React, { useState } from 'react';
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { useResponsive } from '../hooks/useResponsive';
import { cn } from '../lib/utils';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  leftPanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  bottomPanel?: React.ReactNode;
  header?: React.ReactNode;
  leftPanelTitle?: string;
  rightPanelTitle?: string;
  bottomPanelTitle?: string;
  className?: string;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  leftPanel,
  rightPanel,
  bottomPanel,
  header,
  leftPanelTitle = "Left Panel",
  rightPanelTitle = "Right Panel", 
  bottomPanelTitle = "Bottom Panel",
  className
}) => {
  const { isMobile } = useResponsive();
  const [leftPanelOpen, setLeftPanelOpen] = useState(!isMobile);
  const [rightPanelOpen, setRightPanelOpen] = useState(!isMobile);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);

  // Responsive panel widths
  const leftPanelWidth = isMobile ? '280px' : '300px';
  const rightPanelWidth = isMobile ? '280px' : '300px';
  const bottomPanelHeight = isMobile ? '200px' : '256px';

  // Mobile layout - stack panels vertically
  if (isMobile) {
    return (
      <div className={cn("h-screen w-screen bg-background text-foreground overflow-hidden", className)}>
        {/* Mobile Header */}
        {header && (
          <div className="border-b border-border bg-card">
            {header}
          </div>
        )}

        {/* Mobile Navigation */}
        <div className="flex items-center justify-between p-2 bg-card border-b border-border">
          <div className="flex gap-1">
            {leftPanel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                className="flex items-center gap-1"
              >
                <Menu className="h-4 w-4" />
                <span className="text-xs">{leftPanelTitle}</span>
              </Button>
            )}
            {rightPanel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className="flex items-center gap-1"
              >
                <Menu className="h-4 w-4" />
                <span className="text-xs">{rightPanelTitle}</span>
              </Button>
            )}
          </div>
          {bottomPanel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
              className="flex items-center gap-1"
            >
              <span className="text-xs">{bottomPanelTitle}</span>
              {bottomPanelOpen ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Mobile Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Side Panels - Show as overlay */}
          {leftPanelOpen && leftPanel && (
            <div className="absolute inset-0 z-50 bg-black/50" onClick={() => setLeftPanelOpen(false)}>
              <div 
                className="bg-card border-r border-border h-full overflow-y-auto"
                style={{ width: leftPanelWidth }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="font-medium">{leftPanelTitle}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeftPanelOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4">
                  {leftPanel}
                </div>
              </div>
            </div>
          )}

          {rightPanelOpen && rightPanel && (
            <div className="absolute inset-0 z-50 bg-black/50" onClick={() => setRightPanelOpen(false)}>
              <div 
                className="bg-card border-l border-border h-full overflow-y-auto ml-auto"
                style={{ width: rightPanelWidth }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="font-medium">{rightPanelTitle}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRightPanelOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4">
                  {rightPanel}
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 overflow-hidden" role="main">
            {children}
          </main>

          {/* Bottom Panel */}
          {bottomPanel && bottomPanelOpen && (
            <div 
              className="bg-card border-t border-border overflow-y-auto"
              style={{ height: bottomPanelHeight }}
            >
              <div className="p-4">
                {bottomPanel}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop/Tablet layout - traditional grid
  const gridCols = [
    leftPanel && leftPanelOpen ? leftPanelWidth : '0px',
    '1fr',
    rightPanel && rightPanelOpen ? rightPanelWidth : '0px'
  ].filter(col => col !== '0px').join(' ');

  const gridRows = [
    header ? 'auto' : '0px',
    '1fr',
    bottomPanel && bottomPanelOpen ? bottomPanelHeight : '0px'
  ].filter(row => row !== '0px').join(' ');

  return (
    <div 
      className={cn("h-screen w-screen bg-background text-foreground overflow-hidden", className)}
      style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gridTemplateRows: gridRows,
      }}
    >
      {/* Header - spans all columns */}
      {header && (
        <div 
          className="bg-card border-b border-border"
          style={{ gridColumn: '1 / -1' }}
        >
          {header}
        </div>
      )}

      {/* Left Panel */}
      {leftPanel && leftPanelOpen && (
        <div className="bg-card border-r border-border overflow-y-auto" aria-label={leftPanelTitle}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-medium">{leftPanelTitle}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftPanelOpen(false)}
              className="opacity-60 hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            {leftPanel}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="bg-background overflow-hidden relative" role="main">
        {/* Toggle buttons for collapsed panels */}
        {leftPanel && !leftPanelOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeftPanelOpen(true)}
            className="absolute top-4 left-4 z-10 opacity-60 hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        
        {rightPanel && !rightPanelOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRightPanelOpen(true)}
            className="absolute top-4 right-4 z-10 opacity-60 hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {children}
      </main>

      {/* Right Panel */}
      {rightPanel && rightPanelOpen && (
        <div className="bg-card border-l border-border overflow-y-auto" aria-label={rightPanelTitle}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-medium">{rightPanelTitle}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightPanelOpen(false)}
              className="opacity-60 hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            {rightPanel}
          </div>
        </div>
      )}

      {/* Bottom Panel - spans all columns */}
      {bottomPanel && bottomPanelOpen && (
        <div 
          className="bg-card border-t border-border overflow-y-auto"
          style={{ gridColumn: '1 / -1' }}
          aria-label={bottomPanelTitle}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-medium">{bottomPanelTitle}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBottomPanelOpen(false)}
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            {bottomPanel}
          </div>
        </div>
      )}
    </div>
  );
};