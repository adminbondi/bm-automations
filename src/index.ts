import { createApp } from "./http/router";

export { createApp };

const app = createApp({
  now: () => new Date(),
  fetchImpl: fetch,
});

export default app satisfies ExportedHandler<Env>;
