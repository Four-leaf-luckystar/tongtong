(function () {
    'use strict';

    function getElements() {
        return {
            container: document.getElementById('meetingAppUI'),
            frame: document.getElementById('meetingAppFrame')
        };
    }

    function decodeMeetingDocument() {
        const bytes = Uint8Array.from(atob(window.MEETING_APP_DOCUMENT_BASE64), value => value.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    function bindReturnToDesktop(frame) {
        const documentInFrame = frame.contentDocument;
        const backControl = documentInFrame?.querySelector('.header-left-capsule');
        if (!backControl || backControl.dataset.meetingReturnBound === 'true') return;

        backControl.dataset.meetingReturnBound = 'true';
        backControl.setAttribute('role', 'button');
        backControl.tabIndex = 0;
        backControl.addEventListener('click', window.closeMeetingApp);
        backControl.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.closeMeetingApp();
            }
        });
    }

    window.openMeetingApp = function openMeetingApp() {
        const { container, frame } = getElements();
        if (!container || !frame) return;

        if (!frame.srcdoc) {
            frame.addEventListener('load', () => bindReturnToDesktop(frame), { once: true });
            frame.srcdoc = decodeMeetingDocument();
        } else {
            bindReturnToDesktop(frame);
        }

        container.style.display = 'block';
        container.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => container.classList.add('is-open'));
    };

    window.closeMeetingApp = function closeMeetingApp() {
        const { container } = getElements();
        if (!container) return;
        container.classList.remove('is-open');
        container.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (!container.classList.contains('is-open')) container.style.display = 'none';
            if (typeof window.syncStatusBarAfterReturnHome === 'function') window.syncStatusBarAfterReturnHome();
        }, 220);
    };
})();
