import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const action = process.argv[2] ?? "production operation";

const workflowApproval = "DEPLOY_RAWAJ_SYRIA_WORKER_PRODUCTION";
const localApproval = "DEPLOY_RAWAJ_SYRIA_PRODUCTION";

const expectedCommitSha = process.env.RAWAJ_EXPECTED_COMMIT_SHA?.trim() ?? "";
const githubSha = process.env.GITHUB_SHA?.trim() ?? "";

const workflowDispatch =
  process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

const localManualDeploy =
  process.env.GITHUB_ACTIONS !== "true" && process.env.RAWAJ_LOCAL_PRODUCTION_DEPLOY === "true";

const localManualMigrate =
  process.env.GITHUB_ACTIONS !== "true" && process.env.RAWAJ_LOCAL_PRODUCTION_MIGRATE === "true";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

if (action !== "deploy" && action !== "migrate") {
  fail(
    `Blocked ${action}. Only guarded Syria Production Worker deploy or D1 migration is allowed.`,
  );
}

if (!/^[0-9a-f]{40}$/.test(expectedCommitSha)) {
  fail(
    `Blocked ${action}. RAWAJ_EXPECTED_COMMIT_SHA must be an exact lowercase 40-character Git SHA.`,
  );
}

if (workflowDispatch) {
  if (action !== "deploy") {
    fail("Blocked migrate. The existing workflow_dispatch path is Worker-deploy-only.");
  }

  if (process.env.RAWAJ_PRODUCTION_APPROVAL !== workflowApproval) {
    fail(`Blocked deploy. The exact approval phrase ${workflowApproval} is required.`);
  }

  if (expectedCommitSha !== githubSha) {
    fail("Blocked deploy. The expected commit SHA must exactly match the workflow HEAD.");
  }

  console.log(`Approved Syria Production Worker workflow deploy for ${expectedCommitSha}.`);
  process.exit(0);
}

const localManualApproved = action === "deploy" ? localManualDeploy : localManualMigrate;

if (!localManualApproved) {
  const optIn =
    action === "deploy"
      ? "RAWAJ_LOCAL_PRODUCTION_DEPLOY=true"
      : "RAWAJ_LOCAL_PRODUCTION_MIGRATE=true";

  fail(`Blocked ${action}. Explicitly set ${optIn} for this guarded local Production operation.`);
}

if (process.env.RAWAJ_PRODUCTION_APPROVAL !== localApproval) {
  fail(`Blocked ${action}. The exact local approval phrase ${localApproval} is required.`);
}

const headSha = git("rev-parse", "HEAD");
const originMainSha = git("rev-parse", "origin/main");
const status = git("status", "--porcelain");

if (headSha !== expectedCommitSha) {
  fail(`Blocked local ${action}. HEAD does not match RAWAJ_EXPECTED_COMMIT_SHA.`);
}

if (originMainSha !== expectedCommitSha) {
  fail(`Blocked local ${action}. The expected commit must exactly match origin/main.`);
}

if (status) {
  fail(`Blocked local ${action}. The deployment worktree must be completely clean.`);
}

console.log(`Approved guarded local Syria Production ${action} for ${expectedCommitSha}.`);

function git(...args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Blocked local ${action}. Git verification failed: ${message}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
