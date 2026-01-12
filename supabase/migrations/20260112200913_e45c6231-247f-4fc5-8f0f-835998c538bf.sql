-- Update user role to admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '1077d24e-b9d2-44fe-96ce-f98d93c57d3d';

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create datasets table
CREATE TABLE public.datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'xls', 'sav')),
  file_size INTEGER,
  row_count INTEGER,
  column_count INTEGER,
  raw_data JSONB,
  parsed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create variables table (SPSS Variable View)
CREATE TABLE public.variables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  column_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  label TEXT,
  type TEXT NOT NULL DEFAULT 'scale' CHECK (type IN ('nominal', 'ordinal', 'scale')),
  width INTEGER DEFAULT 8,
  decimals INTEGER DEFAULT 2,
  value_labels JSONB,
  missing_values JSONB,
  measure TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(dataset_id, column_index)
);

-- Create analysis_status enum
CREATE TYPE public.analysis_status AS ENUM ('draft', 'configuring', 'running', 'completed', 'failed');

-- Create analyses table
CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 7),
  research_question TEXT,
  hypothesis TEXT,
  test_type TEXT,
  test_category TEXT,
  config JSONB DEFAULT '{}',
  selected_variables JSONB DEFAULT '[]',
  results JSONB,
  ai_interpretation TEXT,
  apa_results TEXT,
  discussion TEXT,
  status analysis_status NOT NULL DEFAULT 'draft',
  is_pro_analysis BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('word', 'pdf')),
  file_url TEXT,
  sections_included JSONB DEFAULT '["methods", "results", "interpretation"]',
  include_tables BOOLEAN DEFAULT true,
  include_charts BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view their own projects"
ON public.projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all projects"
ON public.projects FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Datasets policies (access through project ownership)
CREATE POLICY "Users can view datasets in their projects"
ON public.datasets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = datasets.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create datasets in their projects"
ON public.datasets FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update datasets in their projects"
ON public.datasets FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = datasets.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete datasets in their projects"
ON public.datasets FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = datasets.project_id 
  AND projects.user_id = auth.uid()
));

-- Variables policies (access through dataset -> project ownership)
CREATE POLICY "Users can view variables in their datasets"
ON public.variables FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.datasets 
  JOIN public.projects ON projects.id = datasets.project_id
  WHERE datasets.id = variables.dataset_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create variables in their datasets"
ON public.variables FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.datasets 
  JOIN public.projects ON projects.id = datasets.project_id
  WHERE datasets.id = dataset_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update variables in their datasets"
ON public.variables FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.datasets 
  JOIN public.projects ON projects.id = datasets.project_id
  WHERE datasets.id = variables.dataset_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete variables in their datasets"
ON public.variables FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.datasets 
  JOIN public.projects ON projects.id = datasets.project_id
  WHERE datasets.id = variables.dataset_id 
  AND projects.user_id = auth.uid()
));

-- Analyses policies
CREATE POLICY "Users can view their own analyses"
ON public.analyses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = analyses.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create analyses in their projects"
ON public.analyses FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update their own analyses"
ON public.analyses FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = analyses.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own analyses"
ON public.analyses FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = analyses.project_id 
  AND projects.user_id = auth.uid()
));

-- Reports policies
CREATE POLICY "Users can view their own reports"
ON public.reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports"
ON public.reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
ON public.reports FOR DELETE
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_variables_updated_at
BEFORE UPDATE ON public.variables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analyses_updated_at
BEFORE UPDATE ON public.analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_datasets_project_id ON public.datasets(project_id);
CREATE INDEX idx_variables_dataset_id ON public.variables(dataset_id);
CREATE INDEX idx_analyses_project_id ON public.analyses(project_id);
CREATE INDEX idx_analyses_dataset_id ON public.analyses(dataset_id);
CREATE INDEX idx_reports_analysis_id ON public.reports(analysis_id);
CREATE INDEX idx_reports_user_id ON public.reports(user_id);