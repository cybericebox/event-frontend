import {EmailTemplatePage} from "@/components/event/manage/notifications/EmailTemplatePage";

export default async function EmailTemplateRoute({params, searchParams}: {params: Promise<{signal: string}>; searchParams: Promise<{id?: string}>}) {
    const [{signal}, {id}] = await Promise.all([params, searchParams]);
    return <EmailTemplatePage key={`${signal}:${id ?? ""}`} signal={decodeURIComponent(signal)} versionID={id} />;
}
