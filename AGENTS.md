
### 2. Full `AGENTS.md` (replace the entire file)

```md
# AGENTS.md AI coding guidelines

**Important rules**

1. Never rewrite published git history (force-push, rebase, amend, squash of already-pushed commits). Doing so breaks the Lovable history and the user can lose the project.
2. Keep the connected branch in a working state at all times. Every push is synced back into the Lovable editor.
3. Prefer full-file replacements over partial diffs when making large changes.
4. All game constants live in `src/lib/constants.ts`. Do not duplicate them.
5. Economy actions (shop, energy recover, daily claim, tasks, quests, nuke, token claims) must stay server-authoritative.
6. Nations system: WARDOG + WARCAT are permanent default factions. All other nations are fixed real-world countries. First joiner of an empty country becomes leader.
7. When adding new server functions, always use `createServerFn` + Zod validation + `requireUserId()`.
8. Schema changes must be additive (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`).
