"use client";
import {useRouter} from "next/navigation";
import {ManageTabs, manageTabID, manageTabPanelID} from "../ManageTabs";
import {t} from "@/i18n/t";
import type {ReactNode} from "react";
export function ExercisesTabs({test, children}: {test: boolean; children: ReactNode}) {
    const router = useRouter();
    const value = test ? "test" : "exercises";
    return <><ManageTabs idPrefix="exercises" label={t("manage.nav.exercises")} value={value} tabs={[{value: "exercises", label: t("manage.exercises.mainTab")}, {value: "test", label: t("manage.previewSettings.title")}]} onChange={tab => router.push(tab === "test" ? "/manage/exercises?tab=test" : "/manage/exercises")} /><div className="ib-tabpanel" role="tabpanel" id={manageTabPanelID("exercises")} aria-labelledby={manageTabID("exercises", value)}>{children}</div></>;
}
