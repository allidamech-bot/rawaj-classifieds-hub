#!/usr/bin/env node
/**
 * One-command offline acceptance of two externally pinned Syria backup bundles.
 * This composes the existing recovery verifiers; it NEVER exports or restores
 * data to a remote or persistent database/bucket and cannot attest provenance.
 */
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { rehearseSyriaD1Backup } from "./rehearse-syria-d1-backup.mjs";
import { verifySyriaR2Recovery } from "./verify-syria-r2-backup.mjs";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const isSha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const containedBy = (root, candidate) => {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(".." + sep) && !isAbsolute(path));
};
const requireCondition = (condition, message) => {
  if (!condition) throw new Error("Syria offline recovery acceptance refused: " + message);
};

async function privateDirectory(path, label, canonicalRepository) {
  requireCondition(typeof path === "string" && isAbsolute(path), label + " must be absolute");
  const stat = await lstat(path);
  requireCondition(stat.isDirectory() && !stat.isSymbolicLink(), label + " must be a real directory");
  const canonical = await realpath(path);
  requireCondition(
    !containedBy(canonicalRepository, canonical),
    label + " must be outside the RAWAJ source repository",
  );
  return canonical;
}

/**
 * Accept only local, independently pinned D1 and R2 bundles. A successful result
 * establishes consistency of supplied bytes, NOT their production provenance,
 * age, remote restoration, or live image/API functionality.
 */
export async function acceptSyriaOfflineRecovery({
  d1Directory,
  r2Directory,
  expectedD1ManifestSha256,
  expectedR2ManifestSha256,
}) {
  requireCondition(isSha256(expectedD1ManifestSha256), "independent D1 SHA-256 is required");
  requireCondition(isSha256(expectedR2ManifestSha256), "independent R2 SHA-256 is required");
  const sourceRoot = await realpath(repositoryRoot);
  const d1Root = await privateDirectory(d1Directory, "D1 snapshot", sourceRoot);
  const r2Root = await privateDirectory(r2Directory, "R2 snapshot", sourceRoot);
  requireCondition(
    !containedBy(d1Root, r2Root) && !containedBy(r2Root, d1Root),
    "D1 and R2 snapshots must be in separate directories",
  );

  const d1 = await rehearseSyriaD1Backup(d1Root, {
    expectedManifestSha256: expectedD1ManifestSha256,
  });
  requireCondition(d1.rowContentVerified && d1.foreignKeyViolations === 0, "D1 restore verification incomplete");
  const r2 = await verifySyriaR2Recovery({
    d1Directory: d1Root,
    r2Directory: r2Root,
    expectedD1ManifestSha256,
    expectedR2ManifestSha256,
  });
  requireCondition(
    r2.verified && r2.pinnedD1ManifestSha256 === d1.verifiedManifestSha256,
    "D1 and R2 manifests do not reconcile",
  );

  return {
    result: "offline_snapshot_reconstruction_and_media_integrity_passed",
    scope: "supplied_local_files_only",
    productionProvenanceVerified: false,
    realProductionRestorePerformed: false,
    remoteReads: false,
    remoteWrites: false,
    d1: {
      databaseId: d1.databaseId,
      manifestSha256: d1.verifiedManifestSha256,
      restoredTables: d1.restoredTables,
      restoredRows: d1.restoredRows,
      reconstructedFtsRows: d1.reconstructedFtsRows,
      foreignKeyViolations: d1.foreignKeyViolations,
      rowContentVerified: d1.rowContentVerified,
    },
    r2: {
      bucket: r2.bucket,
      manifestSha256: r2.manifestSha256,
      objectCount: r2.objectCount,
      totalBytes: r2.totalBytes,
      readyMediaReferencesVerified: r2.readyMediaReferencesVerified,
      unreferencedObjectCount: r2.unreferencedObjectCount,
    },
    outstandingProof: [
      "independently document actual production snapshot provenance and timestamp",
      "exercise isolated R2 upload/read and application-level image/search access",
      "confirm pinned release and production operations after owner-managed deployment",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const values = {};
  for (const argument of process.argv.slice(2)) {
    const match = /^--(d1-dir|r2-dir|d1-sha256|r2-sha256)=(.+)$/.exec(argument);
    requireCondition(match && !(match[1] in values), "unexpected or duplicate option");
    values[match[1]] = match[2];
  }
  requireCondition(Object.keys(values).length === 4, "four explicit snapshot parameters are required");
  const result = await acceptSyriaOfflineRecovery({
    d1Directory: values["d1-dir"],
    r2Directory: values["r2-dir"],
    expectedD1ManifestSha256: values["d1-sha256"],
    expectedR2ManifestSha256: values["r2-sha256"],
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
