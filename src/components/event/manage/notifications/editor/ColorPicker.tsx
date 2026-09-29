"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { cn } from "@/utils/cn";
import { t } from "@/i18n/t";
import { ManageFieldLabel } from "../../ManageFieldLabel";
import { THEME_TOKENS, DEFAULT_BRAND, type BrandColors } from "./emailBlocks";

interface Props {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  help?: string;
  /** Colours the `theme:*` tokens stand for (the Event brand). */
  brand?: BrandColors;
}

type RGB = { r: number; g: number; b: number };
type HSV = { h: number; s: number; v: number };

type EyeDropperInstance = { open: () => Promise<{ sRGBHex: string }> };
type EyeDropperCtor = new () => EyeDropperInstance;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) {
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  return null;
}

/** `theme:*` tokens (see emailBlocks.ts) resolve to the platform brand swatch
 *  instead of a literal hex value picked in the SV/hue square. */
function isThemeToken(v: string): v is (typeof THEME_TOKENS)[number] {
  return (THEME_TOKENS as readonly string[]).includes(v);
}

function resolveColor(value: string, brand: BrandColors): string {
  if (isThemeToken(value)) return brand[value];
  return normalizeHex(value) ?? "#000000";
}

const THEME_TOKEN_LABEL_KEYS: Record<(typeof THEME_TOKENS)[number], string> = {
  "theme:brand":     "manage.tpl.editor.colorToken.brand",
  "theme:accent":    "manage.tpl.editor.colorToken.accent",
  "theme:on_accent": "manage.tpl.editor.colorToken.onAccent",
};

