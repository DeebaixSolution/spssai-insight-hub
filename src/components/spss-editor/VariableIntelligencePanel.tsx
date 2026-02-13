import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Variable } from '@/hooks/useAnalysisWizard';
import { ParsedDataset } from '@/hooks/useAnalysisWizard';
import { cn } from '@/lib/utils';

interface VariableIntelligencePanelProps {
  variables: Variable[];
  parsedData: ParsedDataset | null;
}

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  variable?: string;
}

interface VariableConfidence {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

function computeConfidence(variable: Variable, parsedData: ParsedDataset | null): VariableConfidence {
  if (!parsedData) return { name: variable.name, confidence: 'low', reason: 'No data available' };

  const values = parsedData.rows.slice(0, 200).map(r => r[variable.name]).filter(v => v !== null && v !== undefined && v !== '');
  const total = values.length;
  if (total === 0) return { name: variable.name, confidence: 'low', reason: 'No values found' };

  const numericValues = values.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && v !== ''));
  const numericRatio = numericValues.length / total;
  const uniqueCount = new Set(values.map(String)).size;

  if (variable.measure === 'scale') {
    if (numericRatio > 0.95 && uniqueCount > 10) return { name: variable.name, confidence: 'high', reason: `${(numericRatio * 100).toFixed(0)}% numeric, ${uniqueCount} unique values` };
    if (numericRatio > 0.8) return { name: variable.name, confidence: 'medium', reason: `${(numericRatio * 100).toFixed(0)}% numeric` };
    return { name: variable.name, confidence: 'low', reason: `Only ${(numericRatio * 100).toFixed(0)}% numeric values for scale type` };
  }

  if (variable.measure === 'nominal') {
    if (numericRatio < 0.5 || uniqueCount <= 10) return { name: variable.name, confidence: 'high', reason: `${uniqueCount} categories detected` };
    if (uniqueCount <= 20) return { name: variable.name, confidence: 'medium', reason: `${uniqueCount} unique values — may be scale` };
    return { name: variable.name, confidence: 'low', reason: `${uniqueCount} unique values — likely misclassified` };
  }

  if (variable.measure === 'ordinal') {
    if (numericRatio > 0.8 && uniqueCount <= 10) return { name: variable.name, confidence: 'high', reason: `${uniqueCount} ordered levels` };
    if (uniqueCount <= 15) return { name: variable.name, confidence: 'medium', reason: `${uniqueCount} levels` };
    return { name: variable.name, confidence: 'low', reason: `Too many levels for ordinal` };
  }

  return { name: variable.name, confidence: 'medium', reason: 'Standard detection' };
}

function validateVariables(variables: Variable[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // DV/IV consistency
  const dvVars = variables.filter(v => v.role === 'dependent');
  const ivVars = variables.filter(v => v.role === 'independent');

  if (dvVars.length === 0 && variables.length > 0) {
    issues.push({ type: 'warning', message: 'No Dependent Variable (DV) assigned. Assign at least one DV for inferential tests.' });
  }

  // Check DV = IV overlap
  const dvNames = new Set(dvVars.map(v => v.name));
  ivVars.forEach(v => {
    if (dvNames.has(v.name)) {
      issues.push({ type: 'error', message: `"${v.name}" is assigned as both DV and IV`, variable: v.name });
    }
  });

  // Nominal DV warning for parametric
  dvVars.forEach(v => {
    if (v.measure === 'nominal') {
      issues.push({ type: 'info', message: `DV "${v.name}" is nominal — parametric tests require scale DV. Non-parametric or logistic regression recommended.`, variable: v.name });
    }
  });

  // Scale group validation
  const scaleGroups = new Map<string, Variable[]>();
  variables.forEach(v => {
    if (v.scaleGroup) {
      const group = scaleGroups.get(v.scaleGroup) || [];
      group.push(v);
      scaleGroups.set(v.scaleGroup, group);
    }
  });

  scaleGroups.forEach((items, groupName) => {
    if (items.length < 2) {
      issues.push({ type: 'error', message: `Scale group "${groupName}" has only ${items.length} item. Minimum 2 items required.`, variable: groupName });
    }
    if (items.length >= 2) {
      issues.push({ type: 'info', message: `Scale group "${groupName}" (${items.length} items) — Cronbach's Alpha check recommended in Step 10.`, variable: groupName });
    }
  });

  return issues;
}

const confidenceColors = {
  high: { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  medium: { dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' },
  low: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
};

export function VariableIntelligencePanel({ variables, parsedData }: VariableIntelligencePanelProps) {
  const issues = useMemo(() => validateVariables(variables), [variables]);
  const confidences = useMemo(
    () => variables.map(v => computeConfidence(v, parsedData)),
    [variables, parsedData]
  );

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');
  const infos = issues.filter(i => i.type === 'info');

  if (issues.length === 0 && variables.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Validation Issues */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="space-y-1">
              {errors.map((e, i) => <li key={i}>• {e.message}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="space-y-1">
              {warnings.map((w, i) => <li key={i}>• {w.message}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {infos.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <ul className="space-y-1">
              {infos.map((info, i) => <li key={i}>• {info.message}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Confidence Summary */}
      {confidences.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3">
          <h4 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Type Detection Confidence
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {confidences.map(c => {
              const colors = confidenceColors[c.confidence];
              return (
                <Badge key={c.name} variant="outline" className="text-xs gap-1.5" title={c.reason}>
                  <div className={cn('w-2 h-2 rounded-full', colors.dot)} />
                  {c.name}
                </Badge>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> High</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> Medium</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Low</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { computeConfidence, validateVariables };
export type { VariableConfidence, ValidationIssue };
