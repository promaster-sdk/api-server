import { defineConfig } from "oxlint";
import dividConfig from "oxlint-config-divid";

export default defineConfig({
  extends: [dividConfig],
  ignorePatterns: ["lib/", "vite.config.*"],
  rules: {
    // Migration baseline from tslint, enable once code is fixed:
    "typescript/prefer-readonly-parameter-types": "off", // 104
    "typescript/consistent-type-imports": "off", // 50
    "typescript/dot-notation": "off", // 39
    "typescript/no-unnecessary-condition": "off", // 25
    "functional/prefer-readonly-type": "off", // 21
    "no-console": "off", // 20
    "typescript/no-unsafe-member-access": "off", // 19
    "typescript/no-unsafe-type-assertion": "off", // 18
    "typescript/no-empty-object-type": "off", // 13
    "typescript/ban-tslint-comment": "off", // 13
    "typescript/no-unsafe-return": "off", // 12
    "typescript/no-unsafe-assignment": "off", // 11
    "typescript/prefer-nullish-coalescing": "off", // 10
    "typescript/return-await": "off", // 9
    "typescript/no-explicit-any": "off", // 9
    "typescript/no-unsafe-call": "off", // 5
    "typescript/no-unsafe-enum-comparison": "off", // 4
    "typescript/explicit-function-return-type": "off", // 4
    "typescript/array-type": "off", // 4
    "typescript/restrict-template-expressions": "off", // 3
    "typescript/prefer-string-starts-ends-with": "off", // 3
    "typescript/no-unnecessary-type-conversion": "off", // 3
    "typescript/no-base-to-string": "off", // 3
    "typescript/explicit-module-boundary-types": "off", // 3
    "init-declarations": "off", // 3
    "vitest/no-conditional-expect": "off", // 2
    "unicorn/no-useless-spread": "off", // 2
    "typescript/prefer-optional-chain": "off", // 2
    "typescript/no-var-requires": "off", // 2
    "typescript/no-unnecessary-boolean-literal-compare": "off", // 2
    "typescript/no-require-imports": "off", // 2
    "typescript/no-floating-promises": "off", // 2
    "typescript/prefer-regexp-exec": "off", // 1
    "typescript/no-misused-promises": "off", // 1
    "promise/always-return": "off", // 1
    "node/global-require": "off", // 1
    "import/no-named-as-default-member": "off", // 1
    "prefer-const": "off", // 1
    "operator-assignment": "off", // 1
    "no-constant-binary-expression": "off", // 1
  },
});
