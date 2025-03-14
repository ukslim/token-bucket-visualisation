import { defineConfig } from "vite";

// Get the repository name from package.json or environment
const repoName = "token-bucket-visualisation";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? `/${repoName}/` : "/",
});
