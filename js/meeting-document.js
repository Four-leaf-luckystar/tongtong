(function () {
    'use strict';
    Object.defineProperty(window, 'MEETING_APP_DOCUMENT', {
        configurable: true,
        get() {
            const template = document.getElementById('meetingAppDocumentTemplate');
            return template ? template.content.textContent : '';
        }
    });
})();
