import assert from "node:assert/strict";
import test from "node:test";
import {
  migrateLegacyMedia,
  normalizePlacementStatus,
  validateImage,
} from "./legacy-media-core.mjs";

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.alloc(32, 1),
]);

test("dry run plans records without source reads or target writes", async () => {
  const target = memoryTarget();
  let reads = 0;
  const report = await migrateLegacyMedia({
    records: [listingRecord()],
    source: { read: async () => { reads += 1; return { bytes: png, contentType: "image/png" }; } },
    target,
    dryRun: true,
  });
  assert.equal(report.counts.planned, 1);
  assert.equal(reads, 0);
  assert.equal(target.commits.length, 0);
  assert.equal(target.objects.size, 0);
});

test("apply preserves listing order, is idempotent, and reuses the migration ledger", async () => {
  const target = memoryTarget();
  const source = { read: async () => ({ bytes: png, contentType: "image/png" }) };
  const record = listingRecord({ sortOrder: 7 });
  const first = await migrateLegacyMedia({ records: [record], source, target, dryRun: false });
  assert.equal(first.counts.migrated, 1);
  assert.equal(target.commits[0].record.sortOrder, 7);
  assert.equal(target.objects.size, 1);
  const second = await migrateLegacyMedia({ records: [record], source, target, dryRun: false });
  assert.equal(second.counts.duplicate, 1);
  assert.equal(target.commits.length, 1);
  assert.equal(target.objects.size, 1);
});

test("missing and invalid source media are reported without target records", async () => {
  const missingTarget = memoryTarget();
  const missing = await migrateLegacyMedia({
    records: [listingRecord()],
    source: {
      read: async () => {
        throw Object.assign(new Error("missing"), { code: "SOURCE_MISSING" });
      },
    },
    target: missingTarget,
    dryRun: false,
  });
  assert.equal(missing.counts.missingSource, 1);
  assert.equal(missingTarget.commits.length, 0);

  const invalidTarget = memoryTarget();
  const invalid = await migrateLegacyMedia({
    records: [listingRecord()],
    source: { read: async () => ({ bytes: Buffer.from("not-image"), contentType: "image/png" }) },
    target: invalidTarget,
    dryRun: false,
  });
  assert.equal(invalid.counts.invalidFile, 1);
  assert.equal(invalidTarget.commits.length, 0);
});

test("MIME mismatch is rejected by actual signature validation", () => {
  assert.throws(() => validateImage(png, "image/jpeg"), /does not match/);
});

test("R2 failure leaves no D1 record and D1 failure cleans up R2", async () => {
  const uploadFailure = memoryTarget({ failUpload: true });
  const first = await migrateLegacyMedia({
    records: [listingRecord()],
    source: { read: async () => ({ bytes: png, contentType: "image/png" }) },
    target: uploadFailure,
    dryRun: false,
  });
  assert.equal(first.counts.uploadFailure, 1);
  assert.equal(uploadFailure.commits.length, 0);

  const d1Failure = memoryTarget({ failCommit: true });
  const second = await migrateLegacyMedia({
    records: [listingRecord()],
    source: { read: async () => ({ bytes: png, contentType: "image/png" }) },
    target: d1Failure,
    dryRun: false,
  });
  assert.equal(second.counts.d1Failure, 1);
  assert.equal(d1Failure.objects.size, 0);
});

test("stable IDs cannot attach profile media to another user", async () => {
  const target = memoryTarget({ mappedOwner: "different-user" });
  const report = await migrateLegacyMedia({
    records: [
      {
        kind: "profile_avatar",
        sourceId: "legacy-user",
        ownerId: "legacy-user",
        sourceBucket: "profile-media",
        sourcePath: "legacy-user/avatar.png",
      },
    ],
    source: { read: async () => ({ bytes: png, contentType: "image/png" }) },
    target,
    dryRun: false,
  });
  assert.equal(report.counts.ownershipMismatch, 1);
  assert.equal(target.commits.length, 0);
});

test("expired and future promotions are never activated", () => {
  const now = Date.parse("2026-07-24T00:00:00.000Z");
  assert.equal(
    normalizePlacementStatus(
      { status: "active", endsAt: "2026-07-23T23:59:59.000Z" },
      now,
    ),
    "draft",
  );
  assert.equal(
    normalizePlacementStatus(
      { status: "active", startsAt: "2026-07-25T00:00:00.000Z" },
      now,
    ),
    "draft",
  );
  assert.equal(normalizePlacementStatus({ status: "paused" }, now), "paused");
});

function listingRecord(overrides = {}) {
  return {
    kind: "listing_image",
    sourceId: "legacy-image-1",
    listingId: "legacy-listing-1",
    ownerId: "legacy-owner-1",
    sourceBucket: "listing-images",
    sourcePath: "legacy-owner-1/legacy-listing-1/image.png",
    sortOrder: 0,
    ...overrides,
  };
}

function memoryTarget({ failUpload = false, failCommit = false, mappedOwner = null } = {}) {
  const objects = new Map();
  const ledger = new Map();
  const commits = [];
  return {
    objects,
    commits,
    async resolveMapping(record) {
      return { id: record.listingId ?? record.ownerId, ownerId: mappedOwner ?? record.ownerId };
    },
    async findMigration(record) {
      return ledger.get(`${record.kind}:${record.sourceId}`) ?? null;
    },
    async findChecksum() {
      return null;
    },
    async objectExists(key) {
      return objects.has(key);
    },
    async putObject(key, bytes) {
      if (failUpload) throw new Error("simulated upload failure");
      objects.set(key, Buffer.from(bytes));
    },
    async deleteObject(key) {
      objects.delete(key);
    },
    async commit(context) {
      if (failCommit) throw new Error("simulated D1 failure");
      commits.push(context);
      ledger.set(`${context.record.kind}:${context.record.sourceId}`, {
        status: "migrated",
        objectKey: context.objectKey,
        assetId: context.assetId,
      });
    },
    async attachExisting(context) {
      await this.commit(context);
    },
    async recordFailure() {},
  };
}
