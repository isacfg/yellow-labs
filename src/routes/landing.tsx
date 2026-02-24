import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Sparkles, Zap, Share2, ArrowRight } from "lucide-react";

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

const featureCards = [
  {
    icon: Sparkles,
    title: "Visual Style Discovery",
    description:
      "See 3 live previews before committing. Click to choose the aesthetic that's right for your content.",
    gradient: "gradient-coral",
  },
  {
    icon: Zap,
    title: "Instant Generation",
    description:
      "Full HTML presentations with animations, transitions, and responsive layout — generated in seconds.",
    gradient: "gradient-purple-pink",
  },
  {
    icon: Share2,
    title: "Share Anywhere",
    description:
      "Every presentation gets a public link. Download as a self-contained HTML file or present directly in browser.",
    gradient: "gradient-blue-teal",
  },
];

const stats = [
  { value: "10K+", label: "Presentations Created" },
  { value: "<30s", label: "Average Generation Time" },
  { value: "100%", label: "Custom HTML & CSS" },
  { value: "∞", label: "Creative Possibilities" },
];

export function Landing() {
  const user = useQuery(api.users.viewer);

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto">
        <LogoMark />
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Features
          </a>
          <a href="#stats" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            About
          </a>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button size="sm" asChild className="rounded-full px-6">
                <Link to="/chat">New presentation</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button size="sm" asChild className="rounded-full px-6">
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-8 pt-24 pb-16 text-center animate-slide-up">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-coral/8 border border-coral/15 text-coral text-sm font-medium mb-8">
          <Sparkles className="h-4 w-4" />
          AI-powered HTML presentations
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] mb-6 tracking-tight">
          Slides{" "}
          <span className="text-gradient-coral">AI</span>
        </h1>

        <p className="text-lg md:text-xl text-text-secondary max-w-lg mx-auto mb-10 leading-relaxed font-light">
          Describe your topic, choose a visual style, and get a stunning,
          animation-rich HTML presentation in minutes.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Button size="lg" asChild className="rounded-full px-8 text-base h-13 shadow-glow-coral">
            <Link to={user ? "/chat" : "/auth"}>
              Access for Free
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="rounded-full px-8 text-base h-13"
          >
            <Link to={user ? "/dashboard" : "/auth"}>
              Learn More
            </Link>
          </Button>
        </div>
      </div>

      {/* Floating visual elements */}
      <div className="relative max-w-6xl mx-auto px-8 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Modern", gradient: "gradient-coral", icon: "🎨" },
            { label: "Minimal", gradient: "gradient-purple-pink", icon: "✨" },
            { label: "Creative", gradient: "gradient-blue-teal", icon: "🚀" },
            { label: "Professional", gradient: "gradient-dark", icon: "💼" },
          ].map((style, i) => (
            <div
              key={style.label}
              className={`rounded-2xl ${style.gradient} p-6 text-white aspect-[4/3] flex flex-col justify-between animate-fade-in shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 cursor-default`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <span className="text-3xl">{style.icon}</span>
              <div>
                <p className="font-semibold text-sm">{style.label}</p>
                <p className="text-xs text-white/70 mt-0.5">Slide Style</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-sm text-coral font-semibold mb-3 uppercase tracking-wider">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything You Need
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {featureCards.map((f, i) => (
            <div
              key={f.title}
              className="bg-surface-elevated rounded-2xl p-7 border border-border-light shadow-card hover:shadow-card-hover transition-all duration-300 group animate-fade-in hover:-translate-y-1"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`h-12 w-12 rounded-xl ${f.gradient} flex items-center justify-center mb-5 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-base mb-2.5 text-text-primary">
                {f.title}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="max-w-6xl mx-auto px-8 py-20">
        <div className="bg-surface-elevated rounded-3xl border border-border-light p-10 md:p-16 shadow-card">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Slides AI
            </h2>
            <p className="text-text-secondary text-base max-w-md mx-auto">
              The fastest way to create beautiful, animated presentations with AI.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-gradient-coral mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-text-secondary">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-8 py-12 pb-20">
        <div className="gradient-coral rounded-3xl p-10 md:p-16 text-center text-white shadow-glow-coral">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Start Creating Today
          </h2>
          <p className="text-white/80 text-base max-w-md mx-auto mb-8">
            Join thousands of users creating stunning presentations with AI.
          </p>
          <Button
            size="lg"
            asChild
            className="rounded-full px-8 text-base h-13 bg-white text-coral hover:bg-white/90 shadow-none hover:shadow-none"
          >
            <Link to={user ? "/chat" : "/auth"}>
              Get Started — It's Free
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="grid md:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-xl gradient-coral flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <span className="font-semibold text-base">Slides AI</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">
                Create beautiful presentations with AI, in seconds.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4 text-white/90">Product</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link to={user ? "/chat" : "/auth"} className="text-sm text-white/50 hover:text-white transition-colors">
                    Create Presentation
                  </Link>
                </li>
                <li>
                  <Link to={user ? "/dashboard" : "/auth"} className="text-sm text-white/50 hover:text-white transition-colors">
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4 text-white/90">Features</h4>
              <ul className="space-y-2.5">
                <li><span className="text-sm text-white/50">Style Discovery</span></li>
                <li><span className="text-sm text-white/50">Instant Generation</span></li>
                <li><span className="text-sm text-white/50">Share Anywhere</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4 text-white/90">Company</h4>
              <ul className="space-y-2.5">
                <li><span className="text-sm text-white/50">About</span></li>
                <li><span className="text-sm text-white/50">Contact</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/30">
              © 2026 Slides AI. All rights reserved.
            </p>
            <p className="text-xs text-white/30">
              AI-powered presentations
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
