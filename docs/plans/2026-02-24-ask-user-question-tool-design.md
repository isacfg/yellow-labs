# Design: AskUserQuestion Anthropic Tool

**Date:** 2026-02-24
**Status:** Approved

## Problem

The `frontend-slides` skill system prompt instructs Claude to call `AskUserQuestion`, a Claude Code MCP tool. When Claude is invoked via the raw Anthropic API (in `convex/ai.ts`), that tool doesn't exist, so Claude outputs raw `<invoke>` XML as literal text in the chat.

## Solution

Implement `AskUserQuestion` as a proper Anthropic tool in the Convex action, and render the resulting tool calls as interactive question cards in the UI. Questions are answered one at a time.

---

## Section 1 — Schema

Add 3 optional fields to the `messages` table in `convex/schema.ts`:

| Field | Type | Purpose |
|---|---|---|
| `toolCallId` | `string?` | Anthropic tool_use id (e.g. `toolu_01abc`) |
| `toolCallInput` | `string?` | JSON-serialized `questions` array from the tool input |
| `toolResultFor` | `string?` | If this row is a tool_result, the `tool_use_id` it answers |

- Messages with `toolCallId` are rendered as question cards in the UI.
- Messages with `toolResultFor` are hidden from the UI — they exist only for conversation history reconstruction.

---

## Section 2 — Convex AI Action

### `sendMessage` changes (`convex/ai.ts`)

1. Pass `AskUserQuestion` in the `tools` array to `client.messages.stream(...)`:
   ```ts
   tools: [{
     name: "AskUserQuestion",
     description: "Ask the user one or more questions with multiple choice options",
     input_schema: {
       type: "object",
       properties: {
         questions: {
           type: "array",
           items: {
             type: "object",
             properties: {
               header: { type: "string" },
               question: { type: "string" },
               options: {
                 type: "array",
                 items: {
                   type: "object",
                   properties: {
                     label: { type: "string" },
                     description: { type: "string" }
                   },
                   required: ["label", "description"]
                 }
               },
               multiSelect: { type: "boolean" }
             },
             required: ["header", "question", "options"]
           }
         }
       },
       required: ["questions"]
     }
   }]
   ```

2. In the streaming loop:
   - `content_block_start` with `type: "tool_use"` → record the tool_use id and name, switch to tool-collection mode
   - `content_block_delta` with `type: "input_json_delta"` → accumulate `partial_json`
   - `content_block_stop` (when in tool mode) → call `internal.messages.saveToolCall`, exit

3. Action returns early after saving the tool call — Claude generation is paused. No `finalize` call.

### New `answerQuestion` action (`convex/ai.ts`)

Signature: `{ conversationId, toolCallId, answers: string }` (answers = JSON of `{ [questionIndex]: label }`)

Steps:
1. Auth check
2. Save a hidden `user` message row with `toolResultFor = toolCallId`, `content = answers`
3. Rebuild conversation history via updated `listForAI`
4. Re-invoke Claude with the same streaming loop (text + tool_use detection)

### `listForAI` update (`convex/messages.ts`)

Change return type to return raw message rows (with all fields). The action transforms them into `Anthropic.MessageParam[]`:

- Normal text rows → `{ role, content: string }`
- Tool_use rows → `{ role: "assistant", content: [{ type: "tool_use", id, name, input: parsed }] }`
- Tool_result rows → `{ role: "user", content: [{ type: "tool_result", tool_use_id, content }] }`

### New mutations (`convex/messages.ts`)

- `internal.messages.saveToolCall({ messageId, toolCallId, toolCallInput })` — patches the message with tool call fields and sets `isStreaming: false`

---

## Section 3 — Frontend

### One question at a time UX

When a message has `toolCallId` set, parse `toolCallInput` JSON to get the `questions` array. Show questions one at a time. Track `currentQuestionIdx` and `pendingAnswers` in `ChatInterface` state. When all questions are answered, call `answerQuestion`.

### New component: `AskUserQuestionCard`

Props: `questions`, `currentQuestionIdx`, `onAnswer(idx, label)`, `onSubmit()`, `disabled`

Renders:
- Header badge (e.g. "Purpose")
- Question text
- Option cards (label + description, clickable)
- Selected state per option
- "Continue →" button after last question answered

### `ChatMessage.tsx` changes

- Add `toolCallId?: string` and `toolCallInput?: string` to `Message` interface
- New render branch: if `toolCallId`, render `<AskUserQuestionCard />`
- Add props: `currentQuestionIdx`, `onAnswer`, `onSubmit`, `questionAnswerDisabled`
- Tool_result rows (`toolResultFor` set) are filtered out before rendering

### `ChatInterface.tsx` changes

- State: `pendingAnswers: Record<number, string>`, `currentQuestionIdx: number`
- `handleAnswer(idx, label)` — updates state, advances index
- `handleSubmitAnswers()` — calls `answerQuestion` action, resets state
- Pass `currentQuestionIdx`, `onAnswer`, `onSubmit` to `ChatMessage`

### SKILL.md / content.ts revert

Remove the "do NOT use any tools" instructions added in the previous session, restoring the original `AskUserQuestion` invocation instructions.

---

## Files Touched

| File | Change |
|---|---|
| `convex/schema.ts` | Add 3 fields to messages table |
| `convex/messages.ts` | New `saveToolCall` mutation; update `listForAI` return type |
| `convex/ai.ts` | Tool definition, tool_use streaming, new `answerQuestion` action |
| `src/components/AskUserQuestionCard.tsx` | New component |
| `src/components/ChatMessage.tsx` | New render branch + new props |
| `src/components/ChatInterface.tsx` | Answer state + `answerQuestion` call |
| `convex/skill/SKILL.md` | Revert "do NOT use tools" instruction |
| `convex/skill/content.ts` | Revert "do NOT use tools" instruction |
