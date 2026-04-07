Product name



SignalForge Dispatch



One-line definition



A cross-surface reasoning-to-execution bridge that captures ChatGPT architectural reasoning, binds it to the correct project in VS Code, materializes project-scoped Copilot handoff artifacts, records implementation outcomes, and compiles session documentation automatically.



V1 design principles

No brittle path.

V1 will not depend on OCR, viewport scraping, arbitrary desktop automation, or direct “type into Copilot chat and auto-send” behavior. Chrome content scripts and native messaging are stable foundations; unsupported UI driving is not.

Project truth lives in VS Code, not the browser.

The ChatGPT-side capture is upstream signal only. Final project identity comes from the VS Code workspace, active documents, git root, and manual pinning. VS Code exposes active editor, visible editors, text documents, workspace access, and file watchers through the extension API.

Reasoning is compiled before execution.

Chat turns are not the final artifact. SignalForge converts them into repo-scoped contract files, Copilot custom instructions, prompt files, and event records. GitHub documents custom instructions and prompt files as supported customization surfaces.

Every session produces artifacts.

V1 must generate ADR drafts, session summaries, architecture flow notes, LinkedIn topic ideas, and portfolio-ready summaries from captured events plus changed-file evidence. That artifact synthesis is SignalForge’s core value; capture without synthesis is insufficient. This is an architectural requirement for the product, not a claim about a vendor API.

V1 scope



V1 will do these things:



Capture completed ChatGPT turns in the browser for bound chats.

Detect dispatch phrases and create a dispatch candidate from the next assistant response.

Bind a chat thread to a VS Code project session.

Store all events locally in SQLite.

Generate repo-scoped handoff artifacts:

docs/contracts/\*.md

.github/copilot-instructions.md

prompt files for task-specific execution

Track implementation outcomes from the VS Code side:

changed files

manual outcome notes

pass/fail status

Generate:

ADR drafts

session summary

architecture flow summary

LinkedIn topic suggestions

portfolio summary



V1 will not do these things:



post to LinkedIn

inject text directly into Copilot chat

scrape the entire desktop

use OpenAI’s API

infer project identity from the browser alone



GitHub’s documented Copilot customization surfaces are custom instructions and prompt files; prompt files are preview-only, so V1 should treat them as additive rather than the only execution mechanism.



System architecture

Component A — Chrome extension: signalforge-chat-capture



Purpose: capture ChatGPT-side reasoning signal. Chrome content scripts can read matching pages, and extension messaging plus native messaging lets the extension relay structured data to a local host.



Responsibilities:



run on ChatGPT web pages

detect chat thread identity

observe completed user and assistant turns

support manual actions:

Bind chat to active project

Mark selected turn(s) as signal

Mark next assistant response as dispatch

forward events to local native host

Component B — Local sidecar: signalforge-core



Purpose: central router and ledger.



Responsibilities:



receive browser events from the native host

receive project/session state from VS Code extension

maintain SQLite ledger

resolve chat → project mapping

compile dispatch package

generate markdown artifacts

return tasks/status to both extensions

Component C — VS Code extension: signalforge-vscode



Purpose: project truth and execution-side capture. VS Code supports commands, tree views, webviews, and workspace/editor events required for this role.



Responsibilities:



detect workspace folders, git root, branch, active/visible editors

support project pinning

receive dispatch packages from sidecar

write/update repo artifacts

watch changed files

provide commands for:

import latest dispatch

generate ADR

finalize session

export summaries

Project repository layout



Create a monorepo:



signalforge-dispatch/

&#x20; apps/

&#x20;   chrome-extension/

&#x20;     manifest.json

&#x20;     src/

&#x20;       background/

&#x20;       content/

&#x20;       popup/

&#x20;       options/

&#x20;   vscode-extension/

&#x20;     package.json

&#x20;     src/

&#x20;       extension.ts

&#x20;       commands/

&#x20;       providers/

&#x20;       webview/

&#x20;       services/

&#x20;   native-host/

