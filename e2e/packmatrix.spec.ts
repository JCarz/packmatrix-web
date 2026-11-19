import { expect, test } from '@playwright/test';

test('creates, packs, duplicates, templates, exports, and imports a trip', async ({ page }, testInfo) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Master/ }).click();
  await page.getByRole('button', { name: '+ Add' }).click();
  const sheet = page.locator('.sheet');
  await sheet.getByLabel('Name').fill('E2E Socks');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: /Trips/ }).click();
  await page.getByRole('button', { name: '+ Create Trip' }).click();
  await sheet.getByLabel('Trip Name').fill('E2E getaway');
  await sheet.getByLabel('Destination').fill('Toronto');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: '+ Add Item' }).click();
  await sheet.getByText('E2E Socks', { exact: true }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await page.locator('li').filter({ hasText: 'E2E Socks' }).filter({ hasText: '⭕️' }).click();

  await page.getByRole('button', { name: 'Duplicate' }).click();
  await sheet.getByLabel('Trip Name').fill('E2E duplicate');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Save as Template' }).click();
  await sheet.getByLabel('Template Name').fill('E2E template');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: /Settings/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export backup' }).click(),
  ]);
  const backup = testInfo.outputPath('packmatrix-backup.json');
  await download.saveAs(backup);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('input[type=file]').setInputFiles(backup);
  await expect(page.getByText('Backup restored')).toBeVisible();
});
