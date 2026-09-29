import {InAppTemplatePage} from "@/components/event/manage/notifications/InAppTemplatePage";

export default async function InAppTemplateRoute({params, searchParams}: {params: Promise<{signal: string}>; searchParams: Promise<{id?: string}>}) {
    const [{signal}, {id}] = await Promise.all([params, searchParams]);
    return <InAppTemplatePage key={`${signal}:${id ?? ""}`} signal={decodeURIComponent(signal)} versionID={id} />;
}
