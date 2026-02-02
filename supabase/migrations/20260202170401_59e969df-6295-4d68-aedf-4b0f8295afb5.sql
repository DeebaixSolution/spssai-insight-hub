-- ============================================
-- ANALYSIS BLOCKS TABLE
-- Each analysis block represents a single statistical test with its configuration
-- ============================================
CREATE TABLE public.analysis_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'descriptives', -- 'descriptives', 'reliability', 'hypothesis'
  section_id TEXT NOT NULL DEFAULT 'general', -- 'demographics', 'reliability', 'H1', 'H2', etc.
  test_type TEXT NOT NULL,
  test_category TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  dependent_variables TEXT[] NOT NULL DEFAULT '{}',
  independent_variables TEXT[] NOT NULL DEFAULT '{}',
  grouping_variable TEXT,
  linked_hypothesis_id UUID, -- References hypotheses table
  assumptions JSONB DEFAULT '{}', -- Assumption check results
  results JSONB, -- Statistical output (tables, charts, effect sizes)
  narrative JSONB, -- Generated academic text
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- HYPOTHESES TABLE
-- Stores structured hypotheses linked to variables
-- ============================================
CREATE TABLE public.hypotheses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  hypothesis_id TEXT NOT NULL, -- 'H1', 'H2', 'H3', etc.
  hypothesis_type TEXT NOT NULL DEFAULT 'difference', -- 'difference', 'association', 'prediction'
  statement TEXT NOT NULL,
  dependent_vars TEXT[] NOT NULL DEFAULT '{}',
  independent_vars TEXT[] NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'untested', -- 'untested', 'supported', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(analysis_id, hypothesis_id)
);

-- ============================================
-- Enable RLS on new tables
-- ============================================
ALTER TABLE public.analysis_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hypotheses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for analysis_blocks
-- ============================================
CREATE POLICY "Users can view their own analysis blocks"
ON public.analysis_blocks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM analyses a
    JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_blocks.analysis_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create analysis blocks in their analyses"
ON public.analysis_blocks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM analyses a
    JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_blocks.analysis_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own analysis blocks"
ON public.analysis_blocks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM analyses a
    JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_blocks.analysis_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own analysis blocks"
ON public.analysis_blocks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM analyses a
    JOIN projects p ON p.id = a.project_id
    WHERE a.id = analysis_blocks.analysis_id AND p.user_id = auth.uid()
  )
);

-- ============================================
-- RLS Policies for hypotheses
-- ============================================
CREATE POLICY "Users can view their own hypotheses"
ON public.hypotheses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM analyses a
    JOIN projects p ON p.id = a.project_id
    WHERE a.id = hypotheses.analysis_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create hypotheses in their analyses"
ON public.hypotheses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM analyses a
    JOIN projects p ON p.id = a.project_id
    WHERE a.id = hypotheses.analysis_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own hypotheses"
ON public.hypotheses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM analyses a
    JOIN projects p ON p.id = a.project_id
    WHERE a.id = hypotheses.analysis_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own hypotheses"
ON public.hypotheses
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM analyses a
    JOIN projects p ON p.id = a.project_id
    WHERE a.id = hypotheses.analysis_id AND p.user_id = auth.uid()
  )
);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE TRIGGER update_analysis_blocks_updated_at
BEFORE UPDATE ON public.analysis_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hypotheses_updated_at
BEFORE UPDATE ON public.hypotheses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_analysis_blocks_analysis_id ON public.analysis_blocks(analysis_id);
CREATE INDEX idx_analysis_blocks_section ON public.analysis_blocks(section);
CREATE INDEX idx_hypotheses_analysis_id ON public.hypotheses(analysis_id);

-- ============================================
-- Add role column to variables table for SPSS-like role assignment
-- ============================================
ALTER TABLE public.variables
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT NULL; -- 'id', 'demographic', 'dependent', 'independent', 'scale_item'

-- ============================================
-- Add scale_group column to variables for grouping scale items
-- ============================================
ALTER TABLE public.variables
ADD COLUMN IF NOT EXISTS scale_group TEXT DEFAULT NULL;