"use client";

import {useParams} from "next/navigation";
import {CustomPageEditor} from "@/components/event/manage/CustomPageEditor";

export default function EditCustomPage() {
    const params = useParams<{slug: string}>();
    return <CustomPageEditor slug={params.slug} />;
}
