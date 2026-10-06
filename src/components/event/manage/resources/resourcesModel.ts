import {ManageApiError} from "@/api/manage";
import {ResourceErrorCode, type Amount, type ChangeRequestInput} from "@/api/manageResources";
import {apiErrorMessage} from "@/api/apiErrors";
import {localToISO} from "@/components/ui/dateTimePicker";
import {t} from "@/i18n/t";
import {formatBytes} from "../analytics/analyticsFormat";

const MIB = 1024 ** 2;

const cpuNumber = new Intl.NumberFormat("uk-UA", {maximumFractionDigits: 2});
const plural = new Intl.PluralRules("uk");

// Below one core it reads in milli-cores with Ukrainian plural forms, from one core in vCPU.
export function formatCpu(millicores: number): string {
    if (millicores > 0 && millicores < 1000) {
        const category = plural.select(Math.round(millicores));
        const form = category === "one" || category === "few" ? category : "many";
        return t(`manage.resources.unit.mcpu.${form}`, {value: cpuNumber.format(millicores)});
    }
    return t("manage.resources.unit.vcpu", {value: cpuNumber.format(millicores / 1000)});
}

// Memory in the same units the analytics use (МіБ, ГіБ with a decimal comma).
export const formatMemory = formatBytes;

// «456 мілі-ядер · 1,9 ГіБ»: CPU and memory.
export function amountText(amount: Amount): string {
    return t("manage.resources.amount", {cpu: formatCpu(amount.CPUMillicores), memory: formatMemory(amount.MemoryBytes)});
}

export type ChangeDraft = {sizeCpu: string; sizeMemory: string; dynamicCpu: string; dynamicMemory: string; windowStart: string; windowEnd: string; reason: string};
export const emptyDraft: ChangeDraft = {sizeCpu: "", sizeMemory: "", dynamicCpu: "", dynamicMemory: "", windowStart: "", windowEnd: "", reason: ""};

export type DraftIssue = "empty" | "size" | "dynamic" | "window" | "reason";

const wholeNumber = (value: string) => /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;

// An amount is two numbers (CPU in millicores, memory in MiB); both or none.
function amountOf(cpu: string, memory: string): Amount | null | "invalid" {
    if (cpu.trim() === "" && memory.trim() === "") return null;
    const millicores = wholeNumber(cpu);
    const mebibytes = wholeNumber(memory);
    if (millicores === null || mebibytes === null || millicores <= 0 || mebibytes <= 0) return "invalid";
    return {CPUMillicores: millicores, MemoryBytes: mebibytes * MIB};
}

// At least one of size, dynamic estimate, window start or end, plus a reason (the backend's 22507).
export function buildChangeRequest(draft: ChangeDraft): {input: ChangeRequestInput} | {issue: DraftIssue} {
    const size = amountOf(draft.sizeCpu, draft.sizeMemory);
    if (size === "invalid") return {issue: "size"};
    const dynamic = amountOf(draft.dynamicCpu, draft.dynamicMemory);
    if (dynamic === "invalid") return {issue: "dynamic"};
    const start = draft.windowStart ? localToISO(draft.windowStart) : null;
    const end = draft.windowEnd ? localToISO(draft.windowEnd) : null;
    if ((draft.windowStart && !start) || (draft.windowEnd && !end)) return {issue: "window"};
    if (start && end && new Date(end).getTime() <= new Date(start).getTime()) return {issue: "window"};
    if (!size && !dynamic && !start && !end) return {issue: "empty"};
    if (draft.reason.trim() === "") return {issue: "reason"};
    return {input: {Size: size, Dynamic: dynamic, WindowStart: start, WindowEnd: end, Reason: draft.reason.trim()}};
}

export const hasCode = (error: unknown, code: number) => error instanceof ManageApiError && error.code === code;
export const isNotEnoughReserved = (error: unknown) => hasCode(error, ResourceErrorCode.NotEnoughReserved);

// 72514 (one is pending) and 32513 (no reservation) have their own lines; others use the error catalog.
export function resourceErrorMessage(error: unknown, fallback: string): string {
    return apiErrorMessage(error instanceof ManageApiError ? error.code : undefined, fallback);
}
