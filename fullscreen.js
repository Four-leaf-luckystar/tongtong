/**
 * Mobile fullscreen compatibility layer.
 * Browsers retain control over OS status/gesture bars, so this combines PWA
 * detection, visual viewport sizing, and the Fullscreen API where supported.
 */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const isMobile = window.matchMedia('(max-width: 1024px) and (hover: none)').matches;
    const isIosStandalone = window.navigator.standalone === true;
    const isDisplayModeApp = ['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay']
        .some(mode => window.matchMedia(`(display-mode: ${mode})`).matches);
    const isAndroid = /Android/i.test(navigator.userAgent);

    function syncViewport() {
        const viewport = window.visualViewport;
        const viewportHeight = viewport ? viewport.height : window.innerHeight;
        const viewportOffsetTop = viewport ? viewport.offsetTop : 0;

        root.style.setProperty('--app-height', `${Math.ceil(viewportHeight)}px`);
        root.style.setProperty('--viewport-offset-top', `${Math.max(0, Math.floor(viewportOffsetTop))}px`);
        root.classList.toggle('app-installed', isIosStandalone || isDisplayModeApp);
    }

    syncViewport();
    window.addEventListener('resize', syncViewport, { passive: true });
    window.addEventListener('orientationchange', syncViewport, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport, { passive: true });
        window.visualViewport.addEventListener('scroll', syncViewport, { passive: true });
    }

    if (!isMobile || !isAndroid) return;

    function isActualFullscreen() {
        return Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            window.matchMedia('(display-mode: fullscreen)').matches
        );
    }

    async function tryFullscreen() {
        if (isActualFullscreen()) return;

        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        if (!request) return;

        try {
            await request.call(root, { navigationUI: 'hide' });
            syncViewport();
        } catch (_) {
            // Some browsers reject options or disallow fullscreen in installed PWAs.
            try {
                await request.call(root);
                syncViewport();
            } catch (_) {}
        }
    }

    document.addEventListener('pointerup', tryFullscreen, { once: true, passive: true });
    document.addEventListener('touchend', tryFullscreen, { once: true, passive: true });
});