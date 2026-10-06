import {fileURLToPath} from "node:url";
import {configDefaults, defineConfig} from "vitest/config";

export default defineConfig({
    resolve: {alias: {"@": fileURLToPath(new URL("./src", import.meta.url))}},
    test: {
        // The tests are fast alone (100-400 ms each) but run on shared machines and CI runners where
        // the CPU is oversubscribed; the default 5 s test budget then expires on no logic fault.
        testTimeout: 20000, hookTimeout: 20000,
        setupFiles: ["./vitest.setup.ts"], exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/.claude/worktrees/**"], env: {
        TZ: "Europe/Kyiv",
        NEXT_PUBLIC_DOMAIN: "example.test",
        NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.test",
    }},
});
