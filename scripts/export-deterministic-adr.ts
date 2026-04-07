/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { getDefaultDbPath } from '../packages/core/src/storage/db';
import { renderDeterministicAdr } from '../packages/core/src/artifacts/deterministicAdrRenderer';

type OutcomeRow = {
  outcome_id: string;
  project_id: string;
  session_id: string;
  dispatch_id: string;
  contract_ref: string | null;
  artifact_ref: string | null;
  verification_ref?: string | null;
  outcome_summary?: string;
  outcome_status: string;
  source?: string;
  rejection_reason?: string | null;
  created_at?: string | null;
};

type CandidateRow = {
  candidate_id: string;
  project_id: string;
  session_id: string;
  dispatch_id: string;
  contract_ref?: string | null;
  captured_at?: string;
  source?: string;
  raw_text?: string;
  content_hash?: string | null;
  capture_context_json?: string | null;
  diagnostic_score?: number | null;
  gate_pass?: number | null;
  gate_failure_reason?: string | null;
  failed_invariants_json?: string | null;
  signal_flags_json?: string | null;
  validation_status?: string | null;
};

type ArtifactRow = {
  artifact_id: string;
  candidate_id: string;
  project_id: string;
  session_id: string;
  dispatch_id: string;
  validated_at?: string;
  raw_text?: string;
  extracted_file_refs_json?: string | null;
  git_correlation_json?: string | null;
  validation_evidence_json?: string | null;
  source?: string;
  artifact_type?: string;
};

function usage(): never {
  console.error(
    'Usage:\n' +
      'npx tsx scripts/export-deterministic-adr.ts --outcome <outcome_id>\n' +
      'npx tsx scripts/export-deterministic-adr.ts --latest\n'
  );
  process.exit(1);
  throw new Error('unreachable');
}

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const value = process.argv[idx + 1] ?? null;
  if (!value || value.startsWith('--')) return null;
  return value;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function getRequired<T>(
  db: any,
  sql: string,
  params: unknown[],
  label: string
): Promise<T> {
  const row = await new Promise<any>((resolve, reject) => {
    db.get(sql, params, (err: any, result: any) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(result);
    });
  });
  if (!row) {
    throw new Error(`Missing required ${label}. Query params: ${JSON.stringify(params)}`);
  }
  return row as T;
}

async function resolveLatestOutcomeId(db: any): Promise<string> {
  const row = await new Promise<any>((resolve, reject) => {
    db.get(
      `
      SELECT ol.outcome_id
      FROM outcome_logs ol
      LEFT JOIN copilot_execution_artifacts art ON art.artifact_id = ol.artifact_ref
      LEFT JOIN copilot_candidate_staging ccs ON ccs.candidate_id = art.candidate_id
      WHERE ol.outcome_status = 'success'
         OR ccs.validation_status = 'promoted'
      ORDER BY ol.created_at DESC
      LIMIT 1
      `,
      [],
      (err: any, result: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      }
    );
  });

  if (!row || typeof row.outcome_id !== 'string' || !row.outcome_id.trim()) {
    throw new Error('[SignalForge] No eligible outcomes found for --latest');
  }

  return row.outcome_id;
}

async function main(): Promise<void> {
  const outcomeIdArg = getArg('--outcome');
  const latestFlag = hasFlag('--latest');

  if ((outcomeIdArg ? 1 : 0) + (latestFlag ? 1 : 0) !== 1) {
    usage();
  }

  const sqlite3 = require('sqlite3').verbose();
  const dbPath = getDefaultDbPath();
  const db = new sqlite3.Database(dbPath);

  try {
    const selectedOutcomeId = latestFlag
      ? await resolveLatestOutcomeId(db)
      : (outcomeIdArg as string);

    const outcome = await getRequired<OutcomeRow>(
      db,
      `
      SELECT *
      FROM outcome_logs
      WHERE outcome_id = ?
      `,
      [selectedOutcomeId],
      'outcome row'
    );

    if (!outcome.artifact_ref) {
      throw new Error(`Resolved outcome is missing artifact_ref. outcome_id=${outcome.outcome_id}`);
    }

    const artifact = await getRequired<ArtifactRow>(
      db,
      `
      SELECT *
      FROM copilot_execution_artifacts
      WHERE artifact_id = ?
      `,
      [outcome.artifact_ref],
      'artifact row'
    );

    const candidateId = artifact.candidate_id;

    const candidate = await getRequired<CandidateRow>(
      db,
      `
      SELECT *
      FROM copilot_candidate_staging
      WHERE candidate_id = ?
      `,
      [candidateId],
      'candidate row'
    );

    const contractRef = outcome.contract_ref ?? null;
    const contract = null;

    const bundle = {
      outcome: {
        ...outcome,
        candidate_id: candidateId,
        contract_ref: contractRef,
      },
      candidate: {
        ...candidate,
        contract_ref: contractRef,
      },
      artifact,
      contract,
    };

    const adr = renderDeterministicAdr(bundle as any);

    const outDir = path.resolve(process.cwd(), 'artifacts', 'adrs');
    fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, `ADR-${adr.adr_id}.md`);
    fs.writeFileSync(outPath, adr.markdown, 'utf8');

    console.log('[SignalForge] ADR generated');
    console.log(`adr_id: ${adr.adr_id}`);
    console.log(`path: ${outPath}`);
  } finally {
    await new Promise<void>((resolve) => {
      if (!db || typeof db.close !== 'function') {
        resolve();
        return;
      }

      db.close(() => resolve());
    });
  }
}

main().catch((err) => {
  console.error('[SignalForge] ADR export failed');
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
