
-- Delete existing coarse step_functions rows and replace with granular ones
DELETE FROM step_functions;

-- Step 1: Upload
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(1, 'upload-csv', 'CSV Upload', 'Upload CSV/Excel data files', true, false, 1),
(1, 'upload-spss', 'SPSS Upload', 'Upload SPSS .sav files', true, false, 2),
(1, 'file-validation', 'File Validation', 'Automatic file structure validation', true, false, 3);

-- Step 2: Variables
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(2, 'ai-variable-detection', 'AI Variable Detection', 'Automatic variable type and role detection using AI', true, true, 1),
(2, 'manual-variable-config', 'Manual Variable Config', 'Manual variable type, role, and label configuration', true, false, 2),
(2, 'value-labels', 'Value Labels Editor', 'Define value labels for categorical variables', true, false, 3),
(2, 'scale-grouping', 'Scale Grouping', 'Group variables into measurement scales', true, true, 4);

-- Step 3: Research
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(3, 'ai-research-suggestions', 'AI Research Suggestions', 'AI-generated research questions and hypotheses', true, true, 1),
(3, 'manual-hypothesis', 'Manual Hypothesis Entry', 'Manually define hypotheses (H0/H1)', true, false, 2),
(3, 'hypothesis-quality-check', 'Hypothesis Quality Check', 'AI validation of hypothesis quality', true, true, 3);

-- Step 4: Descriptive
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(4, 'shapiro-wilk', 'Shapiro-Wilk Test', 'Normality testing using Shapiro-Wilk', true, false, 1),
(4, 'kolmogorov-smirnov', 'Kolmogorov-Smirnov Test', 'Normality testing using K-S test', true, false, 2),
(4, 'descriptive-stats', 'Descriptive Statistics', 'Mean, SD, skewness, kurtosis computations', true, false, 3),
(4, 'frequencies', 'Frequency Tables', 'Frequency distributions for categorical variables', true, false, 4),
(4, 'visual-diagnostics', 'Visual Diagnostics', 'Histograms, Q-Q plots, and boxplots', true, false, 5);

-- Step 5: Parametric
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(5, 'one-sample-t', 'One-Sample T-Test', 'Compare sample mean to known value', true, false, 1),
(5, 'independent-t', 'Independent Samples T-Test', 'Compare means between two independent groups', true, false, 2),
(5, 'paired-t', 'Paired Samples T-Test', 'Compare means between two related measurements', true, false, 3),
(5, 'one-way-anova-param', 'One-Way ANOVA', 'Compare means across three or more groups', true, false, 4);

-- Step 6: Non-Parametric
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(6, 'mann-whitney', 'Mann-Whitney U Test', 'Non-parametric two-group comparison', true, false, 1),
(6, 'wilcoxon-signed-rank', 'Wilcoxon Signed-Rank', 'Non-parametric paired comparison', true, false, 2),
(6, 'kruskal-wallis', 'Kruskal-Wallis H Test', 'Non-parametric multi-group comparison', true, false, 3),
(6, 'friedman-test', 'Friedman Test', 'Non-parametric repeated measures comparison', true, true, 4),
(6, 'chi-square-test', 'Chi-Square Test', 'Test of independence for categorical variables', true, false, 5);

-- Step 7: ANOVA/GLM
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(7, 'two-way-anova', 'Two-Way ANOVA', 'Factorial ANOVA with two independent variables', true, true, 1),
(7, 'manova', 'MANOVA', 'Multivariate analysis of variance', true, true, 2),
(7, 'repeated-measures', 'Repeated Measures ANOVA', 'Within-subjects analysis of variance', true, true, 3),
(7, 'ancova', 'ANCOVA', 'Analysis of covariance with covariates', true, true, 4);

-- Step 8: Correlation
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(8, 'pearson-correlation', 'Pearson Correlation', 'Bivariate Pearson product-moment correlation', true, false, 1),
(8, 'spearman-correlation', 'Spearman Correlation', 'Rank-order correlation for ordinal data', true, false, 2),
(8, 'partial-correlation', 'Partial Correlation', 'Correlation controlling for third variable', true, true, 3),
(8, 'point-biserial', 'Point-Biserial Correlation', 'Correlation between dichotomous and continuous variable', true, true, 4);

-- Step 9: Regression
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(9, 'simple-linear-reg', 'Simple Linear Regression', 'Single predictor linear regression', true, false, 1),
(9, 'multiple-linear-reg', 'Multiple Linear Regression', 'Multiple predictor linear regression', true, true, 2),
(9, 'binary-logistic-reg', 'Binary Logistic Regression', 'Logistic regression for binary outcomes', true, true, 3),
(9, 'regression-diagnostics', 'Regression Diagnostics', 'Residual plots, multicollinearity checks', true, true, 4);

-- Step 10: Measurement
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(10, 'cronbach-alpha', 'Cronbach''s Alpha', 'Internal consistency reliability analysis', true, false, 1),
(10, 'kmo-bartlett', 'KMO & Bartlett''s Test', 'Sampling adequacy and sphericity tests', true, false, 2),
(10, 'efa', 'Exploratory Factor Analysis', 'Factor extraction and rotation', true, true, 3),
(10, 'cfa', 'Confirmatory Factor Analysis', 'Model fit testing for factor structure', true, true, 4),
(10, 'composite-reliability', 'Composite Reliability', 'CR and AVE calculations', true, true, 5);

-- Step 11: Chapter 4
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(11, 'chapter4-generation', 'Chapter 4 AI Generation', 'AI-powered academic results chapter writing', true, true, 1),
(11, 'section-regeneration', 'Section Regeneration', 'Regenerate individual chapter sections', true, true, 2),
(11, 'manual-editing', 'Manual Section Editing', 'Manually edit generated chapter text', true, false, 3);

-- Step 12: Chapter 5
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(12, 'chapter5-generation', 'Chapter 5 AI Generation', 'AI-powered discussion chapter writing', true, true, 1),
(12, 'theory-framework', 'Theoretical Framework Input', 'Define theoretical models and frameworks', true, true, 2),
(12, 'citation-manager', 'Citation Manager', 'Add and manage academic references', true, false, 3);

-- Step 13: Export
INSERT INTO step_functions (step_number, function_id, function_name, description, is_enabled, is_pro_only, display_order) VALUES
(13, 'word-export', 'Word Export (.doc)', 'Export chapters as Word document', true, false, 1),
(13, 'html-export', 'HTML Export (.htm)', 'Export chapters as HTML file', true, false, 2),
(13, 'appendix-export', 'Appendix Export', 'Export full SPSS output appendix', true, true, 3),
(13, 'unified-export', 'Complete Thesis Export', 'Export all chapters + appendix in one document', true, true, 4);
