import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataPreviewTable } from './DataPreviewTable';
import { DataQualitySummary } from './DataQualitySummary';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useDataParser } from '@/hooks/useDataParser';
import { ParsedDataset } from '@/hooks/useAnalysisWizard';
import { cn } from '@/lib/utils';

interface Step1UploadProps {
  onDataParsed: (data: ParsedDataset) => void;
  parsedData: ParsedDataset | null;
  projectName: string;
  onProjectNameChange: (name: string) => void;
}

export function Step1Upload({
  onDataParsed,
  parsedData,
  projectName,
  onProjectNameChange,
}: Step1UploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { parseFile, isLoading } = useDataParser();
  const { limits, isPro, canUploadFile, isRowCountValid } = usePlanLimits();

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null);

      // Check file type
      if (!canUploadFile(file)) {
        const allowedTypes = limits.allowedFileTypes.join(', ').toUpperCase();
        setUploadError(
          `File type not supported. ${
            isPro
              ? `Allowed types: ${allowedTypes}`
              : `Free plan only supports CSV. Upgrade to Pro for Excel and SPSS files.`
          }`
        );
        return;
      }

      try {
        const data = await parseFile(file);

        // Check row count
        if (!isRowCountValid(data.rowCount)) {
          setUploadError(
            `Dataset has ${data.rowCount.toLocaleString()} rows, but your plan allows up to ${limits.maxRows.toLocaleString()} rows. ${
              !isPro ? 'Upgrade to Pro for up to 50,000 rows.' : ''
            }`
          );
          return;
        }

        onDataParsed(data);

        // Auto-generate project name from file
        if (!projectName) {
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          onProjectNameChange(`Analysis: ${baseName}`);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Failed to parse file');
      }
    },
    [parseFile, canUploadFile, isRowCountValid, limits, isPro, onDataParsed, projectName, onProjectNameChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const clearData = useCallback(() => {
    onDataParsed(null as unknown as ParsedDataset);
    setUploadError(null);
  }, [onDataParsed]);

  return (
    <div className="space-y-6">
      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="project-name">Project Name</Label>
        <Input
          id="project-name"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="Enter a name for your analysis project"
          className="max-w-md"
        />
      </div>

      {/* Upload Area */}
      {!parsedData ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center transition-all',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            isLoading && 'opacity-50 pointer-events-none'
          )}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept={limits.allowedFileTypes.map((t) => `.${t}`).join(',')}
            onChange={handleFileSelect}
            disabled={isLoading}
          />

          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-primary" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {isLoading ? 'Parsing file...' : 'Drop your data file here'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isPro
                  ? 'Supports CSV, Excel (.xlsx, .xls), and SPSS (.sav) files'
                  : 'Free plan supports CSV files only'}
              </p>
            </div>

            <Button asChild variant="outline" disabled={isLoading}>
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Browse Files
              </label>
            </Button>

            <div className="text-xs text-muted-foreground">
              Max {limits.maxRows.toLocaleString()} rows
              {!isPro && ' • Upgrade to Pro for 50,000 rows'}
            </div>
          </div>
        </div>
      ) : (
        /* Data Preview */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{parsedData.fileName}</h3>
                <p className="text-sm text-muted-foreground">
                  {parsedData.rowCount.toLocaleString()} rows × {parsedData.columnCount} columns
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearData}>
              <X className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>

          <DataPreviewTable
            headers={parsedData.headers}
            rows={parsedData.rows}
            maxRows={10}
          />

          {/* Data Quality Summary */}
          <DataQualitySummary parsedData={parsedData} />
        </div>
      )}

      {/* Error Alert */}
      {uploadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {/* Tips */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Tips for best results:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• First row should contain variable names (headers)</li>
          <li>• Use short, descriptive variable names (e.g., "age", "gender", "score1")</li>
          <li>• Ensure numeric values don't contain text (except for missing value codes)</li>
          <li>• Remove any summary rows or empty rows at the bottom</li>
        </ul>
      </div>
    </div>
  );
}
