import fs from "fs";
import path from "path";
import yaml from "yaml";

type Contract = {
  intent: string;
  constraints: string[];
  scope: string;
};

function loadContract(): Contract {
  const contractPath = path.resolve(process.cwd(), "signalforge.yaml");

  if (!fs.existsSync(contractPath)) {
    console.log("NOT SAFE");
    console.log("- signalforge.yaml not found in repo root");
    process.exit(1);
  }

  const file = fs.readFileSync(contractPath, "utf-8");
  return yaml.parse(file) as Contract;
}

function listFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateScopeExists(scope: string): string[] {
  const resolvedScope = path.resolve(process.cwd(), scope);

  if (!fs.existsSync(resolvedScope)) {
    return [`Declared scope does not exist: ${scope}`];
  }

  return [];
}

function validateScopeHasFiles(scope: string, files: string[]): string[] {
  if (files.length === 0) {
    return [`Declared scope contains no files: ${scope}`];
  }

  return [];
}

function validateTypeScriptConstraint(
  constraints: string[],
  scope: string,
  files: string[],
): string[] {
  if (!constraints.includes("scope must contain TypeScript files")) {
    return [];
  }

  const hasTypeScriptFile = files.some((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

  if (!hasTypeScriptFile) {
    return [`Declared scope contains no TypeScript files: ${scope}`];
  }

  return [];
}

function validatePythonConstraint(constraints: string[], scope: string, files: string[]): string[] {
  if (!constraints.includes("scope must contain Python files")) {
    return [];
  }

  const hasPythonFile = files.some((file) => file.endsWith(".py"));

  if (!hasPythonFile) {
    return [`Declared scope contains no Python files: ${scope}`];
  }

  return [];
}

function main() {
  const contract = loadContract();
  const violations: string[] = [];
  const scopeExistenceViolations = validateScopeExists(contract.scope);
  violations.push(...scopeExistenceViolations);

  if (scopeExistenceViolations.length === 0) {
    const resolvedScope = path.resolve(process.cwd(), contract.scope);
    const scopeFiles = listFilesRecursive(resolvedScope);
    violations.push(...validateScopeHasFiles(contract.scope, scopeFiles));
    violations.push(...validateTypeScriptConstraint(contract.constraints, contract.scope, scopeFiles));
    violations.push(...validatePythonConstraint(contract.constraints, contract.scope, scopeFiles));
  }

  if (violations.length > 0) {
    console.log("NOT SAFE");
    for (const violation of violations) {
      console.log(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("SAFE");
}

main();