import {reservedPageSlugs} from "@/components/event/content/pageSlugs";
export function commonPageSlug(pathname:string):string|null {
    if (pathname==="/") return "";
    const match=/^\/(?:p\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
    return match && !reservedPageSlugs.has(match[1]) ? match[1]:null;
}
