"use client";

import {useRef} from "react";
import Image from "next/image";
import {ArrowDown, ArrowUp, Plus, Trash2} from "lucide-react";
import type {ManageEmailBlock} from "@/api/manageEmailTemplates";
import {t} from "@/i18n/t";
import {ManageFieldLabel} from "./ManageFieldLabel";
import {emailBlockTitle, emailRichText, emailRichTextBlock, isSimpleEmailRichText} from "./emailBlocks";
import {EmptyState} from "@/components/ui/EmptyState";

export function EmailBlocksEditor({blocks, onChange, onUploadImage, imageURL, disabled}: {
    blocks: ManageEmailBlock[]; onChange: (blocks: ManageEmailBlock[]) => void;
    onUploadImage: (file: File) => Promise<void>; imageURL: (fileID: string) => string; disabled: boolean;
}) {
    const imageInput = useRef<HTMLInputElement>(null);
    const update = (index: number, block: ManageEmailBlock) => onChange(blocks.map((item, position) => position === index ? block : item));
    const remove = (index: number) => onChange(blocks.filter((_, position) => position !== index));
    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= blocks.length) return;
        const next = [...blocks]; [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    return <div className="event-email-blocks"><div className="event-manage-section__head"><h2>{t("manage.email.blocks.title")}</h2><p>{t("manage.email.blocks.intro")}</p></div>
        {blocks.length === 0 && <EmptyState compact message={t("manage.email.blocks.empty")} />}
        <div className="event-email-blocks__list">{blocks.map((block, index) => <section className="event-email-blocks__item" key={`${block.type}-${index}`}><div className="event-email-blocks__head"><strong>{t("manage.email.blocks.heading", {number: index + 1, title: emailBlockTitle(block)})}</strong><div><button type="button" aria-label={t("manage.email.blocks.moveUp", {number: index + 1})} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={t("manage.email.blocks.moveDown", {number: index + 1})} disabled={disabled || index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button type="button" aria-label={t("manage.email.blocks.remove", {number: index + 1})} disabled={disabled} onClick={() => remove(index)}><Trash2 size={16} /></button></div></div>
            {block.type === "rich_text" ? <div className="event-manage-field"><ManageFieldLabel title={t("manage.email.blocks.textLabel", {number: index + 1})} help={t("manage.email.blocks.textHelp")} htmlFor={`event-email-block-${index}`} /><textarea className="event-manage-input" id={`event-email-block-${index}`} rows={4} disabled={disabled || !isSimpleEmailRichText(block)} value={emailRichText(block)} onChange={e => update(index, emailRichTextBlock(e.target.value))} />{!isSimpleEmailRichText(block) && <><small>{t("manage.email.blocks.formatted")}</small>{!disabled && <button className="ib-btn ib-btn--sm" type="button" onClick={() => update(index, emailRichTextBlock(emailRichText(block)))}>{t("manage.email.blocks.toPlain")}</button>}</>}</div> : null}
            {block.type === "button" ? <div className="event-manage-fields-two"><label className="event-manage-field"><span>{t("manage.email.blocks.buttonText")}</span><input className="event-manage-input" value={String(block.label ?? "")} disabled={disabled} onChange={e => update(index, {...block, label: e.target.value})} /></label><label className="event-manage-field"><span>{t("manage.email.blocks.link")}</span><input className="event-manage-input" value={String(block.url ?? "")} disabled={disabled} onChange={e => update(index, {...block, url: e.target.value})} placeholder="https://…" /></label></div> : null}
            {block.type === "logo" ? <label className="event-manage-field"><span>{t("manage.email.blocks.logoWidth")}</span><input className="event-manage-input" type="number" min={24} max={400} value={Number(block.width_px ?? 64)} disabled={disabled} onChange={e => update(index, {...block, width_px: Number(e.target.value)})} /></label> : null}
            {block.type === "image" ? <><div className="event-manage-fields-two"><label className="event-manage-field"><span>{t("manage.email.blocks.imageAlt")}</span><input className="event-manage-input" value={String(block.alt ?? "")} disabled={disabled} onChange={e => update(index, {...block, alt: e.target.value})} /></label><label className="event-manage-field"><span>{t("manage.email.blocks.imageWidth")}</span><input className="event-manage-input" type="number" min={10} max={100} value={Number(block.width_pct ?? 100)} disabled={disabled} onChange={e => update(index, {...block, width_pct: Number(e.target.value)})} /></label></div>{imageURL(String(block.file_id ?? "")) && <Image unoptimized width={420} height={200} className="event-email-blocks__image" src={imageURL(String(block.file_id))} alt={String(block.alt ?? "")} />}</> : null}
            {block.type === "divider" && <p className="event-email-blocks__hint">{t("manage.email.blocks.dividerHint")}</p>}
            {block.type === "preset" && <p className="event-email-blocks__hint">{String(block.name ?? t("manage.email.blocks.presetHint"))}</p>}
            {!(["rich_text", "button", "divider", "logo", "image", "preset"].includes(block.type)) && <p className="event-email-blocks__hint">{t("manage.email.blocks.unknownHint")}</p>}
        </section>)}</div>
        {!disabled && <div className="event-email-blocks__add"><button className="ib-btn ib-btn--sm" type="button" onClick={() => onChange([...blocks, emailRichTextBlock("")])}><Plus size={15} /> {t("manage.email.block.richText")}</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => onChange([...blocks, {type: "button", label: "", url: "", align: "left"}])}><Plus size={15} /> {t("manage.email.block.button")}</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => onChange([...blocks, {type: "divider"}])}><Plus size={15} /> {t("manage.email.block.divider")}</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => onChange([...blocks, {type: "logo", align: "center", width_px: 64}])}><Plus size={15} /> {t("manage.email.block.logo")}</button><button className="ib-btn ib-btn--sm" type="button" onClick={() => imageInput.current?.click()}><Plus size={15} /> {t("manage.email.block.image")}</button><input ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif" hidden onChange={event => {const file = event.target.files?.[0]; event.target.value = ""; if (file) void onUploadImage(file);}} /></div>}
    </div>;
}
