import {redirect} from "next/navigation";

export default function ApplicationsPage() { redirect("/manage/participants?status=pending"); }
