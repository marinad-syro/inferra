import { LayoutGrid, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasNavigatorProps {
  mode: 'ui' | 'code';
  onModeChange: (mode: 'ui' | 'code') => void;
}

const CanvasNavigator = ({ mode, onModeChange }: CanvasNavigatorProps) => {
  return (
    <div className="border-b bg-background">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Canvas Mode:</h2>
            <div className="flex gap-1 border rounded-lg p-1 bg-muted/30">
              <Button
                variant={mode === 'ui' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onModeChange('ui')}
                className="gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                UI Canvas
              </Button>
              <Button
                variant={mode === 'code' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onModeChange('code')}
                className="gap-2"
              >
                <Code2 className="h-4 w-4" />
                Code Canvas
              </Button>
            </div>
          </div>

          {mode === 'code' && (
            <p className="text-xs text-muted-foreground">
              Edit generated code or write custom transformations
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanvasNavigator;
