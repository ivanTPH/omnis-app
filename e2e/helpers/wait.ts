import { Page } from '@playwright/test'

export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
}

export async function waitForToast(page: Page, text?: string): Promise<void> {
  const selector = text ? `text=${text}` : '[role="alert"], [data-sonner-toast]'
  await page.waitForSelector(selector, { timeout: 8_000 })
}
