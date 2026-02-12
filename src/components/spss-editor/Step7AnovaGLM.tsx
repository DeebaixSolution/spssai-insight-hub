import { BarChart3 } from 'lucide-react';

interface Step7AnovaGLMProps {
  variables: unknown[];
  parsedData: unknown;
}

export function Step7AnovaGLM({ variables, parsedData }: Step7AnovaGLMProps) {
  return (
    <div className="text-center py-16">
      <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold mb-2">ANOVA & GLM Engine</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        One-Way, Two-Way, Repeated Measures ANOVA, MANOVA with post-hoc tests,
        effect sizes, and interaction plots.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming in Phase 5</p>
    </div>
  );
}
