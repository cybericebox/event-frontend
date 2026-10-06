import {BANNER_LABEL_MAX, BANNER_TEXT_MAX, type ManageBanner, type ManageBannerInput} from "@/api/manageBanners";
import {localFromISO, localToISO} from "@/components/ui/dateTimePicker";
import {t} from "@/i18n/t";
import {safeBannerLink} from "../../SiteBanners";

// The banner form: the API input with the two dates as picker values (local wall-clock strings).
export type BannerForm = Omit<ManageBannerInput, "ActiveFrom" | "ActiveTo"> & {ActiveFrom: string; ActiveTo: string};

export function emptyBannerForm(): BannerForm {
    return {Text: "", LinkURL: "", LinkLabel: "", Level: "info", ActiveFrom: "", ActiveTo: "", Dismissible: true, Audience: "everyone", IsActive: true};
}

export function bannerToForm(banner: ManageBanner): BannerForm {
    return {
        Text: banner.Text, LinkURL: banner.LinkURL, LinkLabel: banner.LinkLabel, Level: banner.Level, ActiveFrom: localFromISO(banner.ActiveFrom),
        ActiveTo: localFromISO(banner.ActiveTo), Dismissible: banner.Dismissible, Audience: banner.Audience, IsActive: banner.IsActive,
    };
}

export function bannerFormInput(form: BannerForm): ManageBannerInput {
    return {
        Text: form.Text.trim(), LinkURL: form.LinkURL.trim(), LinkLabel: form.LinkURL.trim() ? form.LinkLabel.trim() : "", Level: form.Level,
        ActiveFrom: localToISO(form.ActiveFrom), ActiveTo: localToISO(form.ActiveTo), Dismissible: form.Dismissible, Audience: form.Audience, IsActive: form.IsActive,
    };
}

// The first reason the banner cannot be saved; empty when it can.
export function bannerValidation(form: BannerForm): string {
    const text = form.Text.trim();
    if (!text) return t("manage.banners.validation.text");
    if ([...text].length > BANNER_TEXT_MAX) return t("manage.banners.validation.textLong", {max: BANNER_TEXT_MAX});
    const link = form.LinkURL.trim();
    if (link && !safeBannerLink(link)) return t("manage.banners.validation.link");
    if ([...form.LinkLabel.trim()].length > BANNER_LABEL_MAX) return t("manage.banners.validation.label", {max: BANNER_LABEL_MAX});
    const from = localToISO(form.ActiveFrom);
    const to = localToISO(form.ActiveTo);
    if (from && to && new Date(to) <= new Date(from)) return t("manage.banners.validation.window");
    return "";
}