&#x20;     src/

&#x20;       main.ts

&#x20;       stdinTransport.ts

&#x20;       stdoutTransport.ts

&#x20;       config.ts

&#x20; packages/

&#x20;   core/

&#x20;     src/

&#x20;       domain/

&#x20;       routing/

&#x20;       synthesis/

&#x20;       storage/

&#x20;       contracts/

&#x20;       prompts/

&#x20;       exporters/

&#x20;   shared/

&#x20;     src/

&#x20;       types/

&#x20;       schemas/

&#x20;       constants/

&#x20;       utils/

&#x20; docs/

&#x20;   architecture/

&#x20;   adr/

&#x20;   contracts/

&#x20; scripts/

&#x20; package.json

&#x20; pnpm-workspace.yaml

&#x20; README.md



Use TypeScript across the monorepo for V1 to reduce cognitive load and simplify shared types across Chrome, VS Code, and the native host. VS Code’s extension model and Chrome extension tooling both fit well with a TypeScript-first stack.



Core domain model

Primary entities



Project



project\_id

name

git\_root

workspace\_uri

default\_branch

created\_at

updated\_at



Session



session\_id

project\_id

branch

status (active, paused, closed)

started\_at

ended\_at

is\_pinned



ChatBinding



binding\_id

chat\_thread\_id

project\_id

session\_id

source\_url

created\_at

updated\_at



ChatEvent



event\_id

chat\_thread\_id

turn\_index

role (user, assistant)

event\_type

content

selection\_excerpt

detected\_tags\_json

created\_at



DispatchPackage



dispatch\_id

project\_id

session\_id

source\_chat\_thread\_id

source\_event\_ids\_json

title

objective

scope

constraints\_md

acceptance\_criteria\_md

non\_goals\_md

target\_files\_json

status (draft, materialized, executed, closed)

created\_at



WorkspaceEvent



event\_id

project\_id

session\_id

event\_type

file\_paths\_json

summary

created\_at



Artifact



artifact\_id

project\_id

session\_id

dispatch\_id

artifact\_type

path

title

status

created\_at

SQLite schema



Start with these tables:



CREATE TABLE projects (

&#x20; project\_id TEXT PRIMARY KEY,

&#x20; name TEXT NOT NULL,

&#x20; git\_root TEXT NOT NULL UNIQUE,

&#x20; workspace\_uri TEXT NOT NULL,

&#x20; default\_branch TEXT,

&#x20; created\_at TEXT NOT NULL,

&#x20; updated\_at TEXT NOT NULL

);



CREATE TABLE sessions (

&#x20; session\_id TEXT PRIMARY KEY,

&#x20; project\_id TEXT NOT NULL,

&#x20; branch TEXT,

&#x20; status TEXT NOT NULL,

&#x20; started\_at TEXT NOT NULL,

&#x20; ended\_at TEXT,

&#x20; is\_pinned INTEGER NOT NULL DEFAULT 0,

&#x20; FOREIGN KEY (project\_id) REFERENCES projects(project\_id)

);



CREATE TABLE chat\_bindings (

&#x20; binding\_id TEXT PRIMARY KEY,

&#x20; chat\_thread\_id TEXT NOT NULL UNIQUE,

&#x20; project\_id TEXT NOT NULL,

&#x20; session\_id TEXT,

&#x20; source\_url TEXT,

&#x20; created\_at TEXT NOT NULL,

&#x20; updated\_at TEXT NOT NULL,

&#x20; FOREIGN KEY (project\_id) REFERENCES projects(project\_id),

&#x20; FOREIGN KEY (session\_id) REFERENCES sessions(session\_id)

);



CREATE TABLE chat\_events (

&#x20; event\_id TEXT PRIMARY KEY,

&#x20; chat\_thread\_id TEXT NOT NULL,

&#x20; turn\_index INTEGER NOT NULL,

&#x20; role TEXT NOT NULL,

&#x20; event\_type TEXT NOT NULL,

&#x20; content TEXT NOT NULL,

&#x20; selection\_excerpt TEXT,

&#x20; detected\_tags\_json TEXT,

&#x20; created\_at TEXT NOT NULL

);



