(function () {
    'use strict';
    const template = document.getElementById('meetingAppDocumentTemplate');
    window.MEETING_APP_DOCUMENT = template ? template.content.textContent : '';
})();