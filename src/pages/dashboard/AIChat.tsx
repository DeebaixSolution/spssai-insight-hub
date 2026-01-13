import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Database,
  Crown,
  Trash2,
  Loader2,
} from 'lucide-react';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { UpgradePrompt } from '@/components/plan/UpgradePrompt';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  dataset_context_id: string | null;
}

interface Dataset {
  id: string;
  file_name: string;
  row_count: number | null;
  column_count: number | null;
}

const QUICK_PROMPTS = [
  { label: 'Choose a test', prompt: 'What statistical test should I use to compare means between two groups?' },
  { label: 'Interpret p-value', prompt: 'How do I interpret a p-value of 0.03 in my results?' },
  { label: 'Correlation vs Regression', prompt: 'What is the difference between correlation and regression analysis?' },
  { label: 'Effect size', prompt: 'What is effect size and why is it important?' },
  { label: 'Sample size', prompt: 'How do I determine the appropriate sample size for my study?' },
  { label: 'ANOVA assumptions', prompt: 'What are the assumptions for running an ANOVA test?' },
];

const FREE_DAILY_LIMIT = 5;

const AIChat = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { isPro } = usePlanLimits();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch chat messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!user,
  });

  // Fetch datasets for context (Pro only)
  const { data: datasets = [] } = useQuery({
    queryKey: ['datasets-for-chat', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('datasets')
        .select('id, file_name, row_count, column_count')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Dataset[];
    },
    enabled: !!user && isPro,
  });

  // Count today's messages for free users
  const todayMessagesCount = messages.filter((m) => {
    if (m.role !== 'user') return false;
    const messageDate = new Date(m.created_at).toDateString();
    const today = new Date().toDateString();
    return messageDate === today;
  }).length;

  const canSendMessage = isPro || todayMessagesCount < FREE_DAILY_LIMIT;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      // Save user message
      const { data: userMsg, error: userError } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user?.id,
          role: 'user',
          content,
          dataset_context_id: selectedDataset || null,
        })
        .select()
        .single();

      if (userError) throw userError;

      // Get dataset context if selected (Pro only)
      let datasetContext = '';
      if (selectedDataset && isPro) {
        const { data: dataset } = await supabase
          .from('datasets')
          .select('file_name, raw_data, row_count, column_count')
          .eq('id', selectedDataset)
          .single();

        if (dataset) {
          const headers = dataset.raw_data && Array.isArray(dataset.raw_data) && dataset.raw_data[0]
            ? Object.keys(dataset.raw_data[0] as Record<string, unknown>)
            : [];
          datasetContext = `\n\nContext: The user has a dataset "${dataset.file_name}" with ${dataset.row_count} rows and ${dataset.column_count} columns. Variables: ${headers.join(', ')}`;
        }
      }

      // Call AI edge function
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: content + datasetContext,
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (error) throw error;

      // Save assistant message
      const { error: assistantError } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user?.id,
          role: 'assistant',
          content: data.response,
          dataset_context_id: selectedDataset || null,
        });

      if (assistantError) throw assistantError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      setInput('');
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast.error('Failed to send message. Please try again.');
    },
  });

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!canSendMessage) {
      setShowUpgradePrompt(true);
      return;
    }

    setIsLoading(true);
    try {
      await sendMessage.mutateAsync(input.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = async () => {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', user?.id);

    if (error) {
      toast.error('Failed to clear chat');
    } else {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      toast.success('Chat cleared');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            {t.dashboard.aiChat}
          </h1>
          <p className="text-muted-foreground">Your statistical research assistant</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Dataset Context Selector (Pro) */}
          {isPro && datasets.length > 0 && (
            <Select value={selectedDataset} onValueChange={setSelectedDataset}>
              <SelectTrigger className="w-[200px]">
                <Database className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Add context..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No context</SelectItem>
                {datasets.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.file_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Usage Counter */}
          {!isPro && (
            <Badge variant="outline" className="gap-1">
              {todayMessagesCount}/{FREE_DAILY_LIMIT} today
            </Badge>
          )}

          {/* Clear Chat */}
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={handleClearChat}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 data-card overflow-hidden flex flex-col">
        {messagesLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              How can I help you today?
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Ask me anything about statistics, research methods, or data analysis.
              I can help you choose the right tests, interpret results, and more.
            </p>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              {QUICK_PROMPTS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(p.prompt)}
                  className="text-xs"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-3',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-accent" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-border">
          {!canSendMessage && (
            <div className="mb-3 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Crown className="w-4 h-4 text-warning" />
                <span>You've reached your daily message limit.</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowUpgradePrompt(true)}>
                Upgrade to Pro
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about statistics, tests, or data analysis..."
              className="min-h-[52px] max-h-32 resize-none"
              disabled={isLoading || !canSendMessage}
            />
            <Button
              variant="hero"
              size="icon"
              className="h-[52px] w-[52px] flex-shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !canSendMessage}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Upgrade Prompt */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        feature="Unlimited AI Messages"
      />
    </div>
  );
};

export default AIChat;
