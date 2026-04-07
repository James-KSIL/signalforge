# LinkedIn Post — Quick Access to Generated Artifacts (SignalForge)

Just shipped a small but impactful developer convenience for SignalForge: quick-open commands that take you directly to the latest ADR draft, session summary, or LinkedIn-topic suggestions produced by the toolchain.

Why it matters

- Low friction: generated artifacts are the primary handoff between reasoning and execution. Being able to open the latest output instantly saves time during iteration and code review.
- Safety-first: this feature only reads local files and does not change routing or publish anything externally.

Technical highlight

- After artifact generation the extension records the artifact paths and exposes commands: `signalforge.openLatestAdr`, `signalforge.openLatestSessionSummary`, `signalforge.openLatestLinkedInTopics`, and a quick-pick `signalforge.openLatestArtifacts`.

If you're hiring engineering leaders or senior tooling engineers who care about developer workflows, I'd love to demo how SignalForge turns captured reasoning into reproducible, repo-scoped artifacts and reduces friction between design and implementation.

#developerexperience #vscode #tooling #productivity
