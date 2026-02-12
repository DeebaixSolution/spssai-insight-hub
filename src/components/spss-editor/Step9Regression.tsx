import { TrendingUp } from 'lucide-react';

interface Step9RegressionProps {
  variables: unknown[];
  parsedData: unknown;
}

export function Step9Regression({ variables, parsedData }: Step9RegressionProps) {
  return (
    <div className="text-center py-16">
      <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold mb-2">Regression Modeling Engine</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Simple & Multiple Linear Regression, Binary Logistic Regression
        with diagnostics, VIF checks, and ROC curves.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming in Phase 7</p>
    </div>
  );
}
