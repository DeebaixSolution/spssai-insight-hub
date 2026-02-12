import { Link2 } from 'lucide-react';

interface Step8CorrelationProps {
  variables: unknown[];
  parsedData: unknown;
}

export function Step8Correlation({ variables, parsedData }: Step8CorrelationProps) {
  return (
    <div className="text-center py-16">
      <Link2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold mb-2">Correlation Intelligence Module</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Pairwise, Matrix, and DV-Centered correlation modes with
        Pearson, Spearman, and Kendall's Tau.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming in Phase 6</p>
    </div>
  );
}
