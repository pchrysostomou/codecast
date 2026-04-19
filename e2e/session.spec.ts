import { test, expect } from '@playwright/test'

// Skip Socket.io-dependent tests in CI (no server running)
const SKIP_SOCKET = !!process.env.CI

// Monaco takes a few seconds to fully initialise in CI
const MONACO_TIMEOUT = 20_000

test.describe('Home Page', () => {
  test('loads and shows create/join options', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/CodeCast/)
    // New premium landing has lp-btn--primary and lp-join-input
    await expect(page.locator('.lp-btn--primary').first()).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('.lp-join-input')).toBeVisible({ timeout: 8_000 })
  })

  test('create session button navigates to host page', async ({ page }) => {
    await page.goto('/')
    // "Start a session" is the primary CTA; "Start coding →" in nav also works
    await page.locator('#start-coding-btn').click()
    await page.waitForURL(/\/host\/[a-zA-Z0-9_-]+/, { timeout: 15_000 })
    expect(page.url()).toMatch(/\/host\//)
  })
})


test.describe('Host Page', () => {
  let hostUrl: string
  let sessionId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Start coding/i }).click()
    await page.waitForURL(/\/host\/[a-zA-Z0-9_-]+/, { timeout: 15_000 })
    hostUrl = page.url()
    sessionId = hostUrl.split('/host/')[1]
    // Wait for page to settle before running assertions
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  })

  test('shows Monaco editor', async ({ page }) => {
    // Monaco needs extra time to initialise in CI
    await page.waitForSelector('.monaco-editor', { timeout: MONACO_TIMEOUT })
    const editor = page.locator('.monaco-editor')
    await expect(editor).toBeVisible()
  })

  test('shows session ID in topbar', async ({ page }) => {
    const badge = page.locator('.session-id-badge')
    await expect(badge).toBeVisible({ timeout: 8_000 })
    await expect(badge).toContainText(sessionId)
  })

  test('shows Live connection badge', async ({ page }) => {
    // Socket.io connection requires the server — skip in CI
    test.skip(SKIP_SOCKET, 'Socket.io server not available in CI')
    await expect(page.locator('.conn-badge--connected')).toBeVisible({ timeout: 8_000 })
  })

  test('shows viewer count pill', async ({ page }) => {
    await expect(page.locator('.viewer-pill')).toBeVisible({ timeout: 8_000 })
  })

  test('copy viewer link button exists', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Share link/i }).first()
    await expect(btn).toBeVisible({ timeout: 8_000 })
  })

  test('shows Watch Replay button', async ({ page }) => {
    await expect(page.getByText(/Watch Replay/i)).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Viewer Page', () => {
  let sessionId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('#start-coding-btn').click()
    await page.waitForURL(/\/host\/[a-zA-Z0-9_-]+/, { timeout: 15_000 })
    sessionId = page.url().split('/host/')[1]
  })

  test('viewer page loads for valid session', async ({ page }) => {
    await page.goto(`/s/${sessionId}`)
    await expect(page).toHaveTitle(/CodeCast/)
    await expect(page.locator('.session-id-badge')).toContainText(sessionId, { timeout: 8_000 })
  })

  test('viewer shows Watching live badge after connecting', async ({ page }) => {
    test.skip(SKIP_SOCKET, 'Socket.io server not available in CI')
    await page.goto(`/s/${sessionId}`)
    await expect(page.locator('.conn-badge--connected')).toBeVisible({ timeout: 8_000 })
  })

  test('viewer shows Monaco read-only editor', async ({ page }) => {
    await page.goto(`/s/${sessionId}`)
    await page.waitForSelector('.monaco-editor', { timeout: MONACO_TIMEOUT })
    const editor = page.locator('.monaco-editor')
    await expect(editor).toBeVisible()
  })

  test('viewer has Q&A tab', async ({ page }) => {
    await page.goto(`/s/${sessionId}`)
    await expect(page.getByText('Q&A')).toBeVisible({ timeout: 8_000 })
  })

  test('viewer shows viewer name in topbar', async ({ page }) => {
    await page.goto(`/s/${sessionId}`)
    // Viewer name is generated client-side — wait for hydration
    await page.waitForSelector('.viewer-name-badge', { timeout: 10_000 }).catch(() => {})
    await expect(page.locator('.viewer-name-badge')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Replay Page', () => {
  test('replay page loads with error state for unknown session', async ({ page }) => {
    await page.goto('/replay/nonexistent-session-xyz')
    await expect(page).toHaveTitle(/CodeCast/)
    // Should show either error state or loading → error
    await expect(page.locator('.replay-badge')).toBeVisible({ timeout: 8_000 })
  })
})
