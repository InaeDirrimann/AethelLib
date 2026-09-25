# Project Ground Rules: AethelLib Engine

## 1. Operating Protocol: Claude-Tier Execution Discipline
You are pair programming on a high-performance Minecraft Bedrock engine. To operate with peak reasoning, absolute zero hallucination, and flawless execution regardless of the underlying LLM model, enforce these mandatory behaviors:

---

### A. The Prompt Untangler: Intent Over Syntax
- **De-Obfuscate User Input**: The user communicates in rapid, stream-of-consciousness, typo-heavy, informal shorthand. 
- **Extract the Core Technical Intent**: NEVER get tripped up by phonetic spellings, missing punctuation, or chaotic phrasing. Immediately translate the prompt into its true engineering requirement:
  - *"check of thid entire plaxe is ai slop"* ➔ Audit full repository for hallucinated APIs, broken patterns, and fake architecture.
  - *"make llm by defsult untsnge udee peomot"* ➔ Autonomously parse user intent and execute the underlying fix without asking trivial clarifying questions.
- **Zero Open-Ended Slop**: Never respond with generic, hand-waving boilerplate, vague lists of suggestions, or ungrounded assistant fluff. Provide sharp, production-ready code backed by verified data flows.

---

### B. The "Read First, Never Guess" Mandate
- **No Blind Coding**: Before proposing or executing ANY change, your FIRST action must ALWAYS be inspection. You MUST call `view_file`, `run_command` (grep/find), or inspect definitions before editing.
- **Inspect Surrounding Context**: Always verify line numbers, variable scopes, import names, and function signatures in the actual live file before calling `replace_file_content`.
- **Bedrock Types Ground Truth**: The absolute source of truth for all Minecraft APIs is:
  - `node_modules/@minecraft/server/index.d.ts`
  - `node_modules/@minecraft/server-ui/index.d.ts`
  NEVER guess method names, parameter types, or events from training memory. If you aren't 100% certain of an API signature, read the `.d.ts` file immediately.

---

### C. Proactive Subagent Spawning (Default Behavior)
- **Multi-File Audits & Heavy Sweeps**: Do NOT clog the main conversation context reading 20 files sequentially. When tasked with auditing systems, checking API compliance across commands, or surveying multiple modules, **IMMEDIATELY spawn a `research` or specialized subagent** via `invoke_subagent`.
- **Parallel Workstreams**: Delegate heavy codebase sweeps, `.d.ts` cross-referencing, and multi-file searches to subagents so the parent agent maintains clean architecture oversight.

---

### D. Trace the Complete Data Flow
- When diagnosing a bug or adding a feature, trace the ENTIRE execution pipeline:
  `Player Input / Chat / Command ➔ Registration ➔ Middleware / Dispatch ➔ Business Logic ➔ Storage / Engine`
- Never apply cosmetic band-aids to a single line without verifying what called it and what consumes its output.

---

### E. The Verification Gate (Mandatory Run Commands)
- **Zero Syntax Errors**: After modifying ANY JavaScript file, ALWAYS run the Acorn syntax verification script (`node --input-type=module --eval "..."`) across all modified modules.
- **Zero Broken Imports**: Verify all relative import paths (`.js` extension required for ES modules).
- **Zero Assumptions**: A task is never complete until verified with working command output.

---

### F. Anti-Slop & Anti-Hallucination Directives
- **No Early-Execution Traps**: Module roots must NEVER execute `world.afterEvents.*.subscribe()`, `system.runInterval()`, or state queries. Everything event-driven must be wrapped in explicit `init()` functions called during deferred boot (`bootstrap/core.js` or `bootstrap/systems.js`).
- **No Fake Return Heuristics**: Never guess return values based on method name substrings (e.g. `balance -> 0`). Throw explicit errors (e.g. `FeatureDisabledError`) so failures fail loudly and cleanly.
- **De-Larping**: Ban sci-fi buzzwords in production code (`QUANTUM_DATA_STREAM`, `INDUSTRIAL_ASSET_MATRIX`, etc.). Use clean, direct engineering language.
- **Bedrock Native Command Rules**: 
  - Native C++ custom commands only consume single words for `String` parameters unless wrapped in quotes.
  - Multi-word sentence commands (`ban`, `kick`, `broadcast`, `report`, `msg`) must be marked `native: false` so they route through the chat intercept pipeline.
  - Commands registered natively MUST define explicit `params` arrays so Bedrock doesn't wipe `rawArgs`.

---

### G. The 3-Pass Mental Dry Run (Pre-Flight Simulation)
Before proposing or executing code, the model must execute a 3-pass mental simulation:
1. **Pass 1: Failure Mode Simulation (Trace)**: Mentally step through the entire call chain. "What happens if this input is passed? Where does it crash? Does Bedrock throw an early-execution error? Does the C++ parser reject unquoted tokens? Does `rawArgs` get wiped?"
2. **Pass 2: Performance & Contract Audit**: Check hot paths, interval loops, unnecessary object allocations, GC pressure, and API type signatures. Flag and reject inefficient or fragile code on sight.
3. **Pass 3: Phased Step Execution**: Break complex tasks into discrete, verifiable phases (Phase 1: Inspection -> Phase 2: Patch -> Phase 3: Syntax Verification). Execute step-by-step and verify with terminal commands before reporting back.

---

## Agent Workflow Rules

1. RESEARCH FIRST, ALWAYS
   Before writing or editing any code, read the relevant files/modules yourself.
   Never assume a function signature, pattern, or convention — verify it exists
   by reading it. If you're touching an existing codebase, minimum 3+ files
   reviewed before proposing changes (skip this only for trivial single-line,
   single-file fixes).

2. CHEAP MODEL FOR CHEAP WORK
   Route pure search/read/grep/exploration tasks to the fastest/cheapest
   available model. Only escalate to the expensive model for actual code
   generation, architectural decisions, or complex multi-step reasoning.
   Never burn the expensive model on file discovery.

3. PLAN BEFORE YOU BUILD
   For anything beyond a one-line fix, produce a numbered step-by-step plan
   and present it before writing code. Wait for approval on non-trivial or
   ambiguous tasks; proceed automatically only on clearly-scoped small asks.

4. MAINTAIN A TODO LIST
   Track multi-step tasks as an explicit checklist. Update it as you complete
   each step. Never silently skip a step.

5. MATCH EXISTING CONVENTIONS
   Whatever style/pattern the research phase found in the codebase (naming,
   structure, error handling, etc.) — use that. Don't impose your own
   preferred pattern over what's already there.

6. STAY IN SCOPE
   Only touch files/lines necessary for the stated task. If you notice an
   unrelated issue, name it and defer it — don't fold it into this change.

7. MINIMAL DIFFS
   Smallest change that solves the problem. No drive-by refactors, no
   "while I'm here" rewrites, unless explicitly asked.

8. VERIFY BEFORE CLAIMING DONE
   Run the test suite / build / linter if one exists. State explicitly what
   was verified and what wasn't ("unmeasured" / "untested" — not implied
   as working). Never claim a fix works without running something to check.

9. GATE DESTRUCTIVE ACTIONS
   Anything irreversible (deletes, force pushes, schema migrations, prod
   config) — stop and ask first, don't just execute.

10. SUMMARIZE AT THE END
    After finishing, give a short summary: what changed, what was verified,
    what assumptions were made, what's still open/deferred.
