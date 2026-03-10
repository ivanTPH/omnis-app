import { Page, expect } from '@playwright/test'

export class SidebarPage {
  constructor(private page: Page) {}

  async expectNavItem(label: string) {
    await expect(this.page.locator('nav').getByText(label, { exact: false })).toBeVisible({ timeout: 8_000 })
  }

  async expectNoNavItem(label: string) {
    await expect(this.page.locator('nav').getByText(label, { exact: false })).not.toBeVisible()
  }

  async clickNavItem(label: string) {
    await this.page.locator('nav').getByText(label, { exact: false }).first().click()
  }
}
