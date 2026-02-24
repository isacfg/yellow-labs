import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AuthForm } from "@/components/AuthForm";

export function Auth() {
  const user = useQuery(api.users.viewer);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">✨ Slides AI</h1>
          <p className="text-white/60">Create beautiful presentations with AI</p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}
