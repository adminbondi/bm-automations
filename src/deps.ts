import type { AppDeps } from "./pipeline/runtime";

// Workers' fetch throws "Illegal invocation" when called as a method of another
// object (deps.fetchImpl(...), this.fetchImpl(...)). Always wrap it.
export function defaultDeps(): AppDeps {
  return {
    now: () => new Date(),
    fetchImpl: (input, init) => fetch(input, init),
  };
}
