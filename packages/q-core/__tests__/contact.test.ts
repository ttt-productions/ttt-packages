import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CONTACT_EMAIL } from '../src/constants/contact.js';

describe("Q-Sports' contact email", () => {
  it('is one valid address, the league mailbox', () => {
    expect(z.email().safeParse(CONTACT_EMAIL).success).toBe(true);
    expect(CONTACT_EMAIL).toBe('Qsportsleague@gmail.com');
  });
});
