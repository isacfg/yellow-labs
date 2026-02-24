import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ChatInterface } from "@/components/ChatInterface";

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-2xl mb-2">404</p>
          <p className="mb-4">Conversation not found</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-primary hover:underline"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center gap-3 bg-background/95 backdrop-blur sticky top-0 z-10">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">
            {conversation?.title ?? "Presentation"}
          </h1>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block">
          {user?.email}
        </span>
      </header>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-h-0">
        <ChatInterface conversationId={conversationId as Id<"conversations">} />
      </div>
    </div>
  );
}
