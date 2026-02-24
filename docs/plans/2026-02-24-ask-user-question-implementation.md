# AskUserQuestion Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `AskUserQuestion` as a real Anthropic tool so Claude can ask questions that render as interactive UI cards in the chat, answered one at a time.

**Architecture:** Define `AskUserQuestion` in the Anthropic `tools` array. When Claude calls it, save the tool call JSON to the message row and pause. The frontend renders clickable option cards, one question at a time. When all answered, `answerQuestion` action saves a hidden tool_result message and re-invokes Claude to continue.

**Tech Stack:** Convex (schema, mutations, actions), Anthropic SDK tool use, React + TypeScript

---

### Task 1: Revert the "do NOT use tools" patches in SKILL.md and content.ts

These were applied in the previous (now-wrong) fix and must be reverted before Claude will call the tool again.

**Files:**
- Modify: `convex/skill/SKILL.md`
- Modify: `convex/skill/content.ts`

**Step 1: Revert SKILL.md — Phase 1 change**

In `convex/skill/SKILL.md`, find and replace:
```
Before designing, understand the content. Ask the user these questions conversationally in plain text (do NOT use any tools — just write the questions as normal chat messages):
```
With:
```
Before designing, understand the content. Ask via AskUserQuestion:
```

**Step 2: Revert SKILL.md — Phase 2 change**

In `convex/skill/SKILL.md`, find and replace:
```
Then ask the user in plain conversational text (do NOT use any tools):

**Question: Pick Your Style**
Ask them: "Which style preview do you prefer? Options:
  - Style A: [Name] — [Brief description]
  - Style B: [Name] — [Brief description]
  - Style C: [Name] — [Brief description]
  - Mix elements — Combine aspects from different styles"
```
With:
```
Then use AskUserQuestion:

**Question: Pick Your Style**
- Header: "Style"
- Question: "Which style preview do you prefer?"
- Options:
  - "Style A: [Name]" — [Brief description]
  - "Style B: [Name]" — [Brief description]
  - "Style C: [Name]" — [Brief description]
  - "Mix elements" — Combine aspects from different styles
```

**Step 3: Apply the same reverts to `convex/skill/content.ts`**

Same two find-and-replace operations in `content.ts` (it has the same strings inside a template literal, as the embedded `SKILL_MD` export).

**Step 4: Verify**

```bash
grep -n "do NOT use" convex/skill/content.ts convex/skill/SKILL.md
```
Expected: no output (both files clean).

**Step 5: Commit**
```bash
git add convex/skill/SKILL.md convex/skill/content.ts
git commit -m "revert: restore AskUserQuestion tool instructions in skill"
```

---

### Task 2: Add tool call fields to schema

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add three optional fields to the messages table**

In `convex/schema.ts`, locate the `messages` table definition and add the three fields:
```typescript
messages: defineTable({
  conversationId: v.id("conversations"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  isStreaming: v.boolean(),
  hasStylePreviews: v.boolean(),
  hasFinalPresentation: v.boolean(),
  createdAt: v.number(),
  // Tool use fields (optional — only set when Claude calls AskUserQuestion)
  toolCallId: v.optional(v.string()),      // Anthropic tool_use id
  toolCallInput: v.optional(v.string()),   // JSON of the questions array
  toolResultFor: v.optional(v.string()),   // tool_use_id this row answers
}).index("by_conversation", ["conversationId"]),
```

**Step 2: Type-check**
```bash
npx tsc --noEmit
```
Expected: no errors (Convex codegen will pick up schema on next `convex dev` start).

**Step 3: Commit**
```bash
git add convex/schema.ts
git commit -m "feat: add tool call fields to messages schema"
```

---

### Task 3: Update messages.ts — new mutations + updated list/listForAI

**Files:**
- Modify: `convex/messages.ts`

**Step 1: Update `list` query return type to include tool call fields**

Find the `returns: v.array(v.object({...}))` block in the `list` query and add the three new optional fields:

```typescript
export const list = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      isStreaming: v.boolean(),
      hasStylePreviews: v.boolean(),
      hasFinalPresentation: v.boolean(),
      createdAt: v.number(),
      toolCallId: v.optional(v.string()),
      toolCallInput: v.optional(v.string()),
      toolResultFor: v.optional(v.string()),
    })
  ),
  // handler unchanged
```

