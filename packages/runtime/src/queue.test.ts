import { randomUUID } from "node:crypto";
import { describe } from "vitest";
import { InlineRunQueue } from "./index.js";
import { runQueueSuite } from "./queue-suite.js";

describe("InlineRunQueue", () => {
  runQueueSuite(async (d) => new InlineRunQueue(d, { maxAttempts: 3 }), () => randomUUID());
});
