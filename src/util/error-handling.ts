export function retryN<T>(cb: () => T, n: number, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attempt() {
      attempts++;
      try {
        const result = cb();
        resolve(result);
      } catch (error) {
        if (attempts < n) {
          setTimeout(attempt, ms);
        } else {
          reject(error);
        }
      }
    }

    attempt();
  });
}
