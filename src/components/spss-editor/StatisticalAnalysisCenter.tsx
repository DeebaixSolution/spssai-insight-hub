import { cn } from '@/lib/utils';
import { Check, Clock, Circle } from 'lucide-react';

interface TabItem {
  step: number;
  label: string;
  shortLabel: string;
}

const tabs: TabItem[] = [
  { step: 4, label: 'Descriptive & Normality', shortLabel: 'Preliminary' },
  { step: 5, label: 'Parametric Tests', shortLabel: 'Parametric' },
  { step: 6, label: 'Non-Parametric Tests', shortLabel: 'Non-Param' },
  { step: 7, label: 'ANOVA & GLM', shortLabel: 'ANOVA' },
  { step: 8, label: 'Correlation', shortLabel: 'Correlation' },
  { step: 9, label: 'Regression', shortLabel: 'Regression' },
  { step: 10, label: 'Measurement Validation', shortLabel: 'Measurement' },
];

interface StatisticalAnalysisCenterProps {
  currentStep: number;
  completedSteps: Set<number>;
  onTabClick: (step: number) => void;
  children: React.ReactNode;
}

export function StatisticalAnalysisCenter({
  currentStep,
  completedSteps,
  onTabClick,
  children,
}: StatisticalAnalysisCenterProps) {
  const isTabAccessible = (step: number) => {
    // Step 4 always accessible within layer 2
    if (step === 4) return true;
    // Other tabs require step 4 completed
    return completedSteps.has(4);
  };

  return (
    <div>
      {/* Horizontal Tab Bar */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map((tab) => {
            const isActive = currentStep === tab.step;
            const isCompleted = completedSteps.has(tab.step);
            const accessible = isTabAccessible(tab.step);

            return (
              <button
                key={tab.step}
                onClick={() => accessible && onTabClick(tab.step)}
                disabled={!accessible}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : isCompleted
                    ? 'border-success text-success hover:text-success/80'
                    : accessible
                    ? 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    : 'border-transparent text-muted-foreground/40 cursor-not-allowed'
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isActive ? (
                  <Clock className="w-3.5 h-3.5" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
                <span className="hidden lg:inline">{tab.label}</span>
                <span className="lg:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {children}
    </div>
  );
}
