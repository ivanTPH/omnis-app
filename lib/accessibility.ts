export type AccessibilitySettings = {
  dyslexiaFont:  boolean
  highContrast:  boolean
  largeText:     boolean
  reducedMotion: boolean
  lineSpacing:   string
}

export const ACCESSIBILITY_DEFAULTS: AccessibilitySettings = {
  dyslexiaFont:  false,
  highContrast:  false,
  largeText:     false,
  reducedMotion: false,
  lineSpacing:   'normal',
}

export function settingsToClasses(settings: AccessibilitySettings | null): string {
  if (!settings) return ''
  const classes: string[] = []
  if (settings.dyslexiaFont)  classes.push('dyslexia-font')
  if (settings.highContrast)  classes.push('high-contrast')
  if (settings.largeText)     classes.push('large-text')
  if (settings.reducedMotion) classes.push('reduced-motion')
  if (settings.lineSpacing === 'wide')  classes.push('line-spacing-wide')
  if (settings.lineSpacing === 'wider') classes.push('line-spacing-wider')
  return classes.join(' ')
}

export function hasActiveSettings(settings: AccessibilitySettings | null): boolean {
  if (!settings) return false
  return settings.dyslexiaFont
    || settings.highContrast
    || settings.largeText
    || settings.reducedMotion
    || settings.lineSpacing !== 'normal'
}
