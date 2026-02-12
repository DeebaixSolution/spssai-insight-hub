import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubStep {
  step: number;
  label: string;
}

const subSteps: SubStep[] = [
  { step: 11, label: 'Results Generator (Ch.4)' },
  { step: 12, label: 'Theoretical Engine (Ch.5)' },
  { step: 13, label: 'Thesis Binder' },
];

interface AcademicProductionLayerProps {
  currentStep: number;
  completedSteps: Set<number>;
  onSubStepClick: (step: number) => void;
  children: React.ReactNode;
}

export function AcademicProductionLayer({
  currentStep,
  completedSteps,
  onSubStepClick,
  children,
}: AcademicProductionLayerProps) {
  return (
    <div>
      {/* Mini Progress Bar */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {subSteps.map((sub, index) => {
          const isActive = currentStep === sub.step;
          const isCompleted = completedSteps.has(sub.step);
          const isAccessible = sub.step === 11 || completedSteps.has(sub.step - 1);

          return (
            <div key={sub.step} className="flex items-center">
              <button
                onClick={() => isAccessible && onSubStepClick(sub.step)}
                disabled={!isAccessible}
                className={cn(
                  'flex items-center gap-2 group',
                  isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                    isCompleted
                      ? 'bg-success text-success-foreground'
                      : isActive
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : sub.step - 10}
                </div>
                <span
                  className={cn(
                    'text-sm hidden md:inline',
                    isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}
                >
                  {sub.label}
                </span>
              </button>

              {index < subSteps.length - 1 && (
                <div className={cn(
                  'w-8 md:w-16 h-0.5 mx-2',
                  isCompleted ? 'bg-success' : 'bg-border'
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
