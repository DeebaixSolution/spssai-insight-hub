import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/types';

export interface ParsedDataset {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  fileType: string;
  rowCount: number;
  columnCount: number;
}

export interface Variable {
  id?: string;
  name: string;
  label: string;
  type: 'nominal' | 'ordinal' | 'scale';
  measure: 'nominal' | 'ordinal' | 'scale';
  width: number;
  decimals: number;
  valueLabels: Record<string, string>;
  missingValues: string[];
  columnIndex: number;
}

export interface AnalysisConfig {
  testCategory: string;
  testType: string;
  dependentVariables: string[];
  independentVariables: string[];
  groupingVariable?: string;
  covariates?: string[];
  options: Record<string, unknown>;
}

export interface AnalysisResults {
  tables: Array<{
    title: string;
    headers: string[];
    rows: Array<Record<string, string | number>>;
  }>;
  charts?: Array<{
    type: string;
    data: unknown;
    title: string;
  }>;
  summary: string;
}

export interface WizardState {
  currentStep: number;
  projectId: string | null;
  projectName: string;
  datasetId: string | null;
  parsedData: ParsedDataset | null;
  variables: Variable[];
  researchQuestion: string;
  hypothesis: string;
  analysisConfig: AnalysisConfig | null;
  results: AnalysisResults | null;
  aiInterpretation: string;
  apaResults: string;
  discussion: string;
  analysisId: string | null;
}

const initialState: WizardState = {
  currentStep: 1,
  projectId: null,
  projectName: '',
  datasetId: null,
  parsedData: null,
  variables: [],
  researchQuestion: '',
  hypothesis: '',
  analysisConfig: null,
  results: null,
  aiInterpretation: '',
  apaResults: '',
  discussion: '',
  analysisId: null,
};

