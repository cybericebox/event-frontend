import type {Metadata} from "next";
import ContentPage, {generateMetadata as contentMetadata} from "../[slug]/page";

const params = Promise.resolve({slug: "faq"});

export function generateMetadata(): Promise<Metadata> {
    return contentMetadata({params});
}

export default function FaqPage() {
    return <ContentPage params={params} />;
}
