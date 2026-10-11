import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "packages/contacts-core/test/**/*.test.ts"],
  },
});
