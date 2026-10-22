"use client";

import {useEffect, useState} from "react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {getPublishedExerciseTags} from "@/api/manageChallenges";
import {EventLoadError} from "@/components/event/EventLoadError";
import {EventLoading} from "@/components/event/EventLoading";
import {EventMultiSelect} from "@/components/ui/EventMultiSelect";
import {t} from "@/i18n/t";

const tagLimit = 50;

// Tags of the catalog picker: a select with several choices over the tags of
// the exercises this event may attach. Its search asks the API by prefix (an
// empty one lists the most used); the list keeps the previous answer while the
// next one loads, so it never flashes.
export function CatalogTagSelect({eventID, value, onChange, enabled}: {
    eventID: string; value: string[]; onChange: (value: string[]) => void; enabled: boolean;
}) {
    const [draft, setDraft] = useState("");
    const [prefix, setPrefix] = useState("");
    useEffect(() => {
        const id = setTimeout(() => setPrefix(draft.trim()), draft.trim() ? 200 : 0);
        return () => clearTimeout(id);
    }, [draft]);
    const tags = useQuery({
        queryKey: ["event-exercise-catalog-tags", eventID, prefix],
        queryFn: () => getPublishedExerciseTags(eventID, prefix, tagLimit),
        enabled, refetchOnWindowFocus: false, placeholderData: keepPreviousData,
    });
    const state = tags.isPending ? <EventLoading compact label={t("manage.exercises.attachDialog.tagsLoading")} />
        : tags.isError ? <EventLoadError compact message={t("manage.exercises.attachDialog.tagsFailed")} error={tags.error} onRetry={() => void tags.refetch()} />
        : undefined;
    return <EventMultiSelect ariaLabel={t("manage.exercises.attachDialog.tags")} label={t("manage.exercises.attachDialog.tags")} emptyLabel={t("manage.exercises.attachDialog.tagsAny")}
        options={(tags.data ?? []).map(tag => ({value: tag.Tag, label: tag.Tag, hint: String(tag.ExerciseCount)}))} value={value} onChange={onChange} onSearch={setDraft} state={state} />;
}
