import {defineConfig, globalIgnores} from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Every user-facing string comes from messages/*.json through t(); a Cyrillic
// literal in source is UI text that bypassed the catalogs.
const CYRILLIC = "/[\\u0400-\\u04FF]/";
const noCyrillicLiterals = {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/**/fixtures/**"],
    rules: {
        "no-restricted-syntax": ["error", ...[
            `Literal[value=${CYRILLIC}]`,
            `TemplateElement[value.raw=${CYRILLIC}]`,
            `JSXText[value=${CYRILLIC}]`,
        ].map(selector => ({selector, message: "Move UI text to messages/{uk,en}.json and render it with t()."}))],
    },
};

export default defineConfig([
    ...nextVitals,
    ...nextTs,
    noCyrillicLiterals,
    globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