**Step 2: Update `listForAI` to return all fields needed for Anthropic history reconstruction**

Replace the entire `listForAI` export with:
```typescript
export const listForAI = internalQuery({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      isStreaming: v.boolean(),
      toolCallId: v.optional(v.string()),
      toolCallInput: v.optional(v.string()),
      toolResultFor: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
    return msgs
      .filter((m) => !m.isStreaming || m.content.length > 0)
      .map((m) => ({
        _id: m._id,
        role: m.role,
        content: m.content,
        isStreaming: m.isStreaming,
        toolCallId: m.toolCallId,
        toolCallInput: m.toolCallInput,
        toolResultFor: m.toolResultFor,
      }));
  },
});
```

**Step 3: Add `saveToolCall` internal mutation**

Add after the `finalize` export:
```typescript
export const saveToolCall = internalMutation({
  args: {
    messageId: v.id("messages"),
    toolCallId: v.string(),
    toolCallInput: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      toolCallId: args.toolCallId,
      toolCallInput: args.toolCallInput,
      isStreaming: false,
    });
    return null;
  },
});
```

**Step 4: Add `saveToolResult` internal mutation**

Add after `saveToolCall`:
```typescript
export const saveToolResult = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    toolCallId: v.string(),
    content: v.string(),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      isStreaming: false,
      hasStylePreviews: false,
      hasFinalPresentation: false,
      createdAt: Date.now(),
      toolResultFor: args.toolCallId,
    });
  },
});
```

**Step 5: Type-check**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 6: Commit**
```bash
git add convex/messages.ts
git commit -m "feat: add saveToolCall/saveToolResult mutations and update listForAI"
```

---

### Task 4: Refactor convex/ai.ts — tool definition, streaming, answerQuestion

**Files:**
- Modify: `convex/ai.ts`

**Step 1: Add the tool definition constant and a `buildHistory` helper at the top of the file (after the imports)**

```typescript
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import type Anthropic from "@anthropic-ai/sdk";

const ASK_USER_QUESTION_TOOL: Anthropic.Tool = {
  name: "AskUserQuestion",
  description:
    "Ask the user one or more multiple-choice questions. Use this to collect preferences, goals, or decisions before generating content.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            header: {
              type: "string",
              description: "Short label for this question (max 12 chars), e.g. 'Purpose'",
            },
            question: {
              type: "string",
              description: "The full question text",
            },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                },
                required: ["label", "description"],
              },
            },
            multiSelect: {
              type: "boolean",
              description: "Whether the user can select multiple options",
            },
          },
          required: ["header", "question", "options"],
        },
      },
    },
    required: ["questions"],
  },
};

type RawMessage = {
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  toolCallId?: string;
  toolCallInput?: string;
  toolResultFor?: string;
};

function buildHistory(msgs: RawMessage[]): Anthropic.MessageParam[] {
  return msgs.map((m) => {
    if (m.toolCallId && m.toolCallInput) {
      // Assistant message that called AskUserQuestion
      const content: Anthropic.ContentBlock[] = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      content.push({
        type: "tool_use",
        id: m.toolCallId,
        name: "AskUserQuestion",
        input: JSON.parse(m.toolCallInput) as Record<string, unknown>,
      });
      return { role: "assistant" as const, content };
    }
    if (m.toolResultFor) {
      // Hidden user message containing the tool result
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: m.toolResultFor,
            content: m.content,
          },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}
```

**Step 2: Extract the streaming logic into a module-level async function**

