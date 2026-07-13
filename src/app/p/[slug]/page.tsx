import { PagePlaceholder } from "@/components/event/PagePlaceholder";

export default async function ContentPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    return <PagePlaceholder title={`Сторінка · ${slug}`} />;
}
