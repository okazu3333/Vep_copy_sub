import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

async function waitForApiOk(page: any, path: string) {
  const response = await page.request.get(`${BASE_URL}${path}`)
  expect(response.status(), `${path} status`).toBe(200)
  const json = await response.json()
  expect(json).toHaveProperty('success')
  expect(json.success).toBeTruthy()
  return json
}

test.describe('Alerts E2E smoke', () => {
  test('alerts list → detail → body', async ({ page }) => {
    // Verify APIs healthy before UI navigation
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: now.toISOString(),
      light: '1',
      limit: '5',
      page: '1',
    })
    const alertsJson = await waitForApiOk(page, `/api/alerts?${params.toString()}`)
    const alerts = Array.isArray(alertsJson.alerts) ? alertsJson.alerts : []
    expect(alerts.length, 'alerts length').toBeGreaterThan(0)

    const firstAlert = alerts[0]
    const threadId = firstAlert.thread_id || firstAlert.threadId || ''
    const messageId = firstAlert.message_id || firstAlert.messageId || ''

    if (threadId || messageId) {
      const msgParams = new URLSearchParams({
        mode: 'fast',
        limit: '10',
        start: start.toISOString(),
        end: now.toISOString(),
      })
      if (threadId) msgParams.set('thread_id', threadId)
      else msgParams.set('message_id', messageId)
      const messagesJson = await waitForApiOk(page, `/api/alerts-threaded/messages?${msgParams.toString()}`)
      const messages = Array.isArray(messagesJson.messages) ? messagesJson.messages : []
      expect(messages.length).toBeGreaterThan(0)

      const firstMessage = messages[0]
      if (firstMessage?.message_id) {
        await waitForApiOk(page, `/api/alerts-threaded/message?message_id=${encodeURIComponent(firstMessage.message_id)}`)
      }
    }

    await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' })
    await expect(page.getByText('リスク統制センター')).toBeVisible()
    await page.waitForSelector('[data-testid="alert-card"]', { timeout: 10000 })
    const card = page.locator('[data-testid="alert-card"]').first()
    await card.click()
    await expect(page.getByText('リスクアラート詳細分析')).toBeVisible({ timeout: 10000 })
    const bodyAccordion = page.locator('[data-testid="threaded-message-body"] textarea, [data-testid="threaded-message-body"] pre').first()
    await expect(bodyAccordion).toBeVisible({ timeout: 10000 })
  })
})
