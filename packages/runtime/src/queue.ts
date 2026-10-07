import { PgBoss } from "pg-boss";
import { execute_block, RetryableRunError, type ExecuteDeps, type ExecuteOutcome, type RunJob } from "./execute.js";

export type RunState = "queued" | "running" | "retrying" | "done" | "failed";
export type RunStatus = { run_id: string; case_id: string; block: string; state: RunState; attempts: number; outcome?: ExecuteOutcome };

/** Reiht Bausteinläufe ein und meldet ihren Stand. Die Wiederholungslogik steckt in execute_block. */
export interface RunQueue {
  enqueue(job: RunJob): Promise<void>;
  status(run_id: string): Promise<RunStatus | null>;
}

const crashed = (job: RunJob, e: unknown): ExecuteOutcome => ({
  status: "failed",
  run_id: job.run_id,
  code: e instanceof RetryableRunError ? e.code : "WORKER_ERROR",
  message: e instanceof Error ? e.message : String(e),
});

/** Führt Läufe im selben Prozess aus. Für Tests und lokale Entwicklung ohne Datenbank. */
export class InlineRunQueue implements RunQueue {
  readonly #runs = new Map<string, RunStatus>();
  readonly #pending = new Set<Promise<void>>();

  constructor(
    private readonly deps: ExecuteDeps,
    private readonly options: { maxAttempts: number },
  ) {}

  async enqueue(job: RunJob): Promise<void> {
    this.#runs.set(job.run_id, { run_id: job.run_id, case_id: job.case_id, block: job.block, state: "queued", attempts: 0 });
    const p = this.#run(job).finally(() => this.#pending.delete(p));
    this.#pending.add(p);
  }

  async status(run_id: string): Promise<RunStatus | null> {
    const s = this.#runs.get(run_id);
    return s ? structuredClone(s) : null;
  }

  /** Wartet, bis alle eingereihten Läufe fertig sind. */
  async idle(): Promise<void> {
    while (this.#pending.size > 0) await Promise.all([...this.#pending]);
  }

  async #run(job: RunJob): Promise<void> {
    await Promise.resolve(); // asynchron wie eine echte Queue
    const set = (patch: Partial<RunStatus>) => this.#runs.set(job.run_id, { ...this.#runs.get(job.run_id)!, ...patch });
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      set({ state: "running", attempts: attempt });
      try {
        const outcome = await execute_block(this.deps, job, attempt, this.options);
        set({ state: outcome.status, outcome });
        return;
      } catch (e) {
        if (e instanceof RetryableRunError && attempt < this.options.maxAttempts) {
          set({ state: "retrying" });
          continue;
        }
        set({ state: "failed", outcome: crashed(job, e) });
        return;
      }
    }
  }
}

export type PgBossRunQueueOptions = {
  connectionString: string;
  schema?: string;
  queue?: string;
  maxAttempts: number;
  retryDelaySeconds: number;
  pollingIntervalSeconds?: number;
};

/** Läufe als pg-boss-Jobs: Job-ID = run_id, Wiederholung durch pg-boss bis zur festen Obergrenze. */
export class PgBossRunQueue implements RunQueue {
  readonly #boss: PgBoss;
  readonly #name: string;

  constructor(
    private readonly deps: ExecuteDeps,
    private readonly options: PgBossRunQueueOptions,
  ) {
    this.#boss = new PgBoss({ connectionString: options.connectionString, ...(options.schema ? { schema: options.schema } : {}) });
    this.#boss.on("error", (e) => console.error("pg-boss:", e));
    this.#name = options.queue ?? "speedboat-run-block";
  }

  async start(): Promise<void> {
    await this.#boss.start();
    await this.#boss.createQueue(this.#name, { retryLimit: this.options.maxAttempts - 1, retryDelay: this.options.retryDelaySeconds, retryBackoff: false });
    await this.#boss.work<RunJob, ExecuteOutcome>(
      this.#name,
      { batchSize: 1, ...(this.options.pollingIntervalSeconds ? { pollingIntervalSeconds: this.options.pollingIntervalSeconds } : {}) },
      async ([job]) => execute_block(this.deps, job!.data, job!.retryCount + 1, { maxAttempts: this.options.maxAttempts }),
    );
  }

  async stop(): Promise<void> {
    await this.#boss.stop({ graceful: false });
  }

  async enqueue(job: RunJob): Promise<void> {
    await this.#boss.send(this.#name, job, { id: job.run_id });
  }

  async status(run_id: string): Promise<RunStatus | null> {
    const [job] = await this.#boss.findJobs<RunJob>(this.#name, { id: run_id });
    if (!job) return null;
    const base = { run_id, case_id: job.data.case_id, block: job.data.block };
    const attempts = job.state === "created" ? 0 : job.retryCount + 1;
    switch (job.state) {
      case "created":
        return { ...base, state: "queued", attempts };
      case "retry":
        return { ...base, state: "retrying", attempts };
      case "active":
        return { ...base, state: "running", attempts };
      case "completed": {
        const outcome = job.output as ExecuteOutcome;
        return { ...base, state: outcome.status, attempts, outcome };
      }
      default: {
        const message = (job.output as { message?: string } | null)?.message ?? job.state;
        return { ...base, state: "failed", attempts, outcome: { status: "failed", run_id, code: "WORKER_ERROR", message } };
      }
    }
  }
}
