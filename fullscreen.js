/**
 * Browser/PWA fullscreen split and adaptive system-bar coloring.
 * - Installed PWA: rely on standalone layout and safe-area CSS.
 * - Regular Android browser: request Fullscreen API after a user gesture.
 * - System-controlled margins: match the desktop's top color where possible.
 */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const appShell = document.querySelector('.iphone');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const isIosStandalone = window.navigator.standalone === true;
    const displayModes = ['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay'];
    const isDisplayModeApp = displayModes.some(mode =>
        window.matchMedia(`(display-mode: ${mode})`).matches
    );
    const isInstalledApp = isIosStandalone || isDisplayModeApp;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = window.matchMedia('(max-width: 1024px) and (hover: none)').matches;
    let colorSyncToken = 0;
    let colorSyncTimer = 0;

    function syncViewport() {
        const viewport = window.visualViewport;
        const viewportHeight = viewport ? viewport.height : window.innerHeight;

        root.style.setProperty('--app-height', `${Math.ceil(viewportHeight)}px`);
        root.classList.toggle('app-installed', isInstalledApp);
    }

    function fallbackSystemColor() {
        return appShell && appShell.classList.contains('dark-mode') ? '#000000' : '#fdfbfb';
    }

    function applySystemColor(color) {
        if (themeColorMeta) themeColorMeta.setAttribute('content', color);
        root.style.setProperty('--system-bar-color', color);
        root.style.backgroundColor = color;
        document.body.style.backgroundColor = color;
    }

    function extractBackgroundUrl(backgroundImage) {
        const match = backgroundImage && backgroundImage.match(/url\(["']?(.*?)["']?\)/i);
        return match ? match[1] : '';
    }

    function sampleWallpaperTop(url, token) {
        const image = new Image();
        if (!url.startsWith('data:') && !url.startsWith('blob:')) {
            image.crossOrigin = 'anonymous';
        }

        image.onload = () => {
            if (token !== colorSyncToken || !appShell) return;

            try {
                const shellWidth = Math.max(1, appShell.clientWidth || window.innerWidth);
                const shellHeight = Math.max(1, appShell.clientHeight || window.innerHeight);
                const scale = Math.max(shellWidth / image.naturalWidth, shellHeight / image.naturalHeight);
                const sourceWidth = shellWidth / scale;
                const sourceHeight = Math.min(48 / scale, image.naturalHeight);
                const sourceX = Math.max(0, (image.naturalWidth - sourceWidth) / 2);
                const sourceY = Math.max(0, (image.naturalHeight - shellHeight / scale) / 2);
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { willReadFrequently: true });

                canvas.width = 24;
                canvas.height = 6;
                context.drawImage(
                    image,
                    sourceX,
                    sourceY,
                    Math.min(sourceWidth, image.naturalWidth - sourceX),
                    Math.min(sourceHeight, image.naturalHeight - sourceY),
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                let red = 0;
                let green = 0;
                let blue = 0;
                let count = 0;

                for (let index = 0; index < pixels.length; index += 4) {
                    if (pixels[index + 3] < 128) continue;
                    red += pixels[index];
                    green += pixels[index + 1];
                    blue += pixels[index + 2];
                    count += 1;
                }

                if (!count) throw new Error('No opaque wallpaper pixels');
                const color = `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`;
                applySystemColor(color);
            } catch (_) {
                applySystemColor(fallbackSystemColor());
            }
        };

        image.onerror = () => {
            if (token === colorSyncToken) applySystemColor(fallbackSystemColor());
        };
        image.src = url;
    }

    function syncSystemColor() {
        const token = ++colorSyncToken;
        const fallback = fallbackSystemColor();

        if (!appShell) {
            applySystemColor(fallback);
            return;
        }

        const backgroundUrl = extractBackgroundUrl(getComputedStyle(appShell).backgroundImage);
        if (!backgroundUrl) {
            applySystemColor(fallback);
            return;
        }

        applySystemColor(fallback);
        sampleWallpaperTop(backgroundUrl, token);
    }

    function scheduleSystemColorSync() {
        window.clearTimeout(colorSyncTimer);
        colorSyncTimer = window.setTimeout(syncSystemColor, 80);
    }

    syncViewport();
    syncSystemColor();
    window.addEventListener('resize', () => {
        syncViewport();
        scheduleSystemColorSync();
    }, { passive: true });
    window.addEventListener('orientationchange', () => {
        syncViewport();
        scheduleSystemColorSync();
    }, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport, { passive: true });
    }

    if (appShell) {
        new MutationObserver(scheduleSystemColorSync).observe(appShell, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    // Installed PWAs must not call Fullscreen API; Chromium may letterbox cutout areas.
    if (isInstalledApp || !isAndroid || !isMobile) return;

    function isFullscreen() {
        return Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement
        );
    }

    async function enterBrowserFullscreen() {
        if (isFullscreen()) return;

        const requestFullscreen = root.requestFullscreen || root.webkitRequestFullscreen;
        if (!requestFullscreen) return;

        try {
            await requestFullscreen.call(root, { navigationUI: 'hide' });
        } catch (_) {
            try {
                await requestFullscreen.call(root);
            } catch (_) {}
        }
    }

    document.addEventListener('pointerup', enterBrowserFullscreen, { passive: true });
    document.addEventListener('touchend', enterBrowserFullscreen, { passive: true });
});
