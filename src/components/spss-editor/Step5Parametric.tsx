import { FlaskConical } from 'lucide-react';

interface Step5ParametricProps {
  variables: unknown[];
  parsedData: unknown;
}

export function Step5Parametric({ variables, parsedData }: Step5ParametricProps) {
  return (
    <div className="text-center py-16">
      <FlaskConical className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold mb-2">Parametric Inferential Engine</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        One-Sample T-Test, Independent Samples T-Test, Paired Samples T-Test, and One-Way ANOVA.
        Connected to normality results from Step 4.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming in Phase 3</p>
    </div>
  );
}
