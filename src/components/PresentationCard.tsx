import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Download, Share2 } from "lucide-react";
import { useState } from "react";

interface PresentationCardProps {
  slug: string;
  title: string;
  htmlContent: string;
}

export function PresentationCard({ slug, title, htmlContent }: PresentationCardProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/p/${slug}`;

  const handleDownload = () => {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="my-4 border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎉</span>
          <CardTitle className="text-lg">Your presentation is ready!</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            View fullscreen
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          Download .html
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          <Share2 className="h-4 w-4 mr-1" />
          {copied ? "Link copied!" : "Copy share link"}
        </Button>
      </CardContent>
    </Card>
  );
}
