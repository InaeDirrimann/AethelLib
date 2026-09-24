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
