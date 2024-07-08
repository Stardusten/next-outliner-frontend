import type {AppState} from "@/state/state";
import {withTimeout} from "@/util/timeout";

export type AsyncTask = {
  id: number;
  callback: () => void | Promise<void>;
  type: string | "null";
  canceller?: () => void;
  recursive?: boolean;
};

export class AsyncTaskQueue {
  private id: number = 0;
  private queue: AsyncTask[] = [];
  private giveupQueue: number[] = [];
  private ongoingTask: AsyncTask | null = null;

  addTask(
    callback: () => void | Promise<void>,
    type: string = "null",
    delay = 0,
    debounce = false
  ) {
    const id = this.id++;
    // console.log("add task", id);
    // if debounce == true, find a task with the same type in queue to merge
    if (debounce && type != "null") {
      const idx = this.queue.findIndex((item) => item.type == type);
      if (idx !== -1) {
        const task = this.queue[idx];
        task.canceller && task.canceller();
        this.queue.splice(idx, 1);
      }
    }
    // detect recursion
    const n = new Error().stack?.split("\n").filter((l) => l.includes("addTask")).length ?? 0;
    const recursive = n > 1;
    const index = this.ongoingTask
      ? this.queue.findIndex((task) => task.id == this.ongoingTask!.id)
      : -1;
    if (delay > 0) {
      const handler = setTimeout(async () => {
        this._processQueue(id);
      }, delay);
      const canceller = () => {
        clearTimeout(handler);
      };
      if (recursive) {
        this.queue.splice(index + 1, 0, {
          id,
          callback,
          type,
          canceller,
          recursive: true
        });
      } else {
        this.queue.push({ id, callback, type, canceller });
      }
    } else {
      if (recursive) {
        this.queue.splice(index + 1, 0, {
          id,
          callback,
          type,
          recursive: true
        });
      } else {
        this.queue.push({ id, callback, type });
      }
      this._processQueue(id);
    }
  }

  async addTaskAndWait(
    callback: () => void | Promise<void>,
    type: string,
    delay = 0,
    debounce = false
  ) {
    return new Promise((resolve) => {
      const wrappedTask = async () => {
        await callback();
        resolve(undefined);
      };

      this.addTask(wrappedTask, type, delay, debounce);
    });
  }

  async flushQueue() {
    // add a empty task to flush
    await this.addTaskAndWait(() => {}, "null");
  }

  async _processQueue(targetId: number) {
    // console.log('try process', targetId, this.queue);
    if (this.queue.length === 0) {
      return;
    }

    if (this.ongoingTask) {
      if (!this.queue[0]!.recursive) {
        this.giveupQueue.push(targetId);
        return;
      }
    }

    const task = this.queue.shift()!;
    const { id, callback, canceller, recursive } = task;

    this.ongoingTask = task;
    // console.log("start processing task", id);

    canceller && canceller();
    // console.log("start executing task", task.id);
    const maybePromise = callback();
    if (maybePromise != null) {
      // is promise
      try {
        await withTimeout(maybePromise as any, 2000); // TODO avoid hardcoding
      } catch (error) {
        console.warn(error);
      }
    }
    // console.log(task.id, "finished");

    this.ongoingTask = null;
    // console.log("process task", id, "finished");

    if (id !== targetId) {
      await this._processQueue(targetId);
    }

    // task targetId should be finished here
    // console.log("giveupQueue", this.giveupQueue)
    if (!recursive && this.giveupQueue.length > 0) {
      queueMicrotask(() => {
        for (const id of this.giveupQueue) {
          const targetId = this.giveupQueue.shift();
          // console.log("try giveup task", id, targetId)
          targetId && this._processQueue(id);
        }
      });
    }
  }
}

declare module "@/state/state" {
  interface AppState {
    taskQueue: AsyncTaskQueue;
  }
}

export const taskQueuePlugin = (s: AppState) => {
  const taskQueue = new AsyncTaskQueue();
  s.decorate("taskQueue", taskQueue);
}