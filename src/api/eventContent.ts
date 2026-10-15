import {getCommonPage} from "./commonPage";
import type {EventContent,EventPageContent} from "@/types/eventContent";
export type {EventContent,EventPageContent} from "@/types/eventContent";
export async function getLandingContent():Promise<EventContent|null> {
    const bundle=await getCommonPage();
    return bundle ? {Landing:bundle.Page.Document,Variables:bundle.Variables}:null;
}
export async function getEventPageContent(slug:string):Promise<EventPageContent|null> {
    const bundle=await getCommonPage(slug);
    return bundle ? {Page:bundle.Page,Variables:bundle.Variables}:null;
}
