
-- Add section_mapping column to discussion_chapter
ALTER TABLE discussion_chapter ADD COLUMN IF NOT EXISTS section_mapping jsonb DEFAULT '{}'::jsonb;

-- Create step_functions table for admin control
CREATE TABLE IF NOT EXISTS step_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number integer NOT NULL,
  function_id text NOT NULL,
  function_name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT true,
  is_pro_only boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(step_number, function_id)
);

ALTER TABLE step_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage step functions" ON step_functions FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view step functions" ON step_functions FOR SELECT USING (true);

-- Seed initial step functions
INSERT INTO step_functions (step_number, function_id, function_name, description, is_pro_only, display_order) VALUES
(2, 'ai-variable-detection', 'AI Variable Detection', 'Auto-detect variable types and measures', true, 1),
(2, 'manual-variable-config', 'Manual Variable Config', 'Manually set variable types', false, 2),
(3, 'ai-research-suggestions', 'AI Research Suggestions', 'AI-powered hypothesis generation', true, 1),
(3, 'manual-hypothesis', 'Manual Hypothesis Entry', 'Enter hypotheses manually', false, 2),
(4, 'normality-test', 'Normality Testing', 'Shapiro-Wilk / Kolmogorov-Smirnov', false, 1),
(4, 'descriptive-stats', 'Descriptive Statistics', 'Mean, SD, frequencies', false, 2),
(5, 'parametric-tests', 'Parametric Tests', 'T-tests, paired comparisons', false, 1),
(6, 'nonparametric-tests', 'Non-Parametric Tests', 'Mann-Whitney, Wilcoxon, Kruskal-Wallis', false, 1),
(7, 'anova-glm', 'ANOVA / GLM', 'One-way, factorial, MANOVA, repeated measures', false, 1),
(8, 'correlation', 'Correlation Analysis', 'Pearson, Spearman, partial correlations', false, 1),
(9, 'regression', 'Regression Models', 'Linear, logistic regression with diagnostics', true, 1),
(10, 'measurement', 'Measurement Validation', 'Cronbach alpha, EFA, CFA', true, 1),
(11, 'chapter4-generation', 'Chapter 4 AI Generation', 'AI-generated academic results chapter', false, 1),
(12, 'chapter5-generation', 'Chapter 5 AI Generation', 'AI-generated discussion chapter', false, 1),
(12, 'theory-framework', 'Theoretical Framework Input', 'Theory and citation management', true, 2),
(13, 'thesis-export', 'Thesis Export', 'Word/HTML document export', false, 1);
