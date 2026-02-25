import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ThemeCard } from "@/components/ThemeCard";
import { ThemeBuilder } from "@/components/ThemeBuilder";
import { ThemeChatInterface } from "@/components/ThemeChatInterface";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Palette,
  LogOut,
  Settings,
  MessageSquare,
  Wand2,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-xl gradient-coral flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-white text-xs font-bold tracking-tight">S</span>
      </div>
      <span className="font-semibold text-base tracking-tight text-text-primary">
        Slides AI
      </span>
    </div>
  );
}

export function Themes() {
  const user = useQuery(api.users.viewer);
  const themes = useQuery(api.themes.list) ?? [];
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const createThemeConversation = useMutation(api.themeConversations.create);
  const [mode, setMode] = useState<
    | "list"
    | "create"
    | { edit: Id<"themes"> }
    | { chat: Id<"themeConversations"> }
  >("list");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || user === undefined || user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="h-8 w-8 rounded-xl gradient-coral flex items-center justify-center animate-pulse">
          <span className="text-white text-xs font-bold">S</span>
        </div>
      </div>
    );
  }

  const startChatCreation = async () => {
    const conversationId = await createThemeConversation();
    setMode({ chat: conversationId });
  };

  // Chat mode — question-based theme creation
  if (typeof mode === "object" && "chat" in mode) {
    return (
      <div className="h-screen flex flex-col bg-surface overflow-hidden">
        <header className="border-b border-border-light px-6 py-3.5 flex items-center gap-4 bg-surface/80 backdrop-blur-xl shrink-0 z-10">
          <button
            onClick={() => setMode("list")}
            className="flex items-center gap-2 text-text-secondary hover:text-coral transition-colors text-sm shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Themes</span>
          </button>
          <div className="h-4 w-px bg-border-light shrink-0" />
          <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-coral" />
            Design with AI
          </h1>
        </header>
        <div className="flex-1 min-h-0">
          <ThemeChatInterface
            conversationId={mode.chat}
            onThemeCreated={() => setMode("list")}
          />
        </div>
      </div>
    );
  }

  // Builder modes
  if (mode === "create" || (typeof mode === "object" && "edit" in mode)) {
    const editingId =
      typeof mode === "object" && "edit" in mode ? mode.edit : undefined;
    const editingTheme = editingId
      ? themes.find((t) => t._id === editingId)
      : undefined;

    return (
      <div className="h-screen flex flex-col bg-surface overflow-hidden">
        <header className="border-b border-border-light px-6 py-3.5 flex items-center gap-4 bg-surface/80 backdrop-blur-xl shrink-0 z-10">
          <button
            onClick={() => setMode("list")}
            className="flex items-center gap-2 text-text-secondary hover:text-coral transition-colors text-sm shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Themes</span>
          </button>
          <div className="h-4 w-px bg-border-light shrink-0" />
          <h1 className="text-sm font-semibold text-text-primary">
            {editingId ? "Edit Theme" : "New Theme"}
          </h1>
        </header>
        <div className="flex-1 min-h-0">
          <ThemeBuilder
            editingThemeId={editingId}
            initialTheme={
              editingTheme
                ? {
                    name: editingTheme.name,
                    colors: editingTheme.colors,
                    fonts: editingTheme.fonts,
                    spacing: editingTheme.spacing,
                    layoutStyle: editingTheme.layoutStyle,
                    previewHtml: editingTheme.previewHtml,
                  }
                : undefined
            }
            onSaved={() => setMode("list")}
            onCancel={() => setMode("list")}
          />
        </div>
      </div>
    );
  }

  // List mode
  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border-light sticky top-0 bg-surface/80 backdrop-blur-xl z-10">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <Link to="/">
            <LogoMark />
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-tertiary hidden sm:block">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="gap-1.5 text-text-secondary"
            >
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut().then(() => navigate("/"))}
              className="gap-1.5 text-text-secondary"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 animate-fade-in">
          <Link
            to="/dashboard"
            className="text-sm text-text-tertiary hover:text-coral transition-colors"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between mb-10 animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Palette className="h-7 w-7 text-coral" />
              Theme Library
            </h1>
            <p className="text-sm text-text-secondary">
              {themes.length === 0
                ? "Create your first custom presentation theme"
                : `${themes.length} theme${themes.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setMode("create")}
              className="rounded-full px-5 gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Quick create
            </Button>
            <Button
              onClick={startChatCreation}
              className="rounded-full px-6 gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Design with AI
            </Button>
          </div>
        </div>

        {/* Themes grid */}
        {themes.length === 0 ? (
          <div className="border border-border-light rounded-3xl p-16 text-center bg-surface-elevated shadow-card animate-fade-in">
            <div className="h-16 w-16 rounded-2xl gradient-coral flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Palette className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">No themes yet</h2>
            <p className="text-text-secondary text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              Answer a few questions and let AI design the perfect presentation
              theme for your needs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={startChatCreation}
                className="rounded-full px-8 gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Design with AI
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode("create")}
                className="rounded-full px-6 gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Quick create
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {themes.map((t, i) => (
              <div
                key={t._id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <ThemeCard
                  themeId={t._id}
                  name={t.name}
                  colors={t.colors}
                  fonts={t.fonts}
                  spacing={t.spacing}
                  previewHtml={t.previewHtml}
                  onEdit={() => setMode({ edit: t._id })}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
