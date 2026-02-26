/**
 * Edit Engine — Pure functions for surgical HTML presentation edits.
 *
 * Supports 4 operation types:
 *   - searchReplace: find/replace text in the HTML
 *   - replaceSlide:  replace an entire slide section by index
 *   - insertSlide:   insert a new slide after a given index
 *   - deleteSlide:   remove a slide by index
 *
 * No Convex runtime dependencies — can be imported from actions and mutations.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type EditOperation =
  | { type: "searchReplace"; search: string; replace: string }
  | { type: "replaceSlide"; slideIndex: number; newHtml: string }
  | { type: "insertSlide"; afterIndex: number; html: string }
  | { type: "deleteSlide"; slideIndex: number };

export interface SlideInfo {
  index: number;
  classes: string;
  heading: string;
  startOffset: number;
  endOffset: number;
}

// ─── Slide boundary detection ───────────────────────────────────────────────

/**
 * Parse the HTML to find slide section boundaries.
 * Slides are `<section class="slide ..."> ... </section>` blocks.
 * Uses a simple depth-tracking parser to avoid regex pitfalls with nested tags.
 */
export function findSlides(html: string): SlideInfo[] {
  const slides: SlideInfo[] = [];
  // Match opening <section ...class="slide..."...> tags
  const openRegex = /<section\s[^>]*class="[^"]*slide[^"]*"[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = openRegex.exec(html)) !== null) {
    const startOffset = match.index;
    // Extract classes from this tag
    const classMatch = match[0].match(/class="([^"]*)"/);
    const classes = classMatch ? classMatch[1] : "slide";

    // Find the matching </section> by tracking depth
    let depth = 1;
    let pos = startOffset + match[0].length;
    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf("<section", pos);
      const nextClose = html.indexOf("</section>", pos);

      if (nextClose === -1) break; // malformed HTML

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 8; // length of "<section"
      } else {
        depth--;
        if (depth === 0) {
          const endOffset = nextClose + "</section>".length;

          // Extract first heading from this slide
          const slideHtml = html.slice(startOffset, endOffset);
          const headingMatch = slideHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
          const heading = headingMatch
            ? headingMatch[1].replace(/<[^>]*>/g, "").trim()
            : "(no heading)";

          slides.push({
            index: slides.length,
            classes,
            heading,
            startOffset,
            endOffset,
          });
        }
        pos = nextClose + "</section>".length;
      }
    }
  }

  return slides;
}

// ─── Slide map (compact representation for AI context) ──────────────────────

export interface SlideMapEntry {
  index: number;
  type: string;
  heading: string;
}

/**
 * Extract a compact slide map from the HTML — used to give the AI
 * a quick overview of the slide structure without the full HTML.
 */
export function extractSlideMap(html: string): SlideMapEntry[] {
  return findSlides(html).map((s) => {
    // Determine slide type from classes
    let type = "content";
    if (s.classes.includes("title-slide")) type = "title";
    else if (s.classes.includes("chart")) type = "chart";
    else if (s.classes.includes("quote")) type = "quote";
    else if (s.classes.includes("code")) type = "code";
    else if (s.classes.includes("grid")) type = "grid";
    else if (s.classes.includes("closing") || s.classes.includes("end")) type = "closing";

    return { index: s.index, type, heading: s.heading };
  });
}

// ─── Apply operations ───────────────────────────────────────────────────────

/**
 * Apply an ordered list of edit operations to an HTML string.
 * Operations are applied sequentially — slide indexes in later operations
 * reflect the state AFTER previous operations have been applied.
 */
export function applyOperations(html: string, ops: EditOperation[]): string {
  let result = html;

  for (const op of ops) {
    switch (op.type) {
      case "searchReplace":
        result = applySearchReplace(result, op.search, op.replace);
        break;
      case "replaceSlide":
        result = applyReplaceSlide(result, op.slideIndex, op.newHtml);
        break;
      case "insertSlide":
        result = applyInsertSlide(result, op.afterIndex, op.html);
        break;
      case "deleteSlide":
        result = applyDeleteSlide(result, op.slideIndex);
        break;
    }
  }

  return result;
}

// ─── Individual operation implementations ────────────────────────────────────

function applySearchReplace(html: string, search: string, replace: string): string {
  if (!search) return html;
  // Replace all occurrences
  return html.split(search).join(replace);
}

function applyReplaceSlide(html: string, slideIndex: number, newHtml: string): string {
  const slides = findSlides(html);
  if (slideIndex < 0 || slideIndex >= slides.length) {
    throw new Error(`Slide index ${slideIndex} out of range (0-${slides.length - 1})`);
  }
  const slide = slides[slideIndex];
  return html.slice(0, slide.startOffset) + newHtml + html.slice(slide.endOffset);
}

function applyInsertSlide(html: string, afterIndex: number, slideHtml: string): string {
  const slides = findSlides(html);

  if (afterIndex === -1) {
    // Insert before the first slide
    if (slides.length === 0) {
      throw new Error("No slides found to insert before");
    }
    return html.slice(0, slides[0].startOffset) + slideHtml + "\n\n" + html.slice(slides[0].startOffset);
  }

  if (afterIndex < 0 || afterIndex >= slides.length) {
    throw new Error(`afterIndex ${afterIndex} out of range (-1 to ${slides.length - 1})`);
  }
  const slide = slides[afterIndex];
  return html.slice(0, slide.endOffset) + "\n\n" + slideHtml + html.slice(slide.endOffset);
}

function applyDeleteSlide(html: string, slideIndex: number): string {
  const slides = findSlides(html);
  if (slideIndex < 0 || slideIndex >= slides.length) {
    throw new Error(`Slide index ${slideIndex} out of range (0-${slides.length - 1})`);
  }
  const slide = slides[slideIndex];

  // Also remove trailing whitespace/newlines between sections
  let endPos = slide.endOffset;
  while (endPos < html.length && (html[endPos] === "\n" || html[endPos] === "\r" || html[endPos] === " ")) {
    endPos++;
  }

  return html.slice(0, slide.startOffset) + html.slice(endPos);
}
