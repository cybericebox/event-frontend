import {BroadcastTemplateEditor} from "@/components/event/manage/broadcasts/BroadcastTemplateEditor";

export default async function BroadcastTemplatePage({params}: {params: Promise<{id: string}>}) {
    const {id} = await params;
    return <BroadcastTemplateEditor key={id} templateID={id} />;
}
