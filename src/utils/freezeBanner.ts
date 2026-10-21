import type {BannerLevel} from "@/api/manageBanners";
import type {SiteBannerData} from "@/components/event/SiteBanners";
import {t} from "@/i18n/t";

export function freezeBannerData(freeze: {BannerText?: string; BannerLevel?: BannerLevel}): SiteBannerData {
    return {
        Text: freeze.BannerText?.trim() || t("scoreboard.frozenDefaultMessage"),
        Level: freeze.BannerLevel ?? "warning",
        LinkURL: "", LinkLabel: "", Dismissible: false,
    };
}