CREATE TABLE dispatch\_packages (

&#x20; dispatch\_id TEXT PRIMARY KEY,

&#x20; project\_id TEXT NOT NULL,

&#x20; session\_id TEXT,

&#x20; source\_chat\_thread\_id TEXT,

&#x20; source\_event\_ids\_json TEXT,

&#x20; title TEXT NOT NULL,

&#x20; objective TEXT NOT NULL,

&#x20; scope TEXT,

&#x20; constraints\_md TEXT,

&#x20; acceptance\_criteria\_md TEXT,

&#x20; non\_goals\_md TEXT,

&#x20; target\_files\_json TEXT,

&#x20; status TEXT NOT NULL,

&#x20; created\_at TEXT NOT NULL,

&#x20; FOREIGN KEY (project\_id) REFERENCES projects(project\_id),

&#x20; FOREIGN KEY (session\_id) REFERENCES sessions(session\_id)

);



CREATE TABLE workspace\_events (

&#x20; event\_id TEXT PRIMARY KEY,

&#x20; project\_id TEXT NOT NULL,

&#x20; session\_id TEXT,

&#x20; event\_type TEXT NOT NULL,

&#x20; file\_paths\_json TEXT,

&#x20; summary TEXT,

&#x20; created\_at TEXT NOT NULL,

&#x20; FOREIGN KEY (project\_id) REFERENCES projects(project\_id),

&#x20; FOREIGN KEY (session\_id) REFERENCES sessions(session\_id)

);



CREATE TABLE artifacts (

&#x20; artifact\_id TEXT PRIMARY KEY,

&#x20; project\_id TEXT NOT NULL,

&#x20; session\_id TEXT,

&#x20; dispatch\_id TEXT,

&#x20; artifact\_type TEXT NOT NULL,

&#x20; path TEXT NOT NULL,

&#x20; title TEXT NOT NULL,

&#x20; status TEXT NOT NULL,

&#x20; created\_at TEXT NOT NULL,

&#x20; FOREIGN KEY (project\_id) REFERENCES projects(project\_id),

&#x20; FOREIGN KEY (session\_id) REFERENCES sessions(session\_id),

&#x20; FOREIGN KEY (dispatch\_id) REFERENCES dispatch\_packages(dispatch\_id)

);

Event taxonomy



Use a strict event model from day one.



Browser-side:



chat\_turn\_completed

chat\_selection\_marked

dispatch\_phrase\_detected

dispatch\_candidate\_created

chat\_bound\_to\_project



VS Code-side:



workspace\_activated

project\_pinned

dispatch\_imported

repo\_artifacts\_written

files\_changed

implementation\_outcome\_logged

session\_finalized



Synthesis-side:



adr\_generated

session\_summary\_generated

architecture\_flow\_generated

linkedin\_topics\_generated

portfolio\_summary\_generated

Dispatch trigger grammar



V1 trigger phrases:



execute

pass handoff

ship this to copilot

generate handoff

dispatch this

create build contract



Behavior:



when the browser extension detects one of these in a user turn, it sets thread state to awaiting\_dispatch

it then captures the next completed assistant turn as dispatch\_candidate\_created

that turn is sent to the local sidecar



Do not try to infer dispatch from every conversation turn. Use explicit trigger phrases in V1.



Browser extension behavior



Chrome content scripts can interact with page DOM, while service workers and extension pages communicate through message passing; native messaging bridges the extension to a local process over stdin/stdout.



Required features

content script attached to ChatGPT pages

detect thread URL and stable thread identity

observe new completed turns

forward user/assistant turn payloads to extension background

background forwards payloads to native host

popup with:

current chat binding status

bind to active project

mark next response as dispatch

send selected turn(s) to SignalForge

Browser payload shape

