import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["apps/*/dist/**", "packages/*/dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended
);
