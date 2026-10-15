import {getCommonManifest} from "@/api/commonPage";
export async function GET(request:Request) {
    const slug=new URL(request.url).searchParams.get("page") ?? "";
    const headers={"Cache-Control":"no-store"};
    if (slug.length>128 || (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) return new Response(null,{status:404,headers});
    try {
        const manifest=await getCommonManifest(slug);
        return manifest ? Response.json({Revision:manifest.Revision},{headers}):new Response(null,{status:404,headers});
    } catch {return new Response(null,{status:503,headers});}
}
