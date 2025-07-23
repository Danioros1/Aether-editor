import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const shortcuts = [
    {
      category: 'Playback',
      items: [
        { key: 'Space', description: 'Play/Pause' },
        { key: 'Escape', description: 'Stop playback' },
        { key: 'Home', description: 'Go to beginning' },
        { key: 'End', description: 'Go to end' },
      ],
    },
    {
      category: 'Navigation',
      items: [
        { key: '← →', description: 'Frame-by-frame navigation' },
        { key: 'Ctrl + ← →', description: 'Jump by seconds' },
      ],
    },
    {
      category: 'Editing',
      items: [
        { key: 'C', description: 'Split clip at playhead' },
        { key: 'Delete', description: 'Delete selected clips' },
        { key: 'Ctrl + Z', description: 'Undo' },
        { key: 'Ctrl + Y', description: 'Redo' },
        { key: 'Ctrl + Shift + Z', description: 'Redo (alternative)' },
      ],
    },
    {
      category: 'Clip Manipulation',
      items: [
        { key: 'Shift + ← →', description: 'Nudge clips by 0.1s' },
        { key: 'Shift + ↑ ↓', description: 'Nudge clips by 1s' },
      ],
    },
    {
      category: 'Timeline',
      items: [
        { key: 'Ctrl + +', description: 'Zoom in timeline' },
        { key: 'Ctrl + -', description: 'Zoom out timeline' },
      ],
    },
    {
      category: 'Selection',
      items: [
        { key: 'Click', description: 'Select single clip' },
        { key: 'Ctrl + Click', description: 'Toggle clip selection' },
        { key: 'Shift + Click', description: 'Select range of clips' },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to work more efficiently in Aether Editor.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 mt-4">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h3 className="font-semibold text-lg mb-3 text-foreground">
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.items.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 px-3 rounded-md bg-muted/50"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-background border border-border rounded">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-muted/30 rounded-md">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Most shortcuts work when the timeline or main interface has focus. 
            Shortcuts are disabled when typing in input fields.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};