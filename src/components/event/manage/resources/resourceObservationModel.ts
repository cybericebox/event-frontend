import {t} from "@/i18n/t";
import {formatCpu, formatMemory} from "./resourcesModel";

function safeDecimal(value: string): number | null {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function decimalCpu(value: string): string {
    const number = safeDecimal(value);
    // The legacy formatter rounds cores to two decimals; retain any remaining millicore digit.
    return number === null || (number >= 1000 && BigInt(value) % BigInt(10) !== BigInt(0))
        ? t("manage.resources.observation.exactMcpu", {value: BigInt(value).toLocaleString("uk-UA")}) : formatCpu(number);
}
export function decimalMemory(value: string): string {
    const number = safeDecimal(value);
    const scale = number === null ? null : number >= 1024 ** 3 ? 1024 ** 3 : number >= 1024 ** 2 ? 1024 ** 2 : number >= 1024 ? 1024 : 1;
    // Compact memory uses one decimal; use exact bytes whenever that would discard information.
    return number === null || scale === null || BigInt(value) * BigInt(10) % BigInt(scale) !== BigInt(0)
        ? t("manage.resources.observation.exactBytes", {value: BigInt(value).toLocaleString("uk-UA")}) : formatMemory(number);
}
