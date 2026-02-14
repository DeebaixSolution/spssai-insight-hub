
-- Table: analysis_assumptions (stores normality/skewness/kurtosis per variable)
CREATE TABLE public.analysis_assumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  normality_status BOOLEAN NOT NULL DEFAULT true,
  test_used TEXT NOT NULL DEFAULT 'Shapiro-Wilk',
  statistic NUMERIC,
  p_value NUMERIC,
  skewness NUMERIC,
  kurtosis NUMERIC,
  skewness_violation BOOLEAN DEFAULT false,
  kurtosis_violation BOOLEAN DEFAULT false,
  parametric_allowed BOOLEAN DEFAULT true,
  sample_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis assumptions"
  ON public.analysis_assumptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_assumptions.analysis_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can create analysis assumptions in their analyses"
  ON public.analysis_assumptions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_assumptions.analysis_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own analysis assumptions"
  ON public.analysis_assumptions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_assumptions.analysis_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own analysis assumptions"
  ON public.analysis_assumptions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_assumptions.analysis_id AND p.user_id = auth.uid()
  ));

-- Table: analysis_state (tracks per-step completion)
CREATE TABLE public.analysis_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE UNIQUE,
  step_4_completed BOOLEAN NOT NULL DEFAULT false,
  step_5_completed BOOLEAN NOT NULL DEFAULT false,
  step_6_completed BOOLEAN NOT NULL DEFAULT false,
  step_7_completed BOOLEAN NOT NULL DEFAULT false,
  step_8_completed BOOLEAN NOT NULL DEFAULT false,
  step_9_completed BOOLEAN NOT NULL DEFAULT false,
  step_10_completed BOOLEAN NOT NULL DEFAULT false,
  parametric_executed BOOLEAN NOT NULL DEFAULT false,
  hypothesis_updated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis state"
  ON public.analysis_state FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_state.analysis_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can create analysis state in their analyses"
  ON public.analysis_state FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_state.analysis_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own analysis state"
  ON public.analysis_state FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_state.analysis_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own analysis state"
  ON public.analysis_state FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_state.analysis_id AND p.user_id = auth.uid()
  ));

-- Triggers for updated_at
CREATE TRIGGER update_analysis_assumptions_updated_at
  BEFORE UPDATE ON public.analysis_assumptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analysis_state_updated_at
  BEFORE UPDATE ON public.analysis_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
