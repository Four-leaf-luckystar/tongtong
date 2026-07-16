/**
 * Unified mobile viewport controller.
 * CSS consumes --app-height, system safe-area colors and ios-installed.
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

    function fallbackSafeColors() {
        const darkMode = appShell && appShell.classList.contains('dark-mode');
        return darkMode
            ? { top: '#000000', bottom: '#000000' }
            : { top: '#fdfbfb', bottom: '#ebedee' };
    }

    function applySafeColors(topColor, bottomColor) {
        if (themeColorMeta) themeColorMeta.setAttribute('content', topColor);
        root.style.setProperty('--system-bar-color', topColor);
        root.style.backgroundColor = bottomColor;
        document.body.style.backgroundColor = bottomColor;
    }

    function syncCanvasBackground() {
        if (!appShell) return;
        const shellStyle = getComputedStyle(appShell);
        const targets = [root, document.body];

        targets.forEach(target => {
            target.style.backgroundColor = shellStyle.backgroundColor;
            target.style.backgroundImage = shellStyle.backgroundImage;
            target.style.backgroundSize = shellStyle.backgroundSize;
            target.style.backgroundPosition = shellStyle.backgroundPosition;
            target.style.backgroundRepeat = shellStyle.backgroundRepeat;
            target.style.backgroundAttachment = 'fixed';
        });
    }

    function extractBackgroundUrl(backgroundImage) {
        const match = backgroundImage && backgroundImage.match(/url\(["']?(.*?)["']?\)/i);
        return match ? match[1] : '';
    }

    function sampleWallpaperEdges(url, token) {
        const image = new Image();
        if (!url.startsWith('data:') && !url.startsWith('blob:')) image.crossOrigin = 'anonymous';

        image.onload = () => {
            if (token !== colorToken || !appShell) return;

            try {
                const shellWidth = Math.max(1, appShell.clientWidth || window.innerWidth);
                const shellHeight = Math.max(1, appShell.clientHeight || window.innerHeight);
                const scale = Math.max(shellWidth / image.naturalWidth, shellHeight / image.naturalHeight);
                const visibleWidth = shellWidth / scale;
                const visibleHeight = shellHeight / scale;
                const sourceX = Math.max(0, (image.naturalWidth - visibleWidth) / 2);
                const sourceY = Math.max(0, (image.naturalHeight - visibleHeight) / 2);
                const edgeHeight = Math.min(48 / scale, visibleHeight);

                function averageEdgeColor(edgeY) {
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d', { willReadFrequently: true });
                    canvas.width = 24;
                    canvas.height = 6;
                    context.drawImage(
                        image,
                        sourceX,
                        edgeY,
                        Math.min(visibleWidth, image.naturalWidth - sourceX),
                        Math.min(edgeHeight, image.naturalHeight - edgeY),
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
                    return `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`;
                }

                const topColor = averageEdgeColor(sourceY);
                const bottomY = Math.max(sourceY, sourceY + visibleHeight - edgeHeight);
                const bottomColor = averageEdgeColor(bottomY);
                applySafeColors(topColor, bottomColor);
            } catch (_) {
                const fallback = fallbackSafeColors();
                applySafeColors(fallback.top, fallback.bottom);
            }
        };

        image.onerror = () => {
            if (token !== colorToken) return;
            const fallback = fallbackSafeColors();
            applySafeColors(fallback.top, fallback.bottom);
        };
        image.src = url;
    }

    function updateSystemColor() {
        const token = ++colorToken;
        const fallback = fallbackSafeColors();
        const backgroundUrl = appShell
            ? extractBackgroundUrl(getComputedStyle(appShell).backgroundImage)
            : '';

        applySafeColors(fallback.top, fallback.bottom);
        syncCanvasBackground();
        if (backgroundUrl) sampleWallpaperEdges(backgroundUrl, token);
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