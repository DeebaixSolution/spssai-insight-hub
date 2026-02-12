import { GitBranch } from 'lucide-react';

interface Step6NonParametricProps {
  variables: unknown[];
  parsedData: unknown;
}

export function Step6NonParametric({ variables, parsedData }: Step6NonParametricProps) {
  return (
    <div className="text-center py-16">
      <GitBranch className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold mb-2">Non-Parametric Decision Engine</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Chi-Square, Mann-Whitney U, Wilcoxon, Kruskal-Wallis, and Friedman tests
        with automated decision tree selection.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming in Phase 4</p>
    </div>
  );
}
