// Gemeinsame Vertragstests für jede RunQueue: dieselbe Wiederholungslogik inline und mit pg-boss.
import { expect, it } from "vitest";
import { ModelError, type FakeReply } from "@speedboat/adapters";
import type { RunQueue, RunStatus } from "./index.js";
import { deps, items, seedCase } from "./test-support.js";

export type QueueFactory = (d: ReturnType<typeof deps>) => Promise<RunQueue>;

async function settle(queue: RunQueue, run_id: string, timeoutMs: number): Promise<RunStatus> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const s = await queue.status(run_id);
    if (s && (s.state === "done" || s.state === "failed")) return s;
    if (Date.now() > until) throw new Error(`Lauf ${run_id} nicht fertig: ${JSON.stringify(s)}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

export function runQueueSuite(make: QueueFactory, newRunId: () => string, timeoutMs = 2000): void {
  it("führt einen Lauf asynchron aus und meldet das Ergebnis", async () => {
    const d = deps([{ output: { items } }]);
    await seedCase(d.state);
    const queue = await make(d);
    const run_id = newRunId();
    await queue.enqueue({ run_id, case_id: "case-1", block: "propose", requested_by: "u-dev" });
    const s = await settle(queue, run_id, timeoutMs);
    expect(s).toMatchObject({ run_id, case_id: "case-1", block: "propose", state: "done", attempts: 1, outcome: { status: "done", patch: "APPLIED" } });
    expect((await d.state.load("case-1"))!.runs.map((r) => r.run_id)).toEqual([run_id]);
  });

  it("wiederholt nach einem vorübergehenden Fehler", async () => {
    const replies: FakeReply[] = [{ error: new ModelError("API_ERROR", "überlastet", true, "m") }, { output: { items } }];
    const d = deps(replies);
    await seedCase(d.state);
    const queue = await make(d);
    const run_id = newRunId();
    await queue.enqueue({ run_id, case_id: "case-1", block: "propose", requested_by: "u-dev" });
    expect(await settle(queue, run_id, timeoutMs)).toMatchObject({ state: "done", attempts: 2 });
    expect((await d.attempts.list(run_id)).map((e) => e.code)).toEqual(["MODEL_API_ERROR"]);
  });

  it("gibt nach der festen Obergrenze auf; die Akte bleibt unverändert", async () => {
    const d = deps(() => ({ error: new ModelError("API_ERROR", "überlastet", true, "m") }));
    const before = await seedCase(d.state);
    const queue = await make(d);
    const run_id = newRunId();
    await queue.enqueue({ run_id, case_id: "case-1", block: "propose", requested_by: "u-dev" });
    expect(await settle(queue, run_id, timeoutMs)).toMatchObject({ state: "failed", attempts: 3, outcome: { status: "failed", code: "MODEL_API_ERROR" } });
    expect(d.model.calls).toHaveLength(3);
    expect(await d.state.load("case-1")).toEqual(before);
    expect((await d.attempts.list(run_id)).map((e) => e.attempt)).toEqual([1, 2, 3]);
  });

  it("kennt unbekannte Läufe nicht", async () => {
    const queue = await make(deps([]));
    expect(await queue.status(newRunId())).toBeNull();
  });
}
