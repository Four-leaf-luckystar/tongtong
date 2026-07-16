/**
 * Unified mobile viewport controller.
 * CSS consumes only --app-height, --system-bar-color and ios-installed.
 */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const appShell = document.querySelector('.iphone');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIosStandalone = isIos && window.navigator.standalone === true;
    const isInstalledDisplayMode = ['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay']
        .some(mode => window.matchMedia(`(display-mode: ${mode})`).matches);
    const isInstalledApp = isIosStandalone || isInstalledDisplayMode;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = window.matchMedia('(max-width: 1024px) and (hover: none)').matches;
    let viewportTimer = 0;
    let colorTimer = 0;
    let colorToken = 0;

    function updateViewportHeight() {
        const viewport = window.visualViewport;
        let appHeight = window.innerHeight;

        if (isIos && viewport) {
            const keyboardOpen = (window.screen.height - viewport.height) > 150;

            if (keyboardOpen) {
                appHeight = viewport.height;
            } else {
                const candidates = [
                    window.innerHeight,
                    document.documentElement.clientHeight,
                    viewport.height
                ];

                if (isIosStandalone) candidates.push(window.screen.height);
                appHeight = Math.max(...candidates.filter(value => Number.isFinite(value) && value > 0));
            }

            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
        }

        root.style.setProperty('--app-height', `${Math.ceil(appHeight)}px`);
        root.classList.toggle('ios-installed', isIosStandalone);
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
        if (!url.startsWith('data:') && !url.startsWith('blob:')) image.crossOrigin = 'anonymous';

        image.onload = () => {
            if (token !== colorToken || !appShell) return;

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

                if (!count) throw new Error('No opaque pixels');
                applySystemColor(`rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`);
            } catch (_) {
                applySystemColor(fallbackSystemColor());
            }
        };

        image.onerror = () => {
            if (token === colorToken) applySystemColor(fallbackSystemColor());
        };
        image.src = url;
    }

    function updateSystemColor() {
        const token = ++colorToken;
        const fallback = fallbackSystemColor();
        const backgroundUrl = appShell
            ? extractBackgroundUrl(getComputedStyle(appShell).backgroundImage)
            : '';

        applySystemColor(fallback);
        if (backgroundUrl) sampleWallpaperTop(backgroundUrl, token);
    }

    function scheduleLayoutUpdate() {
        window.clearTimeout(viewportTimer);
        viewportTimer = window.setTimeout(updateViewportHeight, 150);
    }

    function scheduleColorUpdate() {
        window.clearTimeout(colorTimer);
        colorTimer = window.setTimeout(updateSystemColor, 80);
    }

    updateViewportHeight();
    updateSystemColor();

    window.addEventListener('resize', () => {
        scheduleLayoutUpdate();
        scheduleColorUpdate();
    }, { passive: true });
    window.addEventListener('orientationchange', () => {
        scheduleLayoutUpdate();
        scheduleColorUpdate();
    }, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleLayoutUpdate, { passive: true });
        window.visualViewport.addEventListener('scroll', () => {
            if (!isIos) return;
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
        }, { passive: true });
    }

    document.addEventListener('focusout', () => {
        if (isIos) window.setTimeout(updateViewportHeight, 50);
    });

    if (appShell) {
        new MutationObserver(scheduleColorUpdate).observe(appShell, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    if (isInstalledApp || !isAndroid || !isMobile) return;

    async function enterBrowserFullscreen() {
        if (document.fullscreenElement || document.webkitFullscreenElement) return;
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
});