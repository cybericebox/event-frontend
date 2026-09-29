export const IN_APP_ICONS = [
    {value: "info", labelKey: "manage.notifications.icon.info"},
    {value: "success", labelKey: "manage.notifications.icon.success"},
    {value: "warning", labelKey: "manage.notifications.icon.warning"},
    {value: "error", labelKey: "manage.notifications.icon.error"},
    {value: "bell", labelKey: "manage.notifications.icon.bell"},
    {value: "mail", labelKey: "manage.notifications.icon.mail"},
    {value: "calendar", labelKey: "manage.notifications.icon.calendar"},
    {value: "user", labelKey: "manage.notifications.icon.user"},
    {value: "shield", labelKey: "manage.notifications.icon.shield"},
    {value: "trophy", labelKey: "manage.notifications.icon.trophy"},
] as const;

// A tone picks the default icon and colour; the accent colour overrides the colour.
export const IN_APP_TONES = [
    {tone: "neutral", icon: "bell", labelKey: "manage.notifications.tone.neutral"},
    {tone: "info", icon: "info", labelKey: "manage.notifications.tone.info"},
    {tone: "success", icon: "success", labelKey: "manage.notifications.tone.success"},
    {tone: "warning", icon: "warning", labelKey: "manage.notifications.tone.warning"},
    {tone: "danger", icon: "error", labelKey: "manage.notifications.tone.danger"},
] as const;

export const POP_IN_MIN_SECONDS = 3;
export const POP_IN_MAX_SECONDS = 10;
