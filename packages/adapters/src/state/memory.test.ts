import { describe } from "vitest";
import { MemoryStateAdapter } from "./memory.js";
import { stateAdapterSuite } from "./state-adapter-suite.js";

let n = 0;
describe("MemoryStateAdapter", () => {
  stateAdapterSuite(() => new MemoryStateAdapter(), () => `mem-${++n}`);
});
