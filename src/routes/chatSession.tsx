import { useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ChatInterface } from "@/components/ChatInterface";
import { ThemePicker } from "@/components/ThemePicker";
import { ArrowLeft, ExternalLink, Layers, Save, Loader2, Palette, Plus, Check } from "lucide-react";
import { useState } from "react";
import { toPng } from "html-to-image";

export function ChatSession() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const user = useQuery(api.users.viewer);
  const conversation = useQuery(
    api.conversations.get,
    conversationId
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip"
  );
  const presentation = useQuery(
    api.presentations.getByConversation,
    conversationId
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip"
  );
  const saveFromPresentation = useMutation(api.themes.saveFromPresentation);
  const duplicateTheme = useMutation(api.themes.duplicate);
  const setThemeOnConversation = useMutation(api.conversations.setTheme);
  const generateThemeUploadUrl = useMutation(api.themes.generateUploadUrl);
  const setThemePreviewImage = useMutation(api.themes.setPreviewImage);
  const themes = useQuery(api.themes.list) ?? [];
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeSaveStatus, setThemeSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    const handleArrowNavigation = (event: KeyboardEvent) => {
      const isNavigationKey =
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === " " ||
        event.code === "Space" ||
        event.key === "PageDown" ||
        event.key === "PageUp";
      if (!isNavigationKey) return;
      if (!presentation) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTypingTarget =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (isTypingTarget) return;

      const frameWindow = previewIframeRef.current?.contentWindow;
      if (!frameWindow) return;

      event.preventDefault();
      frameWindow.focus();
      frameWindow.document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: event.key,
          code: event.code,
          keyCode: event.keyCode,
          which: event.which,
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    window.addEventListener("keydown", handleArrowNavigation);
    return () => window.removeEventListener("keydown", handleArrowNavigation);
  }, [presentation]);

  useEffect(() => {
    if (user === null) {
      navigate("/auth");
    }
  }, [user, navigate]);

  /**
   * Capture a screenshot of the first slide of the presentation and attach it
   * to the newly saved theme.  Uses html-to-image on an off-screen container
   * populated with the theme’s previewHtml (the real first slide + CSS).
   */
  const captureAndAttachScreenshot = async (themeId: Id<"themes">, previewHtml: string) => {
    try {
      // Build a temporary off-screen container
      const container = document.createElement("div");
      Object.assign(container.style, {
        position: "fixed",
        top: "0",
        left: "-9999px",
        width: "1280px",
        height: "720px",
        overflow: "hidden",
        zIndex: "-1",
      });

      // Parse the previewHtml to extract styles and body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(previewHtml, "text/html");

      // Inject all <link> and <style> elements
      for (const el of doc.head.querySelectorAll("link[rel='stylesheet'], style")) {
        container.appendChild(el.cloneNode(true));
      }

      // Inject body content
      const content = document.createElement("div");
      content.style.cssText = "width:1280px;height:720px;overflow:hidden;";
      content.innerHTML = doc.body.innerHTML;
      container.appendChild(content);

      document.body.appendChild(container);

      // Small delay for fonts/layout to settle
      await new Promise((r) => setTimeout(r, 300));

      const dataUrl = await toPng(container, { width: 1280, height: 720, skipAutoScale: true });

      document.body.removeChild(container);

      // Convert data URL to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      // Upload to Convex storage
      const uploadUrl = await generateThemeUploadUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      const { storageId } = await uploadRes.json() as { storageId: string };

      await setThemePreviewImage({
        themeId,
        previewImageId: storageId as Id<"_storage">,
      });
    } catch (err) {
      // Screenshot is best-effort; theme is still usable without it
      console.warn("Theme screenshot capture failed:", err);
    }
  };

  const handleSaveAsTheme = async () => {
    if (!presentation || isSavingTheme) return;

    setIsSavingTheme(true);
    setThemeSaveStatus(null);

    try {
      if (presentation.themeId) {
        const duplicateExisting = window.confirm(
          "This presentation already has a theme. Click OK to duplicate it, or Cancel to extract a new theme from this presentation's HTML.",
        );

        if (duplicateExisting) {
          const newThemeId = await duplicateTheme({ themeId: presentation.themeId });
          setThemeSaveStatus("Theme duplicated — capturing screenshot…");
          // Find the previewHtml of the current theme to use for screenshot
          const srcTheme = themes.find((t) => t._id === presentation.themeId);
          if (srcTheme?.previewHtml) {
            await captureAndAttachScreenshot(newThemeId, srcTheme.previewHtml);
          }
          setThemeSaveStatus("Theme duplicated and saved to your library.");
        } else {
          const newThemeId = await saveFromPresentation({ presentationId: presentation._id });
          setThemeSaveStatus("Extracting theme — capturing screenshot…");
          // Use the freshly saved theme's previewHtml via optimistic list query
          // Give Convex a moment to reflect the new theme in the list, then capture
          setTimeout(async () => {
            const freshTheme = themes.find((t) => t._id === newThemeId);
            if (freshTheme?.previewHtml) {
              await captureAndAttachScreenshot(newThemeId, freshTheme.previewHtml);
              setThemeSaveStatus("New theme extracted and saved to your library.");
            } else {
              setThemeSaveStatus("New theme extracted and saved to your library.");
            }
          }, 1500);
        }
      } else {
        const newThemeId = await saveFromPresentation({ presentationId: presentation._id });
        setThemeSaveStatus("Extracting theme — capturing screenshot…");
        setTimeout(async () => {
          const freshTheme = themes.find((t) => t._id === newThemeId);
          if (freshTheme?.previewHtml) {
            await captureAndAttachScreenshot(newThemeId, freshTheme.previewHtml);
            setThemeSaveStatus("Theme extracted and saved to your library.");
          } else {
            setThemeSaveStatus("Theme extracted and saved to your library.");
          }
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to save theme:", error);
      setThemeSaveStatus("Could not save theme. Please try again.");
    } finally {
      setIsSavingTheme(false);
    }
  };

  if (!conversationId) {
    navigate("/chat");
    return null;
  }

  if (conversation === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center animate-fade-in">
          <p className="text-5xl font-bold text-gradient-coral mb-3">404</p>
          <p className="text-text-secondary text-sm mb-6">
            Conversation not found
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm font-semibold text-coral hover:text-coral-dark transition-colors"
          >
            Go to dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="border-b border-border-light px-6 py-3.5 flex items-center gap-4 bg-surface/80 backdrop-blur-xl shrink-0 z-10">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-text-secondary hover:text-coral transition-colors text-sm shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        <div className="h-4 w-px bg-border-light shrink-0" />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate text-text-primary">
            {conversation?.title ?? "New presentation"}
          </h1>
        </div>

        {conversationId && (
          <ThemePicker
            conversationId={conversationId as Id<"conversations">}
            currentThemeId={conversation?.themeId}
          />
        )}

        <span className="text-xs text-text-tertiary hidden md:block shrink-0">
          {user?.email}
        </span>
      </header>

      {/* Body: split layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat */}
        <div className="flex flex-col w-[420px] shrink-0 border-r border-border-light min-h-0">
          <ChatInterface
            conversationId={conversationId as Id<"conversations">}
          />
        </div>

        {/* Right: Presentation preview */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-elevated">
          {/* Preview header */}
          <div className="px-4 py-2.5 border-b border-border-light flex items-center gap-3 bg-surface/60 backdrop-blur-sm shrink-0">
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Preview
            </span>
            {presentation && (
              <>
                <span className="text-xs text-text-secondary truncate flex-1">
                  {presentation.title}
                </span>

                {/* Active theme pill */}
                {(() => {
                  const activeTheme = themes.find((t) => t._id === conversation?.themeId);
                  return activeTheme ? (
                    <span className="hidden lg:flex items-center gap-1.5 text-[10px] font-medium text-text-tertiary border border-border-light rounded-full px-2 py-0.5 shrink-0">
                      <span className="flex items-center gap-0.5">
                        {[activeTheme.colors.background, activeTheme.colors.accent].map((c, i) => (
                          <span
                            key={i}
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </span>
                      {activeTheme.name}
                    </span>
                  ) : null;
                })()}

                <button
                  onClick={handleSaveAsTheme}
                  disabled={isSavingTheme}
                  className="text-xs text-text-secondary hover:text-coral transition-colors flex items-center gap-1 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingTheme ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3 w-3" />
                      Save as theme
                    </>
                  )}
                </button>
                <a
                  href={`/p/${presentation.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-coral hover:text-coral-dark transition-colors flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                  Fullscreen
                </a>
              </>
            )}
          </div>

          {themeSaveStatus && (
            <div className="px-4 py-2 text-xs text-text-secondary border-b border-border-light bg-surface">
              {themeSaveStatus}
            </div>
          )}

          {/* Preview content */}
          <div className="flex-1 relative min-h-0">
            {presentation ? (
              <iframe
                key={presentation._id}
                ref={previewIframeRef}
                srcDoc={presentation.htmlContent}
                sandbox="allow-scripts allow-same-origin"
                className="absolute inset-0 w-full h-full border-0"
                title={presentation.title}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-y-auto">
                <div className="w-full max-w-xs">
                  {/* Icon + headline */}
                  <div className="text-center mb-5">
                    <div className="h-12 w-12 rounded-xl gradient-coral flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <Palette className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-text-primary mb-1">
                      Set your visual style
                    </p>
                    <p className="text-xs text-text-tertiary leading-relaxed">
                      Choose a theme to guide the AI's design choices, or let it create one during the chat.
                    </p>
                  </div>

                  {/* Theme list */}
                  <div className="space-y-1.5 mb-3">
                    {/* No-theme option */}
                    <button
                      onClick={() =>
                        conversationId &&
                        setThemeOnConversation({
                          conversationId: conversationId as Id<"conversations">,
                          themeId: undefined,
                        })
                      }
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all border
                        hover:bg-surface border-transparent hover:border-border-light
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
                    >
                      <div className="h-8 w-8 rounded-lg bg-surface border border-border-light flex items-center justify-center shrink-0">
                        <Layers className="h-3.5 w-3.5 text-text-tertiary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-primary">Let AI choose</p>
                        <p className="text-[10px] text-text-tertiary">AI suggests styles during chat</p>
                      </div>
                      {!conversation?.themeId && (
                        <Check className="h-3.5 w-3.5 text-coral ml-auto" />
                      )}
                    </button>

                    {/* User themes */}
                    {themes.map((t) => (
                      <button
                        key={t._id}
                        onClick={() =>
                          conversationId &&
                          setThemeOnConversation({
                            conversationId: conversationId as Id<"conversations">,
                            themeId: t._id,
                          })
                        }
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all border
                          hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40
                          "
                        style={{
                          borderColor:
                            conversation?.themeId === t._id
                              ? "rgba(255,107,107,0.4)"
                              : "transparent",
                          background:
                            conversation?.themeId === t._id
                              ? "rgba(255,107,107,0.05)"
                              : undefined,
                        }}
                      >
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[t.colors.background, t.colors.accent, t.colors.foreground].map(
                            (c, i) => (
                              <div
                                key={i}
                                className="h-4 w-4 rounded-full border border-border-light"
                                style={{ backgroundColor: c }}
                              />
                            )
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate text-text-primary">{t.name}</p>
                          <p className="text-[10px] text-text-tertiary truncate">
                            {t.fonts.display} + {t.fonts.body}
                          </p>
                        </div>
                        {conversation?.themeId === t._id && (
                          <Check className="h-3.5 w-3.5 text-coral ml-auto shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Create theme link */}
                  <Link
                    to="/themes/new"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-coral hover:bg-coral/5 transition-colors w-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create new theme
                  </Link>

                  <p className="text-center text-[10px] text-text-tertiary mt-4 px-2 leading-relaxed">
                    Start chatting on the left — your presentation will appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
