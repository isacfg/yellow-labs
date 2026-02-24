# Slides AI — Frontend Slides SaaS

AI-powered HTML presentation generator. Describe your topic, choose a visual style, and get a stunning, animation-rich HTML presentation.

## Stack

- **Frontend**: Vite + React 18 + TypeScript + TailwindCSS + shadcn/ui
- **Backend/DB**: Convex (reactive, streaming)
- **Auth**: Convex Auth (email/password)
- **AI**: Anthropic Claude (claude-sonnet-4-6) via Convex Actions

## Setup

### 1. Initialize Convex

```bash
npx convex dev
```

Follow the prompts to create a Convex account and project. This will populate `.env.local` with `VITE_CONVEX_URL`.

### 2. Set Anthropic API Key

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

This key lives only in Convex — never exposed to the browser.

### 3. Run Development

In two terminals:

```bash
# Terminal 1: Convex backend (keep running)
npx convex dev

# Terminal 2: Vite frontend
npm run dev
```

Visit http://localhost:5173

## Usage Flow

1. Sign up at `/auth`
2. Go to `/chat` to start a new presentation
3. Describe your topic, audience, and goals
4. Claude responds with **3 style previews** — click one to select it
5. Claude generates the full presentation
6. View at `/p/{slug}`, download as `.html`, or copy share link
7. Access all your presentations from `/dashboard`

## Updating Skill Content

If you update `convex/skill/SKILL.md` or `convex/skill/STYLE_PRESETS.md`, regenerate `content.ts`:

```bash
python3 -c "
import json
with open('convex/skill/SKILL.md') as f: skill = f.read()
with open('convex/skill/STYLE_PRESETS.md') as f: presets = f.read()
def esc(s): return s.replace('\`', '\\\`').replace('\${', '\\\${')
out = '// Auto-generated\\nexport const SKILL_MD = \`' + esc(skill) + '\`;\\nexport const STYLE_PRESETS_MD = \`' + esc(presets) + '\`;\\nexport const SYSTEM_PROMPT = SKILL_MD + \"\\\\n\\\\n\" + STYLE_PRESETS_MD;\\n'
with open('convex/skill/content.ts', 'w') as f: f.write(out)
print('Done')
"
```
