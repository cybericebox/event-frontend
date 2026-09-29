// The server renders the email as a fragment (inline styles, no <html>). Mail
// clients show such a fragment on a white sheet in a quiet grey canvas; the
// preview does the same, so the logo, the text and the button sit where they
// will in the inbox. Colours here are fixed on purpose: an email does not
// follow the site theme.
export function emailPreviewDocument(html: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>`
        + `html,body{margin:0;padding:0}`
        + `body{background:#eef0f4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#333333;-webkit-text-size-adjust:100%}`
        + `.sheet{box-sizing:border-box;max-width:600px;margin:0 auto;padding:32px 28px;background:#ffffff;border-radius:8px;overflow-wrap:anywhere}`
        + `.sheet img{max-width:100%;height:auto;border:0}`
        + `.sheet hr{border:0;border-top:1px solid #e2e5ea;margin:20px 0}`
        + `</style></head><body><div class="sheet">${html}</div></body></html>`;
}
