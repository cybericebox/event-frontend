/**
 * Optional installation settings (README, Configuration → Installation settings).
 *
 * Every setting is optional and "no value = not shown". The value of each one is written into an attribute of <html>
 * (settingsAttrs, spread in the root layout); src/styles/cfg.css hides the optional blocks by those attributes, so no JavaScript
 * decides what is shown and server and client markup are equal. In an image the attribute holds a placeholder (__NEXT_PUBLIC_X__) that the
 * container entrypoint replaces with the value or with an empty string, in the server and the client chunks alike; in a build with real values
 * it holds the value itself.
 *
 * Each variable is read by its literal name (Next inlines it) and only assigned to an attribute: no comparison, no `||`, no `??`, nothing a
 * minifier could fold into a constant at build time. (The old NEXT_PUBLIC_SHOW_PARTNERS was a comparison on the placeholder: it worked in
 * this app only because the bundler happened to leave `"__X__".trim()!=="false"` as a runtime expression; ID's identical line was folded and dead.)
 * A variable that does not exist at all (local `next dev`) leaves the attribute out; an empty one gives data-cfg-x="". Both mean "empty".
 */
export const settingsAttrs = () => ({
    "data-cfg-main-site-url": process.env.NEXT_PUBLIC_MAIN_SITE_URL,
    "data-cfg-cookies-url": process.env.NEXT_PUBLIC_COOKIES_URL,
    "data-cfg-ice-support": process.env.NEXT_PUBLIC_SHOW_ICE_DEPARTMENT_SUPPORT,
});

export type SettingName = "main-site-url" | "cookies-url" | "ice-support";

/**
 * The value of a setting, read from <html>. Only in event handlers, effects and validation, never while rendering (a render-time read
 * would differ between the server and the client). "" when the setting is empty or absent.
 */
export const cfg = (name: SettingName): string => document.documentElement.getAttribute(`data-cfg-${name}`) ?? "";
