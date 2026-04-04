const { chromium } = require('/Users/admin/Desktop/khanh/workspace/Personal_Financial_Management/src/wj-client/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport large enough to contain all ads
  await page.setViewportSize({ width: 1200, height: 10000 });

  await page.goto('http://localhost:7788/ads/render.html', { waitUntil: 'networkidle' });

  // Wait for images to load
  await page.waitForTimeout(2000);

  const ads = ['ad1', 'ad2', 'ad3', 'ad4', 'ad5', 'ad6', 'ad7', 'ad8'];

  for (const id of ads) {
    const el = await page.$(`#${id}`);
    if (!el) {
      console.log(`Element #${id} not found`);
      continue;
    }
    const outPath = path.join(__dirname, `${id}.png`);
    await el.screenshot({ path: outPath, type: 'png' });
    console.log(`Saved: ${outPath}`);
  }

  await browser.close();
  console.log('Done!');
})();
