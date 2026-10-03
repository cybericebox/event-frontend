// Content-Security-Policy builder. Pure: the proxy passes the nonce and the env in.
// Every origin comes from NEXT_PUBLIC_* env; the only literals are Google Analytics'
// own endpoints, added only when NEXT_PUBLIC_GOOGLE_ANALYTICS_ID is set.

export type CspEnv = {
    NEXT_PUBLIC_API_HOST?: string;
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?: string;
    NEXT_PUBLIC_CAPTCHA_PROVIDER?: string;
    NEXT_PUBLIC_DOS_PROTECTION?: string;
    NODE_ENV?: string;
};

const GA_SCRIPT = ["https://www.googletagmanager.com"];
const GA_CONNECT = [
    "https://www.googletagmanager.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
];

// Bot-check hosts, by provider. This app has no form: the check runs only for the invisible client token,
// so the hosts are allowed only when the provider is set and DOS protection is on.
type Hosts = {script: string[]; frame: string[]; connect: string[]};
const CAPTCHA_HOSTS: Record<string, Hosts> = {
    turnstile: {
        script: ["https://challenges.cloudflare.com"],
        frame: ["https://challenges.cloudflare.com"],
        connect: ["https://challenges.cloudflare.com"],
    },
    recaptcha: {
        script: ["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"],
        frame: ["https://www.google.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"],
        connect: ["https://www.google.com/recaptcha/"],
    },
};
const NO_HOSTS: Hosts = {script: [], frame: [], connect: []};

function captchaHosts(env: CspEnv): Hosts {
    const dos = ["on"].includes(env.NEXT_PUBLIC_DOS_PROTECTION?.trim() ?? "");
    const provider = env.NEXT_PUBLIC_CAPTCHA_PROVIDER?.trim() ?? "";
    return dos && Object.hasOwn(CAPTCHA_HOSTS, provider) ? CAPTCHA_HOSTS[provider] : NO_HOSTS;
}

export function generateNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
}

function hostOrigin(host: string | undefined): string | null {
    const value = host?.trim();
    return value ? `https://${value}` : null;
}

export function buildCsp(nonce: string, env: CspEnv): string {
    const dev = env.NODE_ENV === "development";
    const api = hostOrigin(env.NEXT_PUBLIC_API_HOST);
    const ga = Boolean(env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim());

    const captcha = captchaHosts(env);

    const scriptSrc = ["'self'", `'nonce-${nonce}'`, ...captcha.script, ...(ga ? GA_SCRIPT : []), ...(dev ? ["'unsafe-eval'"] : [])];
    // Next's dev server injects <style> tags without a nonce; production uses nonce + files only.
    const styleSrc = dev ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`];
    const connectSrc = ["'self'", ...(api ? [api] : []), ...captcha.connect, ...(ga ? GA_CONNECT : []), ...(dev ? ["ws:", "wss:"] : [])];

    const directives: Record<string, string[]> = {
        "default-src": ["'self'"],
        "script-src": scriptSrc,
        "style-src": styleSrc,
        // React renders style="" attributes (theme variables, text alignment): attributes only, never <style>.
        "style-src-attr": ["'unsafe-inline'"],
        // Organizer images (logos, banners, markdown) come from any https host; blob/data for QR codes and previews.
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "data:"],
        "connect-src": connectSrc,
        "media-src": ["'self'", "blob:", "https:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "frame-src": captcha.frame.length ? captcha.frame : ["'none'"],
        "worker-src": ["'self'", "blob:"],
        "manifest-src": ["'self'"],
    };
    const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
    if (!dev) parts.push("upgrade-insecure-requests");
    return parts.join("; ");
}
