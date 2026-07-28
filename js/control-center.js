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

    function beginDrag(event, openedAtStart, inputType = 'pointer') {
        if (event.button !== undefined && event.button !== 0) return;
        if (dragState) return;

        dragState = {
            inputType,
            pointerId: event.pointerId,
            startY: event.clientY,
            openedAtStart
        };
        panel.classList.add('is-dragging');

        if (inputType === 'pointer' && event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function') {
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch (error) {
                // iOS may reject pointer capture while the system handles the top edge gesture.
            }
        }
    }

    function updateDrag(clientY) {
        if (!dragState) return;

        const height = Math.max(phone.getBoundingClientRect().height, 1);
        const deltaY = clientY - dragState.startY;
        const progress = dragState.openedAtStart
            ? 1 + Math.min(0, deltaY) / height
            : Math.max(0, deltaY) / height;

        setDragProgress(progress);
    }

    function finishDrag(clientY, cancelled) {
        if (!dragState) return;

        const { startY, openedAtStart } = dragState;
        const deltaY = clientY - startY;
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
        beginDrag(event, false, 'pointer');
    });

    trigger.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setPanelOpen(true);
    });

    panel.addEventListener('pointerdown', event => {
        if (!isOpen || event.target.closest('[data-cc-toggle], [data-cc-slider], .music-controls, .drawer-handle')) return;
        beginDrag(event, true, 'pointer');
    });

    document.addEventListener('pointermove', event => {
        if (!dragState || dragState.inputType !== 'pointer' || dragState.pointerId !== event.pointerId) return;

        event.preventDefault();
        updateDrag(event.clientY);
    }, { capture: true, passive: false });

    document.addEventListener('pointerup', event => {
        if (!dragState || dragState.inputType !== 'pointer' || dragState.pointerId !== event.pointerId) return;
        finishDrag(event.clientY, false);
    }, true);

    document.addEventListener('pointercancel', event => {
        if (!dragState || dragState.inputType !== 'pointer' || dragState.pointerId !== event.pointerId) return;
        finishDrag(event.clientY, true);
    }, true);

    function findTouch(touchList, identifier) {
        for (let index = 0; index < touchList.length; index++) {
            if (touchList[index].identifier === identifier) return touchList[index];
        }
        return null;
    }

    function beginTouchDrag(event, openedAtStart) {
        if (dragState || event.touches.length !== 1) return;
        const touch = event.touches[0];
        beginDrag({
            button: 0,
            pointerId: touch.identifier,
            clientY: touch.clientY
        }, openedAtStart, 'touch');
    }

    trigger.addEventListener('touchstart', event => {
        event.preventDefault();
        beginTouchDrag(event, false);
    }, { passive: false });

    panel.addEventListener('touchstart', event => {
        if (!isOpen || event.target.closest('[data-cc-toggle], [data-cc-slider], .music-controls, .drawer-handle')) return;
        event.preventDefault();
        beginTouchDrag(event, true);
    }, { passive: false });

    document.addEventListener('touchmove', event => {
        if (!dragState || dragState.inputType !== 'touch') return;
        const touch = findTouch(event.touches, dragState.pointerId);
        if (!touch) return;

        event.preventDefault();
        updateDrag(touch.clientY);
    }, { capture: true, passive: false });

    document.addEventListener('touchend', event => {
        if (!dragState || dragState.inputType !== 'touch') return;
        const touch = findTouch(event.changedTouches, dragState.pointerId);
        if (!touch) return;
        finishDrag(touch.clientY, false);
    }, true);

    document.addEventListener('touchcancel', event => {
        if (!dragState || dragState.inputType !== 'touch') return;
        const touch = findTouch(event.changedTouches, dragState.pointerId);
        finishDrag(touch ? touch.clientY : 0, true);
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
        let activeTouchId = null;

        function setLevel(clientY) {
            const rect = slider.getBoundingClientRect();
            const level = Math.max(0, Math.min(100, ((rect.bottom - clientY) / rect.height) * 100));
            if (fill) fill.style.height = `${level}%`;
            if (isBrightness) applyBrightness(level);
        }

        slider.addEventListener('pointerdown', event => {
            if (activePointerId !== null || activeTouchId !== null) return;
            activePointerId = event.pointerId;
            try {
                slider.setPointerCapture(event.pointerId);
            } catch (error) {
                // Touch Events below continue to support older iOS browsers.
            }
            event.preventDefault();
            event.stopPropagation();
            setLevel(event.clientY);
        });

        slider.addEventListener('pointermove', event => {
            if (activePointerId !== event.pointerId) return;
            event.preventDefault();
            setLevel(event.clientY);
        });

        slider.addEventListener('pointerup', event => {
            if (activePointerId === event.pointerId) activePointerId = null;
        });

        slider.addEventListener('pointercancel', event => {
            if (activePointerId === event.pointerId) activePointerId = null;
        });

        slider.addEventListener('touchstart', event => {
            if (activePointerId !== null || activeTouchId !== null || event.touches.length !== 1) return;
            const touch = event.touches[0];
            activeTouchId = touch.identifier;
            event.preventDefault();
            event.stopPropagation();
            setLevel(touch.clientY);
        }, { passive: false });

        slider.addEventListener('touchmove', event => {
            if (activeTouchId === null) return;
            const touch = findTouch(event.touches, activeTouchId);
            if (!touch) return;
            event.preventDefault();
            setLevel(touch.clientY);
        }, { passive: false });

        slider.addEventListener('touchend', event => {
            if (!findTouch(event.changedTouches, activeTouchId)) return;
            activeTouchId = null;
        });

        slider.addEventListener('touchcancel', event => {
            if (findTouch(event.changedTouches, activeTouchId)) activeTouchId = null;
        });
    });
})();
