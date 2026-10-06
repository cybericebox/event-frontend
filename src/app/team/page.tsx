"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {EventLoading} from "@/components/event/EventLoading";
import {teamRedirectHref} from "@/components/event/participation/participationModel";
import {t} from "@/i18n/t";

// The team is a tab of «Моя участь» now; old links and invitations (/team?join=КОД) land there.
export default function Page() {
    const router = useRouter();
    useEffect(() => { router.replace(teamRedirectHref(window.location.search)); }, [router]);
    return <EventLoading label={t("participation.loading")} />;
}
