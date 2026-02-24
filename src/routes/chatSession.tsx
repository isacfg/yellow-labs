import { useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ChatInterface } from "@/components/ChatInterface";
import { ArrowLeft, ExternalLink, Layers } from "lucide-react";

export function ChatSession() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const user = useQuery(api.users.viewer);
  const conversation = useQuery(
    api.conversations.get,
    conversationId
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip"
  );
  const presentation = useQuery(
    api.presentations.getByConversation,
    conversationId
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip"
  );

  useEffect(() => {
    if (user === null) {
      navigate("/auth");
    }
  }, [user, navigate]);

  if (!conversationId) {
    navigate("/chat");
    return null;
  }

  if (conversation === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center animate-fade-in">
          <p className="text-5xl font-bold text-gradient-coral mb-3">404</p>
          <p className="text-text-secondary text-sm mb-6">
            Conversation not found
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm font-semibold text-coral hover:text-coral-dark transition-colors"
          >
            Go to dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="border-b border-border-light px-6 py-3.5 flex items-center gap-4 bg-surface/80 backdrop-blur-xl shrink-0 z-10">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-text-secondary hover:text-coral transition-colors text-sm shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        <div className="h-4 w-px bg-border-light shrink-0" />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate text-text-primary">
            {conversation?.title ?? "New presentation"}
          </h1>
        </div>

        <span className="text-xs text-text-tertiary hidden md:block shrink-0">
          {user?.email}
        </span>
      </header>

      {/* Body: split layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat */}
        <div className="flex flex-col w-[420px] shrink-0 border-r border-border-light min-h-0">
          <ChatInterface
            conversationId={conversationId as Id<"conversations">}
          />
        </div>

        {/* Right: Presentation preview */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-elevated">
          {/* Preview header */}
          <div className="px-4 py-2.5 border-b border-border-light flex items-center gap-3 bg-surface/60 backdrop-blur-sm shrink-0">
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Preview
            </span>
            {presentation && (
              <>
                <span className="text-xs text-text-secondary truncate flex-1">
                  {presentation.title}
                </span>
                <a
                  href={`/p/${presentation.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-coral hover:text-coral-dark transition-colors flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                  Fullscreen
                </a>
              </>
            )}
          </div>

          {/* Preview content */}
          <div className="flex-1 relative min-h-0">
            {presentation ? (
              <iframe
                key={presentation._id}
                srcDoc={presentation.htmlContent}
                sandbox="allow-scripts allow-same-origin"
                className="absolute inset-0 w-full h-full border-0"
                title={presentation.title}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-2xl bg-surface border border-border-light flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Layers className="h-7 w-7 text-text-tertiary" />
                  </div>
                  <p className="text-sm font-medium text-text-secondary">
                    Presentation preview
                  </p>
                  <p className="text-xs text-text-tertiary mt-1 max-w-[200px] leading-relaxed">
                    Your presentation will appear here once generated
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
