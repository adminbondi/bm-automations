import { defaultDeps } from "./deps";
import { createApp } from "./http/router";

export { createApp };

const app = createApp(defaultDeps());

export default app satisfies ExportedHandler<Env>;
