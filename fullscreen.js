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

    function updateThemeColor() {
        const darkMode = appShell && appShell.classList.contains('dark-mode');
        const color = darkMode ? '#000000' : '#fdfbfb';
        if (themeColorMeta) themeColorMeta.setAttribute('content', color);
        root.style.setProperty('--system-bar-color', color);
    }
    function scheduleLayoutUpdate() {
        window.clearTimeout(viewportTimer);
        viewportTimer = window.setTimeout(updateViewportHeight, 150);
    }

    function refreshAppViewport() {
        window.clearTimeout(viewportTimer);
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        updateViewportHeight();
        viewportTimer = window.setTimeout(() => {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            updateViewportHeight();
        }, 350);
    }

    window.refreshAppViewport = refreshAppViewport;

    function scheduleColorUpdate() {
        window.clearTimeout(colorTimer);
        colorTimer = window.setTimeout(updateThemeColor, 80);
    }

    updateViewportHeight();
    updateThemeColor();

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
