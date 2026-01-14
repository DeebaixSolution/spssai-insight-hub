-- Create analysis_categories table
CREATE TABLE public.analysis_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analysis_tests table
CREATE TABLE public.analysis_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  is_pro_only BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  required_variables JSONB DEFAULT '{}',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.analysis_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_tests ENABLE ROW LEVEL SECURITY;

-- Policies for analysis_categories (everyone can read, only admins can modify)
CREATE POLICY "Anyone can view categories"
ON public.analysis_categories
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage categories"
ON public.analysis_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Policies for analysis_tests (everyone can read, only admins can modify)
CREATE POLICY "Anyone can view tests"
ON public.analysis_tests
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage tests"
ON public.analysis_tests
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create update triggers for updated_at
CREATE TRIGGER update_analysis_categories_updated_at
BEFORE UPDATE ON public.analysis_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analysis_tests_updated_at
BEFORE UPDATE ON public.analysis_tests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed categories
INSERT INTO public.analysis_categories (category_id, name, icon, display_order) VALUES
('descriptive', 'Descriptive Statistics', '📊', 1),
('compare-means', 'Compare Means', '📈', 2),
('correlation', 'Correlation', '🔗', 3),
('regression', 'Regression', '📉', 4),
('nonparametric', 'Nonparametric Tests', '📋', 5),
('reliability', 'Scale Reliability', '✓', 6);

-- Seed tests
INSERT INTO public.analysis_tests (test_id, name, description, category, is_pro_only, display_order, required_variables) VALUES
-- Descriptive
('frequencies', 'Frequencies', 'Frequency tables and charts for categorical variables', 'descriptive', false, 1, '{"dependent": {"type": ["nominal", "ordinal"], "min": 1, "max": 10}}'),
('descriptives', 'Descriptives', 'Mean, SD, min, max for scale variables', 'descriptive', false, 2, '{"dependent": {"type": ["scale"], "min": 1, "max": 20}}'),
('crosstabs', 'Crosstabs', 'Cross-tabulation with chi-square test', 'descriptive', false, 3, '{"dependent": {"type": ["nominal", "ordinal"], "min": 1, "max": 1}, "independent": {"type": ["nominal", "ordinal"], "min": 1, "max": 1}}'),
-- Compare Means
('independent-t-test', 'Independent Samples T-Test', 'Compare means of two independent groups', 'compare-means', false, 1, '{"dependent": {"type": ["scale"], "min": 1, "max": 1}, "grouping": {"type": ["nominal", "ordinal"], "min": 1, "max": 1}}'),
('paired-t-test', 'Paired Samples T-Test', 'Compare means of two related measurements', 'compare-means', false, 2, '{"dependent": {"type": ["scale"], "min": 2, "max": 2}}'),
('one-way-anova', 'One-Way ANOVA', 'Compare means across 3+ groups', 'compare-means', true, 3, '{"dependent": {"type": ["scale"], "min": 1, "max": 1}, "grouping": {"type": ["nominal", "ordinal"], "min": 1, "max": 1}}'),
('two-way-anova', 'Two-Way ANOVA', 'Factorial ANOVA with two factors', 'compare-means', true, 4, '{"dependent": {"type": ["scale"], "min": 1, "max": 1}, "independent": {"type": ["nominal", "ordinal"], "min": 2, "max": 2}}'),
-- Correlation
('pearson', 'Pearson Correlation', 'Linear correlation between scale variables', 'correlation', false, 1, '{"dependent": {"type": ["scale"], "min": 2, "max": 10}}'),
('spearman', 'Spearman Correlation', 'Rank correlation for ordinal data', 'correlation', true, 2, '{"dependent": {"type": ["scale", "ordinal"], "min": 2, "max": 10}}'),
-- Regression
('linear-regression', 'Linear Regression', 'Predict continuous outcome from predictors', 'regression', true, 1, '{"dependent": {"type": ["scale"], "min": 1, "max": 1}, "independent": {"type": ["scale", "nominal", "ordinal"], "min": 1, "max": 20}}'),
('multiple-regression', 'Multiple Regression', 'Multiple predictors for continuous outcome', 'regression', true, 2, '{"dependent": {"type": ["scale"], "min": 1, "max": 1}, "independent": {"type": ["scale", "nominal", "ordinal"], "min": 2, "max": 20}}'),
-- Nonparametric
('chi-square', 'Chi-Square Test', 'Test association between categorical variables', 'nonparametric', false, 1, '{"dependent": {"type": ["nominal", "ordinal"], "min": 1, "max": 1}, "independent": {"type": ["nominal", "ordinal"], "min": 1, "max": 1}}'),
('mann-whitney', 'Mann-Whitney U Test', 'Nonparametric alternative to t-test', 'nonparametric', true, 2, '{"dependent": {"type": ["scale", "ordinal"], "min": 1, "max": 1}, "grouping": {"type": ["nominal", "ordinal"], "min": 1, "max": 1}}'),
('kruskal-wallis', 'Kruskal-Wallis H Test', 'Nonparametric alternative to ANOVA', 'nonparametric', true, 3, '{"dependent": {"type": ["scale", "ordinal"], "min": 1, "max": 1}, "grouping": {"type": ["nominal", "ordinal"], "min": 1, "max": 1}}'),
-- Reliability
('cronbach-alpha', 'Cronbach''s Alpha', 'Internal consistency reliability', 'reliability', true, 1, '{"dependent": {"type": ["scale", "ordinal"], "min": 2, "max": 50}}');