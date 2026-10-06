import {redirect} from "next/navigation";

export default async function LegacyContentPage({params}: {params: Promise<{slug: string}>}) {
    const {slug} = await params;
    redirect(`/${slug}`);
}
