import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Search,
  FileText,
  FileDown,
  Trash2,
  Eye,
  MoreHorizontal,
  Crown,
  BarChart3,
  Table,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { UpgradePrompt } from '@/components/plan/UpgradePrompt';
import { useNavigate } from 'react-router-dom';

interface Report {
  id: string;
  title: string;
  format: string;
  file_url: string | null;
  include_charts: boolean | null;
  include_tables: boolean | null;
  sections_included: string[] | null;
  created_at: string;
  analysis_id: string;
  analysis?: {
    test_type: string | null;
    research_question: string | null;
    ai_interpretation: string | null;
    apa_results: string | null;
    discussion: string | null;
    project?: {
      name: string;
    };
  };
}

const Reports = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPro } = usePlanLimits();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [deleteReport, setDeleteReport] = useState<Report | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Fetch reports with analysis info
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          analysis:analyses(
            test_type,
            research_question,
            ai_interpretation,
            apa_results,
            discussion,
            project:projects(name)
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Report[];
    },
    enabled: !!user,
  });

  // Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Report deleted successfully');
      setDeleteReport(null);
    },
    onError: (error) => {
      toast.error('Failed to delete report');
      console.error(error);
    },
  });

  const handleDelete = async () => {
    if (!deleteReport) return;
    setIsDeleting(true);
    await deleteMutation.mutateAsync(deleteReport.id);
    setIsDeleting(false);
  };

  const handleDownload = (report: Report) => {
    if (!isPro) {
      setShowUpgradePrompt(true);
      return;
    }
    
    // TODO: Implement actual download logic
    toast.info('Download feature coming soon!');
  };

  const filteredReports = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.analysis?.project?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.analysis?.test_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFormatBadge = (format: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      docx: 'default',
      pdf: 'secondary',
    };
    return (
      <Badge variant={variants[format] || 'outline'}>
        {format.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.dashboard.reports}</h1>
          <p className="text-muted-foreground">View and download your analysis reports</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard/new-analysis')}>
          <BarChart3 className="w-4 h-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Reports Grid */}
      {isLoading ? (
        <div className="data-card flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="data-card text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery ? 'No reports found' : 'No reports yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Complete an analysis and export to create a report'}
          </p>
          {!searchQuery && (
            <Button variant="hero" onClick={() => navigate('/dashboard/new-analysis')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Start Analysis
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="data-card hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  {getFormatBadge(report.format)}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }}>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(report); }}>
                      <FileDown className="w-4 h-4 mr-2" />
                      Download
                      {!isPro && <Crown className="w-3 h-3 ml-1 text-warning" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setDeleteReport(report); }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="font-semibold text-foreground mb-1 truncate">{report.title}</h3>
              <p className="text-sm text-muted-foreground mb-3 truncate">
                {report.analysis?.project?.name || 'Unknown Project'}
              </p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {report.analysis?.test_type && (
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    {report.analysis.test_type}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(report.created_at), 'MMM d, yyyy')}
                </div>
              </div>

              {/* Included sections indicators */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                {report.include_tables && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Table className="w-3 h-3" />
                    Tables
                  </div>
                )}
                {report.include_charts && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BarChart3 className="w-3 h-3" />
                    Charts
                  </div>
                )}
                {(report.sections_included as string[] | null)?.includes('interpretation') && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="w-3 h-3" />
                    AI
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Preview Modal */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedReport?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.analysis?.test_type} • {selectedReport?.analysis?.project?.name}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="summary" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="results">APA Results</TabsTrigger>
              <TabsTrigger value="discussion">Discussion</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="summary" className="mt-0">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {selectedReport?.analysis?.ai_interpretation ? (
                    <div className="whitespace-pre-wrap">{selectedReport.analysis.ai_interpretation}</div>
                  ) : (
                    <p className="text-muted-foreground">No summary available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="results" className="mt-0">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {selectedReport?.analysis?.apa_results ? (
                    <div className="whitespace-pre-wrap font-mono text-sm">{selectedReport.analysis.apa_results}</div>
                  ) : (
                    <p className="text-muted-foreground">No APA results available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="discussion" className="mt-0">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {selectedReport?.analysis?.discussion ? (
                    <div className="whitespace-pre-wrap">{selectedReport.analysis.discussion}</div>
                  ) : (
                    <p className="text-muted-foreground">No discussion available</p>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Close
            </Button>
            <Button
              variant="hero"
              onClick={() => {
                if (selectedReport) handleDownload(selectedReport);
              }}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Download {selectedReport?.format.toUpperCase()}
              {!isPro && <Crown className="w-3 h-3 ml-1" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteReport} onOpenChange={() => setDeleteReport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteReport?.title}"? This action cannot be undone.
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

      {/* Upgrade Prompt */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        feature="Report Downloads"
      />
    </div>
  );
};

export default Reports;