Add this function before the `sendMessage` export:
```typescript
async function runStreaming(
  ctx: GenericActionCtx<DataModel>,
  client: Anthropic,
  history: Anthropic.MessageParam[],
  assistantMsgId: Id<"messages">,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  convTitle: string | undefined,
): Promise<void> {
  let fullContent = "";
  let toolUseId = "";
  let toolUseName = "";
  let toolInputJson = "";
  let isCollectingTool = false;

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: history,
    tools: [ASK_USER_QUESTION_TOOL],
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_start") {
      if (chunk.content_block.type === "tool_use") {
        isCollectingTool = true;
        toolUseId = chunk.content_block.id;
        toolUseName = chunk.content_block.name;
        toolInputJson = "";
      }
    } else if (chunk.type === "content_block_delta") {
      if (chunk.delta.type === "text_delta") {
        const text = chunk.delta.text;
        fullContent += text;
        await ctx.runMutation(internal.messages.appendStream, {
          messageId: assistantMsgId,
          chunk: text,
        });
      } else if (chunk.delta.type === "input_json_delta") {
        toolInputJson += chunk.delta.partial_json;
      }
    } else if (chunk.type === "content_block_stop") {
      if (isCollectingTool) {
        isCollectingTool = false;
      }
    }
  }

  if (toolUseId) {
    // Claude called AskUserQuestion — save and pause
    await ctx.runMutation(internal.messages.saveToolCall, {
      messageId: assistantMsgId,
      toolCallId: toolUseId,
      toolCallInput: toolInputJson,
    });
    // Note: toolUseName is validated at runtime; only AskUserQuestion is defined
    void toolUseName; // suppress unused warning
  } else {
    // Normal text response — finalize as before
    const hasStylePreviews = detectStylePreviews(fullContent);
    const hasFinalPresentation = detectFinalPresentation(fullContent);
    await ctx.runMutation(internal.messages.finalize, {
      messageId: assistantMsgId,
      hasStylePreviews,
      hasFinalPresentation,
    });

    if (hasFinalPresentation) {
      const htmlMatch = fullContent.match(/<!DOCTYPE html>[\s\S]*/i);
      const htmlContent = htmlMatch ? htmlMatch[0] : fullContent;
      const title = extractTitle(htmlContent, convTitle ?? "Presentation");
      const slug = generateSlug();
      await ctx.runMutation(internal.presentations.save, {
        userId,
        conversationId,
        title,
        htmlContent,
        slug,
      });
    }
  }
}
```

**Step 3: Simplify `sendMessage` to use `runStreaming`**

Replace the handler body of `sendMessage` (everything from step 4 onwards that builds the history and calls Anthropic) with:
```typescript
handler: async (ctx, args) => {
  // 1. Auth check
  const userId = await ctx.runQuery(internal.users.currentUserId);
  if (!userId) throw new Error("Not authenticated");

  // 2. Save user message
  await ctx.runMutation(api.messages.addUser, {
    conversationId: args.conversationId,
    content: args.userContent,
  });

  // 3. Auto-set title from first message
  const conv = await ctx.runQuery(api.conversations.get, {
    conversationId: args.conversationId,
  });
  if (conv && !conv.title) {
    const title = args.userContent.slice(0, 60);
    await ctx.runMutation(api.conversations.setTitle, {
      conversationId: args.conversationId,
      title,
    });
  }

  // 4. Load conversation history
  const rawHistory = await ctx.runQuery(internal.messages.listForAI, {
    conversationId: args.conversationId,
  });
  const history = buildHistory(rawHistory);

  // 5. Create empty assistant message
  const assistantMsgId = await ctx.runMutation(
    internal.messages.createAssistant,
    { conversationId: args.conversationId }
  );

  // 6. Stream Claude response
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  await runStreaming(
    ctx,
    client,
    history,
    assistantMsgId,
    args.conversationId,
    userId,
    conv?.title,
  );

  return null;
},
```

**Step 4: Add `answerQuestion` action**

Add after the `sendMessage` export:
```typescript
export const answerQuestion = action({
  args: {
    conversationId: v.id("conversations"),
    toolCallId: v.string(),
    answers: v.string(), // Human-readable: "Purpose: Startup pitch\nLength: Medium"
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Auth check
    const userId = await ctx.runQuery(internal.users.currentUserId);
    if (!userId) throw new Error("Not authenticated");

    // 2. Save tool result message (hidden from UI)
    await ctx.runMutation(internal.messages.saveToolResult, {
      conversationId: args.conversationId,
      toolCallId: args.toolCallId,
      content: args.answers,
    });

    // 3. Load full conversation history (now includes the tool result)
    const rawHistory = await ctx.runQuery(internal.messages.listForAI, {
      conversationId: args.conversationId,
    });
    const history = buildHistory(rawHistory);

    // 4. Create empty assistant message
    const assistantMsgId = await ctx.runMutation(
      internal.messages.createAssistant,
      { conversationId: args.conversationId }
    );

    // 5. Continue streaming
    const conv = await ctx.runQuery(api.conversations.get, {
      conversationId: args.conversationId,
    });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await runStreaming(
      ctx,
      client,
      history,
      assistantMsgId,
      args.conversationId,
      userId,
      conv?.title,
    );

    return null;
  },
});
```

