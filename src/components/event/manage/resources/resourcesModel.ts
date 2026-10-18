import {ManageApiError} from "@/api/manage";
import {ResourceErrorCode, type Amount, type ChangeRequestInput} from "@/api/manageResources";
import {apiErrorText} from "@/api/apiErrors";
import {localToISO} from "@/components/ui/dateTimePicker";
import {t} from "@/i18n/t";
import {formatBytes} from "../analytics/analyticsFormat";

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

const GIB = 1024 ** 3;
// The platform ties CPU to memory: 250 millicores per GiB (the backend's milliCPUPerGiB).
const MILLICPU_PER_GIB = 250;
const gbNumber = new Intl.NumberFormat("uk-UA", {maximumFractionDigits: 1});

// Memory in GB, the only unit of the reserve: «3,4 ГБ». CPU is not shown here.
export const formatGB = (bytes: number) => t("manage.resources.gb", {value: gbNumber.format(bytes / GIB)});

// What the event uses beyond its reserve, in bytes; 0 while the usage fits.
export const shortageBytes = (resources: {Allocated: Amount; InUse: Amount}) => Math.max(0, resources.InUse.MemoryBytes - resources.Allocated.MemoryBytes);

export type ChangeDraft = {extraGB: string; extendTo: string; reason: string};
export const emptyDraft: ChangeDraft = {extraGB: "", extendTo: "", reason: ""};

export type DraftIssue = "empty" | "extra" | "extend" | "reason";
export type CurrentReserve = {allocated: Amount; to: string | null};

// A positive decimal with a dot or a comma; null when empty, NaN when it is not one.
function extraOf(text: string): number | null {
    const value = text.trim().replace(",", ".");
    if (value === "") return null;
    const number = /^\d+(\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
    return number > 0 ? number : Number.NaN;
}

export function changeRequestErrors(draft: ChangeDraft, current: CurrentReserve): Partial<Record<keyof ChangeDraft | "empty", DraftIssue>> {
    const errors: Partial<Record<keyof ChangeDraft | "empty", DraftIssue>> = {};
    const extra = extraOf(draft.extraGB);
    if (Number.isNaN(extra)) errors.extraGB = "extra";
    const end = draft.extendTo ? localToISO(draft.extendTo) : null;
    if (draft.extendTo && (!end || (current.to && new Date(end).getTime() <= new Date(current.to).getTime()))) errors.extendTo = "extend";
    if (extra === null && !draft.extendTo) errors.empty = "empty";
    if (!draft.reason.trim()) errors.reason = "reason";
    return errors;
}

// The new total of the reserve for «на скільки більше»: memory in GB, CPU follows the memory.
export function enlarged(allocated: Amount, extraGB: number): Amount {
    return {CPUMillicores: allocated.CPUMillicores + Math.round(extraGB * MILLICPU_PER_GIB), MemoryBytes: allocated.MemoryBytes + Math.round(extraGB * GIB)};
}

// «На скільки більше» and/or «Продовжити до», plus a reason (the backend's 22507). The extra is sent as the new
// total size; the end is the real end of the reservation.
export function buildChangeRequest(draft: ChangeDraft, current: CurrentReserve): {input: ChangeRequestInput} | {issue: DraftIssue} {
    const extra = extraOf(draft.extraGB);
    if (Number.isNaN(extra)) return {issue: "extra"};
    const end = draft.extendTo ? localToISO(draft.extendTo) : null;
    if (draft.extendTo && (!end || (current.to && new Date(end).getTime() <= new Date(current.to).getTime()))) return {issue: "extend"};
    if (extra === null && !end) return {issue: "empty"};
    if (draft.reason.trim() === "") return {issue: "reason"};
    return {input: {Size: extra === null ? null : enlarged(current.allocated, extra), Dynamic: null, WindowStart: null, WindowEnd: end, Reason: draft.reason.trim()}};
}

export const hasCode = (error: unknown, code: number) => error instanceof ManageApiError && error.code === code;
export const isNotEnoughReserved = (error: unknown) => hasCode(error, ResourceErrorCode.NotEnoughReserved);

// 72514 (one is pending) and 32513 (no reservation) have their own lines; others use the error catalog.
export function resourceErrorMessage(error: unknown, fallback: string): string {
    return apiErrorText(error, fallback);
}
