/**
 * @jest-environment node
 * extractFileReferences Language-Agnostic Path Detection Tests
 * 
 * Validates that the path detector correctly accepts all file types
 * (.py, .glb, .tsx, .wgsl, etc.) and rejects non-path strings.
 */
// @ts-nocheck

import { extractFileReferences } from './copilotValidationService';

describe('extractFileReferences - Language-Agnostic Path Detection', () => {
  describe('Accept Cases - Must correctly identify as valid file paths', () => {
    test('should accept Python files with directory prefix', () => {
      const result = extractFileReferences('Created forge/ama/types.py');
      expect(result).toContain('forge/ama/types.py');
    });

    test('should accept TypeScript in nested project structure', () => {
      const result = extractFileReferences('Modified apps/vscode-extension/src/extension.ts');
      expect(result).toContain('apps/vscode-extension/src/extension.ts');
    });

    test('should accept 3D model formats (glTF)', () => {
      const result = extractFileReferences('Updated assets/scene.gltf');
      expect(result).toContain('assets/scene.gltf');
    });

    test('should accept binary 3D model formats (GLB)', () => {
      const result = extractFileReferences('Added assets/model.glb');
      expect(result).toContain('assets/model.glb');
    });

    test('should accept OBJ 3D models', () => {
      const result = extractFileReferences('Modified models/character.obj');
      expect(result).toContain('models/character.obj');
    });

    test('should accept image assets (PNG)', () => {
      const result = extractFileReferences('Updated textures/albedo.png');
      expect(result).toContain('textures/albedo.png');
    });

    test('should accept WebGL shader files (WGSL)', () => {
      const result = extractFileReferences('Changed shaders/main.wgsl');
      expect(result).toContain('shaders/main.wgsl');
    });

    test('should accept GLSL shader files', () => {
      const result = extractFileReferences('Files changed: shaders/vertex.glsl');
      expect(result).toContain('shaders/vertex.glsl');
    });

    test('should accept FBX pipeline files', () => {
      const result = extractFileReferences('Deleted pipeline/scene.fbx');
      expect(result).toContain('pipeline/scene.fbx');
    });

    test('should accept Python __init__ files', () => {
      const result = extractFileReferences('Created forge/runtime/__init__.py');
      expect(result).toContain('forge/runtime/__init__.py');
    });

    test('should accept GitHub workflow files (YAML)', () => {
      const result = extractFileReferences('Updated .github/workflows/ci.yml');
      expect(result).toContain('.github/workflows/ci.yml');
    });

    test('should accept VS Code settings (JSON)', () => {
      const result = extractFileReferences('Modified .vscode/settings.json');
      expect(result).toContain('.vscode/settings.json');
    });

    test('should accept Windows absolute paths', () => {
      const result = extractFileReferences('file: C:\\Users\\KSIL\\project\\file.ts');
      expect(result).toContain('C:/Users/KSIL/project/file.ts');
    });

    test('should accept drive letter with forward slash', () => {
      const result = extractFileReferences('Created I:\\Forge\\forge\\ama\\types.py');
      expect(result).toContain('I:/Forge/forge/ama/types.py');
    });

    test('should accept Unix absolute paths', () => {
      const result = extractFileReferences('Modified /home/user/project/main.py');
      expect(result).toContain('/home/user/project/main.py');
    });

    test('should accept relative paths with dot-slash', () => {
      const result = extractFileReferences('Updated ./readme.md');
      expect(result).toContain('./readme.md');
    });

    test('should accept parent directory references', () => {
      const result = extractFileReferences('Changed ../config/settings.toml');
      expect(result).toContain('../config/settings.toml');
    });

    test('should accept audio files (MP3)', () => {
      const result = extractFileReferences('Added audio/track.mp3');
      expect(result).toContain('audio/track.mp3');
    });

    test('should accept video files (MP4)', () => {
      const result = extractFileReferences('Created video/clip.mp4');
      expect(result).toContain('video/clip.mp4');
    });

    test('should accept multiple file references in one text', () => {
      const text = `Created forge/ama/types.py
Modified forge/ama/dispatcher.py
Updated forge/runtime/executor.py
Files changed: forge/ama/types.py, forge/ama/dispatcher.py, forge/runtime/executor.py`;
      const result = extractFileReferences(text);
      expect(result).toContain('forge/ama/types.py');
      expect(result).toContain('forge/ama/dispatcher.py');
      expect(result).toContain('forge/runtime/executor.py');
      // Should deduplicate
      expect(result.filter((r) => r === 'forge/ama/types.py').length).toBe(1);
    });

    test('should accept TSX React components', () => {
      const result = extractFileReferences('Modified src/components/Button.tsx');
      expect(result).toContain('src/components/Button.tsx');
    });
  });

  describe('Reject Cases - Must correctly exclude non-file-path strings', () => {
    test('should reject bare domain names', () => {
      const result = extractFileReferences('Check google.com for details');
      expect(result).not.toContain('google.com');
    });

    test('should reject www URLs', () => {
      const result = extractFileReferences('See www.google.com');
      expect(result).not.toContain('www.google.com');
    });

    test('should reject API domain with version', () => {
      const result = extractFileReferences('Call api.v2.example.io');
      expect(result).not.toContain('api.v2.example.io');
    });

    test('should reject HTTP URLs', () => {
      const result = extractFileReferences('Visit http://example.com');
      expect(result).not.toContain('http://example.com');
    });

    test('should reject HTTPS URLs', () => {
      const result = extractFileReferences('Go to https://chatgpt.com/c/abc123');
      expect(result).not.toContain('https://chatgpt.com/c/abc123');
    });

    test('should reject FTP URLs', () => {
      const result = extractFileReferences('FTP: ftp://files.example.com');
      expect(result).not.toContain('ftp://files.example.com');
    });

    test('should reject git SSH URLs', () => {
      const result = extractFileReferences('Repository: git@github.com:user/repo.git');
      expect(result).not.toContain('git@github.com:user/repo.git');
    });

    test('should reject mailto links', () => {
      const result = extractFileReferences('Email: mailto:user@example.com');
      expect(result).not.toContain('mailto:user@example.com');
    });

    test('should reject localhost with port', () => {
      const result = extractFileReferences('Server running on localhost:3000/api/v1');
      expect(result).not.toContain('localhost:3000/api/v1');
    });

    test('should reject IP address with port', () => {
      const result = extractFileReferences('Address: 127.0.0.1:8080/path');
      expect(result).not.toContain('127.0.0.1:8080/path');
    });

    test('should reject IP address without port', () => {
      const result = extractFileReferences('IP: 192.168.1.1');
      expect(result).not.toContain('192.168.1.1');
    });

    test('should reject email addresses', () => {
      const result = extractFileReferences('Contact: user@example.com');
      expect(result).not.toContain('user@example.com');
    });

    test('should reject scoped npm packages', () => {
      const result = extractFileReferences('Import from @signalforge/core');
      expect(result).not.toContain('@signalforge/core');
    });

    test('should reject @types npm packages', () => {
      const result = extractFileReferences('Install @types/node');
      expect(result).not.toContain('@types/node');
    });

    test('should reject .NET framework reference', () => {
      const result = extractFileReferences('Using .NET framework');
      expect(result).not.toContain('.NET');
    });

    test('should reject ASP.NET reference', () => {
      const result = extractFileReferences('Built with ASP.NET');
      expect(result).not.toContain('ASP.NET');
    });

    test('should reject Node.js reference', () => {
      const result = extractFileReferences('Runtime: Node.js');
      expect(result).not.toContain('Node.js');
    });

    test('should reject Next.js reference', () => {
      const result = extractFileReferences('Frontend: Next.js');
      expect(result).not.toContain('Next.js');
    });

    test('should reject semantic version with v prefix', () => {
      const result = extractFileReferences('Version v1.2.3 released');
      expect(result).not.toContain('v1.2.3');
    });

    test('should reject semver with caret', () => {
      const result = extractFileReferences('Dependency: ^1.2.3');
      expect(result).not.toContain('^1.2.3');
    });

    test('should reject semver with greater-than-equal', () => {
      const result = extractFileReferences('Requires >=1.2.3');
      expect(result).not.toContain('>=1.2.3');
    });

    test('should reject bare semver', () => {
      const result = extractFileReferences('Latest: 1.2.3');
      expect(result).not.toContain('1.2.3');
    });

    test('should reject floating point number', () => {
      const result = extractFileReferences('PI = 3.14159');
      expect(result).not.toContain('3.14159');
    });

    test('should reject bare filename without directory prefix', () => {
      const result = extractFileReferences('See readme.md for details');
      expect(result).not.toContain('readme.md');
    });

    test('should reject bare filename (main.py)', () => {
      const result = extractFileReferences('Run main.py');
      expect(result).not.toContain('main.py');
    });

    test('should reject bare filename (index.js)', () => {
      const result = extractFileReferences('Entry: index.js');
      expect(result).not.toContain('index.js');
    });

    test('should reject .env file without directory prefix', () => {
      const result = extractFileReferences('Create .env');
      expect(result).not.toContain('.env');
    });

    test('should reject .gitignore file without directory prefix', () => {
      const result = extractFileReferences('Update .gitignore');
      expect(result).not.toContain('.gitignore');
    });

    test('should reject ISO timestamp', () => {
      const result = extractFileReferences('Captured at 2026-04-05T04:10:34.228Z');
      expect(result).not.toContain('2026-04-05T04:10:34.228Z');
    });

    test('should reject project ID format', () => {
      const result = extractFileReferences('Project ID: proj_187b7e9c118d');
      expect(result).not.toContain('proj_187b7e9c118d');
    });

    test('should reject file with trailing dot', () => {
      const result = extractFileReferences('Modified file.');
      expect(result).not.toContain('file.');
    });

    test('should reject triple-dot file extension', () => {
      const result = extractFileReferences('test.test.test');
      expect(result).not.toContain('test.test.test');
    });

    test('should reject chrome URLs', () => {
      const result = extractFileReferences('Extension: chrome://extensions');
      expect(result).not.toContain('chrome://extensions');
    });

    test('should reject file:// protocol URLs', () => {
      const result = extractFileReferences('Local file:///absolute/path');
      expect(result).not.toContain('file:///absolute/path');
    });

    test('should reject WebSocket URLs', () => {
      const result = extractFileReferences('Connect to wss://server.io');
      expect(result).not.toContain('wss://server.io');
    });
  });

  describe('Edge Cases and Signal Keywords', () => {
    test('should extract path after "Created" keyword', () => {
      const result = extractFileReferences('Created src/app.ts');
      expect(result).toContain('src/app.ts');
    });

    test('should extract path after "Modified" keyword', () => {
      const result = extractFileReferences('Modified config/settings.json');
      expect(result).toContain('config/settings.json');
    });

    test('should extract path after "Updated" keyword', () => {
      const result = extractFileReferences('Updated docs/README.md');
      expect(result).toContain('docs/README.md');
    });

    test('should extract path after "Files changed:" keyword', () => {
      const result = extractFileReferences('Files changed: src/index.ts, lib/util.py');
      expect(result).toContain('src/index.ts');
      expect(result).toContain('lib/util.py');
    });

    test('should handle arrow notation "→"', () => {
      const result = extractFileReferences('Old file → src/new/location.ts');
      expect(result).toContain('src/new/location.ts');
    });

    test('should handle arrow notation "->"', () => {
      const result = extractFileReferences('Moved to -> config/app.json');
      expect(result).toContain('config/app.json');
    });

    test('should extract multiple paths from complex text', () => {
      const text = `Created forge/ama/types.py
Modified forge/ama/dispatcher.py
Deleted old/executor.py
Files changed: src/util.ts, lib/helper.js, models/shape.glb`;
      const result = extractFileReferences(text);
      expect(result.length).toBeGreaterThanOrEqual(5);
      expect(result).toContain('forge/ama/types.py');
      expect(result).toContain('forge/ama/dispatcher.py');
      expect(result).toContain('old/executor.py');
      expect(result).toContain('src/util.ts');
      expect(result).toContain('models/shape.glb');
    });

    test('should deduplicate extracted references', () => {
      const text = `Modified src/app.ts
Updated src/app.ts
Changed src/app.ts`;
      const result = extractFileReferences(text);
      expect(result.filter((r) => r === 'src/app.ts').length).toBe(1);
    });

    test('should extract prose-embedded module responsibility paths', () => {
      const text = 'governor.py now evaluates policy from InferenceEnvelope. forge/policy/governor.py defines the entrypoint. Modified forge/runtime/executor.py to enforce lineage.';
      const result = extractFileReferences(text);
      expect(result).toContain('forge/policy/governor.py');
      expect(result).toContain('forge/runtime/executor.py');
    });

    test('should handle paths with hyphens', () => {
      const result = extractFileReferences('Modified src/my-component.ts');
      expect(result).toContain('src/my-component.ts');
    });

    test('should handle paths with underscores', () => {
      const result = extractFileReferences('Created src/my_module.py');
      expect(result).toContain('src/my_module.py');
    });

    test('should handle numbered directories', () => {
      const result = extractFileReferences('Updated phase-2/step_1/config.json');
      expect(result).toContain('phase-2/step_1/config.json');
    });
  });

  describe('Format Robustness - Various spacing and punctuation', () => {
    test('should handle extra spaces around paths', () => {
      const result = extractFileReferences('Modified   src/app.ts   ');
      expect(result).toContain('src/app.ts');
    });

    test('should handle paths surrounded by parentheses', () => {
      const result = extractFileReferences('(src/app.ts)');
      expect(result).toContain('src/app.ts');
    });

    test('should handle paths surrounded by brackets', () => {
      const result = extractFileReferences('[src/app.ts]');
      expect(result).toContain('src/app.ts');
    });

    test('should handle paths surrounded by backticks (markdown code)', () => {
      const result = extractFileReferences('`src/app.ts`');
      expect(result).toContain('src/app.ts');
    });

    test('should handle paths with trailing comma', () => {
      const result = extractFileReferences('src/app.ts,');
      expect(result).toContain('src/app.ts');
    });

    test('should handle paths with trailing period', () => {
      const result = extractFileReferences('Modified src/app.ts.');
      expect(result).toContain('src/app.ts');
    });

    test('should handle paths with trailing semicolon', () => {
      const result = extractFileReferences('Created src/app.ts;');
      expect(result).toContain('src/app.ts');
    });

    test('should handle paths in CSV list', () => {
      const result = extractFileReferences('src/a.ts, src/b.py, src/c.glb');
      expect(result).toContain('src/a.ts');
      expect(result).toContain('src/b.py');
      expect(result).toContain('src/c.glb');
    });

    test('should normalize backslashes to forward slashes', () => {
      const result = extractFileReferences('Created src\\app.ts');
      expect(result.some((r) => r.includes('/'))).toBe(true);
    });

    test('should strip leading ./ prefix in normalization', () => {
      const result = extractFileReferences('Modified ./src/app.ts');
      // Both with and without ./ should be accepted or normalized
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