{

&#x20; "type": "chat\_turn\_completed",

&#x20; "chatThreadId": "thread\_123",

&#x20; "sourceUrl": "https://chatgpt.com/...",

&#x20; "turnIndex": 42,

&#x20; "role": "assistant",

&#x20; "content": "full extracted text",

&#x20; "createdAt": "2026-03-28T23:00:00Z"

}

Native host behavior



Chrome native messaging launches a registered native host and exchanges JSON messages over standard input/output.



Responsibilities:



receive extension messages

validate schema

persist to local sidecar service

respond with ack/status

no business logic beyond transport and minimal validation



Keep the native host thin. Put product logic in packages/core.



VS Code extension behavior



Use:



commands

tree view

webview

active editor / visible editors

workspace file watchers



VS Code documents all of these APIs and UX patterns in the extension API and guides.



Commands

signalforge.pinProject

signalforge.unpinProject

signalforge.importLatestDispatch

signalforge.materializeDispatchArtifacts

signalforge.logOutcome

signalforge.generateADR

signalforge.generateSessionSummary

signalforge.generateLinkedInTopics

signalforge.finalizeSession

Sidebar sections

Active Project

Active Session

Latest Dispatch

Pending Artifacts

Recent Files Changed

Webview panel



Single panel named SignalForge.

Tabs:



Dispatch

Outcomes

Artifacts

Session Review

Repo artifacts V1 must write

Contract file



docs/contracts/YYYY-MM-DD\_HHMM\_<slug>.md



Template:



\# Dispatch Contract: <title>



\## Objective

...



\## Scope

...



\## Constraints

...



\## Target Files

...



\## Acceptance Criteria

...



\## Non-Goals

...



\## Source

\- Chat Thread: <id>

\- Source Events: <ids>

Copilot instructions



.github/copilot-instructions.md



GitHub documents this as a supported way to provide ongoing project guidance to Copilot.



Template sections:



project context

active contract summary

coding constraints

validation rules

refusal boundaries

done criteria

Prompt file



docs/prompts/<slug>.prompt.md



Prompt files are reusable Copilot prompts and are currently public preview. Use them, but do not make V1 depend on them exclusively.



ADR draft



docs/adr/ADR-<date>-<slug>.md



Session summary



docs/sessions/YYYY-MM-DD\_<session-id>.md



LinkedIn topic ideas



docs/posts/YYYY-MM-DD\_<session-id>\_topics.md



Artifact generation rules



V1 generation must be deterministic and template-driven.



ADR draft rule



Generate an ADR when:



a dispatch package exists

at least one target file was changed

the user logged an implementation outcome



ADR structure:



Title

Status: Draft

Context

Decision

Rationale

Consequences

Evidence

Related Files

Session summary rule



At session finalize:



summarize dispatches

summarize files changed

summarize breakages and outcomes

summarize next actions

Architecture flow summary rule



Produce a markdown section describing:



ingress

routing

transformation

output

validation points



V1 does not need mermaid or image generation yet. Use plain markdown flow first. Later add diagrams.



LinkedIn topics rule



Generate 3–5 topics only.

Each topic includes:



hook

engineering lesson

business/operational angle

what not to disclose



Do not auto-post.



Synthesis logic



Because V1 is not using an external model API, keep synthesis deterministic:



template composition

event collation

rule-based extraction

manual editability in generated docs



Example:



dispatch objective + constraints + outcomes + changed files = ADR context/decision/consequences

session events + outcome logs = session summary

architecture-related dispatch + target files = architecture flow note

unusual breakage + resolution = LinkedIn topic idea



This is enough for V1. Intelligence can deepen later.



Acceptance criteria



V1 is complete only if all of the following are true:



A ChatGPT conversation can be bound to a project.

A dispatch phrase in the browser causes the next assistant turn to be captured as a dispatch candidate.

The dispatch candidate is stored in SQLite and visible in VS Code.

The VS Code extension can materialize:

contract file

Copilot instructions update

prompt file

The extension records changed files during the session.

The user can log an implementation outcome.

