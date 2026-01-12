import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DataPreviewTableProps {
  headers: string[];
  rows: Record<string, unknown>[];
  maxRows?: number;
  className?: string;
}

export function DataPreviewTable({
  headers,
  rows,
  maxRows = 10,
  className,
}: DataPreviewTableProps) {
  const displayRows = rows.slice(0, maxRows);

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden', className)}>
      <ScrollArea className="w-full">
        <table className="spss-table min-w-full">
          <thead>
            <tr>
              <th className="bg-muted font-medium text-left p-3 border-b border-r border-border text-xs text-muted-foreground w-12">
                #
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  className="bg-muted font-medium text-left p-3 border-b border-border whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-muted/50 transition-colors"
              >
                <td className="p-3 border-b border-r border-border/50 text-xs text-muted-foreground">
                  {rowIndex + 1}
                </td>
                {headers.map((header) => (
                  <td
                    key={`${rowIndex}-${header}`}
                    className="p-3 border-b border-border/50 whitespace-nowrap"
                  >
                    {formatCellValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {rows.length > maxRows && (
        <div className="px-4 py-2 bg-muted/50 text-sm text-muted-foreground text-center">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return String(value);
}
