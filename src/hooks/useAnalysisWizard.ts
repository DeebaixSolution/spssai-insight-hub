import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/types';
import type {
  Variable,
  Hypothesis,
  AnalysisBlock,
  BlockResults,
  BlockNarrative,
  AssumptionResult,
} from '@/types/analysis';

// Re-export types for backward compatibility
export type { Variable, Hypothesis, AnalysisBlock };

export interface ParsedDataset {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  fileType: string;
  rowCount: number;
  columnCount: number;
}

// Legacy AnalysisConfig for backward compatibility
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

// Enhanced wizard state with new architecture
export interface WizardState {
  currentStep: number;
  projectId: string | null;
  projectName: string;
  datasetId: string | null;
  parsedData: ParsedDataset | null;
  variables: Variable[];
  
  // Step 3: Research Question & Hypotheses
  researchQuestion: string;
  hypotheses: Hypothesis[];
  
  // Step 4: Analysis Blocks
  analysisBlocks: AnalysisBlock[];
  
  // Legacy fields for backward compatibility
  hypothesis: string;
  analysisConfig: AnalysisConfig | null;
  results: AnalysisResults | null;
  
  // Step 6: Interpretations
  aiInterpretation: string;
  apaResults: string;
  discussion: string;
  methodology: string;
  fullResults: string;
  
  // Settings
  supervisorMode: boolean;
  styleProfile: 'apa7' | 'custom';
  
  analysisId: string | null;
}

const createDefaultVariable = (name: string, index: number): Variable => ({
  name,
  label: '',
  type: 'scale',
  measure: 'scale',
  dataType: 'numeric',
  role: null,
  width: 8,
  decimals: 2,
  valueLabels: {},
  missingValues: [],
  columnIndex: index,
});

