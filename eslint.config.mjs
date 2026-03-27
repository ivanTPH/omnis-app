import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Seed / migration scripts are not production code
    "prisma/seed*.ts",
    "prisma/seed.ts",
    "scripts/**",
    "e2e/**",
  ]),
  {
    rules: {
      // `any` is used intentionally throughout server actions (NextAuth session,
      // Prisma JSON fields, AI response parsing). Treat as a warning not an error.
      "@typescript-eslint/no-explicit-any": "warn",
      // Unused vars are flagged as warnings, not build-breaking errors.
      "@typescript-eslint/no-unused-vars": "warn",
      // react-hooks v5 rules that fire on valid patterns throughout this codebase.
      // Downgraded to warnings — none represent actual bugs in this project.
      "react-hooks/set-state-in-effect":  "warn",  // async setState in useEffect
      "react-hooks/static-components":    "warn",  // helper components defined inline
      "react-hooks/purity":               "warn",  // Date.now() etc. in default params
    },
  },
]);

export default eslintConfig;
