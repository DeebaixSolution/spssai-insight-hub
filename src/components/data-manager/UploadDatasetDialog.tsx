import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDataParser } from '@/hooks/useDataParser';
import { DataPreviewTable } from '@/components/spss-editor/DataPreviewTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Loader2, CheckCircle } from 'lucide-react';
import type { ParsedDataset } from '@/hooks/useAnalysisWizard';

interface UploadDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UploadDatasetDialog({ open, onOpenChange, onSuccess }: UploadDatasetDialogProps) {
  const { user } = useAuth();
  const { parseFile, detectVariableTypes, isLoading: isParsing } = useDataParser();
  
  const [projectName, setProjectName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedDataset | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setUploadedFile(file);
      const data = await parseFile(file);
      setParsedData(data);
      
      // Auto-fill project name from file name if empty
      if (!projectName) {
        const baseName = file.name.replace(/\.(csv|xlsx?|sav)$/i, '');
        setProjectName(baseName);
      }
    } catch (err) {
      toast.error('Failed to parse file');
      console.error(err);
    }
  }, [parseFile, projectName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: isParsing || isSaving,
  });

  const handleSave = async () => {
    if (!user || !parsedData || !projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          user_id: user.id,
          status: 'draft',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Create dataset
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .insert([{
          project_id: project.id,
          file_name: parsedData.fileName,
          file_type: parsedData.fileType,
          file_size: uploadedFile?.size || null,
          row_count: parsedData.rowCount,
          column_count: parsedData.columnCount,
          raw_data: JSON.parse(JSON.stringify(parsedData.rows)),
          parsed_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (datasetError) throw datasetError;

      // 3. Detect and save variables
      const detectedVariables = detectVariableTypes(parsedData);
      const variablesToInsert = detectedVariables.map((v) => ({
        dataset_id: dataset.id,
        name: v.name,
        label: v.label || null,
        type: v.type,
        measure: v.measure || v.type,
        column_index: v.columnIndex,
        width: v.width,
        decimals: v.decimals,
        value_labels: v.valueLabels || null,
        missing_values: v.missingValues || null,
      }));

      const { error: varsError } = await supabase
        .from('variables')
        .insert(variablesToInsert);

      if (varsError) throw varsError;

      toast.success('Dataset saved successfully!');
      handleClose();
      onSuccess();

    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save dataset');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setProjectName('');
    setUploadedFile(null);
    setParsedData(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload New Dataset</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to create a new project with your data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="Enter project name..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* File Upload Zone */}
          {!parsedData ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                transition-colors duration-200
                ${isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
                ${isParsing ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              <input {...getInputProps()} />
              
              {isParsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-muted-foreground">Parsing file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {isDragActive ? 'Drop your file here' : 'Drop your file here or click to browse'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supports CSV, Excel (.xlsx, .xls)
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{parsedData.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {parsedData.rowCount.toLocaleString()} rows × {parsedData.columnCount} columns
                  </p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>

              {/* Data Preview */}
              <div>
                <Label className="mb-2 block">Data Preview</Label>
                <DataPreviewTable
                  headers={parsedData.headers}
                  rows={parsedData.rows.slice(0, 5)}
                  maxRows={5}
                  className="max-h-[200px]"
                />
              </div>

              {/* Change File Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadedFile(null);
                  setParsedData(null);
                }}
                disabled={isSaving}
              >
                Choose Different File
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="hero"
            onClick={handleSave}
            disabled={!parsedData || !projectName.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Dataset'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