const initialState: WizardState = {
  currentStep: 1,
  projectId: null,
  projectName: '',
  datasetId: null,
  parsedData: null,
  variables: [],
  researchQuestion: '',
  hypotheses: [],
  analysisBlocks: [],
  hypothesis: '',
  analysisConfig: null,
  results: null,
  aiInterpretation: '',
  apaResults: '',
  discussion: '',
  methodology: '',
  fullResults: '',
  supervisorMode: false,
  styleProfile: 'apa7',
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
    if (step >= 1 && step <= 13) {
      setState(prev => ({ ...prev, currentStep: step }));
    }
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(13, prev.currentStep + 1),
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1),
    }));
  }, []);

  // ==================== HYPOTHESIS MANAGEMENT ====================

  const addHypothesis = useCallback((hypothesis: Omit<Hypothesis, 'id'>) => {
    const newHypothesis: Hypothesis = {
      ...hypothesis,
      id: crypto.randomUUID(),
    };
    setState(prev => ({
      ...prev,
      hypotheses: [...prev.hypotheses, newHypothesis],
    }));
    return newHypothesis;
  }, []);

  const updateHypothesis = useCallback((id: string, updates: Partial<Hypothesis>) => {
    setState(prev => ({
      ...prev,
      hypotheses: prev.hypotheses.map(h => 
        h.id === id ? { ...h, ...updates } : h
      ),
    }));
  }, []);

  const removeHypothesis = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      hypotheses: prev.hypotheses.filter(h => h.id !== id),
      // Also remove any analysis blocks linked to this hypothesis
      analysisBlocks: prev.analysisBlocks.filter(b => b.linkedHypothesisId !== id),
    }));
  }, []);

  // ==================== ANALYSIS BLOCK MANAGEMENT ====================

  const addAnalysisBlock = useCallback((block: Omit<AnalysisBlock, 'id' | 'displayOrder'>) => {
    const newBlock: AnalysisBlock = {
      ...block,
      id: crypto.randomUUID(),
      displayOrder: state.analysisBlocks.length,
    };
    setState(prev => ({
      ...prev,
      analysisBlocks: [...prev.analysisBlocks, newBlock],
    }));
    return newBlock;
  }, [state.analysisBlocks.length]);

  const updateAnalysisBlock = useCallback((id: string, updates: Partial<AnalysisBlock>) => {
    setState(prev => ({
      ...prev,
      analysisBlocks: prev.analysisBlocks.map(b => 
        b.id === id ? { ...b, ...updates } : b
      ),
    }));
  }, []);

  const removeAnalysisBlock = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      analysisBlocks: prev.analysisBlocks.filter(b => b.id !== id),
    }));
  }, []);

  const reorderAnalysisBlocks = useCallback((startIndex: number, endIndex: number) => {
    setState(prev => {
      const blocks = [...prev.analysisBlocks];
      const [removed] = blocks.splice(startIndex, 1);
      blocks.splice(endIndex, 0, removed);
      return {
        ...prev,
        analysisBlocks: blocks.map((b, i) => ({ ...b, displayOrder: i })),
      };
    });
  }, []);

  // ==================== VARIABLE MANAGEMENT ====================

  const updateVariable = useCallback((index: number, updates: Partial<Variable>) => {
    setState(prev => ({
      ...prev,
      variables: prev.variables.map((v, i) => 
        i === index ? { ...v, ...updates } : v
      ),
    }));
  }, []);

  const getVariablesByRole = useCallback((role: Variable['role']) => {
    return state.variables.filter(v => v.role === role);
  }, [state.variables]);

  const getVariablesByMeasure = useCallback((measure: Variable['measure']) => {
    return state.variables.filter(v => v.measure === measure);
  }, [state.variables]);

  // ==================== DATABASE MUTATIONS ====================

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
        role: v.role || null,
        scale_group: v.scaleGroup || null,
      }));

      const { data, error } = await supabase
        .from('variables')
        .insert(variableRecords)
        .select();

      if (error) throw error;
      return data;
    },
  });

  // Save hypotheses mutation
  const saveHypothesesMutation = useMutation({
    mutationFn: async ({
      analysisId,
      hypotheses,
    }: {
      analysisId: string;
      hypotheses: Hypothesis[];
    }) => {
      // Delete existing hypotheses
      await supabase
        .from('hypotheses')
        .delete()
        .eq('analysis_id', analysisId);

      if (hypotheses.length === 0) return [];

      const hypothesisRecords = hypotheses.map((h) => ({
        analysis_id: analysisId,
        hypothesis_id: h.hypothesisId,
        hypothesis_type: h.type,
        statement: h.statement,
        dependent_vars: h.dependentVariables,
        independent_vars: h.independentVariables,
        status: h.status || 'untested',
      }));

      const { data, error } = await supabase
        .from('hypotheses')
        .insert(hypothesisRecords)
        .select();

      if (error) throw error;
      return data;
    },
  });

  // Save analysis blocks mutation
  const saveAnalysisBlocksMutation = useMutation({
    mutationFn: async ({
      analysisId,
      blocks,
    }: {
      analysisId: string;
      blocks: AnalysisBlock[];
    }) => {
      // Delete existing blocks
      await supabase
        .from('analysis_blocks')
        .delete()
        .eq('analysis_id', analysisId);

      if (blocks.length === 0) return [];

      const blockRecords = blocks.map((b) => ({
        analysis_id: analysisId,
        section: b.section,
        section_id: b.sectionId,
        test_type: b.testType,
        test_category: b.testCategory,
        config: b.config as Json,
        dependent_variables: b.dependentVariables,
        independent_variables: b.independentVariables,
        grouping_variable: b.groupingVariable || null,
        linked_hypothesis_id: b.linkedHypothesisId || null,
        assumptions: b.assumptions as unknown as Json,
        results: b.results as unknown as Json,
        narrative: b.narrative as unknown as Json,
        display_order: b.displayOrder,
        status: b.status,
      }));

      const { data, error } = await supabase
        .from('analysis_blocks')
        .insert(blockRecords)
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
        status: ((analysisData.currentStep || state.currentStep) >= 11 ? 'completed' : 'configuring') as 'draft' | 'configuring' | 'running' | 'completed' | 'failed',
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
    onSuccess: async (data) => {
      updateState({ analysisId: data.id });
      
      // Save hypotheses and analysis blocks
      if (state.hypotheses.length > 0) {
        await saveHypothesesMutation.mutateAsync({
          analysisId: data.id,
          hypotheses: state.hypotheses,
        });
      }
      
      if (state.analysisBlocks.length > 0) {
        await saveAnalysisBlocksMutation.mutateAsync({
          analysisId: data.id,
          blocks: state.analysisBlocks,
        });
      }
      
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

      // Fetch hypotheses
      const { data: hypotheses, error: hypError } = await supabase
        .from('hypotheses')
        .select('*')
        .eq('analysis_id', analysisId);

      if (hypError) throw hypError;

      // Fetch analysis blocks
      const { data: blocks, error: blocksError } = await supabase
        .from('analysis_blocks')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('display_order');

      if (blocksError) throw blocksError;

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
        type: v.type as Variable['measure'],
        measure: (v.measure || v.type) as Variable['measure'],
        dataType: 'numeric' as const,
        role: (v.role as Variable['role']) || null,
        width: v.width || 8,
        decimals: v.decimals || 2,
        valueLabels: (v.value_labels as Record<string, string>) || {},
        missingValues: (v.missing_values as string[]) || [],
        columnIndex: v.column_index,
        scaleGroup: v.scale_group || undefined,
      }));

      // Map hypotheses
      const wizardHypotheses: Hypothesis[] = (hypotheses || []).map((h) => ({
        id: h.id,
        hypothesisId: h.hypothesis_id,
        type: h.hypothesis_type as Hypothesis['type'],
        statement: h.statement,
        dependentVariables: h.dependent_vars || [],
        independentVariables: h.independent_vars || [],
        status: (h.status as Hypothesis['status']) || 'untested',
      }));

      // Map analysis blocks
      const wizardBlocks: AnalysisBlock[] = (blocks || []).map((b) => ({
        id: b.id,
        analysisId: b.analysis_id,
        section: b.section as AnalysisBlock['section'],
        sectionId: b.section_id,
        testType: b.test_type,
        testCategory: b.test_category,
        dependentVariables: b.dependent_variables || [],
        independentVariables: b.independent_variables || [],
        groupingVariable: b.grouping_variable || undefined,
        linkedHypothesisId: b.linked_hypothesis_id || undefined,
        config: (b.config as Record<string, unknown>) || {},
        assumptions: (b.assumptions as unknown as AssumptionResult[]) || [],
        results: (b.results as unknown as BlockResults) || null,
        narrative: (b.narrative as unknown as BlockNarrative) || null,
        displayOrder: b.display_order,
        status: b.status as AnalysisBlock['status'],
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
        hypotheses: wizardHypotheses,
        analysisBlocks: wizardBlocks,
        hypothesis: analysis.hypothesis || '',
        analysisConfig: analysis.config as unknown as AnalysisConfig | null,
        results: analysis.results as unknown as AnalysisResults | null,
        aiInterpretation: analysis.ai_interpretation || '',
        apaResults: analysis.apa_results || '',
        discussion: analysis.discussion || '',
        methodology: '',
        fullResults: '',
        supervisorMode: false,
        styleProfile: 'apa7',
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
    
    // Hypothesis management
    addHypothesis,
    updateHypothesis,
    removeHypothesis,
    
    // Analysis block management
    addAnalysisBlock,
    updateAnalysisBlock,
    removeAnalysisBlock,
    reorderAnalysisBlocks,
    
    // Variable management
    updateVariable,
    getVariablesByRole,
    getVariablesByMeasure,
    
    // Mutations
    createProject: createProjectMutation.mutateAsync,
    saveDataset: saveDatasetMutation.mutateAsync,
    saveVariables: saveVariablesMutation.mutateAsync,
    saveHypotheses: saveHypothesesMutation.mutateAsync,
    saveAnalysisBlocks: saveAnalysisBlocksMutation.mutateAsync,
    saveAnalysis: saveAnalysisMutation.mutateAsync,
    loadAnalysis,
    reset,
    
    // Loading states
    isCreatingProject: createProjectMutation.isPending,
    isSavingDataset: saveDatasetMutation.isPending,
    isSavingVariables: saveVariablesMutation.isPending,
    isSavingHypotheses: saveHypothesesMutation.isPending,
    isSavingAnalysisBlocks: saveAnalysisBlocksMutation.isPending,
    isSavingAnalysis: saveAnalysisMutation.isPending,
  };
}
