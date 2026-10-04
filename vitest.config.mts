import {fileURLToPath} from "node:url";
import {defineConfig} from "vitest/config";

export default defineConfig({
    resolve: {alias: {"@": fileURLToPath(new URL("./src", import.meta.url))}},
    test: {setupFiles: ["./vitest.setup.ts"], env: {
        TZ: "Europe/Kyiv",
        NEXT_PUBLIC_DOMAIN: "example.test",
        NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.test",
        NEXT_PUBLIC_PARTNER_ICE_NURE_URL: "https://partner.example.test/dept/",
        NEXT_PUBLIC_PARTNER_NURE_URL: "https://partner.example.test",
        NEXT_PUBLIC_WIREGUARD_INSTALL_URL: "https://wireguard.example.test/install/",
    }},
});
