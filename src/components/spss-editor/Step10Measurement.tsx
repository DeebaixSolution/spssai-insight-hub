import { Puzzle } from 'lucide-react';

interface Step10MeasurementProps {
  variables: unknown[];
  parsedData: unknown;
}

export function Step10Measurement({ variables, parsedData }: Step10MeasurementProps) {
  return (
    <div className="text-center py-16">
      <Puzzle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold mb-2">Measurement Validation Engine</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Exploratory Factor Analysis (EFA) with KMO, Bartlett's test,
        Cronbach's Alpha, and item optimization.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming in Phase 8</p>
    </div>
  );
}
