export interface FirebaseProjects {
  dev: string;
  prod: string;
}

export function parseFirebaseProjects(firebaserc: string): FirebaseProjects {
  const projects = (JSON.parse(firebaserc) as { projects?: Record<string, unknown> }).projects;
  if (!projects || typeof projects.dev !== 'string' || typeof projects.prod !== 'string') {
    throw new Error('.firebaserc declares no dev and prod project aliases');
  }
  return Object.freeze({ dev: projects.dev, prod: projects.prod });
}

export function resolveProject(value: unknown, projects: FirebaseProjects): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(
      `--project is required: name the project this run reaches (${Object.keys(projects).join(' or ')})`,
    );
  }
  if (Object.hasOwn(projects, value)) return projects[value as keyof FirebaseProjects];
  if (Object.values(projects).includes(value)) return value;
  throw new Error(
    `--project ${value} is not a project in .firebaserc (${Object.keys(projects).join(', ')})`,
  );
}

export function isDevProject(projectId: string, projects: FirebaseProjects): boolean {
  return projectId === projects.dev;
}