export function useAnalysisWizard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<WizardState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 7) {
      setState(prev => ({ ...prev, currentStep: step }));
    }
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(7, prev.currentStep + 1),
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1),
    }));
  }, []);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name,
          user_id: user.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      updateState({ projectId: data.id, projectName: data.name });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Save dataset mutation
  const saveDatasetMutation = useMutation({
    mutationFn: async ({
      projectId,
      parsedData,
    }: {
      projectId: string;
      parsedData: ParsedDataset;
    }) => {
      const { data, error } = await supabase
        .from('datasets')
        .insert([{
          project_id: projectId,
          file_name: parsedData.fileName,
          file_type: parsedData.fileType,
          row_count: parsedData.rowCount,
          column_count: parsedData.columnCount,
          raw_data: parsedData.rows as Json,
          parsed_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      updateState({ datasetId: data.id });
    },
  });

  // Save variables mutation
  const saveVariablesMutation = useMutation({
    mutationFn: async ({
      datasetId,
      variables,
    }: {
      datasetId: string;
      variables: Variable[];
    }) => {
      const variableRecords = variables.map((v) => ({
        dataset_id: datasetId,
        name: v.name,
        label: v.label || null,
        type: v.type,
        measure: v.measure,
        width: v.width,
        decimals: v.decimals,
        value_labels: v.valueLabels || null,
        missing_values: v.missingValues || null,
        column_index: v.columnIndex,
      }));

      const { data, error } = await supabase
        .from('variables')
        .insert(variableRecords)
        .select();

      if (error) throw error;
      return data;
    },
  });

  // Create/update analysis mutation
  const saveAnalysisMutation = useMutation({
    mutationFn: async (analysisData: Partial<WizardState>) => {
      if (!user || !state.projectId || !state.datasetId) {
        throw new Error('Missing required data');
      }

      const analysisRecord = {
        project_id: state.projectId,
        dataset_id: state.datasetId,
        current_step: analysisData.currentStep || state.currentStep,
        research_question: analysisData.researchQuestion || state.researchQuestion || null,
        hypothesis: analysisData.hypothesis || state.hypothesis || null,
        test_category: analysisData.analysisConfig?.testCategory || state.analysisConfig?.testCategory || null,
        test_type: analysisData.analysisConfig?.testType || state.analysisConfig?.testType || null,
        config: (analysisData.analysisConfig || state.analysisConfig || null) as unknown as Json,
        selected_variables: state.variables.map(v => v.name) as unknown as Json,
        results: (analysisData.results || state.results || null) as unknown as Json,
        ai_interpretation: analysisData.aiInterpretation || state.aiInterpretation || null,
        apa_results: analysisData.apaResults || state.apaResults || null,
        discussion: analysisData.discussion || state.discussion || null,
        status: (analysisData.currentStep === 7 ? 'completed' : 'configuring') as 'draft' | 'configuring' | 'running' | 'completed' | 'failed',
      };

      if (state.analysisId) {
        const { data, error } = await supabase
          .from('analyses')
          .update(analysisRecord)
          .eq('id', state.analysisId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('analyses')
          .insert([analysisRecord])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      updateState({ analysisId: data.id });
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
    },
  });

  const reset = useCallback(() => {
    setState(initialState);
    setError(null);
  }, []);

  // Load an existing analysis by ID
  const loadAnalysis = useCallback(async (analysisId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch analysis with related data
      const { data: analysis, error: analysisError } = await supabase
        .from('analyses')
        .select(`
          *,
          dataset:datasets(*),
          project:projects(*)
        `)
        .eq('id', analysisId)
        .single();

      if (analysisError) throw analysisError;

      // Fetch variables for the dataset
      const { data: variables, error: varsError } = await supabase
        .from('variables')
        .select('*')
        .eq('dataset_id', analysis.dataset_id)
        .order('column_index');

      if (varsError) throw varsError;

      // Parse raw_data from dataset
      const rawData = analysis.dataset?.raw_data as Record<string, unknown>[] | null;
      let parsedData: ParsedDataset | null = null;

      if (rawData && Array.isArray(rawData) && rawData.length > 0) {
        parsedData = {
          headers: Object.keys(rawData[0]),
          rows: rawData,
          fileName: analysis.dataset.file_name,
          fileType: analysis.dataset.file_type,
          rowCount: analysis.dataset.row_count || rawData.length,
          columnCount: analysis.dataset.column_count || Object.keys(rawData[0]).length,
        };
      }

      // Map variables to wizard format
      const wizardVariables: Variable[] = (variables || []).map((v) => ({
        id: v.id,
        name: v.name,
        label: v.label || '',
        type: v.type as 'nominal' | 'ordinal' | 'scale',
        measure: (v.measure || v.type) as 'nominal' | 'ordinal' | 'scale',
        width: v.width || 8,
        decimals: v.decimals || 2,
        valueLabels: (v.value_labels as Record<string, string>) || {},
        missingValues: (v.missing_values as string[]) || [],
        columnIndex: v.column_index,
      }));

      // Restore state
      setState({
        currentStep: analysis.current_step || 1,
        projectId: analysis.project_id,
        projectName: analysis.project?.name || '',
        datasetId: analysis.dataset_id,
        parsedData,
        variables: wizardVariables,
        researchQuestion: analysis.research_question || '',
        hypothesis: analysis.hypothesis || '',
        analysisConfig: analysis.config as unknown as AnalysisConfig | null,
        results: analysis.results as unknown as AnalysisResults | null,
        aiInterpretation: analysis.ai_interpretation || '',
        apaResults: analysis.apa_results || '',
        discussion: analysis.discussion || '',
        analysisId: analysis.id,
      });

    } catch (err) {
      console.error('Error loading analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    state,
    isLoading,
    error,
    updateState,
    goToStep,
    nextStep,
    prevStep,
    createProject: createProjectMutation.mutateAsync,
    saveDataset: saveDatasetMutation.mutateAsync,
    saveVariables: saveVariablesMutation.mutateAsync,
    saveAnalysis: saveAnalysisMutation.mutateAsync,
    loadAnalysis,
    reset,
    isCreatingProject: createProjectMutation.isPending,
    isSavingDataset: saveDatasetMutation.isPending,
    isSavingVariables: saveVariablesMutation.isPending,
    isSavingAnalysis: saveAnalysisMutation.isPending,
  };
}
