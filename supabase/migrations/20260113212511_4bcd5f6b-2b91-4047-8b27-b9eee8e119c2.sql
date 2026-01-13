-- Create chat_messages table for AI chat feature
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  dataset_context_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own messages
CREATE POLICY "Users can view their own messages"
  ON public.chat_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own messages
CREATE POLICY "Users can create their own messages"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON public.chat_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient querying
CREATE INDEX idx_chat_messages_user_created ON public.chat_messages(user_id, created_at DESC);