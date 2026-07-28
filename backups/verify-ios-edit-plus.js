const { chromium } = require('playwright-core');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        screen: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('file:///D:/童话机/index.html', { waitUntil: 'load' });
    await page.evaluate(() => {
        document.documentElement.classList.add('ios-installed');
        document.querySelector('.iphone').classList.add('desktop-editing');
        document.getElementById('editPlus').style.display = 'flex';
        document.getElementById('editDone').style.display = 'block';
        window.__plusClickCount = 0;
        document.getElementById('editPlus').addEventListener('click', () => {
            window.__plusClickCount += 1;
        });
    });

    const rects = await page.evaluate(() => {
        const getRect = (id) => {
            const rect = document.getElementById(id).getBoundingClientRect();
            return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                cx: rect.x + rect.width / 2,
                cy: rect.y + rect.height / 2
            };
        };
        return {
            visual: getRect('editPlus'),
            target: getRect('editPlusTouchTarget'),
            done: getRect('editDoneTouchTarget')
        };
    });

    const testPoints = [
        [rects.target.cx, rects.target.cy],
        [rects.target.x + 7, rects.target.y + 7],
        [rects.target.x + rects.target.width - 7, rects.target.y + 7],
        [rects.target.x + 7, rects.target.y + rects.target.height - 7],
        [rects.target.x + rects.target.width - 7, rects.target.y + rects.target.height - 7]
    ];
    const results = [];

    for (const [x, y] of testPoints) {
        await page.evaluate(() => {
            document.getElementById('widgetPickerModal').style.display = 'none';
            window.__plusClickCount = 0;
        });
        await page.touchscreen.tap(x, y);
        await page.waitForTimeout(100);
        results.push(await page.evaluate(() => ({
            modal: getComputedStyle(document.getElementById('widgetPickerModal')).display,
            clicks: window.__plusClickCount
        })));
    }

    await page.evaluate(() => {
        document.getElementById('widgetPickerModal').style.display = 'none';
    });
    await page.touchscreen.tap(rects.done.cx, rects.done.cy);
    await page.waitForTimeout(50);
    const doneExited = await page.evaluate(() => (
        !document.querySelector('.iphone').classList.contains('desktop-editing')
    ));

    console.log(JSON.stringify({ rects, results, doneExited, errors }, null, 2));
    await browser.close();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
