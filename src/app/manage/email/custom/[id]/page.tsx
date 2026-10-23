import {CustomTemplateEditor} from "@/components/event/manage/notifications/CustomTemplateEditor";

export default async function CustomTemplatePage({params}: {params: Promise<{id: string}>}) {
    const {id} = await params;
    return <CustomTemplateEditor key={id} templateID={id} channel="email" />;
}
