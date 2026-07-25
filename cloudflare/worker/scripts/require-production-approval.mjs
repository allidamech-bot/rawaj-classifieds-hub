const expected = "I_UNDERSTAND_THIS_CHANGES_PRODUCTION";
const action = process.argv[2] ?? "production operation";

if (process.env.RAWAJ_PRODUCTION_APPROVAL !== expected) {
  console.error(
    `Blocked ${action}. Set RAWAJ_PRODUCTION_APPROVAL=${expected} only after an explicit reviewed production approval.`,
  );
  process.exit(1);
}
