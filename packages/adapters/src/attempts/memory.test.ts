import { describe } from "vitest";
import { attemptLogSuite } from "./attempt-log-suite.js";
import { MemoryAttemptLog } from "./memory.js";

let n = 0;
describe("MemoryAttemptLog", () => {
  attemptLogSuite(() => new MemoryAttemptLog(), () => `run-${++n}`);
});
