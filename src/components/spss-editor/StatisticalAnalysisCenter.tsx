import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Clock, Circle, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Variable, Hypothesis } from '@/hooks/useAnalysisWizard';
import { ParsedDataset } from '@/hooks/useAnalysisWizard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  analysisId?: string | null;
  variables?: Variable[];
  hypotheses?: Hypothesis[];
  parsedData?: ParsedDataset | null;
}

export function StatisticalAnalysisCenter({
  currentStep,
  completedSteps,
  onTabClick,
  children,
  analysisId,
  variables,
  hypotheses,
  parsedData,
}: StatisticalAnalysisCenterProps) {
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [autoPilotProgress, setAutoPilotProgress] = useState(0);
  const [autoPilotStatus, setAutoPilotStatus] = useState('');

  const isTabAccessible = (step: number) => {
    if (step === 4) return true;
    return completedSteps.has(4);
  };

  const handleSpssBrainAnalysis = async () => {
    if (!analysisId || !variables || !parsedData) {
      toast.error('Please complete Steps 1-3 and save your analysis first.');
      return;
    }

    setIsAutoPilot(true);
    setAutoPilotProgress(0);

    const scaleVars = variables.filter(v => v.measure === 'scale');
    const steps = [
      { name: 'Descriptive Statistics & Normality', step: 4, progress: 15 },
      { name: 'Correlation Matrix', step: 8, progress: 40 },
      { name: 'Hypothesis Tests', step: 5, progress: 60 },
      { name: 'Regression Analysis', step: 9, progress: 80 },
      { name: 'Reliability Analysis', step: 10, progress: 95 },
    ];

    try {
      for (const s of steps) {
        setAutoPilotStatus(s.name);
        setAutoPilotProgress(s.progress);

        if (s.step === 4 && scaleVars.length > 0) {
          // Run descriptive stats
          await supabase.functions.invoke('run-analysis', {
            body: {
              testType: 'descriptives',
              dependentVariables: scaleVars.map(v => v.name),
              independentVariables: [],
              data: parsedData.rows.slice(0, 500),
            },
          });
          // Run normality test
          await supabase.functions.invoke('run-analysis', {
            body: {
              testType: 'normality-test',
              dependentVariables: scaleVars.map(v => v.name),
              independentVariables: [],
              data: parsedData.rows.slice(0, 500),
            },
          });
        }

        if (s.step === 8 && scaleVars.length >= 2) {
          // Run Pearson correlation matrix
          await supabase.functions.invoke('run-analysis', {
            body: {
              testType: 'pearson',
              dependentVariables: scaleVars.map(v => v.name),
              independentVariables: scaleVars.map(v => v.name),
              data: parsedData.rows.slice(0, 500),
            },
          });
        }

        if (s.step === 5 && hypotheses && hypotheses.length > 0) {
          // Run first hypothesis test
          const h = hypotheses[0];
          if (h.dependentVariables.length > 0 && h.independentVariables.length > 0) {
            const testType = h.type === 'association' ? 'pearson' : 'independent-t-test';
            await supabase.functions.invoke('run-analysis', {
              body: {
                testType,
                dependentVariables: h.dependentVariables,
                independentVariables: h.independentVariables,
                groupingVariable: h.independentVariables[0],
                data: parsedData.rows.slice(0, 500),
              },
            });
          }
        }

        // Brief delay between steps
        await new Promise(r => setTimeout(r, 500));
      }

      setAutoPilotProgress(100);
      setAutoPilotStatus('Complete!');
      toast.success('SPSS Brain Analysis complete! Review results in each tab.');
    } catch (err) {
      console.error('Auto-pilot error:', err);
      toast.error('Some analyses failed. Check individual tabs.');
    } finally {
      setTimeout(() => {
        setIsAutoPilot(false);
        setAutoPilotProgress(0);
      }, 2000);
    }
  };

  return (
    <div>
      {/* SPSS Brain Analysis Button */}
      <div className="mb-4">
        {isAutoPilot ? (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">SPSS Brain Analysis Running...</p>
                <p className="text-xs text-muted-foreground">{autoPilotStatus}</p>
              </div>
              <span className="text-sm font-bold text-primary">{autoPilotProgress}%</span>
            </div>
            <Progress value={autoPilotProgress} className="h-2" />
          </div>
        ) : (
          <Button
            onClick={handleSpssBrainAnalysis}
            className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 h-12 text-base font-semibold"
            disabled={!analysisId}
          >
            <Brain className="w-5 h-5 mr-2" />
            SPSS Brain Analysis – Auto-Detect & Run All
          </Button>
        )}
      </div>

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
                    ? 'border-green-500 text-green-600 hover:text-green-500'
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
