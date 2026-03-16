'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Send, Plus, Sparkles, AlertTriangle, Info, Zap,
  MessageSquare, X, RefreshCw, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

interface HealthScore {
  overall: number;
  breakdown: { diversification: number; goals: number; quality: number; discipline: number };
  summary: string;
}

interface Nudge {
  id: string;
  nudgeType: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'URGENT';
  relatedHoldingId?: string;
  relatedGoalId?: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  'Is my SIP enough for retirement?',
  'Should I rebalance my portfolio?',
  'How is my portfolio performing?',
  'What should I invest next month?',
];

function healthScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function healthScoreBg(score: number): string {
  if (score >= 70) return 'bg-green-50 border-green-200';
  if (score >= 40) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function healthScoreRing(score: number): string {
  if (score >= 70) return 'stroke-green-500';
  if (score >= 40) return 'stroke-amber-400';
  return 'stroke-red-400';
}

function severityIcon(severity: string) {
  if (severity === 'URGENT') return <Zap className="w-3.5 h-3.5 text-red-500" />;
  if (severity === 'WARNING') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
  return <Info className="w-3.5 h-3.5 text-blue-500" />;
}

function severityBadgeClass(severity: string): string {
  if (severity === 'URGENT') return 'bg-red-100 text-red-700';
  if (severity === 'WARNING') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className ?? ''}`} />;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Radial Score Gauge ────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const r           = 36;
  const circ        = 2 * Math.PI * r;
  const filled      = (score / 100) * circ;
  const dashOffset  = circ - filled;

  return (
    <div className="relative inline-flex items-center justify-center w-24 h-24">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#E5E7EB" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={`transition-all duration-700 ${healthScoreRing(score)}`}
        />
      </svg>
      <span className={`text-2xl font-bold ${healthScoreColor(score)}`}>{Math.round(score)}</span>
    </div>
  );
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────

function ChatBubble({
  role, content, isStreaming,
}: {
  role: 'USER' | 'ASSISTANT';
  content: string;
  isStreaming?: boolean;
}) {
  const isUser = role === 'USER';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3C3489] to-[#5048a8] flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-[#3C3489] text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
          }`}
      >
        {content}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current ml-1 align-middle animate-[blink_1s_step-end_infinite] rounded-sm" />
        )}
      </div>
    </div>
  );
}

// ─── Session List ─────────────────────────────────────────────────────────────

