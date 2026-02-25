import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";

// Set up PDF.js worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAX_PAGES = 10;
const MAX_WIDTH = 1024;

export interface AttachmentImages {
  name: string;
  pageImages: { data: string; mediaType: string }[];
  textContent?: string; // structured text extracted from slides/PDF
}

async function extractPdf(file: File): Promise<AttachmentImages> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = Math.min(pdf.numPages, MAX_PAGES);
  const pages: { data: string; mediaType: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_WIDTH / baseViewport.width, 2);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/png");
    pages.push({
      data: dataUrl.replace(/^data:image\/png;base64,/, ""),
      mediaType: "image/png",
    });
  }

  return { name: file.name, pageImages: pages };
}

function extractSlideText(xml: string): string {
  // Extract text paragraph by paragraph, preserving structure
  const paragraphs = [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)];
  return paragraphs
    .map((p) =>
      [...p[1].matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
        .map((t) => t[1])
        .join("")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function mimeFromExt(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function extractPptx(file: File): Promise<AttachmentImages> {
  const zip = await JSZip.loadAsync(file);

  // ── Extract text from slide XML files ──────────────────────────────────────
  const slideXmlPaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p) && !zip.files[p].dir)
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
      return na - nb;
    })
    .slice(0, MAX_PAGES);

  const slideTextParts = await Promise.all(
    slideXmlPaths.map(async (path, idx) => {
      const xml = await zip.files[path].async("text");
      const text = extractSlideText(xml);
      return text ? `Slide ${idx + 1}:\n${text}` : null;
    }),
  );
  const textContent = slideTextParts.filter(Boolean).join("\n\n") || undefined;

  // ── Extract thumbnail images (visual reference) ────────────────────────────
  const pages: { data: string; mediaType: string }[] = [];
  const thumbnailFiles = Object.keys(zip.files)
    .filter((p) => p.startsWith("ppt/thumbnails/") && !zip.files[p].dir)
    .sort()
    .slice(0, MAX_PAGES);

  for (const path of thumbnailFiles) {
    const base64 = await zip.files[path].async("base64");
    pages.push({ data: base64, mediaType: mimeFromExt(path) });
  }

  return { name: file.name, pageImages: pages, textContent };
}

async function extractImage(file: File): Promise<AttachmentImages> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIdx = dataUrl.indexOf(",");
      const base64 = dataUrl.slice(commaIdx + 1);
      const mediaType = file.type || mimeFromExt(file.name);
      resolve({ name: file.name, pageImages: [{ data: base64, mediaType }] });
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

export async function extractFileImages(file: File): Promise<AttachmentImages> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") return extractPdf(file);
  if (ext === "pptx") return extractPptx(file);
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext ?? ""))
    return extractImage(file);

  throw new Error(`Unsupported file type: .${ext}`);
}
