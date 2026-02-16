import { useState } from 'react';
import { Lightbulb, X, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIAssistantPanelProps {
  currentStep: number;
}

const stepTips: Record<number, { title: string; tips: string[]; icon: string }> = {
  1: {
    title: 'Data Upload',
    icon: '📁',
    tips: [
      'Upload SPSS (.sav), Excel (.xlsx), or CSV files',
      'Ensure your data has column headers in the first row',
      'Clean missing values before uploading for best results',
    ],
  },
  2: {
    title: 'Variable Configuration',
    icon: '🔧',
    tips: [
      'Use "AI Detect & Group" to auto-assign roles, measures, and scale groups',
      'Assign DV/IV roles for better test recommendations in Step 3',
      'Group Likert items into scales for reliability analysis in Step 10',
    ],
  },
  3: {
    title: 'Research Design',
    icon: '🔬',
    tips: [
      'A clear research question drives the entire analysis pipeline',
      'Use "Generate Research Questions" for AI-suggested questions based on your variables',
      'Set the hypothesis count before generating — each hypothesis links to a specific test',
    ],
  },
  4: {
    title: 'Descriptive & Normality',
    icon: '📊',
    tips: [
      'Always check normality BEFORE running parametric tests',
      'Skewness > |2| or Kurtosis > |7| suggests non-normal distribution',
      'If normality is violated, use non-parametric alternatives (Step 6)',
    ],
  },
  5: {
    title: 'Parametric Tests',
    icon: '📈',
    tips: [
      'Use Independent t-test for 2 groups, One-way ANOVA for 3+ groups',
      'Check Levene\'s test for homogeneity of variances',
      'Report effect size (Cohen\'s d) alongside p-values',
    ],
  },
  6: {
    title: 'Non-Parametric Tests',
    icon: '📉',
    tips: [
      'Use when normality assumption is violated',
      'Mann-Whitney U replaces Independent t-test',
      'Kruskal-Wallis replaces One-way ANOVA',
    ],
  },
  7: {
    title: 'ANOVA & GLM',
    icon: '🧮',
    tips: [
      'Two-way ANOVA examines interaction effects between factors',
      'Check for significant interactions before interpreting main effects',
      'Post-hoc tests (Tukey, Bonferroni) reveal which groups differ',
    ],
  },
  8: {
    title: 'Correlation',
    icon: '🔗',
    tips: [
      'Pearson for normal data, Spearman for non-normal or ordinal',
      'r > .70 may indicate multicollinearity — check before regression',
      'Correlation does not imply causation',
    ],
  },
  9: {
    title: 'Regression',
    icon: '🎯',
    tips: [
      'Check VIF < 10 for multicollinearity before interpreting results',
      'Standardized Beta shows relative predictor importance',
      'Use logistic regression for binary (0/1) dependent variables',
    ],
  },
  10: {
    title: 'Measurement Validation',
    icon: '✅',
    tips: [
      'KMO > .70 indicates adequate sampling for factor analysis',
      'Factor loadings < .40 suggest weak items — consider removal',
      'Cronbach\'s Alpha > .70 indicates acceptable internal consistency',
    ],
  },
  11: {
    title: 'Chapter 4: Results',
    icon: '📝',
    tips: [
      'Generate all sections then edit each individually',
      'Tables from Steps 4-10 appear inline — the AI references them',
      'Use per-section "AI" button to regenerate individual sections',
    ],
  },
  12: {
    title: 'Chapter 5: Discussion',
    icon: '💡',
    tips: [
      'Link findings to your theoretical framework',
      'Discuss unexpected results — they strengthen academic rigor',
      'Use per-section "AI" button for targeted regeneration',
    ],
  },
  13: {
    title: 'Thesis Binder',
    icon: '📄',
    tips: [
      'Both chapters must be generated before export',
      'Word export includes all tables and APA formatting',
      'PRO users get full export without watermarks',
    ],
  },
};

export function AIAssistantPanel({ currentStep }: AIAssistantPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const currentTips = stepTips[currentStep];
  if (!currentTips) return null;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full w-12 h-12 p-0 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 animate-pulse"
      >
        <Brain className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
            {currentTips.icon}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-primary" />
              SPSS Assistant
            </h4>
            <p className="text-xs text-muted-foreground">{currentTips.title}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(!isMinimized)} className="h-7 w-7 p-0">
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-7 w-7 p-0">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="space-y-2 mt-3">
          {currentTips.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground/80">{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
