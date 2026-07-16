/**
 * Browser/PWA fullscreen split:
 * - Installed PWA: rely on standalone layout and safe-area CSS.
 * - Regular Android browser: request Fullscreen API after a user gesture.
 */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const isIosStandalone = window.navigator.standalone === true;
    const displayModes = ['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay'];
    const isDisplayModeApp = displayModes.some(mode =>
        window.matchMedia(`(display-mode: ${mode})`).matches
    );
    const isInstalledApp = isIosStandalone || isDisplayModeApp;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = window.matchMedia('(max-width: 1024px) and (hover: none)').matches;

    function syncViewport() {
        const viewport = window.visualViewport;
        const viewportHeight = viewport ? viewport.height : window.innerHeight;

        root.style.setProperty('--app-height', `${Math.ceil(viewportHeight)}px`);
        root.classList.toggle('app-installed', isInstalledApp);
    }

    syncViewport();
    window.addEventListener('resize', syncViewport, { passive: true });
    window.addEventListener('orientationchange', syncViewport, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport, { passive: true });
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