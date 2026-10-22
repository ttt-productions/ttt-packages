import { describe, it, expect } from 'vitest';
import { CraftSkillReferenceSchema, FullUserSchema } from '../src/doc-schemas/user.js';

describe('user documents store references, not copies', () => {
  it('a user profile holds no copy of the Works the member owns or joined', () => {
    expect(Object.keys(FullUserSchema.shape)).not.toContain('ownedWorkProjects');
    expect(Object.keys(FullUserSchema.shape)).not.toContain('associatedWorkProjects');
  });

  it('a tagged craft-skill reference stores no copy of the skill name', () => {
    expect(Object.keys(CraftSkillReferenceSchema.shape)).not.toContain('craftSkillName');
  });
});
