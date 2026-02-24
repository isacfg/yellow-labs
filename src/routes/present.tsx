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
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-6xl mb-4">404</p>
          <p className="text-xl mb-4">Presentation not found</p>
          <a href="/" className="text-blue-400 hover:underline">
            Return to Slides AI
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
