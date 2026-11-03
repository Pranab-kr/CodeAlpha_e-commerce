#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const candidates = [
  process.env.HALLMARK_SKILL_DIR,
  resolve(homedir(), '.agents/skills/hallmark'),
  resolve(homedir(), '.claude/skills/hallmark'),
  resolve(homedir(), '.qoder/skills/hallmark'),
].filter(Boolean);

const skillDir = candidates.find((dir) => existsSync(resolve(dir, 'scripts/sloplint.mjs')));

if (!skillDir) {
  console.error('Hallmark skill not found. Set HALLMARK_SKILL_DIR to the skill directory.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [resolve(skillDir, 'scripts/sloplint.mjs'), 'client', '--genre', 'modern-minimal'],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
