import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Database, Copy, TrendingUp, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ParsedDataset } from '@/hooks/useAnalysisWizard';
import { cn } from '@/lib/utils';

interface DataQualitySummaryProps {
  parsedData: ParsedDataset;
}

interface VariableQuality {
  name: string;
  missingCount: number;
  missingPercent: number;
  detectedType: 'continuous' | 'ordinal' | 'binary' | 'count' | 'categorical';
  uniqueCount: number;
  outlierCount: number;
  headerIssue?: string;
}

interface QualitySummary {
  totalMissing: number;
  totalMissingPercent: number;
  duplicateRows: number;
  totalOutliers: number;
  headerIssues: string[];
  overallScore: 'good' | 'attention' | 'issues';
  variables: VariableQuality[];
}

function analyzeDataQuality(data: ParsedDataset): QualitySummary {
  const { headers, rows } = data;
  const totalCells = headers.length * rows.length;
  const variables: VariableQuality[] = [];
  let totalMissing = 0;
  let totalOutliers = 0;
  const headerIssues: string[] = [];

  // Header validation
  const headerSet = new Set<string>();
  headers.forEach(h => {
    if (!h || h.trim() === '') headerIssues.push('Empty header detected');
    else if (headerSet.has(h)) headerIssues.push(`Duplicate header: "${h}"`);
    else if (/[^a-zA-Z0-9_\s]/.test(h)) headerIssues.push(`Special characters in: "${h}"`);
    headerSet.add(h);
  });

  // Per-variable analysis
  headers.forEach(header => {
    const values = rows.map(r => r[header]);
    const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
    const missing = values.length - nonEmpty.length;
    totalMissing += missing;

    const uniqueValues = new Set(nonEmpty.map(String));
    const numericValues = nonEmpty.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && v !== ''));
    const numbers = numericValues.map(Number);

    // Type detection
    let detectedType: VariableQuality['detectedType'] = 'categorical';
    if (numericValues.length / Math.max(nonEmpty.length, 1) > 0.9) {
      if (uniqueValues.size === 2) detectedType = 'binary';
      else if (uniqueValues.size <= 10 && numbers.every(n => Number.isInteger(n) && n >= 0)) detectedType = 'count';
      else if (uniqueValues.size <= 7 && numbers.every(n => Number.isInteger(n))) detectedType = 'ordinal';
      else detectedType = 'continuous';
    }

    // Outlier detection (IQR method for numeric)
    let outlierCount = 0;
    if (detectedType === 'continuous' && numbers.length > 10) {
      const sorted = [...numbers].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      outlierCount = numbers.filter(n => n < lower || n > upper).length;
      totalOutliers += outlierCount;
    }

    variables.push({
      name: header,
      missingCount: missing,
      missingPercent: rows.length > 0 ? (missing / rows.length) * 100 : 0,
      detectedType,
      uniqueCount: uniqueValues.size,
      outlierCount,
      headerIssue: headerIssues.find(i => i.includes(header)),
    });
  });

  // Duplicate row detection
  const rowStrings = rows.map(r => JSON.stringify(r));
  const uniqueRows = new Set(rowStrings);
  const duplicateRows = rows.length - uniqueRows.size;

  // Overall score
  const missingPercent = totalCells > 0 ? (totalMissing / totalCells) * 100 : 0;
  let overallScore: QualitySummary['overallScore'] = 'good';
  if (missingPercent > 10 || duplicateRows > rows.length * 0.1 || headerIssues.length > 2) {
    overallScore = 'issues';
  } else if (missingPercent > 2 || duplicateRows > 0 || totalOutliers > 0 || headerIssues.length > 0) {
    overallScore = 'attention';
  }

  return {
    totalMissing,
    totalMissingPercent: missingPercent,
    duplicateRows,
    totalOutliers,
    headerIssues,
    overallScore,
    variables,
  };
}

const scoreConfig = {
  good: { label: 'Good Quality', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', icon: CheckCircle },
  attention: { label: 'Needs Attention', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', icon: AlertTriangle },
  issues: { label: 'Issues Found', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: AlertTriangle },
};

export function DataQualitySummary({ parsedData }: DataQualitySummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const quality = useMemo(() => analyzeDataQuality(parsedData), [parsedData]);
  const config = scoreConfig[quality.overallScore];
  const ScoreIcon = config.icon;

  const cards = [
    { label: 'Missing Values', value: quality.totalMissing, detail: `${quality.totalMissingPercent.toFixed(1)}%`, icon: Database, warn: quality.totalMissingPercent > 5 },
    { label: 'Duplicates', value: quality.duplicateRows, detail: 'rows', icon: Copy, warn: quality.duplicateRows > 0 },
    { label: 'Outliers', value: quality.totalOutliers, detail: 'flagged', icon: TrendingUp, warn: quality.totalOutliers > 0 },
    { label: 'Header Issues', value: quality.headerIssues.length, detail: 'found', icon: Hash, warn: quality.headerIssues.length > 0 },
  ];

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn('border rounded-lg', config.border, config.bg)}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="flex items-center gap-3">
              <ScoreIcon className={cn('w-5 h-5', config.color)} />
              <div>
                <h4 className={cn('text-sm font-semibold', config.color)}>
                  Data Quality: {config.label}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {parsedData.rowCount} rows × {parsedData.columnCount} columns analyzed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Mini summary cards */}
              <div className="hidden md:flex gap-2">
                {cards.map(c => (
                  <Badge key={c.label} variant={c.warn ? 'destructive' : 'secondary'} className="text-xs">
                    {c.value} {c.label.split(' ')[0]}
                  </Badge>
                ))}
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {cards.map(c => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className={cn(
                    'rounded-lg p-3 border',
                    c.warn ? 'bg-destructive/5 border-destructive/20' : 'bg-background border-border'
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn('w-4 h-4', c.warn ? 'text-destructive' : 'text-muted-foreground')} />
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                    </div>
                    <div className="text-xl font-bold text-foreground">{c.value}</div>
                    <div className="text-xs text-muted-foreground">{c.detail}</div>
                  </div>
                );
              })}
            </div>

            {/* Variable Detail Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left font-medium border-b">Variable</th>
                    <th className="p-2 text-left font-medium border-b">Detected Type</th>
                    <th className="p-2 text-right font-medium border-b">Unique</th>
                    <th className="p-2 text-right font-medium border-b">Missing</th>
                    <th className="p-2 text-right font-medium border-b">Outliers</th>
                  </tr>
                </thead>
                <tbody>
                  {quality.variables.map(v => (
                    <tr key={v.name} className="hover:bg-muted/50">
                      <td className="p-2 border-b border-border/50 font-mono">{v.name}</td>
                      <td className="p-2 border-b border-border/50">
                        <Badge variant="outline" className="text-xs capitalize">{v.detectedType}</Badge>
                      </td>
                      <td className="p-2 border-b border-border/50 text-right">{v.uniqueCount}</td>
                      <td className="p-2 border-b border-border/50 text-right">
                        <span className={v.missingPercent > 5 ? 'text-destructive font-medium' : ''}>
                          {v.missingCount} ({v.missingPercent.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="p-2 border-b border-border/50 text-right">
                        <span className={v.outlierCount > 0 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : ''}>
                          {v.outlierCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Header Issues */}
            {quality.headerIssues.length > 0 && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                <h5 className="text-xs font-medium text-destructive mb-1">Header Issues:</h5>
                <ul className="text-xs text-destructive/80 space-y-0.5">
                  {quality.headerIssues.map((issue, i) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