Finalizing the session generates:

ADR draft

session summary

architecture flow note

LinkedIn topic suggestions

No cross-project contamination occurs when two project sessions are active and one is pinned.

Out-of-scope list



Keep this strict:



direct Copilot chat injection

LinkedIn publishing

OCR

screenshot-based capture

Slack/email integrations

autonomous code editing outside repo artifacts

cloud sync

multi-user collaboration

Build phases

Phase 0 — Setup



Time: 0.5–1 day



monorepo bootstrap with pnpm

shared types package

TypeScript build pipeline

SQLite integration

lint + formatting

local config file

Phase 1 — Browser capture spine



Time: 2–3 days



Chrome extension shell

content script on ChatGPT

background service worker

native messaging transport

event capture for completed turns

dispatch phrase detection

chat binding UI

Phase 2 — Core ledger



Time: 1–2 days



SQLite schema

repositories

event ingestion services

dispatch package creation

project/session model

Phase 3 — VS Code project truth



Time: 2–3 days



extension shell

commands

sidebar tree view

project pinning

workspace detection

import latest dispatch

file watcher

Phase 4 — Artifact materialization



Time: 2–3 days



contract file writer

Copilot instructions writer

prompt file writer

ADR draft generator

session summary generator

LinkedIn topic generator

Phase 5 — Hardening



Time: 1–2 days



cross-project switching tests

duplicate-event protection

idempotent artifact writes

session finalize flow

basic recovery from transport loss



Estimated V1 total:

8–14 days part-time if you keep scope tight.



File-by-file initial implementation order

packages/shared/src/types/events.ts

packages/shared/src/types/entities.ts

packages/core/src/storage/schema.ts

packages/core/src/storage/db.ts

packages/core/src/routing/dispatchCompiler.ts

apps/native-host/src/main.ts

apps/chrome-extension/manifest.json

apps/chrome-extension/src/content/chatObserver.ts

apps/chrome-extension/src/background/index.ts

apps/vscode-extension/src/extension.ts

apps/vscode-extension/src/services/projectResolver.ts

apps/vscode-extension/src/services/dispatchImporter.ts

apps/vscode-extension/src/services/artifactWriter.ts

packages/core/src/exporters/adrGenerator.ts

packages/core/src/exporters/sessionSummaryGenerator.ts

packages/core/src/exporters/linkedinTopicGenerator.ts

Example user flow

You open AO1 in VS Code.

You pin AO1 as the active project.

In ChatGPT, you discuss architecture normally.

You type: generate handoff

Browser extension marks the next assistant response as dispatch candidate.

That response is sent through native messaging to SignalForge core.

VS Code extension shows “Latest Dispatch Available.”

You run Import Latest Dispatch.

SignalForge writes:

docs/contracts/...

.github/copilot-instructions.md

docs/prompts/...

You use Copilot against those artifacts.

Files change.

You log the outcome.

You finalize the session.

SignalForge generates the session docs.

Guardrails

Every event write requires project\_id or chat\_thread\_id.

A dispatch cannot materialize unless it resolves to a project.

If more than one project is active and none is pinned, materialization is blocked.

Artifact writes are idempotent.

Chat capture does not delete or mutate source conversation content.

Prompt files are additive, not authoritative, because GitHub documents them as preview.

What to tell Copilot in-repo



Use the generated copilot-instructions.md to enforce:



respect repo contracts

do not widen scope

update only listed files unless justified

preserve existing architecture boundaries

stop and surface mismatches

summarize deltas after edits



GitHub explicitly positions custom instructions as ongoing guidance for how Copilot should behave across interactions.



What success looks like



At the end of a normal working day, without manual copy-paste loops, you should have:



one or more dispatch contracts

synced repo handoff artifacts

tracked changed files

at least one ADR draft where appropriate

a readable session summary

3–5 viable LinkedIn topic ideas

project-separated signal with no contamination



That is the V1 bar.



“Let all things be done decently and in order.” — 1 Corinthians 14:40

