// Small promise scheduler shared by every on-demand layer load. Keeping network/decode work
// bounded avoids saturating mobile connections and leaves bandwidth for the visible viewport.
export const MAX_PARALLEL_LAYER_LOADS = 2;

export function createLoadScheduler(limit = MAX_PARALLEL_LAYER_LOADS) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Load limit must be a positive integer');
  const queue = [];
  let active = 0;

  function pump() {
    while (active < limit && queue.length) {
      const job = queue.shift();
      active++;
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
        active--;
        pump();
      });
    }
  }

  return function schedule(task) {
    if (typeof task !== 'function') throw new TypeError('Scheduled load must be a function');
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      pump();
    });
  };
}
