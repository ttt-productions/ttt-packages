import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFirebaseProjects, type FirebaseProjects } from './firebase-projects.js';

export function readFirebaseProjects(repoRoot: string): FirebaseProjects {
  return parseFirebaseProjects(readFileSync(path.join(repoRoot, '.firebaserc'), 'utf8'));
}
