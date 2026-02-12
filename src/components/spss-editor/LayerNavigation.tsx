import { Check, FlaskConical, GraduationCap, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Layer {
  id: number;
  label: string;
  icon: React.ReactNode;
  steps: number[];
}

const layers: Layer[] = [
  { id: 1, label: 'Research Design', icon: <FlaskConical className="w-4 h-4" />, steps: [1, 2, 3] },
  { id: 2, label: 'Statistical Analysis', icon: <FileText className="w-4 h-4" />, steps: [4, 5, 6, 7, 8, 9, 10] },
  { id: 3, label: 'Academic Production', icon: <GraduationCap className="w-4 h-4" />, steps: [11, 12, 13] },
];

interface LayerNavigationProps {
  currentStep: number;
  completedSteps: Set<number>;
  onLayerClick: (firstStep: number) => void;
}

export function LayerNavigation({ currentStep, completedSteps, onLayerClick }: LayerNavigationProps) {
  const getActiveLayer = () => {
    if (currentStep <= 3) return 1;
    if (currentStep <= 10) return 2;
    return 3;
  };

  const activeLayer = getActiveLayer();

  const isLayerCompleted = (layer: Layer) => {
    return layer.steps.every(s => completedSteps.has(s));
  };

  const isLayerAccessible = (layer: Layer) => {
    // Layer 1 always accessible
    if (layer.id === 1) return true;
    // Layer 2 accessible if step 3 is completed
    if (layer.id === 2) return completedSteps.has(3);
    // Layer 3 accessible if step 4 is completed (at minimum descriptive done)
    if (layer.id === 3) return completedSteps.has(4);
    return false;
  };

  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {layers.map((layer, index) => {
        const isActive = layer.id === activeLayer;
        const isCompleted = isLayerCompleted(layer);
        const isAccessible = isLayerAccessible(layer);

        return (
          <div key={layer.id} className="flex items-center">
            <button
              onClick={() => isAccessible && onLayerClick(layer.steps[0])}
              disabled={!isAccessible}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all border',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : isCompleted
                  ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                  : isAccessible
                  ? 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  : 'bg-muted/50 text-muted-foreground/50 border-border/50 cursor-not-allowed'
              )}
            >
              {isCompleted ? (
                <Check className="w-4 h-4" />
              ) : (
                layer.icon
              )}
              <span className="hidden sm:inline">{layer.label}</span>
              <span className="sm:hidden text-xs">L{layer.id}</span>
            </button>

            {index < layers.length - 1 && (
              <div className={cn(
                'w-8 md:w-12 h-0.5 mx-1',
                isCompleted ? 'bg-success' : 'bg-border'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
