const action = process.argv[2] ?? "production operation";
const expected = "DEPLOY_RAWAJ_WORKER_PRODUCTION";
const expectedCommitSha = process.env.RAWAJ_EXPECTED_COMMIT_SHA?.trim() ?? "";
const githubSha = process.env.GITHUB_SHA?.trim() ?? "";

if (action !== "deploy") {
  console.error(
    `Blocked ${action}. Remote migrations and other Production operations require a separate, explicitly approved workflow.`,
  );
  process.exit(1);
}

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.GITHUB_EVENT_NAME !== "workflow_dispatch"
) {
  console.error(
    "Blocked deploy. Production Worker deployment is allowed only in workflow_dispatch.",
  );
  process.exit(1);
}

if (process.env.RAWAJ_PRODUCTION_APPROVAL !== expected) {
  console.error(`Blocked deploy. The exact approval phrase ${expected} is required.`);
  process.exit(1);
}

if (!/^[0-9a-f]{40}$/.test(expectedCommitSha) || expectedCommitSha !== githubSha) {
  console.error("Blocked deploy. The expected commit SHA must exactly match the workflow HEAD.");
  process.exit(1);
}
