import type React from 'react'
import {t} from "@/i18n/t"

export default function Footer() {
    return (
        <div
            className={"w-full h-full mt-7 mb-2.5 text-[#211a52]"}
        >
            <center>{t("footer.copyright", {year: new Date().getFullYear()})}
                {process.env.NEXT_PUBLIC_SHOW_UNIVERSITY === 'true' && (
                    <><br/><a href="https://ice.nure.ua/ua/">{t("footer.supportedBy")}</a><br/>{t("footer.university")}</>
                )}
            </center>
        </div>
    )
}
