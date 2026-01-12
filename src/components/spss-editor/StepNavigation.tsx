import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  isLoading?: boolean;
  nextLabel?: string;
  showFinish?: boolean;
  onFinish?: () => void;
}

export function StepNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  canGoNext = true,
  canGoPrevious = true,
  isLoading = false,
  nextLabel,
  showFinish = false,
  onFinish,
}: StepNavigationProps) {
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={currentStep === 1 || !canGoPrevious || isLoading}
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        Previous
      </Button>

      <span className="text-sm text-muted-foreground">
        Step {currentStep} of {totalSteps}
      </span>

      {isLastStep && showFinish ? (
        <Button variant="hero" onClick={onFinish} disabled={!canGoNext || isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Finishing...
            </>
          ) : (
            'Finish & Export'
          )}
        </Button>
      ) : (
        <Button variant="hero" onClick={onNext} disabled={!canGoNext || isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {nextLabel || 'Next'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
