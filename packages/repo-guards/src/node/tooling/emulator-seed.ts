// Clear and seed the running local emulators with an app's deterministic test data, without a
// browser or a served build, then verify the seed. The app's seed clears all emulator data first,
// so a run is idempotent; it never reaches a hosted project.

export async function runEmulatorSeed({
  seedAll,
  verifySeed,
  startHint,
}: {
  seedAll: () => Promise<unknown>;
  verifySeed: () => Promise<unknown>;
  /** What starts the emulators, printed when the seed fails. */
  startHint: string;
}): Promise<void> {
  try {
    console.log('Seeding the local emulators (clear + seed)...');
    await seedAll();
    console.log('Seed complete. Verifying...');
    await verifySeed();
    console.log('Emulator seeded and verified.');
  } catch (error) {
    console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Are the emulators running? ${startHint}`);
    process.exit(1);
  }
}
