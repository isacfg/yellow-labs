import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AuthForm } from "@/components/AuthForm";

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

export function Auth() {
  const user = useQuery(api.users.viewer);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Nav */}
      <nav className="px-8 py-4 border-b border-border-light">
        <Link to="/">
          <LogoMark />
        </Link>
      </nav>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="text-center mb-8">
            <div className="h-14 w-14 rounded-2xl gradient-coral flex items-center justify-center mx-auto mb-5 shadow-glow-coral">
              <span className="text-white text-xl font-bold">S</span>
            </div>
            <h1 className="text-3xl font-bold mb-2 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-text-secondary text-sm">
              Sign in to access your presentations
            </p>
          </div>
          <AuthForm />
        </div>
      </div>

      {/* Subtle bottom mark */}
      <div className="pb-8 text-center">
        <p className="text-xs text-text-tertiary">
          Slides AI · AI-powered presentations
        </p>
      </div>
    </div>
  );
}
