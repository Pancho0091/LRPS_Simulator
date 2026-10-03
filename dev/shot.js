const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: +(process.env.W || 700), height: 500 }, colorScheme: process.env.SCHEME || 'light' })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, 'illus-gallery.html') + (process.env.Q || ''));
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: process.env.OUT, fullPage: true });
  console.log('errors', errs);
  await b.close();
})();
