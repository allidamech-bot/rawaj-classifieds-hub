import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

function isInside(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(".." + sep) && !isAbsolute(path));
}

async function canonicalTarget(path) {
  let current = path;
  const missing = [];
  for (;;) {
    try {
      return resolve(await realpath(current), ...missing.reverse());
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = dirname(current);
      if (parent === current) throw new Error("Could not resolve backup destination ancestry.");
      missing.push(basename(current));
      current = parent;
    }
  }
}

async function assertUnused(path, label) {
  try {
    await lstat(path);
    throw new Error(label + " already exists; refusing to overwrite a previous backup.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Refuse in-repo, symlink-escaped, relative and overwrite-prone D1 backups. */
export async function assertSafeBackupOutputPaths({ backupDir, report, repositoryRoot }) {
  if (
    ![backupDir, report, repositoryRoot].every(
      (value) => typeof value === "string" && isAbsolute(value),
    )
  ) {
    throw new Error("Backup directory, report path and repository root must be absolute paths.");
  }
  const repository = await realpath(repositoryRoot);
  const backup = await canonicalTarget(backupDir);
  const reportTarget = await canonicalTarget(report);
  if (isInside(repository, backup) || isInside(repository, reportTarget)) {
    throw new Error(
      "Backup outputs must be outside the RAWAJ repository (including symlink aliases).",
    );
  }
  if (isInside(backup, reportTarget) || isInside(reportTarget, backup)) {
    throw new Error("Backup directory and report destination must be separate.");
  }
  if (backup === dirname(backup)) {
    throw new Error("The filesystem root cannot be a backup directory.");
  }
  await assertUnused(backupDir, "Backup directory");
  await assertUnused(report, "Backup report");
  return { backupDir: backup, report: reportTarget };
}
