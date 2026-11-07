import { test, expect } from '@playwright/test'

// Smoke tests that don't depend on the API being reachable: the shell, titles and routing
test('home page renders the storefront shell with a real title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Order pizza for pickup · Sellout Pizza')
    await expect(page.getByRole('link', { name: 'Sellout Pizza home' })).toBeVisible()
})

test('unknown URLs show a not-found page', async ({ page }) => {
    await page.goto('/no-such-page')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(page).toHaveTitle('Page not found · Sellout Pizza')
})
