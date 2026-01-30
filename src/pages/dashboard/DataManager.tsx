import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Upload,
  Search,
  FileSpreadsheet,
  Trash2,
  Eye,
  Play,
  FolderOpen,
  Database,
  MoreHorizontal,
  FileText,
  Table as TableIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataPreviewTable } from '@/components/spss-editor/DataPreviewTable';
import { useNavigate } from 'react-router-dom';
import { UploadDatasetDialog } from '@/components/data-manager/UploadDatasetDialog';
import type { Json } from '@/integrations/supabase/types';

interface Dataset {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  row_count: number | null;
  column_count: number | null;
  created_at: string;
  project_id: string;
  raw_data: Json | null;
  project?: {
    name: string;
  };
}

interface Variable {
  id: string;
  name: string;
  label: string | null;
  type: string;
  measure: string | null;
}

const DataManager = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [deleteDataset, setDeleteDataset] = useState<Dataset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Fetch datasets with project info
  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['datasets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('datasets')
        .select(`
          *,
          project:projects(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Dataset[];
    },
    enabled: !!user,
  });

  // Fetch variables for selected dataset
  const { data: variables = [] } = useQuery({
    queryKey: ['variables', selectedDataset?.id],
    queryFn: async () => {
      if (!selectedDataset) return [];
      const { data, error } = await supabase
        .from('variables')
        .select('*')
        .eq('dataset_id', selectedDataset.id)
        .order('column_index');

      if (error) throw error;
      return data as Variable[];
    },
    enabled: !!selectedDataset,
  });

  // Delete dataset mutation
  const deleteMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      // First delete related analyses
      await supabase
        .from('analyses')
        .delete()
        .eq('dataset_id', datasetId);

      // Then delete variables
      await supabase
        .from('variables')
        .delete()
        .eq('dataset_id', datasetId);

      // Finally delete the dataset
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', datasetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success('Dataset deleted successfully');
      setDeleteDataset(null);
    },
    onError: (error) => {
      toast.error('Failed to delete dataset');
      console.error(error);
    },
  });

  const handleDelete = async () => {
    if (!deleteDataset) return;
    setIsDeleting(true);
    await deleteMutation.mutateAsync(deleteDataset.id);
    setIsDeleting(false);
  };

  const handleOpenInAnalysis = (dataset: Dataset) => {
    // Navigate to new analysis with this dataset pre-selected
    navigate('/dashboard/new-analysis', { state: { datasetId: dataset.id } });
  };

  const filteredDatasets = datasets.filter(
    (d) =>
      d.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.project?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeIcon = (type: string) => {
    if (type.includes('csv')) return <FileText className="w-4 h-4" />;
    if (type.includes('excel') || type.includes('xlsx')) return <FileSpreadsheet className="w-4 h-4" />;
    return <TableIcon className="w-4 h-4" />;
  };

  const getFileTypeBadge = (type: string) => {
    if (type.includes('csv')) return 'CSV';
    if (type.includes('xlsx') || type.includes('excel')) return 'Excel';
    if (type.includes('xls')) return 'XLS';
    return type.toUpperCase();
  };

  // Parse raw_data for preview
  const getPreviewData = () => {
    if (!selectedDataset?.raw_data) return { headers: [], rows: [] as Record<string, unknown>[] };
    const rawData = selectedDataset.raw_data as Record<string, unknown>[];
    if (!Array.isArray(rawData) || rawData.length === 0) return { headers: [], rows: [] as Record<string, unknown>[] };
    
    const headers = Object.keys(rawData[0] || {});
    const rows = rawData.slice(0, 100).map(row =>
    row as Record<string, unknown>
    );
    return { headers, rows };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.dashboard.dataManager}</h1>
          <p className="text-muted-foreground">Manage and organize your datasets</p>
        </div>
        <Button variant="hero" onClick={() => setIsUploadOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Dataset
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search datasets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Datasets Table */}
      {isLoading ? (
        <div className="data-card flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="data-card text-center py-12">
          <Database className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery ? 'No datasets found' : 'No datasets yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Upload your first dataset to get started'}
          </p>
          {!searchQuery && (
            <Button variant="hero" onClick={() => setIsUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Dataset
            </Button>
          )}
        </div>
      ) : (
        <div className="data-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Columns</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDatasets.map((dataset) => (
                <TableRow key={dataset.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getFileTypeIcon(dataset.file_type)}
                      <span className="truncate max-w-[200px]">{dataset.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getFileTypeBadge(dataset.file_type)}</Badge>
                  </TableCell>
                  <TableCell>{dataset.row_count?.toLocaleString() || '-'}</TableCell>
                  <TableCell>{dataset.column_count || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground truncate max-w-[120px]">
                        {dataset.project?.name || 'Unknown'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(dataset.file_size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(dataset.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedDataset(dataset)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenInAnalysis(dataset)}>
                          <Play className="w-4 h-4 mr-2" />
                          Open in Analysis
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteDataset(dataset)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dataset Details Modal */}
      <Dialog open={!!selectedDataset} onOpenChange={() => setSelectedDataset(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedDataset && getFileTypeIcon(selectedDataset.file_type)}
              {selectedDataset?.file_name}
            </DialogTitle>
            <DialogDescription>
              {selectedDataset?.row_count?.toLocaleString()} rows × {selectedDataset?.column_count} columns
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="preview" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview">Data Preview</TabsTrigger>
              <TabsTrigger value="variables">Variables ({variables.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="flex-1 overflow-auto mt-4">
              {selectedDataset?.raw_data ? (
                <DataPreviewTable
                  headers={getPreviewData().headers}
                  rows={getPreviewData().rows}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No preview available
                </div>
              )}
            </TabsContent>

            <TabsContent value="variables" className="flex-1 overflow-auto mt-4">
              {variables.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Measure</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variables.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-sm">{v.name}</TableCell>
                        <TableCell className="text-muted-foreground">{v.label || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{v.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.measure || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No variables defined yet
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSelectedDataset(null)}>
              Close
            </Button>
            <Button
              variant="hero"
              onClick={() => {
                if (selectedDataset) handleOpenInAnalysis(selectedDataset);
                setSelectedDataset(null);
              }}
            >
              <Play className="w-4 h-4 mr-2" />
              Open in Analysis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDataset} onOpenChange={() => setDeleteDataset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dataset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDataset?.file_name}"? This will also delete
              all related analyses and variables. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Dataset Dialog */}
      <UploadDatasetDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['datasets'] })}
      />
    </div>
  );
};

export default DataManager;
