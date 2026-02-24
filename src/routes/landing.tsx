import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function Landing() {
  const user = useQuery(api.users.viewer);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 font-bold text-xl">
          <span>✨</span>
          <span>Slides AI</span>
        </div>
        <div className="flex gap-3">
          {user ? (
            <>
              <Button variant="ghost" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild>
                <Link to="/chat">New Presentation</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get started free</Link>
              </Button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center text-center px-4 pt-24 pb-16">
        <div className="inline-block bg-white/10 border border-white/20 rounded-full px-4 py-1 text-sm mb-6 backdrop-blur-sm">
          AI-powered HTML presentations
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Beautiful presentations,{" "}
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            built by AI
          </span>
        </h1>
        <p className="text-xl text-white/70 max-w-2xl mb-10">
          Describe your topic, choose a visual style, and get a stunning,
          animation-rich HTML presentation in minutes. No design skills needed.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button size="lg" className="bg-purple-600 hover:bg-purple-500 text-white border-0 text-base px-8" asChild>
            <Link to={user ? "/chat" : "/auth"}>
              Start creating for free
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-base px-8" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 pb-24 grid md:grid-cols-3 gap-8">
        {[
          {
            icon: "🎨",
            title: "Visual style discovery",
            description:
              "See 3 live previews before committing. Click to choose the aesthetic that's right for your content.",
          },
          {
            icon: "⚡",
            title: "Instant generation",
            description:
              "Full HTML presentations with animations, transitions, and responsive layout — generated in seconds.",
          },
          {
            icon: "🔗",
            title: "Share anywhere",
            description:
              "Every presentation gets a public link. Download as a self-contained HTML file or present directly in browser.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
          >
            <div className="text-3xl mb-4">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-white/60 text-sm leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
