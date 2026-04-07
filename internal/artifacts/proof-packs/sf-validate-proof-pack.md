# sf-validate proof pack

Baseline restored after capture.

## 1. Missing scope fail
Command: npx tsx scripts/sf-validate.ts
Output:
NOT SAFE
- Declared scope does not exist: artifacts/proof-packs/missing-scope/

## 2. Empty scope fail
Command: npx tsx scripts/sf-validate.ts
Output:
NOT SAFE
- Declared scope contains no files: artifacts/proof-packs/empty-scope/

## 3. TypeScript pass
Command: npx tsx scripts/sf-validate.ts
Output:
SAFE

## 4. Python fail
Command: npx tsx scripts/sf-validate.ts
Output:
NOT SAFE
- Declared scope contains no Python files: docs/
