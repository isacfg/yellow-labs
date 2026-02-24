import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthActions } from "@convex-dev/auth/react";
import { Plus, ExternalLink, MessageSquare, LogOut } from "lucide-react";

export function Dashboard() {
  const user = useQuery(api.users.viewer);
  const presentations = useQuery(api.presentations.list) ?? [];
  const conversations = useQuery(api.conversations.list) ?? [];
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span>✨</span>
            <span>Slides AI</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* CTA */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Your presentations</h1>
          <Button asChild>
            <Link to="/chat">
              <Plus className="h-4 w-4 mr-1" />
              New presentation
            </Link>
          </Button>
        </div>

        {/* Presentations grid */}
        {presentations.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-5xl mb-4">📊</p>
            <p className="font-medium text-lg mb-2">No presentations yet</p>
            <p className="mb-6">Create your first AI-powered presentation</p>
            <Button asChild>
              <Link to="/chat">
                <Plus className="h-4 w-4 mr-1" />
                Create presentation
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {presentations.map((p) => (
              <Card key={p._id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base truncate">{p.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={`/p/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/chat/${p.conversationId}`}>
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Edit
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Recent conversations */}
        {conversations.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent conversations</h2>
            <div className="space-y-2">
              {conversations.slice(0, 5).map((c) => (
                <Link
                  key={c._id}
                  to={`/chat/${c._id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors border"
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.title ?? "Untitled conversation"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
