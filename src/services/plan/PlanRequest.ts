const REQUEST_TIMEOUT_MS = 15000;

export function isStandalonePlanSource(): boolean {
  return typeof window !== 'undefined' &&
    (Boolean(window.__STANDALONE_MODE__) || window.location.protocol === 'file:');
}

/** Bound both the request and its response body, even if a transport ignores abort. */
export async function withPlanRequestTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Plan persistence request timed out'));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
