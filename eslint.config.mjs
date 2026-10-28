import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // src/core is pure TypeScript shared by browser and server (CLAUDE.md, SPEC §4).
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next", "next/*", "react", "react-dom", "react/*",
                "node:*", "fs", "path", "os", "crypto", "child_process",
                "@/server", "@/server/*", "@/app", "@/app/*", "@/components", "@/components/*",
                "@/packs", "@/packs/*", "@/lib", "@/lib/*",
              ],
              message: "src/core must stay pure: no Next, React, Node-only APIs or imports from other layers.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
