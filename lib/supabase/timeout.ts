/** How long a request may wait on Supabase auth before carrying on without it (the SDK itself retries for ~25 s). */
export const AUTH_TIMEOUT_MS = 2500;

/**
 * Resolves with the promise's value, or with `fallback` if it fails or takes longer than `ms`.
 * The slow promise is left to finish on its own; its failure is swallowed so it cannot become an unhandled rejection.
 */
export function withTimeout<T>(work: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    Promise.resolve(work).then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}