function hexToRgb(hex: string): RGB {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const hh = (h / 60) % 6;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] = hh < 1 ? [c, x, 0]
    : hh < 2 ? [x, c, 0]
    : hh < 3 ? [0, c, x]
    : hh < 4 ? [0, x, c]
    : hh < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = v - c;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function ColorPicker({ value, onChange, label, help, brand = DEFAULT_BRAND }: Props) {
  const initial = resolveColor(value, brand);
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(hexToRgb(initial)));
  const [hexInput, setHexInput] = useState<string>(initial);
  const [prevValue, setPrevValue] = useState<string>(value);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);

  // Sync internal state when external `value` prop changes.
  // Using the "store previous prop" pattern instead of an effect to avoid
  // cascading renders flagged by react-hooks/set-state-in-effect.
  if (value !== prevValue) {
    setPrevValue(value);
    const nh = isThemeToken(value) ? brand[value] : normalizeHex(value);
    if (nh && nh !== rgbToHex(hsvToRgb(hsv))) {
      setHsv(rgbToHsv(hexToRgb(nh)));
      setHexInput(nh);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const rgb = useMemo(() => hsvToRgb(hsv), [hsv]);
  const hex = useMemo(() => rgbToHex(rgb), [rgb]);

  const commit = useCallback(
    (next: HSV) => {
      setHsv(next);
      const nextHex = rgbToHex(hsvToRgb(next));
      setHexInput(nextHex);
      onChange(nextHex);
    },
    [onChange]
  );

  const onSvPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = svRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      const handle = (clientX: number, clientY: number) => {
        const rect = el.getBoundingClientRect();
        const x = clamp(clientX - rect.left, 0, rect.width);
        const y = clamp(clientY - rect.top, 0, rect.height);
        commit({ h: hsv.h, s: x / rect.width, v: 1 - y / rect.height });
      };
      handle(e.clientX, e.clientY);
      const onMove = (ev: PointerEvent) => handle(ev.clientX, ev.clientY);
      const onUp = () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    },
    [commit, hsv.h]
  );

  const onHuePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = hueRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      const handle = (clientX: number) => {
        const rect = el.getBoundingClientRect();
        const x = clamp(clientX - rect.left, 0, rect.width);
        commit({ h: (x / rect.width) * 360, s: hsv.s, v: hsv.v });
      };
      handle(e.clientX);
      const onMove = (ev: PointerEvent) => handle(ev.clientX);
      const onUp = () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    },
    [commit, hsv.s, hsv.v]
  );

  const onHexBlur = () => {
    const nh = normalizeHex(hexInput);
    if (nh) {
      setHsv(rgbToHsv(hexToRgb(nh)));
      setHexInput(nh);
      onChange(nh);
    } else {
      setHexInput(hex);
    }
  };

  const onRgbInput = (channel: keyof RGB, raw: string) => {
    const n = clamp(parseInt(raw || "0", 10) || 0, 0, 255);
    const next = { ...rgb, [channel]: n } as RGB;
    commit(rgbToHsv(next));
  };

  const hueColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  const hasEyeDropper =
    typeof window !== "undefined" &&
    typeof (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper === "function";

  const openEyeDropper = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const result = await new Ctor().open();
      const nh = normalizeHex(result.sRGBHex);
      if (nh) {
        setHsv(rgbToHsv(hexToRgb(nh)));
        setHexInput(nh);
        onChange(nh);
      }
    } catch {
      // User canceled.
    }
  };

  return (
    <div ref={rootRef} className="relative inline-flex flex-col gap-1">
      {label && (help ? <ManageFieldLabel title={label} help={help} /> : <span className="text-xs font-medium text-(--ib-dim)">{label}</span>)}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-6 h-6 rounded-md border border-(--ib-line)"
          style={{ background: hex }}
          aria-label={t("manage.tpl.editor.openColorPicker")}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={onHexBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(
            "px-2 py-1 w-24 text-sm rounded-md border border-(--ib-line) font-mono",
            "bg-(--ib-soft) text-(--ib-ink) placeholder:text-(--ib-dim)",
            "focus:outline-none focus:ring-1 focus:ring-(--ib-action)"
          )}
        />
      </div>
      {/* Brand theme-token chips — pick a `theme:*` token instead of a literal hex. */}
      <div className="flex flex-wrap items-center gap-1">
        {THEME_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => onChange(token)}
            aria-pressed={value === token}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
              value === token
                ? "border-(--ib-action) bg-(--ib-soft) text-(--ib-action)"
                : "border-(--ib-line) bg-(--ib-soft) text-(--ib-dim) hover:bg-(--ib-soft)"
            )}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: brand[token] }}
            />
            {t(THEME_TOKEN_LABEL_KEYS[token])}
          </button>
        ))}
      </div>
      {open && (
        <div
          className={cn(
            "absolute top-full left-0 mt-2 z-50 w-[232px] p-3 rounded-xl",
            "bg-(--ib-raised) border border-(--ib-line)"
          )}
        >
          <div
            ref={svRef}
            data-testid="sv-square"
            onPointerDown={onSvPointer}
            className="relative w-[200px] h-[140px] rounded-md touch-none cursor-crosshair"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
            }}
          >
            <div
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white outline outline-1 outline-black/40 pointer-events-none"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                background: hex,
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            ref={hueRef}
            onPointerDown={onHuePointer}
            className="relative w-[200px] h-3 mt-3 rounded-full touch-none cursor-pointer"
            style={{
              background:
                "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            }}
          >
            <div
              className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white outline outline-1 outline-black/40 pointer-events-none"
              style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
            />
          </div>

          {/* RGB inputs */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["r", "g", "b"] as const).map((ch) => (
              <label key={ch} className="flex flex-col items-center">
                <span className="text-[10px] font-semibold uppercase text-(--ib-dim)">
                  {ch}
                </span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={Math.round(rgb[ch])}
                  onChange={(e) => onRgbInput(ch, e.target.value)}
                  className={cn(
                    "w-full px-1 py-1 text-xs text-center rounded-md border border-(--ib-line)",
                    "bg-(--ib-soft) text-(--ib-ink)",
                    "focus:outline-none focus:ring-1 focus:ring-(--ib-action)"
                  )}
                />
              </label>
            ))}
          </div>

          {/* EyeDropper (feature-detected) */}
          {hasEyeDropper && (
            <button
              type="button"
              onClick={openEyeDropper}
              className={cn(
                "mt-3 w-full flex items-center justify-center gap-2 py-1.5",
                "rounded-md border border-(--ib-line) text-xs font-medium",
                "text-(--ib-ink) hover:bg-(--ib-soft) hover:text-(--ib-ink)",
                "transition-colors"
              )}
            >
              <Pipette size={14} />
              {t("manage.tpl.editor.pickFromScreen")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ColorPicker;
