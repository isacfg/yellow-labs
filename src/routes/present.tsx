import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function Present() {
  const { slug } = useParams<{ slug: string }>();
  const presentation = useQuery(
    api.presentations.getBySlug,
    slug ? { slug } : "skip"
  );

  if (presentation === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="h-10 w-10 rounded-xl gradient-coral flex items-center justify-center animate-pulse shadow-glow-coral">
          <span className="text-white text-sm font-bold">S</span>
        </div>
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center animate-fade-in">
          <p className="text-6xl font-bold text-gradient-coral mb-4">404</p>
          <p className="text-text-secondary text-sm mb-6">
            Presentation not found
          </p>
          <a
            href="/"
            className="text-sm font-semibold text-coral hover:text-coral-dark transition-colors"
          >
            Return to Slides AI →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <iframe
        srcDoc={presentation.htmlContent}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-full border-0"
        title={presentation.title}
        allowFullScreen
      />
    </div>
  );
}