**Step 5: Type-check**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 6: Commit**
```bash
git add convex/ai.ts
git commit -m "feat: add AskUserQuestion Anthropic tool and answerQuestion action"
```

---

### Task 5: Create AskUserQuestionCard component

**Files:**
- Create: `src/components/AskUserQuestionCard.tsx`

**Step 1: Create the component**

```typescript
interface Option {
  label: string;
  description: string;
}

interface Question {
  header: string;
  question: string;
  options: Option[];
  multiSelect?: boolean;
}

interface AskUserQuestionCardProps {
  questions: Question[];
  currentQuestionIdx: number;
  pendingAnswers: Record<number, string>;
  onAnswer: (questionIdx: number, label: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function AskUserQuestionCard({
  questions,
  currentQuestionIdx,
  pendingAnswers,
  onAnswer,
  onSubmit,
  disabled = false,
}: AskUserQuestionCardProps) {
  const question = questions[currentQuestionIdx];
  if (!question) return null;

  const selectedLabel = pendingAnswers[currentQuestionIdx];
  const isLastQuestion = currentQuestionIdx === questions.length - 1;
  const canAdvance = selectedLabel !== undefined && !disabled;

  return (
    <div className="bg-surface-elevated border border-border-light rounded-2xl rounded-tl-md overflow-hidden shadow-card">
      {/* Progress */}
      {questions.length > 1 && (
        <div className="flex items-center gap-1.5 px-4 pt-4 pb-0">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < currentQuestionIdx
                  ? "bg-coral"
                  : i === currentQuestionIdx
                    ? "bg-coral/60"
                    : "bg-border-light"
              }`}
            />
          ))}
        </div>
      )}

      {/* Header + question */}
      <div className="px-4 pt-4 pb-3">
        <span className="inline-block text-xs font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full mb-2">
          {question.header}
        </span>
        <p className="text-sm font-semibold text-text-primary leading-snug">
          {question.question}
        </p>
      </div>

      {/* Options */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {question.options.map((option) => {
          const isSelected = selectedLabel === option.label;
          return (
            <button
              key={option.label}
              onClick={() => !disabled && onAnswer(currentQuestionIdx, option.label)}
              disabled={disabled}
              className={`text-left rounded-xl border px-3.5 py-2.5 transition-all ${
                isSelected
                  ? "border-coral bg-coral/8 shadow-sm"
                  : "border-border-light hover:border-coral/40 hover:bg-surface-hover"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <p className={`text-sm font-semibold ${isSelected ? "text-coral" : "text-text-primary"}`}>
                {option.label}
              </p>
              {option.description && (
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {option.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Action button */}
      <div className="border-t border-border-light px-4 py-3 flex justify-end">
        <button
          onClick={isLastQuestion ? onSubmit : () => onAnswer(currentQuestionIdx + 1, pendingAnswers[currentQuestionIdx + 1] ?? "")}
          disabled={!canAdvance}
          className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all ${
            canAdvance
              ? "bg-coral text-white shadow-sm hover:bg-coral-dark"
              : "bg-border-light text-text-tertiary cursor-not-allowed"
          }`}
        >
          {isLastQuestion ? "Submit →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
```

Wait — the "Next" button above has a bug: it calls `onAnswer` with the *next* question's index and empty string, which isn't right. The "Next" button should just advance the `currentQuestionIdx` state in the parent. Fix the component by making the "Next" button emit a separate `onNext` callback:

Actually, the cleaner approach: "Next" is handled by the parent (`ChatInterface`) which increments `currentQuestionIdx`. Clicking an option just selects it; the Next button advances. Add an `onNext` prop:

```typescript
interface AskUserQuestionCardProps {
  questions: Question[];
  currentQuestionIdx: number;
  pendingAnswers: Record<number, string>;
  onAnswer: (questionIdx: number, label: string) => void;
  onNext: () => void;    // advances to next question
  onSubmit: () => void;  // submits all answers
  disabled?: boolean;
}
```

And the button:
```typescript
<button
  onClick={isLastQuestion ? onSubmit : onNext}
  disabled={!canAdvance}
  ...
>
  {isLastQuestion ? "Submit →" : "Next →"}
</button>
```

**The full final component** (incorporating the fix):

```typescript
interface Option {
  label: string;
  description: string;
}

export interface AskUserQuestion {
  header: string;
  question: string;
  options: Option[];
  multiSelect?: boolean;
}

interface AskUserQuestionCardProps {
  questions: AskUserQuestion[];
  currentQuestionIdx: number;
  pendingAnswers: Record<number, string>;
  onAnswer: (questionIdx: number, label: string) => void;
  onNext: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function AskUserQuestionCard({
  questions,
  currentQuestionIdx,
  pendingAnswers,
  onAnswer,
  onNext,
  onSubmit,
  disabled = false,
}: AskUserQuestionCardProps) {
  const question = questions[currentQuestionIdx];
  if (!question) return null;

  const selectedLabel = pendingAnswers[currentQuestionIdx];
  const isLastQuestion = currentQuestionIdx === questions.length - 1;
  const canAdvance = selectedLabel !== undefined && !disabled;

  return (
    <div className="bg-surface-elevated border border-border-light rounded-2xl rounded-tl-md overflow-hidden shadow-card">
      {questions.length > 1 && (
        <div className="flex items-center gap-1.5 px-4 pt-4">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < currentQuestionIdx
                  ? "bg-coral"
                  : i === currentQuestionIdx
                    ? "bg-coral/60"
                    : "bg-border-light"
              }`}
            />
          ))}
        </div>
      )}

      <div className="px-4 pt-4 pb-3">
        <span className="inline-block text-xs font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full mb-2">
          {question.header}
        </span>
        <p className="text-sm font-semibold text-text-primary leading-snug">
          {question.question}
        </p>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-2">
        {question.options.map((option) => {
          const isSelected = selectedLabel === option.label;
          return (
            <button
              key={option.label}
              onClick={() => !disabled && onAnswer(currentQuestionIdx, option.label)}
              disabled={disabled}
              className={[
                "text-left rounded-xl border px-3.5 py-2.5 transition-all",
                isSelected
                  ? "border-coral bg-coral/8 shadow-sm"
                  : "border-border-light hover:border-coral/40",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <p className={`text-sm font-semibold ${isSelected ? "text-coral" : "text-text-primary"}`}>
                {option.label}
              </p>
              {option.description && (
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {option.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-border-light px-4 py-3 flex justify-end">
        <button
          onClick={isLastQuestion ? onSubmit : onNext}
          disabled={!canAdvance}
          className={[
            "text-sm font-semibold px-4 py-2 rounded-xl transition-all",
            canAdvance
              ? "bg-coral text-white shadow-sm hover:bg-coral-dark"
              : "bg-border-light text-text-tertiary cursor-not-allowed",
          ].join(" ")}
        >
          {isLastQuestion ? "Submit →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Type-check**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**
```bash
git add src/components/AskUserQuestionCard.tsx
git commit -m "feat: add AskUserQuestionCard component"
```

---

### Task 6: Update ChatMessage.tsx

**Files:**
- Modify: `src/components/ChatMessage.tsx`

**Step 1: Update the `Message` interface to include tool call fields**

```typescript
interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  hasStylePreviews: boolean;
  hasFinalPresentation: boolean;
  toolCallId?: string;
  toolCallInput?: string;
  toolResultFor?: string;
}
```

**Step 2: Update `ChatMessageProps` to include question interaction props**

```typescript
interface ChatMessageProps {
  message: Message;
  presentation?: PresentationRef;
  onStyleSelect?: (index: number) => void;
  styleSelectDisabled?: boolean;
  // AskUserQuestion props
  currentQuestionIdx?: number;
  pendingAnswers?: Record<number, string>;
  onAnswer?: (questionIdx: number, label: string) => void;
  onNext?: () => void;
  onSubmit?: () => void;
  questionDisabled?: boolean;
}
```

**Step 3: Add the import for AskUserQuestionCard**

```typescript
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import type { AskUserQuestion } from "./AskUserQuestionCard";
```

**Step 4: Add a render guard for tool result rows (hidden)**

At the very top of the `ChatMessage` function body, before the `isUser` check, add:
```typescript
// Hidden tool result messages — only exist for conversation history
if (message.toolResultFor) return null;
```

**Step 5: Add tool call rendering branch**

In the assistant message section, after the avatar row and before the `{/* Content */}` block, insert a check: if the message has a tool call, render the question card instead of the normal content branches.

Replace the entire `{/* Content */}` section with:
```typescript
{/* Content */}
<div className="ml-9">
  {/* AskUserQuestion tool call — render as interactive question card */}
  {message.toolCallId && message.toolCallInput && (() => {
    let questions: AskUserQuestion[] = [];
    try {
      const parsed = JSON.parse(message.toolCallInput) as { questions: AskUserQuestion[] };
      questions = parsed.questions ?? [];
    } catch {
      // malformed JSON — fall through to text render
    }
    if (questions.length > 0) {
      return (
        <>
          {message.content && (
            <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap mb-3 bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
              {message.content}
            </div>
          )}
          <AskUserQuestionCard
            questions={questions}
            currentQuestionIdx={currentQuestionIdx ?? 0}
            pendingAnswers={pendingAnswers ?? {}}
            onAnswer={onAnswer ?? (() => {})}
            onNext={onNext ?? (() => {})}
            onSubmit={onSubmit ?? (() => {})}
            disabled={questionDisabled}
          />
        </>
      );
    }
    return null;
  })()}

  {/* Normal text/stylePreviews/finalPresentation branches — only if no tool call */}
  {!message.toolCallId && (
    <>
      {parsed.type === "text" && (
        <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-[2px] h-3.5 bg-coral animate-pulse ml-0.5 rounded-full" />
          )}
        </div>
      )}

      {parsed.type === "stylePreviews" && (
        <>
          {message.content.split("```html")[0].trim() && (
            <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap mb-4 bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
              {message.content.split("```html")[0].trim()}
            </div>
          )}
          {!message.isStreaming && onStyleSelect && (
            <StylePreviewGrid
              previews={parsed.previews}
              onSelect={onStyleSelect}
              disabled={styleSelectDisabled}
            />
          )}
          {message.isStreaming && (
            <div className="text-sm text-text-secondary flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-3 border border-border-light">
              <Loader2 className="h-4 w-4 animate-spin text-coral" />
              Generating style previews…
            </div>
          )}
        </>
      )}

      {parsed.type === "finalPresentation" && (
        <>
          {parsed.textBefore && (
            <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap mb-4 bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
              {parsed.textBefore}
            </div>
          )}
          {message.isStreaming ? (
            <div className="text-sm text-text-secondary flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-3 border border-border-light">
              <Loader2 className="h-4 w-4 animate-spin text-coral" />
              Generating your presentation…
            </div>
          ) : presentation ? (
            <PresentationCard
              slug={presentation.slug}
              title={presentation.title}
              htmlContent={presentation.htmlContent}
            />
          ) : (
            <div className="text-sm text-text-secondary flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-3 border border-border-light">
              <Loader2 className="h-4 w-4 animate-spin text-coral" />
              Saving your presentation…
            </div>
          )}
        </>
      )}
    </>
  )}
</div>
```

**Step 6: Update the function signature to destructure the new props**

```typescript
export function ChatMessage({
  message,
  presentation,
  onStyleSelect,
  styleSelectDisabled = false,
  currentQuestionIdx,
  pendingAnswers,
  onAnswer,
  onNext,
  onSubmit,
  questionDisabled = false,
}: ChatMessageProps) {
```

**Step 7: Type-check**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 8: Commit**
```bash
git add src/components/ChatMessage.tsx
git commit -m "feat: render AskUserQuestion tool call as interactive question card"
```

---

### Task 7: Update ChatInterface.tsx

**Files:**
- Modify: `src/components/ChatInterface.tsx`

**Step 1: Import `answerQuestion` from Convex API**

The `useAction` import is already there. Add `answerQuestion` to the action setup:
```typescript
const answerQuestion = useAction(api.ai.answerQuestion);
```

**Step 2: Add question interaction state**

```typescript
const [pendingAnswers, setPendingAnswers] = useState<Record<number, string>>({});
const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
```

**Step 3: Find the last unanswered tool call message**

Add this `useMemo` after the `isStreaming` line:
```typescript
const lastUnansweredToolCallId = useMemo(() => {
  const answeredIds = new Set(
    messages
      .filter((m: (typeof messages)[number]) => m.toolResultFor)
      .map((m: (typeof messages)[number]) => m.toolResultFor)
  );
  const toolCallMsgs = messages.filter(
    (m: (typeof messages)[number]) => m.toolCallId && !answeredIds.has(m.toolCallId)
  );
  return toolCallMsgs.at(-1)?._id ?? null;
}, [messages]);
```

**Step 4: Add question interaction handlers**

```typescript
const handleAnswer = (questionIdx: number, label: string) => {
  setPendingAnswers((prev) => ({ ...prev, [questionIdx]: label }));
};

const handleNext = () => {
  setCurrentQuestionIdx((i) => i + 1);
};

const handleSubmitAnswers = async (toolCallId: string) => {
  const answersText = Object.entries(pendingAnswers)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, label]) => label)
    .join("\n");

  setIsSending(true);
  setPendingAnswers({});
  setCurrentQuestionIdx(0);
  try {
    await answerQuestion({
      conversationId,
      toolCallId,
      answers: answersText,
    });
  } catch (err) {
    console.error("Failed to submit answers:", err);
  } finally {
    setIsSending(false);
  }
};
```

**Step 5: Pass the new props to `ChatMessage`**

Update the `ChatMessage` render inside `messages.map(...)`:

```typescript
return (
  <ChatMessage
    key={msg._id}
    message={msg}
    presentation={
      msg.hasFinalPresentation && !msg.isStreaming && presentation
        ? presentation
        : undefined
    }
    onStyleSelect={isLastStylePreview ? handleStyleSelect : undefined}
    styleSelectDisabled={styleSelectDisabled || isSending || isStreaming}
    // AskUserQuestion props — only active on the last unanswered tool call
    currentQuestionIdx={msg._id === lastUnansweredToolCallId ? currentQuestionIdx : 0}
    pendingAnswers={msg._id === lastUnansweredToolCallId ? pendingAnswers : {}}
    onAnswer={msg._id === lastUnansweredToolCallId ? handleAnswer : undefined}
    onNext={msg._id === lastUnansweredToolCallId ? handleNext : undefined}
    onSubmit={
      msg._id === lastUnansweredToolCallId && msg.toolCallId
        ? () => handleSubmitAnswers(msg.toolCallId!)
        : undefined
    }
    questionDisabled={isSending || isStreaming}
  />
);
```

**Step 6: Type-check**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 7: Commit**
```bash
git add src/components/ChatInterface.tsx
git commit -m "feat: wire AskUserQuestion answer state and answerQuestion action in ChatInterface"
```

---

### Task 8: Smoke test

> Requires: `npx convex dev` running in one terminal, `npm run dev` in another.

**Step 1: Open browser at http://localhost:5173, sign in, start a new chat**

**Step 2: Type a prompt**
```
Create a pitch deck for my startup
```

**Expected:** Claude's response should appear as an interactive question card (not raw XML), showing "Purpose" as the first question with 4 clickable options.

**Step 3: Click an option (e.g. "Startup pitch") → verify it highlights**

**Step 4: Click "Next →" → verify the next question (Length or Content) appears with a progress bar updating**

**Step 5: Complete all questions → click "Submit →"**

**Expected:** Claude continues, either generating style previews or asking follow-up questions.

**Step 6: Verify tool result rows are not visible in the UI**

The hidden `toolResultFor` messages should not appear as visible chat bubbles.

---

### Task 9: Final commit + summary

```bash
git log --oneline -8
```

Verify you see commits for each task. The feature is complete.
