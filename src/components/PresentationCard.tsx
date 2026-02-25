import { Button } from "@/components/ui/button";
import { ExternalLink, Share2, Check, Sparkles } from "lucide-react";
import { useState } from "react";

interface PresentationCardProps {
  slug: string;
  title: string;
  htmlContent: string;
  showFullscreen?: boolean;
}

export function PresentationCard({ slug, title, htmlContent, showFullscreen = true }: PresentationCardProps) {
  const [copied, setCopied] = useState(false);
  void htmlContent;

  const shareUrl = `${window.location.origin}/p/${slug}`;

const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-2xl border border-border-light bg-surface-elevated shadow-card overflow-hidden animate-scale-in">
      {/* Header strip */}
      <div className="px-5 py-4 border-b border-border-light flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl gradient-coral flex items-center justify-center shrink-0 shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {title}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 flex gap-2">
        {showFullscreen && (
          <Button
            asChild
            size="sm"
            className="rounded-full px-5 text-xs h-9 gap-1.5 flex-1"
          >
            <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              View fullscreen
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="rounded-full px-5 text-xs h-9 gap-1.5 flex-1"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-success" />
              Copied!
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" />
              Share
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
