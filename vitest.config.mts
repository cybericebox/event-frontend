import {fileURLToPath} from "node:url";
import {defineConfig} from "vitest/config";

export default defineConfig({
    resolve: {alias: {"@": fileURLToPath(new URL("./src", import.meta.url))}},
    test: {setupFiles: ["./vitest.setup.ts"], env: {
        TZ: "Europe/Kyiv",
        NEXT_PUBLIC_MAIN_HOST: "example.test",
        NEXT_PUBLIC_API_HOST: "api.example.test",
        NEXT_PUBLIC_ID_HOST: "id.example.test",
        NEXT_PUBLIC_ADMIN_HOST: "admin.example.test",
        NEXT_PUBLIC_EXERCISES_HOST: "exercises.example.test",
        NEXT_PUBLIC_EVENT_DOMAIN: "example.test",
        NEXT_PUBLIC_PARTNER_URL: "https://partner.example.test/dept/",
        NEXT_PUBLIC_PARTNER_SITE_URL: "https://partner.example.test",
        NEXT_PUBLIC_WIREGUARD_INSTALL_URL: "https://wireguard.example.test/install/",
    }},
});
