import { test, expect } from '@playwright/test'

// Skip Socket.io-dependent tests in CI (no server running)
const SKIP_SOCKET = !!process.env.CI

test.describe('Home Page', () => {
  test('loads and shows create/join options', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/CodeCast/)
    await expect(page.locator('.action-card')).toHaveCount(2)
  })

  test('create session button navigates to host page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Start coding/i }).click()
    await page.waitForURL(/\/host\/[a-zA-Z0-9_-]+/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/host\//)
  })
})

test.describe('Host Page', () => {
  let hostUrl: string
  let sessionId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Start coding/i }).click()
    await page.waitForURL(/\/host\/[a-zA-Z0-9_-]+/, { timeout: 10_000 })
    hostUrl = page.url()
    sessionId = hostUrl.split('/host/')[1]
  })

  test('shows Monaco editor', async ({ page }) => {
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })
    const editor = page.locator('.monaco-editor')
    await expect(editor).toBeVisible()
  })

  test('shows session ID in topbar', async ({ page }) => {
    const badge = page.locator('.session-id-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText(sessionId)
  })

  test('shows Live connection badge', async ({ page }) => {
    // Socket.io connection requires the server — skip in CI
    test.skip(SKIP_SOCKET, 'Socket.io server not available in CI')
    await expect(page.locator('.conn-badge--connected')).toBeVisible({ timeout: 8_000 })
  })

  test('shows viewer count pill', async ({ page }) => {
    await expect(page.locator('.viewer-pill')).toBeVisible()
  })

  test('copy viewer link button exists', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Share link/i }).first()
    await expect(btn).toBeVisible()
  })

  test('shows Watch Replay button', async ({ page }) => {
    await expect(page.getByText(/Watch Replay/i)).toBeVisible()
  })
})

test.describe('Viewer Page', () => {
  let sessionId: string

  test.beforeEach(async ({ browser }) => {
    const hostCtx = await browser.newContext()
    const hostPage = await hostCtx.newPage()
    await hostPage.goto('http://localhost:3002')
    await hostPage.getByRole('button', { name: /Start coding/i }).click()
    await hostPage.waitForURL(/\/host\/[a-zA-Z0-9_-]+/)
    sessionId = hostPage.url().split('/host/')[1]
    await hostCtx.close()
  })

  test('viewer page loads for valid session', async ({ page }) => {
    await page.goto(`/s/${sessionId}`)
    await expect(page).toHaveTitle(/CodeCast/)
    await expect(page.locator('.session-id-badge')).toContainText(sessionId)
  })

  test('viewer shows Watching live badge after connecting', async ({ page }) => {
    test.skip(SKIP_SOCKET, 'Socket.io server not available in CI')
    await page.goto(`/s/${sessionId}`)
    await expect(page.locator('.conn-badge--connected')).toBeVisible({ timeout: 8_000 })
  })

  test('viewer shows Monaco read-only editor', async ({ page }) => {
    await page.goto(`/s/${sessionId}`)
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })
    const editor = page.locator('.monaco-editor')
    await expect(editor).toBeVisible()
  })

  test('viewer has Q&A tab', async ({ page }) => {
    await page.goto(`/s/${sessionId}`)
    await expect(page.getByText('Q&A')).toBeVisible({ timeout: 8_000 })
  })

  test('viewer shows viewer name in topbar', async ({ page }) => {
    await page.goto(`/s/${sessionId}`)
    await expect(page.locator('.viewer-name-badge')).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Replay Page', () => {
  test('replay page loads with error state for unknown session', async ({ page }) => {
    await page.goto('/replay/nonexistent-session-xyz')
    await expect(page).toHaveTitle(/CodeCast/)
    // Should show either error state or loading → error
    await expect(page.locator('.replay-badge')).toBeVisible({ timeout: 5_000 })
  })
})
