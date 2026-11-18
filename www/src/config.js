// Language separation rules (plan section 4): UI is always English,
// teaching explanations are Bengali, the practice language is English.
export const LOCALES = Object.freeze({ ui_locale: 'en', explanation_language: 'bn', target_language: 'en' });

// Shown in Help and sent with feedback and usage events. Keep in step with package.json.
export const APP_VERSION = '0.2.0';
