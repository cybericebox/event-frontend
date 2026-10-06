import {t} from "@/i18n/t";

// First focusable element of every shell: jumps past the navigation to <main id="main">.
export function SkipLink() {
    return <a className="ib-skip" href="#main">{t("a11y.skipToContent")}</a>;
}
