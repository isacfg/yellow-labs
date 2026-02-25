import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { Plus, ExternalLink, MessageSquare, LogOut, LayoutTemplate, Sparkles, Settings, Palette } from "lucide-react";

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

const cardGradients = [
  "gradient-coral",
  "gradient-purple-pink",
  "gradient-blue-teal",
  "gradient-orange-red",
  "gradient-dark",
];

export function Dashboard() {
  const user = useQuery(api.users.viewer);
  const presentations = useQuery(api.presentations.list) ?? [];
  const conversations = useQuery(api.conversations.list) ?? [];
  const themes = useQuery(api.themes.list) ?? [];
  const { signOut } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  if (isLoading || user === undefined || user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="h-8 w-8 rounded-xl gradient-coral flex items-center justify-center animate-pulse">
          <span className="text-white text-xs font-bold">S</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

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
              onClick={handleSignOut}
              className="gap-1.5 text-text-secondary"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {/* Page header */}
        <div className="flex items-center justify-between mb-10 animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              Your Presentations
            </h1>
            <p className="text-sm text-text-secondary">
              {presentations.length === 0
                ? "Create your first AI-powered presentation"
                : `${presentations.length} presentation${presentations.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-full px-5 gap-2">
              <Link to="/themes">
                <Palette className="h-4 w-4" />
                New theme
              </Link>
            </Button>
            <Button asChild className="rounded-full px-6 gap-2">
              <Link to="/chat">
                <Plus className="h-4 w-4" />
                New presentation
              </Link>
            </Button>
          </div>
        </div>

        {/* Presentations grid */}
        {presentations.length === 0 ? (
          <div className="border border-border-light rounded-3xl p-16 text-center bg-surface-elevated shadow-card animate-fade-in">
            <div className="h-16 w-16 rounded-2xl gradient-coral flex items-center justify-center mx-auto mb-6 shadow-glow-coral">
              <LayoutTemplate className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">No presentations yet</h2>
            <p className="text-text-secondary text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              Describe a topic and let AI build you a beautiful, animated HTML presentation.
            </p>
            <Button asChild className="rounded-full px-8 gap-2">
              <Link to="/chat">
                <Sparkles className="h-4 w-4" />
                Create presentation
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
            {presentations.map((p: (typeof presentations)[number], i: number) => (
              <div
                key={p._id}
                className="bg-surface-elevated rounded-2xl border border-border-light shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden group hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Gradient thumbnail */}
                <div className={`h-40 ${cardGradients[i % cardGradients.length]} flex items-center justify-center relative overflow-hidden`}>
                  <LayoutTemplate className="h-10 w-10 text-white/30" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                </div>
                {/* Info */}
                <div className="p-5">
                  <h3 className="font-semibold text-sm truncate mb-1 text-text-primary">
                    {p.title}
                  </h3>
                  <p className="text-xs text-text-tertiary mb-4">
                    {new Date(p.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      asChild
                      className="rounded-full px-4 text-xs h-8 gap-1.5"
                    >
                      <a
                        href={`/p/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="rounded-full px-4 text-xs h-8 gap-1.5"
                    >
                      <Link to={`/chat/${p.conversationId}`}>
                        <MessageSquare className="h-3 w-3" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* My Themes preview */}
        <div className="mb-14 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Palette className="h-4 w-4 text-text-tertiary" />
              My Themes
            </h2>
            <Link
              to="/themes"
              className="text-xs text-coral hover:text-coral-dark transition-colors font-medium"
            >
              {themes.length > 0 ? "View all →" : "Create →"}
            </Link>
          </div>
          {themes.length === 0 ? (
            <Link
              to="/themes"
              className="flex items-center gap-4 p-5 bg-surface-elevated rounded-2xl border border-border-light shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group"
            >
              <div className="h-12 w-12 rounded-xl gradient-coral flex items-center justify-center shadow-sm shrink-0">
                <Palette className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary group-hover:text-coral transition-colors">
                  Create your first theme
                </p>
                <p className="text-xs text-text-tertiary">
                  Describe a mood and let AI design colors, fonts, and layout
                </p>
              </div>
              <span className="text-text-tertiary text-sm opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                →
              </span>
            </Link>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {themes.slice(0, 4).map((t) => (
                <Link
                  key={t._id}
                  to="/themes"
                  className="bg-surface-elevated rounded-xl border border-border-light shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 overflow-hidden group"
                >
                  <div
                    className="h-16 p-3 flex items-end"
                    style={{ backgroundColor: t.colors.background }}
                  >
                    <span
                      className="text-[10px] font-bold truncate"
                      style={{ color: t.colors.accent }}
                    >
                      Aa
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium truncate text-text-primary group-hover:text-coral transition-colors">
                      {t.name}
                    </p>
                    <div className="flex items-center gap-0.5 mt-1.5">
                      {[t.colors.background, t.colors.accent, t.colors.foreground, t.colors.muted].map(
                        (c, i) => (
                          <div
                            key={i}
                            className="h-2 flex-1 first:rounded-l-full last:rounded-r-full"
                            style={{ backgroundColor: c }}
                          />
                        )
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent conversations */}
        {conversations.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-base font-semibold mb-4 text-text-primary">
              Recent Conversations
            </h2>
            <div className="bg-surface-elevated rounded-2xl border border-border-light shadow-card overflow-hidden">
              {conversations.slice(0, 5).map((c: (typeof conversations)[number], i: number) => (
                <Link
                  key={c._id}
                  to={`/chat/${c._id}`}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-surface transition-colors group ${i !== Math.min(conversations.length - 1, 4) ? "border-b border-border-light" : ""
                    }`}
                >
                  <div className="h-10 w-10 rounded-xl bg-surface flex items-center justify-center shrink-0 group-hover:bg-coral/8 transition-colors">
                    <MessageSquare className="h-4 w-4 text-text-tertiary group-hover:text-coral transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-text-primary group-hover:text-coral transition-colors">
                      {c.title ?? "Untitled conversation"}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {new Date(c.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="text-text-tertiary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
