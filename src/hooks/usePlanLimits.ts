import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface PlanLimits {
  maxRows: number;
  maxAnalysesPerMonth: number;
  allowedFileTypes: string[];
  hasAIVariableDetection: boolean;
  hasAIResearchSuggestions: boolean;
  hasFullAIInterpretation: boolean;
  hasAPAResults: boolean;
  hasDiscussion: boolean;
  hasMethodology: boolean;
  hasFullResults: boolean;
  hasExport: boolean;
  hasAdvancedTests: boolean;
  maxChatMessages: number;
}

const FREE_LIMITS: PlanLimits = {
  maxRows: 500,
  maxAnalysesPerMonth: 5,
  allowedFileTypes: ['csv'],
  hasAIVariableDetection: false,
  hasAIResearchSuggestions: false,
  hasFullAIInterpretation: false,
  hasAPAResults: false,
  hasDiscussion: false,
  hasMethodology: false,
  hasFullResults: false,
  hasExport: false,
  hasAdvancedTests: false,
  maxChatMessages: 5,
};

const PRO_LIMITS: PlanLimits = {
  maxRows: 50000,
  maxAnalysesPerMonth: -1, // Unlimited
  allowedFileTypes: ['csv', 'xlsx', 'xls', 'sav'],
  hasAIVariableDetection: true,
  hasAIResearchSuggestions: true,
  hasFullAIInterpretation: true,
  hasAPAResults: true,
  hasDiscussion: true,
  hasMethodology: true,
  hasFullResults: true,
  hasExport: true,
  hasAdvancedTests: true,
  maxChatMessages: -1, // Unlimited
};

export function usePlanLimits() {
  const { profile, user } = useAuth();
  const isPro = profile?.plan === 'pro';
  const limits = isPro ? PRO_LIMITS : FREE_LIMITS;

  // Fetch usage stats
  const { data: usageStats } = useQuery({
    queryKey: ['usage-stats', user?.id],
    queryFn: async () => {
      if (!user) return { analysesThisMonth: 0, chatMessagesToday: 0 };

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: analysesCount } = await supabase
        .from('analyses')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      return {
        analysesThisMonth: analysesCount || 0,
        chatMessagesToday: 0, // Will implement chat tracking later
      };
    },
    enabled: !!user,
  });

  const canCreateAnalysis = () => {
    if (isPro) return true;
    return (usageStats?.analysesThisMonth || 0) < limits.maxAnalysesPerMonth;
  };

  const getAnalysesRemaining = () => {
    if (isPro) return -1;
    return Math.max(0, limits.maxAnalysesPerMonth - (usageStats?.analysesThisMonth || 0));
  };

  const canUploadFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return limits.allowedFileTypes.includes(extension);
  };

  const isRowCountValid = (rowCount: number) => {
    return rowCount <= limits.maxRows;
  };

  return {
    isPro,
    limits,
    usageStats,
    canCreateAnalysis,
    getAnalysesRemaining,
    canUploadFile,
    isRowCountValid,
  };
}
