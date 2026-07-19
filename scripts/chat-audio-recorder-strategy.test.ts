import assert from "node:assert/strict";
import test from "node:test";

const {
  isAppleMobileWebKit,
  recorderMimeCandidates,
  shouldUseRecorderTimeslice,
  normalizeRecordedMimeType,
  resolveFinalMimeType,
  createCompatibleMediaRecorder,
  extensionForMime,
} = await import("../src/lib/chat-audio-recorder-strategy.ts");

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

function mockAppleMobile(apple = true) {
  defineGlobal("navigator", {
    userAgent: apple ? "iPhone" : "Android",
    platform: apple ? "iPhone" : "Win32",
    maxTouchPoints: apple ? 1 : 0,
  });
}

function mockAndroid() {
  defineGlobal("navigator", {
    userAgent: "Android Chrome",
    platform: "Linux armv8l",
    maxTouchPoints: 5,
  });
}

function mockIPadDesktop() {
  defineGlobal("navigator", {
    userAgent: "Macintosh",
    platform: "MacIntel",
    maxTouchPoints: 2,
  });
}

function mockMediaRecorder(supportedTypes = new Set(["audio/webm;codecs=opus", "audio/webm"])) {
  const isTypeSupported = (type) => supportedTypes.has(type);
  defineGlobal(
    "MediaRecorder",
    class MockMediaRecorder {
      static isTypeSupported = isTypeSupported;
      constructor(stream, options) {
        this.stream = stream;
        this.options = options;
        this.mimeType = options?.mimeType ?? "";
        this.state = "inactive";
      }
      start(timeslice) {
        this.state = "recording";
        this.timeslice = timeslice;
      }
      stop() {
        this.state = "inactive";
        if (typeof this.onstop === "function") this.onstop();
      }
    },
  );
}

test("iPhone + explicit audio/mp4: shouldUseRecorderTimeslice === false", () => {
  mockAppleMobile();
  assert.strictEqual(shouldUseRecorderTimeslice(true, "audio/mp4", "audio/mp4"), false);
});

test("iPhone + default MediaRecorder + empty mimeType: shouldUseRecorderTimeslice === false", () => {
  mockAppleMobile();
  assert.strictEqual(shouldUseRecorderTimeslice(true, "", null), false);
});

test("iPad Desktop Mode + empty MIME: shouldUseRecorderTimeslice === false", () => {
  mockIPadDesktop();
  assert.strictEqual(shouldUseRecorderTimeslice(true, "", null), false);
});

test("Android + audio/webm: shouldUseRecorderTimeslice === true", () => {
  mockAndroid();
  assert.strictEqual(shouldUseRecorderTimeslice(false, "audio/webm;codecs=opus", null), true);
});

test("video/mp4 resolves to audio/mp4 with m4a extension", () => {
  assert.strictEqual(normalizeRecordedMimeType("video/mp4"), "audio/mp4");
  assert.strictEqual(extensionForMime("audio/mp4"), "m4a");
  assert.strictEqual(resolveFinalMimeType("video/mp4", undefined, null), "audio/mp4");
});

test("constructor failure advances to next candidate", () => {
  mockAndroid();
  let callCount = 0;
  defineGlobal(
    "MediaRecorder",
    class FailingRecorder {
      static isTypeSupported = () => true;
      constructor(stream, options) {
        callCount++;
        this.stream = stream;
        this.options = options;
        this.mimeType = options?.mimeType ?? "";
        this.state = "inactive";
        if (callCount === 1) {
          throw new Error("Unsupported MIME");
        }
      }
      start(timeslice) {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        if (typeof this.onstop === "function") this.onstop();
      }
    },
  );

  const stream = { getTracks: () => [] };
  const result = createCompatibleMediaRecorder(stream);
  assert.strictEqual(result.selectedMimeType, "audio/webm");
  assert.strictEqual(result.recorder.mimeType, "audio/webm");
});

test("fallback to default MediaRecorder when all explicit candidates fail", () => {
  mockAndroid();
  let explicitCalls = 0;
  let defaultCalls = 0;
  defineGlobal(
    "MediaRecorder",
    class SometimesFailingRecorder {
      static isTypeSupported = () => true;
      constructor(stream, options) {
        this.stream = stream;
        this.options = options;
        this.mimeType = options?.mimeType ?? "";
        this.state = "inactive";
        if (options?.mimeType) {
          explicitCalls++;
          throw new Error("Explicit MIME not supported");
        }
        defaultCalls++;
      }
      start(timeslice) {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        if (typeof this.onstop === "function") this.onstop();
      }
    },
  );

  const stream = { getTracks: () => [] };
  const result = createCompatibleMediaRecorder(stream);
  assert.ok(defaultCalls === 1, "default MediaRecorder should be tried");
  assert.strictEqual(result.selectedMimeType, null);
});
