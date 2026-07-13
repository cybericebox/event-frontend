import { PagePlaceholder } from "@/components/event/PagePlaceholder";

export default async function TeamDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <PagePlaceholder title={`Деталь команди · ${id}`} />;
}
