import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../../');
}

export function loadRootEnv(): void {
  loadDotenv({ path: resolve(repoRoot(), '.env') });
}