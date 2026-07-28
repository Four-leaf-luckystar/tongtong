(() => {
    const panel = document.getElementById('controlCenter');
    const trigger = document.getElementById('controlCenterTrigger');
    const handle = document.getElementById('controlCenterHandle');
    const phone = document.querySelector('.iphone');

    if (!panel || !trigger || !handle || !phone) return;

    let isOpen = false;
    let dragState = null;

    function setPanelOpen(nextOpen) {
        isOpen = nextOpen;
        panel.classList.remove('is-dragging');
        panel.classList.toggle('is-open', nextOpen);
        panel.style.removeProperty('transform');
        panel.style.removeProperty('opacity');
        panel.setAttribute('aria-hidden', String(!nextOpen));
    }

    function setDragProgress(progress) {
        const clamped = Math.max(0, Math.min(1, progress));
        panel.style.transform = `translateY(${(clamped - 1) * 100}%)`;
        panel.style.opacity = String(clamped);
    }

    function beginDrag(event, openedAtStart) {
        if (event.button !== undefined && event.button !== 0) return;

        dragState = {
            pointerId: event.pointerId,
            startY: event.clientY,
            openedAtStart
        };
        panel.classList.add('is-dragging');

        if (event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function') {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    }

    function finishDrag(event, cancelled) {
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const { startY, openedAtStart } = dragState;
        const deltaY = event.clientY - startY;
        const height = Math.max(phone.getBoundingClientRect().height, 1);
        const openThreshold = Math.min(82, height * 0.16);
        const closeThreshold = Math.min(62, height * 0.12);

        dragState = null;

        if (cancelled) {
            setPanelOpen(openedAtStart);
            return;
        }

        if (openedAtStart) {
            setPanelOpen(deltaY >= -closeThreshold);
            return;
        }

        setPanelOpen(Math.abs(deltaY) < 12 || deltaY >= openThreshold);
    }

    trigger.addEventListener('pointerdown', event => {
        event.preventDefault();
        beginDrag(event, false);
    });

    trigger.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setPanelOpen(true);
    });

    panel.addEventListener('pointerdown', event => {
        if (!isOpen || event.target.closest('[data-cc-toggle], [data-cc-slider], .music-controls, .drawer-handle')) return;
        beginDrag(event, true);
    });

    document.addEventListener('pointermove', event => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const deltaY = event.clientY - dragState.startY;
        const height = Math.max(phone.getBoundingClientRect().height, 1);
        const progress = dragState.openedAtStart
            ? 1 + Math.min(0, deltaY) / height
            : Math.max(0, deltaY) / height;

        event.preventDefault();
        setDragProgress(progress);
    }, { capture: true, passive: false });

    document.addEventListener('pointerup', event => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        finishDrag(event, false);
    }, true);

    document.addEventListener('pointercancel', event => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        finishDrag(event, true);
    }, true);

    handle.addEventListener('click', () => setPanelOpen(false));
    handle.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setPanelOpen(false);
    });

    panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') setPanelOpen(false);
    });

    panel.querySelectorAll('[data-cc-toggle]').forEach(control => {
        const toggle = () => {
            const nextState = !control.classList.contains('active');
            control.classList.toggle('active', nextState);
            control.setAttribute('aria-pressed', String(nextState));
        };

        control.addEventListener('click', toggle);
        control.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggle();
        });
    });

    function applyBrightness(value) {
        const displaySlider = document.getElementById('dsBrightnessSlider');
        if (displaySlider) {
            displaySlider.value = value;
            if (typeof window.updateDsSlider === 'function') {
                window.updateDsSlider(displaySlider);
                return;
            }
        }

        const overlay = document.getElementById('brightnessOverlay');
        if (overlay) {
            const opacity = 0.7 - (value / 100) * 0.7;
            overlay.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
        }
    }

    panel.querySelectorAll('[data-cc-slider]').forEach(slider => {
        const fill = slider.querySelector('.slider-fill');
        const isBrightness = slider.getAttribute('data-cc-slider') === 'brightness';
        let activePointerId = null;

        function setLevel(event) {
            const rect = slider.getBoundingClientRect();
            const level = Math.max(0, Math.min(100, ((rect.bottom - event.clientY) / rect.height) * 100));
            if (fill) fill.style.height = `${level}%`;
            if (isBrightness) applyBrightness(level);
        }

        slider.addEventListener('pointerdown', event => {
            activePointerId = event.pointerId;
            slider.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.stopPropagation();
            setLevel(event);
        });

        slider.addEventListener('pointermove', event => {
            if (activePointerId !== event.pointerId) return;
            event.preventDefault();
            setLevel(event);
        });

        slider.addEventListener('pointerup', event => {
            if (activePointerId === event.pointerId) activePointerId = null;
        });

        slider.addEventListener('pointercancel', event => {
            if (activePointerId === event.pointerId) activePointerId = null;
        });
    });
})();
