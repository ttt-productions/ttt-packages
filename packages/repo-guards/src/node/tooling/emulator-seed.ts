export async function runEmulatorSeed({
  seedAll,
  verifySeed,
  startHint,
}: {
  seedAll: () => Promise<unknown>;
  verifySeed: () => Promise<unknown>;
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
