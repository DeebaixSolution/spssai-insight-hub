
-- Table 1: chapter_results (Chapter 4 storage)
CREATE TABLE public.chapter_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  full_text TEXT,
  section_mapping JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chapter_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chapter results"
ON public.chapter_results FOR SELECT
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = chapter_results.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can create chapter results in their analyses"
ON public.chapter_results FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = chapter_results.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can update their own chapter results"
ON public.chapter_results FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = chapter_results.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own chapter results"
ON public.chapter_results FOR DELETE
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = chapter_results.analysis_id AND p.user_id = auth.uid()
));

CREATE TRIGGER update_chapter_results_updated_at
BEFORE UPDATE ON public.chapter_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 2: discussion_chapter (Chapter 5 storage)
CREATE TABLE public.discussion_chapter (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  chapter5_text TEXT,
  mode TEXT NOT NULL DEFAULT 'free',
  theory_input JSONB DEFAULT '{}',
  citations_used JSONB DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.discussion_chapter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own discussion chapter"
ON public.discussion_chapter FOR SELECT
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = discussion_chapter.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can create discussion chapter in their analyses"
ON public.discussion_chapter FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = discussion_chapter.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can update their own discussion chapter"
ON public.discussion_chapter FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = discussion_chapter.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own discussion chapter"
ON public.discussion_chapter FOR DELETE
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = discussion_chapter.analysis_id AND p.user_id = auth.uid()
));

CREATE TRIGGER update_discussion_chapter_updated_at
BEFORE UPDATE ON public.discussion_chapter
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 3: citations (Reference management)
CREATE TABLE public.citations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  journal TEXT,
  doi TEXT,
  formatted_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own citations"
ON public.citations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = citations.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can create citations in their analyses"
ON public.citations FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = citations.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can update their own citations"
ON public.citations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = citations.analysis_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own citations"
ON public.citations FOR DELETE
USING (EXISTS (
  SELECT 1 FROM analyses a JOIN projects p ON p.id = a.project_id
  WHERE a.id = citations.analysis_id AND p.user_id = auth.uid()
));

-- Table 4: thesis_exports (Export tracking)
CREATE TABLE public.thesis_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  export_type TEXT NOT NULL DEFAULT 'word',
  version INTEGER NOT NULL DEFAULT 1,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.thesis_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own thesis exports"
ON public.thesis_exports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own thesis exports"
ON public.thesis_exports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own thesis exports"
ON public.thesis_exports FOR DELETE
USING (auth.uid() = user_id);
