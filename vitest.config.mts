import {fileURLToPath} from "node:url";
import {configDefaults, defineConfig} from "vitest/config";

export default defineConfig({
    resolve: {alias: {"@": fileURLToPath(new URL("./src", import.meta.url))}},
    test: {setupFiles: ["./vitest.setup.ts"], exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/.claude/worktrees/**"], env: {
        TZ: "Europe/Kyiv",
        NEXT_PUBLIC_DOMAIN: "example.test",
        NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.test",
    }},
});