function SessionList({
  sessions,
  activeId,
  onSelect,
  onNew,
  isLoading,
}: {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="w-[250px] shrink-0 bg-white border-r border-gray-100 flex flex-col h-full">
      <div className="p-3 border-b border-gray-100">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 mx-1" />)
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            <p className="text-xs">No conversations yet</p>
          </div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors group
                ${activeId === s.id
                  ? 'bg-[#3C3489]/10 text-[#3C3489]'
                  : 'hover:bg-gray-50 text-gray-700'
                }`}
            >
              <p className={`text-sm font-medium truncate ${activeId === s.id ? 'text-[#3C3489]' : 'text-gray-800'}`}>
                {s.title}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(s.createdAt)} · {s.messageCount} msgs
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Insights Sidebar ─────────────────────────────────────────────────────────

function InsightsSidebar({
  healthScore,
  nudges,
  isLoadingScore,
  isLoadingNudges,
  onDismissNudge,
  onRefreshAnalysis,
  isAnalysing,
}: {
  healthScore: HealthScore | null;
  nudges: Nudge[];
  isLoadingScore: boolean;
  isLoadingNudges: boolean;
  onDismissNudge: (id: string) => void;
  onRefreshAnalysis: () => void;
  isAnalysing: boolean;
}) {
  const unread = nudges.filter((n) => !n.isRead).slice(0, 5);

  return (
    <div className="w-[280px] shrink-0 bg-white border-l border-gray-100 flex flex-col h-full overflow-y-auto">
      {/* Health Score */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Financial Health</h3>
          <button
            onClick={onRefreshAnalysis}
            disabled={isAnalysing}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#3C3489] hover:bg-gray-50 transition-colors disabled:opacity-40"
            title="Refresh analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalysing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoadingScore ? (
          <Skeleton className="h-28" />
        ) : healthScore ? (
          <div className={`rounded-2xl border p-3 ${healthScoreBg(healthScore.overall)}`}>
            <div className="flex items-center gap-3">
              <ScoreGauge score={healthScore.overall} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1.5">Score Breakdown</p>
                {Object.entries(healthScore.breakdown).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 capitalize w-20 shrink-0">{key}</span>
                    <div className="flex-1 h-1.5 bg-white/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#3C3489] rounded-full"
                        style={{ width: `${val}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 w-7 text-right shrink-0">{Math.round(val)}</span>
                  </div>
                ))}
              </div>
            </div>
            {healthScore.summary && (
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{healthScore.summary}</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-400">Click refresh to compute your health score</p>
          </div>
        )}
      </div>

      {/* Active Nudges */}
      <div className="p-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Active Nudges</h3>
          {unread.length > 0 && (
            <Link
              href="/advisor/nudges"
              className="text-xs text-[#3C3489] hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {isLoadingNudges ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : unread.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Sparkles className="w-7 h-7 mx-auto mb-2 text-gray-200" />
            <p className="text-xs">No active nudges</p>
            <p className="text-xs mt-0.5">Click refresh to analyse your portfolio</p>
          </div>
        ) : (
          <div className="space-y-2">
            {unread.map((n) => (
              <div key={n.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {severityIcon(n.severity)}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{n.title}</p>
                      <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${severityBadgeClass(n.severity)}`}>
                        {n.severity}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onDismissNudge(n.id)}
                    className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{n.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdvisorPage() {
  const queryClient                        = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages]            = useState<ChatMessage[]>([]);
  const [input, setInput]                  = useState('');
  const [isStreaming, setIsStreaming]       = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef                     = useRef<HTMLDivElement>(null);
  const abortRef                           = useRef<AbortController | null>(null);

  // Sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: { sessions: ChatSession[] } }>('/api/ai/chat/sessions')
        .then((r) => r.data.data),
    staleTime: 30_000,
  });

  // Health Score
  const { data: healthScore, isLoading: scoreLoading } = useQuery({
    queryKey: ['health-score'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: HealthScore }>('/api/ai/health-score')
        .then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  // Nudges
  const { data: nudgesData, isLoading: nudgesLoading } = useQuery({
    queryKey: ['nudges', 'unread'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: { nudges: Nudge[]; unread_count: number } }>('/api/ai/nudges?is_read=false&limit=20')
        .then((r) => r.data.data),
    staleTime: 60_000,
  });

  // Analyse mutation
  const analyseMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ success: boolean; data: { new_nudges: Nudge[]; health_score: HealthScore } }>('/api/ai/analyse'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nudges'] });
      queryClient.invalidateQueries({ queryKey: ['health-score'] });
    },
  });

  // Dismiss nudge
  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/ai/nudges/${id}`, { isDismissed: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nudges'] }),
  });

  // Load session messages
  const loadSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setStreamingContent('');
    const resp = await apiClient.get<{
      success: boolean;
      data: { session: { messages: ChatMessage[] } };
    }>(`/api/ai/chat/sessions/${sessionId}`);
    setMessages(resp.data.data.session.messages);
  }, []);

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setStreamingContent('');
    setInput('');
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const sendMessage = async (text: string) => {
    const msg = text.trim();
    if (!msg || isStreaming) return;

    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'USER',
      content: msg,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const resp = await fetch(
        `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5000'}/api/ai/chat`,
        {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ message: msg, sessionId: activeSessionId }),
          signal:      abort.signal,
        }
      );

      if (!resp.body) throw new Error('No stream');

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';
      let   fullContent = '';
      let   resolvedSessionId = activeSessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          try {
            const parsed = JSON.parse(payload) as {
              chunk?: string;
              done?: boolean;
              sessionId?: string;
              error?: string;
            };

            if (parsed.sessionId) {
              resolvedSessionId = parsed.sessionId;
              setActiveSessionId(parsed.sessionId);
            } else if (parsed.chunk) {
              fullContent += parsed.chunk;
              setStreamingContent(fullContent);
            } else if (parsed.done) {
              const assistantMsg: ChatMessage = {
                id: `tmp-assist-${Date.now()}`,
                role: 'ASSISTANT',
                content: fullContent || 'Sorry, I could not generate a response.',
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingContent('');
              queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
              if (resolvedSessionId && !activeSessionId) {
                setActiveSessionId(resolvedSessionId);
              }
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'ASSISTANT',
          content: 'Sorry, something went wrong. Please try again.',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setStreamingContent('');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const sessions = sessionsData?.sessions ?? [];
  const nudges   = nudgesData?.nudges ?? [];

  return (
    <div className="-m-4 lg:-m-6 h-[calc(100vh-56px)] flex bg-white overflow-hidden">
      {/* Left: Session list */}
      <SessionList
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={loadSession}
        onNew={startNewChat}
        isLoading={sessionsLoading}
      />

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-14 border-b border-gray-100 flex items-center px-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3C3489] to-[#5048a8] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">WealthPortal AI</p>
              <p className="text-xs text-green-500 font-medium">Online · Powered by Gemini</p>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3C3489] to-[#5048a8] flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Your AI Financial Advisor</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-sm">
                Ask me anything about your investments, goals, or financial planning. I have full context of your portfolio.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-[#3C3489]/40 hover:bg-[#3C3489]/5 text-sm text-gray-700 transition-colors group"
                  >
                    <span className="group-hover:text-[#3C3489] transition-colors">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <ChatBubble key={m.id} role={m.role} content={m.content} />
          ))}

          {isStreaming && streamingContent && (
            <ChatBubble role="ASSISTANT" content={streamingContent} isStreaming />
          )}

          {isStreaming && !streamingContent && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3C3489] to-[#5048a8] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-gray-100 p-4 shrink-0">
          <div className="flex items-end gap-3 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 focus-within:border-[#3C3489]/50 focus-within:bg-white transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask about your investments, goals, or financial health…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm text-gray-800 resize-none outline-none placeholder-gray-400 max-h-32 leading-relaxed disabled:opacity-50"
              style={{ height: 'auto' }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="w-9 h-9 rounded-xl bg-[#3C3489] text-white flex items-center justify-center hover:bg-[#2d2871] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">
            AI may make mistakes. Always verify financial advice with a certified advisor.
          </p>
        </div>
      </div>

      {/* Right: Insights sidebar */}
      <InsightsSidebar
        healthScore={healthScore ?? null}
        nudges={nudges}
        isLoadingScore={scoreLoading}
        isLoadingNudges={nudgesLoading}
        onDismissNudge={(id) => dismissMutation.mutate(id)}
        onRefreshAnalysis={() => analyseMutation.mutate()}
        isAnalysing={analyseMutation.isPending}
      />

      <style jsx global>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
