        function formatWidgetSizeLabel(widget) {
            if (widget.width && widget.height) {
                return widget.width + '×' + widget.height;
            }
            if (widget.presetSize) {
                return widget.presetSize;
            }
            return '1×1';
        }
        window.formatWidgetSizeLabel = formatWidgetSizeLabel;

        function handleWidgetPresetChange(radio) {
            if (radio.checked) {
                document.getElementById('widgetCustomSizeLabel').innerText = '自定义大小';
                document.getElementById('widgetCustomSizeLabel').style.color = '#8e8e93';
                updateWidgetCodePreview();
            }
        }
        window.handleWidgetPresetChange = handleWidgetPresetChange;

        function openCustomSizePicker() {
            document.getElementById('customSizePicker').classList.add('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'block';
            overlay.style.zIndex = '350';
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = false; });
        }
        window.openCustomSizePicker = openCustomSizePicker;

        function closeCustomSizePicker() {
            document.getElementById('customSizePicker').classList.remove('show');
            const editor = document.getElementById('widgetEditorModal');
            if (editor && editor.classList.contains('show')) {
                document.getElementById('widgetOverlay').style.zIndex = '250';
            } else {
                document.getElementById('widgetOverlay').style.display = 'none';
            }
        }
        window.closeCustomSizePicker = closeCustomSizePicker;

        function stepCustomSize(type, delta) {
            const el = document.getElementById(type === 'w' ? 'customW' : 'customH');
            let val = parseInt(el.innerText, 10) + delta;
            
            // ??????????????????????
            let maxCols = 4;
            let maxRows = 7;
            const grid = document.getElementById('desktopGrid');
            if (grid) {
                // ?? desktopGrid ????????? (????80+15px = 95px)
                const gridH = grid.clientHeight;
                if (gridH > 100) {
                    maxRows = Math.floor(gridH / 95) || 7;
                }
            }
            if (type === 'w' && val > maxCols) val = maxCols;
            if (type === 'w' && val < 1) val = 1;
            if (type === 'h' && val > maxRows) val = maxRows;
            if (type === 'h' && val < 1) val = 1;
            el.innerText = val;
        }
        window.stepCustomSize = stepCustomSize;

        function confirmCustomSize() {
            const w = document.getElementById('customW').innerText;
            const h = document.getElementById('customH').innerText;
            const label = document.getElementById('widgetCustomSizeLabel');
            label.innerText = w + ' × ' + h;
            label.style.color = '#000';
            updateWidgetCodePreview();
            closeCustomSizePicker();
        }
        window.confirmCustomSize = confirmCustomSize;

        function handleWidgetCustomSizeChange() {
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = false; });
        }
        window.handleWidgetCustomSizeChange = handleWidgetCustomSizeChange;

            // show three-dots button; click to expand vertical capsule menu
    (function () {
        const widgetTrack = document.getElementById('widgetTrack');
        const widgetPagination = document.getElementById('widgetPagination');
        const widgetListContainer = document.getElementById('widgetList');
        const widgetEmptyState = document.getElementById('widgetEmptyState');
        const widgetContentArea = document.getElementById('widgetContentArea');
        const widgetSegmentBtns = document.querySelectorAll('#widgetAppGrid .widget-segment-btn');
        const widgetIndicator = document.getElementById('widgetSegmentIndicator');
        const widgetAppGrid = document.getElementById('widgetAppGrid');
        const themeAppUI = document.getElementById('themeAppUI');

        const officialWidgets = window.officialWidgets || [];
        const customWidgets = window.customWidgets || [];
        window.officialWidgets = officialWidgets;
        window.customWidgets = customWidgets;
        let currentWidgets = officialWidgets;

        let widgetViewMode = 'carousel';     // 'carousel' | 'list'
        let isWidgetEditing = false;
        let currentProgress = 0, targetProgress = 0;
        let isDragging = false, startX = 0, startProgress = 0;
        let activeWidgetIndex = -1;

        function findWidgetTagEnd(source, startIndex) {
            let quote = '';
            for (let i = startIndex; i < source.length; i++) {
                const char = source[i];
                if (quote) {
                    if (char === quote) quote = '';
                } else if (char === '"' || char === "'") {
                    quote = char;
                } else if (char === '>') {
                    return i;
                }
            }
            return -1;
        }

        function getWidgetTagAttribute(tagText, attributeName) {
            const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp('\\s' + escapedName + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
            const match = pattern.exec(tagText);
            return match ? (match[1] || match[2] || match[3] || '') : '';
        }

        function scanWidgetImageTags(content) {
            const source = String(content == null ? '' : content);
            const lowerSource = source.toLowerCase();
            const counters = { img: 0, image: 0, uploadable: 0, contenteditable: 0 };
            const tags = [];
            let cursor = 0;

            while (cursor < source.length) {
                const tagStart = source.indexOf('<', cursor);
                if (tagStart === -1) break;

                if (lowerSource.slice(tagStart, tagStart + 4) === '<!--') {
                    const commentEnd = lowerSource.indexOf('-->', tagStart + 4);
                    cursor = commentEnd === -1 ? source.length : commentEnd + 3;
                    continue;
                }

                let nameStart = tagStart + 1;
                while (/\s/.test(source[nameStart] || '')) nameStart++;
                if (/[/!?]/.test(source[nameStart] || '')) {
                    const skippedTagEnd = findWidgetTagEnd(source, nameStart + 1);
                    cursor = skippedTagEnd === -1 ? source.length : skippedTagEnd + 1;
                    continue;
                }

                let nameEnd = nameStart;
                while (/[A-Za-z0-9:-]/.test(source[nameEnd] || '')) nameEnd++;
                if (nameEnd === nameStart) {
                    cursor = tagStart + 1;
                    continue;
                }

                const tagName = lowerSource.slice(nameStart, nameEnd);
                const tagEnd = findWidgetTagEnd(source, nameEnd);
                if (tagEnd === -1) break;

                const tagText = source.slice(tagStart, tagEnd + 1);
                if (tagName === 'img' || tagName === 'image') {
                    tags.push({
                        name: tagName,
                        tagName: tagName,
                        kind: tagName,
                        index: counters[tagName]++,
                        start: tagStart,
                        end: tagEnd
                    });
                }

                const classNames = getWidgetTagAttribute(tagText, 'class').split(/\s+/).filter(Boolean);
                if (tagName !== 'img' && tagName !== 'image' && classNames.indexOf('uploadable-img') !== -1) {
                    tags.push({
                        name: 'uploadable',
                        tagName: tagName,
                        kind: 'uploadable',
                        index: counters.uploadable++,
                        start: tagStart,
                        end: tagEnd
                    });
                }

                if (getWidgetTagAttribute(tagText, 'contenteditable').toLowerCase() === 'true') {
                    tags.push({
                        name: 'contenteditable',
                        tagName: tagName,
                        kind: 'contenteditable',
                        index: counters.contenteditable++,
                        start: tagStart,
                        end: tagEnd
                    });
                }

                if (tagName === 'script' || tagName === 'style') {
                    const closeStart = lowerSource.indexOf('</' + tagName, tagEnd + 1);
                    if (closeStart === -1) break;
                    const closeEnd = findWidgetTagEnd(source, closeStart + tagName.length + 2);
                    cursor = closeEnd === -1 ? source.length : closeEnd + 1;
                } else {
                    cursor = tagEnd + 1;
                }
            }

            return tags;
        }

        function widgetImageEditBridge(mode) {
            const isDesktopWidget = mode === 'desktop';
            let pointerStart = null;
            let suppressImageClickUntil = 0;

            function findContentEditableTarget(startElement) {
                const editable = startElement && startElement.closest
                    ? startElement.closest('[data-widget-editor-content-index]')
                    : null;
                if (!editable) return null;

                const markedIndex = editable.getAttribute('data-widget-editor-content-index');
                const index = parseInt(markedIndex, 10);
                if (!Number.isFinite(index)) return null;

                return {
                    kind: 'contenteditable',
                    index: index,
                    html: editable.innerHTML
                };
            }

            function postContentEdit(element, phase) {
                const target = findContentEditableTarget(element);
                if (!target) return;

                parent.postMessage({
                    type: isDesktopWidget ? 'widget-desktop-content' : 'widget-image-editor-content',
                    phase: phase,
                    target: { kind: target.kind, index: target.index },
                    html: target.html
                }, '*');
            }

            function postDesktopPointer(phase, event) {
                parent.postMessage({
                    type: 'widget-desktop-pointer',
                    phase: phase,
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY
                }, '*');
            }

            document.addEventListener('pointerdown', function (event) {
                if (event.isPrimary === false) return;
                pointerStart = {
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    startedAt: Date.now(),
                    moved: false
                };
                if (isDesktopWidget) {
                    try {
                        if (event.target && event.target.setPointerCapture) {
                            event.target.setPointerCapture(event.pointerId);
                        }
                    } catch (error) {
                        // Pointer capture is optional; the parent still receives normal events.
                    }
                    postDesktopPointer('down', event);
                }
            }, true);

            document.addEventListener('pointermove', function (event) {
                if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
                if (Math.abs(event.clientX - pointerStart.clientX) > 10 || Math.abs(event.clientY - pointerStart.clientY) > 10) {
                    pointerStart.moved = true;
                }
                if (isDesktopWidget) {
                    postDesktopPointer('move', event);
                }
            }, true);

            document.addEventListener('pointerup', function (event) {
                if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
                const pressDuration = Date.now() - pointerStart.startedAt;
                const shouldOpenTouchPicker = isDesktopWidget && event.pointerType === 'touch' && !pointerStart.moved && pressDuration < 550;
                if (pointerStart.moved || pressDuration >= 550 || shouldOpenTouchPicker) {
                    suppressImageClickUntil = Date.now() + 500;
                }
                if (isDesktopWidget) {
                    postDesktopPointer('up', event);
                }
                pointerStart = null;

                if (shouldOpenTouchPicker) {
                    const element = event.target && event.target.nodeType === 1 ? event.target : null;
                    const target = element && (findImageTarget(element) || findBackgroundTarget(element));
                    if (target) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        openWidgetImagePicker(target);
                    }
                }
            }, true);

            document.addEventListener('pointercancel', function (event) {
                if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
                suppressImageClickUntil = Date.now() + 500;
                if (isDesktopWidget) {
                    postDesktopPointer('cancel', event);
                }
                pointerStart = null;
            }, true);

            function extractBackgroundUrl(value) {
                const match = String(value || '').match(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/i);
                return match ? (match[1] || match[2] || (match[3] || '').trim()) : '';
            }

            function findRuleBackground(element, rules) {
                let source = '';
                Array.prototype.forEach.call(rules || [], function (rule) {
                    try {
                        if (rule.cssRules) {
                            const nestedSource = findRuleBackground(element, rule.cssRules);
                            if (nestedSource) source = nestedSource;
                        } else if (rule.selectorText && element.matches(rule.selectorText)) {
                            const ruleSource = extractBackgroundUrl(rule.style && rule.style.backgroundImage);
                            if (ruleSource) source = ruleSource;
                        }
                    } catch (error) {
                        // Ignore inaccessible or unsupported CSS rules in the preview.
                    }
                });
                return source;
            }

            function getBackgroundSource(element) {
                const inlineSource = extractBackgroundUrl(element.style && element.style.backgroundImage);
                if (inlineSource) return inlineSource;

                let ruleSource = '';
                Array.prototype.forEach.call(document.styleSheets || [], function (styleSheet) {
                    try {
                        const matchedSource = findRuleBackground(element, styleSheet.cssRules);
                        if (matchedSource) ruleSource = matchedSource;
                    } catch (error) {
                        // Ignore inaccessible stylesheets in the preview.
                    }
                });
                if (ruleSource) return ruleSource;

                return extractBackgroundUrl(getComputedStyle(element).backgroundImage);
            }

            function findBackgroundTarget(startElement) {
                let element = startElement;
                while (element && element.nodeType === 1) {
                    const source = getBackgroundSource(element);
                    if (source) return { kind: 'background', source: source };
                    if (element === document.body || element === document.documentElement) break;
                    element = element.parentElement;
                }
                return null;
            }

            function findImageTarget(startElement) {
                const uploadable = startElement && startElement.closest
                    ? startElement.closest('[data-widget-editor-uploadable-index]')
                    : null;
                if (uploadable) {
                    const markedIndex = uploadable.getAttribute('data-widget-editor-uploadable-index');
                    const index = parseInt(markedIndex, 10);
                    if (Number.isFinite(index)) {
                        return {
                            kind: 'uploadable',
                            index: index,
                            source: getBackgroundSource(uploadable)
                        };
                    }
                }

                const image = startElement && startElement.closest
                    ? startElement.closest('img, image')
                    : null;
                if (!image) return null;

                const tagName = image.tagName.toLowerCase();
                const markedIndex = image.getAttribute('data-widget-editor-image-index');
                const isStaticImage = markedIndex !== null;
                let attribute = tagName === 'image' ? 'href' : 'src';
                let source = image.getAttribute(attribute) || '';

                if (tagName === 'image' && !source) {
                    attribute = 'xlink:href';
                    source = image.getAttribute('xlink:href') || '';
                }

                return {
                    kind: tagName,
                    index: isStaticImage
                        ? parseInt(markedIndex, 10)
                        : Array.prototype.indexOf.call(document.querySelectorAll(tagName), image),
                    attribute: attribute,
                    source: source,
                    dynamic: !isStaticImage
                };
            }

            function openWidgetImagePicker(target) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';
                document.body.appendChild(input);
                input.addEventListener('change', function () {
                    const file = input.files && input.files[0];
                    if (file) {
                        parent.postMessage({
                            type: isDesktopWidget ? 'widget-desktop-image-file' : 'widget-image-editor-file',
                            target: target,
                            file: file
                        }, '*');
                    }
                    input.remove();
                }, { once: true });
                input.addEventListener('cancel', function () { input.remove(); }, { once: true });
                input.click();
            }

            document.addEventListener('pointerover', function (event) {
                const element = event.target && event.target.nodeType === 1 ? event.target : null;
                if (!element) return;
                const uploadable = element.closest && element.closest('[data-widget-editor-uploadable-index]');
                if (uploadable) {
                    uploadable.setAttribute('data-widget-editor-uploadable-hover', '');
                    return;
                }
                if (element.closest && element.closest('img, image, [contenteditable="true"]')) return;
                let current = element;
                while (current && current.nodeType === 1) {
                    if (getBackgroundSource(current)) {
                        current.setAttribute('data-widget-editor-background', '');
                        break;
                    }
                    if (current === document.body || current === document.documentElement) break;
                    current = current.parentElement;
                }
            }, true);

            document.addEventListener('click', function (event) {
                const element = event.target && event.target.nodeType === 1 ? event.target : null;
                if (!element || (element.matches && element.matches('input[type="file"]'))) return;
                if (element.closest && element.closest('[contenteditable="true"]')) return;

                const target = findImageTarget(element) || findBackgroundTarget(element);
                if (!target) return;

                if (isDesktopWidget && Date.now() < suppressImageClickUntil) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }

                event.preventDefault();
                event.stopImmediatePropagation();
                openWidgetImagePicker(target);
            }, true);

            document.addEventListener('input', function (event) {
                const element = event.target && event.target.nodeType === 1 ? event.target : null;
                if (element) postContentEdit(element, 'input');
            }, true);

            document.addEventListener('blur', function (event) {
                const element = event.target && event.target.nodeType === 1 ? event.target : null;
                if (element) postContentEdit(element, 'blur');
            }, true);
        }

        function buildWidgetImageEditableContent(content, mode) {
            let previewContent = String(content == null ? '' : content);
            const tags = scanWidgetImageTags(previewContent);

            for (let i = tags.length - 1; i >= 0; i--) {
                const tag = tags[i];
                let insertAt = tag.end;
                let beforeEnd = tag.end - 1;
                while (beforeEnd > tag.start && /\s/.test(previewContent[beforeEnd])) beforeEnd--;
                if (previewContent[beforeEnd] === '/') insertAt = beforeEnd;
                const markerName = tag.name === 'uploadable'
                    ? 'data-widget-editor-uploadable-index'
                    : tag.name === 'contenteditable'
                        ? 'data-widget-editor-content-index'
                        : 'data-widget-editor-image-index';
                const marker = ' ' + markerName + '="' + tag.index + '"';
                previewContent = previewContent.slice(0, insertAt) + marker + previewContent.slice(insertAt);
            }

            const editStyle = '<style>img[data-widget-editor-image-index],image[data-widget-editor-image-index],[data-widget-editor-uploadable-index],[data-widget-editor-background]{cursor:pointer!important}[data-widget-editor-content-index]{cursor:text!important}[data-widget-editor-uploadable-index]:hover,img[data-widget-editor-image-index]:hover,image[data-widget-editor-image-index]:hover,[data-widget-editor-background]:hover{outline:2px solid #007aff!important;outline-offset:-2px}[data-widget-editor-content-index]:focus{outline:2px solid rgba(0,122,255,.55)!important;outline-offset:2px}</style>';
            const editScript = '<script>(' + widgetImageEditBridge.toString() + ')(' + JSON.stringify(mode || 'editor') + ');<' + '/script>';
            const editTools = editStyle + editScript;
            const headMatch = /<head\b[^>]*>/i.exec(previewContent);

            if (headMatch) {
                const insertAt = headMatch.index + headMatch[0].length;
                return previewContent.slice(0, insertAt) + editTools + previewContent.slice(insertAt);
            }
            return editTools + previewContent;
        }

        function buildWidgetEditablePreview(content) {
            return buildWidgetImageEditableContent(content, 'editor');
        }

        function buildWidgetDesktopContent(content) {
            return buildWidgetImageEditableContent(content, 'desktop');
        }

        function replaceWidgetTagImage(tagText, target, imageUrl) {
            const attribute = target.attribute || (target.kind === 'image' ? 'href' : 'src');
            const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const attributePattern = new RegExp('(\\s' + escapedAttribute + '\\s*=\\s*)(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i');
            let updatedTag = tagText;

            if (attributePattern.test(tagText)) {
                updatedTag = tagText.replace(attributePattern, function (match, prefix) {
                    return prefix + '"' + imageUrl + '"';
                });
            } else {
                let insertAt = tagText.lastIndexOf('>');
                let beforeEnd = insertAt - 1;
                while (beforeEnd > 0 && /\s/.test(tagText[beforeEnd])) beforeEnd--;
                if (tagText[beforeEnd] === '/') insertAt = beforeEnd;
                updatedTag = tagText.slice(0, insertAt) + ' ' + attribute + '="' + imageUrl + '"' + tagText.slice(insertAt);
            }

            if (target.kind === 'img' && attribute === 'src') {
                const srcsetPattern = /(\ssrcset\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/i;
                updatedTag = updatedTag.replace(srcsetPattern, function (match, prefix) {
                    return prefix + '"' + imageUrl + '"';
                });
            }
            return updatedTag;
        }

        function replaceWidgetImageContent(content, target, imageUrl) {
            const source = String(content == null ? '' : content);
            if (target && target.kind === 'uploadable') {
                const matchingTags = scanWidgetImageTags(source).filter(function (tag) {
                    return tag.name === 'uploadable';
                });
                const tag = matchingTags[target.index];
                if (tag) {
                    const tagText = source.slice(tag.start, tag.end + 1);
                    const replacement = replaceWidgetUploadableTag(tagText, imageUrl);
                    return source.slice(0, tag.start) + replacement + source.slice(tag.end + 1);
                }
            }

            if (target && (target.kind === 'img' || target.kind === 'image') && !target.dynamic) {
                const matchingTags = scanWidgetImageTags(source).filter(function (tag) {
                    return tag.name === target.kind;
                });
                const tag = matchingTags[target.index];
                if (tag) {
                    const tagText = source.slice(tag.start, tag.end + 1);
                    const replacement = replaceWidgetTagImage(tagText, target, imageUrl);
                    return source.slice(0, tag.start) + replacement + source.slice(tag.end + 1);
                }
            }

            if (target && target.source && source.indexOf(target.source) !== -1) {
                return source.replace(target.source, imageUrl);
            }
            return null;
        }

        function replaceWidgetUploadableTag(tagText, imageUrl) {
            const safeUrl = String(imageUrl == null ? '' : imageUrl)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const backgroundDeclaration = 'background-image: url(' + safeUrl + ')';
            const stylePattern = /(\sstyle\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
            const styleMatch = stylePattern.exec(tagText);

            if (styleMatch) {
                const quote = styleMatch[2] !== undefined ? '"' : styleMatch[3] !== undefined ? "'" : '';
                const currentStyle = styleMatch[2] !== undefined
                    ? styleMatch[2]
                    : styleMatch[3] !== undefined
                        ? styleMatch[3]
                        : styleMatch[4];
                const nextStyle = /background-image\s*:/i.test(currentStyle)
                    ? currentStyle.replace(/background-image\s*:\s*[^;]*(;?)/i, backgroundDeclaration + '$1')
                    : currentStyle.replace(/\s*$/, '') + (currentStyle.trim() ? '; ' : '') + backgroundDeclaration;
                const encodedStyle = quote === '"'
                    ? nextStyle.replace(/"/g, '&quot;')
                    : quote === "'"
                        ? nextStyle.replace(/'/g, '&#39;')
                        : nextStyle;
                return tagText.replace(stylePattern, function (match, prefix) {
                    return prefix + (quote ? quote + encodedStyle + quote : encodedStyle);
                });
            }

            let insertAt = tagText.lastIndexOf('>');
            let beforeEnd = insertAt - 1;
            while (beforeEnd > 0 && /\s/.test(tagText[beforeEnd])) beforeEnd--;
            if (tagText[beforeEnd] === '/') insertAt = beforeEnd;
            return tagText.slice(0, insertAt) + ' style="' + backgroundDeclaration + '"' + tagText.slice(insertAt);
        }

        function findWidgetElementContentRange(source, tag) {
            const tagName = tag && tag.tagName;
            if (!tagName) return null;

            const openingTag = source.slice(tag.start, tag.end + 1);
            if (/\/\s*>$/.test(openingTag)) return null;

            let depth = 1;
            let cursor = tag.end + 1;
            const lowerSource = source.toLowerCase();
            while (cursor < source.length) {
                const nextTagStart = source.indexOf('<', cursor);
                if (nextTagStart === -1) return null;

                if (lowerSource.slice(nextTagStart, nextTagStart + 4) === '<!--') {
                    const commentEnd = lowerSource.indexOf('-->', nextTagStart + 4);
                    cursor = commentEnd === -1 ? source.length : commentEnd + 3;
                    continue;
                }

                const nextTagEnd = findWidgetTagEnd(source, nextTagStart + 1);
                if (nextTagEnd === -1) return null;
                const nextTagText = source.slice(nextTagStart, nextTagEnd + 1);
                const nameMatch = /^<\s*(\/?)\s*([A-Za-z0-9:-]+)/.exec(nextTagText);
                if (nameMatch && nameMatch[2].toLowerCase() === tagName.toLowerCase()) {
                    if (nameMatch[1]) {
                        depth--;
                        if (depth === 0) {
                            return { start: tag.end + 1, end: nextTagStart };
                        }
                    } else if (!/\/\s*>$/.test(nextTagText)) {
                        depth++;
                    }
                }

                cursor = nextTagEnd + 1;
            }
            return null;
        }

        function replaceWidgetEditableContent(content, target, html) {
            const source = String(content == null ? '' : content);
            if (!target || target.kind !== 'contenteditable' || !Number.isInteger(target.index) || target.index < 0) return null;

            const editableTags = scanWidgetImageTags(source).filter(function (tag) {
                return tag.name === 'contenteditable';
            });
            const tag = editableTags[target.index];
            const range = tag && findWidgetElementContentRange(source, tag);
            if (!range) return null;

            return source.slice(0, range.start) + String(html == null ? '' : html) + source.slice(range.end);
        }

        function readWidgetImageFile(file) {
            return new Promise(function (resolve, reject) {
                const reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = function () { reject(reader.error || new Error('Image read failed')); };
                reader.readAsDataURL(file);
            });
        }

        async function prepareWidgetImageData(file) {
            const originalData = await readWidgetImageFile(file);
            if (file.type === 'image/gif' || file.type === 'image/svg+xml') return originalData;
            if (typeof window.compressImageBase64 !== 'function') return originalData;

            return new Promise(function (resolve) {
                window.compressImageBase64(originalData, 1600, 0.88, function (compressedData) {
                    resolve(compressedData && compressedData.length < originalData.length ? compressedData : originalData);
                });
            });
        }

        window.addEventListener('message', async function (event) {
            const frame = document.getElementById('widgetCodePreviewFrame');
            const editorModal = document.getElementById('widgetEditorModal');
            const message = event.data;
            if (!frame || event.source !== frame.contentWindow || !editorModal || !editorModal.classList.contains('show')) return;
            if (!message) return;

            if (message.type === 'widget-image-editor-content') {
                if (typeof message.html !== 'string' || !message.target || typeof window.replaceWidgetEditableContent !== 'function') return;
                const editor = document.getElementById('widgetEditContent');
                const updatedContent = window.replaceWidgetEditableContent(editor.value, message.target, message.html);
                if (updatedContent != null) editor.value = updatedContent;
                return;
            }

            if (message.type !== 'widget-image-editor-file' || !(message.file instanceof Blob)) return;

            try {
                const imageData = await prepareWidgetImageData(message.file);
                const editor = document.getElementById('widgetEditContent');
                const updatedContent = replaceWidgetImageContent(editor.value, message.target, imageData);
                if (updatedContent == null) {
                    if (typeof window.showToast === 'function') window.showToast('\u672a\u80fd\u5b9a\u4f4d\u8fd9\u5f20\u56fe\u7247');
                    return;
                }
                editor.value = updatedContent;
                updateWidgetCodePreview();
                if (typeof window.showToast === 'function') window.showToast('\u56fe\u7247\u5df2\u66ff\u6362');
            } catch (error) {
                if (typeof window.showToast === 'function') window.showToast('\u56fe\u7247\u8bfb\u53d6\u5931\u8d25');
            }
        });

            // show three-dots button; click to expand vertical capsule menu
        window.renderWidgetViews = renderWidgetViews;

        function hideWidgetChrome() {
            const wg = document.getElementById('widgetAppGrid'); if (wg) wg.style.display = 'none';
            const vb = document.getElementById('widgetViewBtn'); if (vb) vb.style.display = 'none';
            const wgc = document.getElementById('widgetToolbarMenu'); if (wgc) wgc.style.display = 'none';
            const dots = document.getElementById('menuIconDots'); if (dots) dots.style.display = 'none';
            const list = document.getElementById('menuIconList'); if (list) list.style.display = 'block';
            exitWidgetEditMode(true);
        }
        window.hideWidgetChrome = hideWidgetChrome;

        function closeWidgetMenus() {
            const dd = document.getElementById('themeDropdownMenu'); if (dd) dd.classList.remove('show');
            const tbm = document.getElementById('widgetToolbarMenu'); if (tbm) tbm.classList.remove('show');
            const cm = document.getElementById('widgetContextMenu'); if (cm) cm.classList.remove('show');
            const dots = document.getElementById('menuIconDots'); if (dots) dots.style.display = 'block';
            const chev = document.getElementById('menuIconChevron'); if (chev) chev.style.display = 'none';
            const overlay = document.getElementById('widgetOverlay');
            const editor = document.getElementById('widgetEditorModal');
            if (editor && editor.classList.contains('show')) {
                if (overlay) overlay.style.zIndex = '250';
            } else if (overlay) {
                overlay.style.display = 'none';
                overlay.style.zIndex = '105';
            }
        }
        window.closeWidgetMenus = closeWidgetMenus;

            // show three-dots button; click to expand vertical capsule menu
        const originalToggleThemeMenu = window.toggleThemeMenu;
        window.toggleThemeMenu = function () {
            if (currentActiveTab === "widget") {
                const m = document.getElementById("widgetToolbarMenu");
                const ov = document.getElementById("widgetOverlay");
                if (!m.classList.contains("show")) {
                    m.classList.add("show");
                    if (ov) { ov.style.display = "block"; ov.style.zIndex = "240"; }
                    const d = document.getElementById("menuIconDots"); if (d) d.style.display = "none";
                    const c = document.getElementById("menuIconChevron"); if (c) c.style.display = "block";
                } else {
                    closeWidgetMenus();
                }
                return;
            } else if (typeof originalToggleThemeMenu === "function") { originalToggleThemeMenu(); }
        };

        function openWidgetContextMenu(index, event) {
            event.stopPropagation(); activeWidgetIndex = index;
            const menu = document.getElementById('widgetContextMenu');
            const overlay = document.getElementById('widgetOverlay');
            const rect = event.currentTarget.getBoundingClientRect();
            const hostRect = (themeAppUI || document.body).getBoundingClientRect();
            let top = rect.bottom - hostRect.top + 10;
            let left = rect.right - hostRect.left - 140;
            if (top + 200 > hostRect.height) top = rect.top - hostRect.top - 190;
            if (left < 16) left = 16;
            menu.style.top = top + 'px'; menu.style.left = left + 'px';
            menu.classList.add('show');
            overlay.style.display = 'block'; overlay.style.zIndex = '350';
        }
        window.openWidgetContextMenu = openWidgetContextMenu;

        function widgetCtxAction(action) {
            closeWidgetMenus();
            if (activeWidgetIndex === -1) return;

            if (action === 'edit') { openWidgetEditor(activeWidgetIndex); }
            else if (action === 'addToDesktop') {
                const widget = currentWidgets[activeWidgetIndex];
                const added = addDesktopWidget(widget);
                if (added && typeof window.showToast === 'function') window.showToast('已添加到桌面');
            }
            else if (action === 'export') {
                const widget = currentWidgets[activeWidgetIndex];
                const fileName = (widget.name || 'widget') + '.json';
                const dataStr = JSON.stringify(widget, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                if (typeof showToast === 'function') showToast("导出成功");
            }
        }
        window.widgetCtxAction = widgetCtxAction;

        function toggleWidgetViewMode(forceMode) {
            widgetViewMode = forceMode ? forceMode : (widgetViewMode === 'carousel' ? 'list' : 'carousel');
            const iL = document.getElementById('widgetIconList');
            const iC = document.getElementById('widgetIconCard');
            if (iL) iL.style.display = widgetViewMode === 'carousel' ? 'block' : 'none';
            if (iC) iC.style.display = widgetViewMode === 'list' ? 'block' : 'none';
            if (widgetViewMode === 'list') widgetContentArea.classList.add('show-list');
            else { widgetContentArea.classList.remove('show-list'); updateWidgetCardsContinuous(); }
        }
        window.toggleWidgetViewMode = toggleWidgetViewMode;

        function enterWidgetEditMode() {
            closeWidgetMenus(); isWidgetEditing = true;
            if (themeAppUI) themeAppUI.classList.add('is-widget-editing');
            toggleWidgetViewMode('list');
            document.getElementById('topBarTitle').innerText = '管理组件';
            const wgc1 = document.getElementById('widgetToolbarMenu'); if (wgc1) { wgc1.style.display = 'none'; wgc1.classList.remove('show'); }
            const doneBtn = document.getElementById('widgetDoneBtn'); if (doneBtn) doneBtn.style.display = 'block';
            const viewBtn = document.getElementById('widgetViewBtn'); if (viewBtn) viewBtn.style.display = 'none';
            const menuBtn = document.getElementById('themeMenuBtn'); if (menuBtn) menuBtn.style.display = 'none';
        }
        window.enterWidgetEditMode = enterWidgetEditMode;

        function exitWidgetEditMode(silent) {
            isWidgetEditing = false;
            if (themeAppUI) themeAppUI.classList.remove('is-widget-editing');
            if (!silent && currentActiveTab === 'widget') {
                document.getElementById('topBarTitle').innerText = 'Widgets';
                const wgc2 = document.getElementById('widgetToolbarMenu'); if (wgc2) { wgc2.style.display = 'flex'; wgc2.classList.remove('show'); }
                const doneBtn = document.getElementById('widgetDoneBtn'); if (doneBtn) doneBtn.style.display = 'none';
                const viewBtn = document.getElementById('widgetViewBtn'); if (viewBtn) viewBtn.style.display = 'flex';
                const menuBtn = document.getElementById('themeMenuBtn'); if (menuBtn) menuBtn.style.display = 'flex';
            }
        }
        window.exitWidgetEditMode = exitWidgetEditMode;

        function deleteWidget(index, event) {
            event.stopPropagation();
            if (confirm('确定要删除 "' + currentWidgets[index].name + '" 吗？')) {
                currentWidgets.splice(index, 1);
                if (activeWidgetIndex >= currentWidgets.length) activeWidgetIndex = currentWidgets.length - 1;
                renderWidgetViews();
                if (typeof window.saveCustomWidgetsData === 'function') window.saveCustomWidgetsData();
            }
        }
        window.deleteWidget = deleteWidget;


        // import widgets from a .json file (single object or array). Fields: name, preview, content.
        function handleWidgetJsonImport(event) {
            closeWidgetMenus();
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    let parsed = JSON.parse(ev.target.result);
                    if (!Array.isArray(parsed)) parsed = [parsed];
                    let added = 0;
                    parsed.forEach(function (w) {
                        if (!w || typeof w !== 'object') return;
                        customWidgets.push({
                            name: w.name || ('widget ' + (customWidgets.length + 1)),
                            preview: w.preview || 'linear-gradient(135deg,#a1c4fd 0%,#c2e9fb 100%)',
                            content: w.content || w.html || '',
                            width: w.width || '',
                            height: w.height || '',
                            presetSize: w.presetSize || ''
                        });
                        added++;
                    });
                    // switch to custom tab so the user sees imports immediately
                    if (typeof switchWidgetTab === 'function') switchWidgetTab(1);
                    else { currentWidgets = customWidgets; renderWidgetViews(); }
                    if (typeof window.saveCustomWidgetsData === 'function') window.saveCustomWidgetsData();
                    alert('imported ' + added + ' widget(s)');
                } catch (err) { alert('JSON parse failed: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        }
        window.handleWidgetJsonImport = handleWidgetJsonImport;

        // export all widgets (official + custom) as a .json download
        function exportWidgetJson() {
            closeWidgetMenus();
            const all = officialWidgets.concat(customWidgets).map(function (w) {
                return { name: w.name || '', preview: w.preview || '', content: w.content || '', width: w.width || '', height: w.height || '', presetSize: w.presetSize || '' };
            });
            const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'widgets.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        window.exportWidgetJson = exportWidgetJson;

        function updateWidgetCodePreview() {
            const preview = document.getElementById('widgetCodePreview');
            const stage = document.getElementById('widgetCodePreviewStage');
            const frame = document.getElementById('widgetCodePreviewFrame');
            const sizeLabel = document.getElementById('widgetCodePreviewSize');
            const editor = document.getElementById('widgetEditContent');
            if (!preview || !stage || !frame || !sizeLabel || !editor) return;

            const checkedPreset = document.querySelector('input[name="widgetPresetSize"]:checked');
            let cols = 1;
            let rows = 1;
            if (checkedPreset) {
                const parts = checkedPreset.value.split('x').map(Number);
                cols = parts[0] || 1;
                rows = parts[1] || 1;
            } else if (document.getElementById('widgetCustomSizeLabel').innerText !== '自定义大小') {
                cols = parseInt(document.getElementById('customW').innerText, 10) || 1;
                rows = parseInt(document.getElementById('customH').innerText, 10) || 1;
            }

            const width = cols * 140;
            const height = rows * 140;
            preview.style.display = 'block';
            const availableWidth = stage.clientWidth || 280;
            const scale = Math.min(1, availableWidth / width);
            stage.style.height = Math.round(height * scale) + 'px';
            frame.style.width = width + 'px';
            frame.style.height = height + 'px';
            frame.style.transform = 'scale(' + scale + ')';
            frame.srcdoc = buildWidgetEditablePreview(editor.value);
            sizeLabel.innerText = cols + ' × ' + rows;
        }
        window.updateWidgetCodePreview = updateWidgetCodePreview;

        function openWidgetEditor(index) {
            activeWidgetIndex = index; const widget = currentWidgets[index];
            document.getElementById('widgetEditName').value = widget.name;
            document.getElementById('widgetEditContent').value = widget.content || '';
            if (widget.width && widget.height) {
                const cw = Math.round(widget.width / 140) || 1;
                const ch = Math.round(widget.height / 140) || 1;
                document.getElementById('customW').innerText = cw;
                document.getElementById('customH').innerText = ch;
                document.getElementById('widgetCustomSizeLabel').innerText = cw + ' × ' + ch;
                document.getElementById('widgetCustomSizeLabel').style.color = '#000';
            } else {
                document.getElementById('customW').innerText = '1';
                document.getElementById('customH').innerText = '1';
                document.getElementById('widgetCustomSizeLabel').innerText = '自定义大小';
                document.getElementById('widgetCustomSizeLabel').style.color = '#8e8e93';
            }
            const radios = document.querySelectorAll('input[name="widgetPresetSize"]');
            radios.forEach(r => { r.checked = (widget.presetSize && r.value === widget.presetSize); });
            document.getElementById('widgetEditorModal').classList.add('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'block'; overlay.style.zIndex = '250';
            requestAnimationFrame(updateWidgetCodePreview);
        }
        window.openWidgetEditor = openWidgetEditor;

        function closeWidgetEditor() {
            const modal = document.getElementById('widgetEditorModal');
            const focusedElement = document.activeElement;
            if (focusedElement && modal.contains(focusedElement) && typeof focusedElement.blur === 'function') {
                focusedElement.blur();
            }
            modal.classList.remove('show');
            const overlay = document.getElementById('widgetOverlay');
            overlay.style.display = 'none'; overlay.style.zIndex = '105';
            const preview = document.getElementById('widgetCodePreview');
            const frame = document.getElementById('widgetCodePreviewFrame');
            if (preview) preview.style.display = 'none';
            if (frame) frame.srcdoc = '';
            activeWidgetIndex = -1;
            requestAnimationFrame(function () {
                if (typeof window.refreshAppViewport === 'function') {
                    window.refreshAppViewport();
                } else {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                }
            });
        }

        window.buildWidgetDesktopContent = buildWidgetDesktopContent;
        window.replaceWidgetImageContent = replaceWidgetImageContent;
        window.replaceWidgetEditableContent = replaceWidgetEditableContent;
        window.prepareWidgetImageData = prepareWidgetImageData;
        if (typeof window.refreshDesktopWidgetFrames === 'function') {
            window.refreshDesktopWidgetFrames();
        }
        window.closeWidgetEditor = closeWidgetEditor;

        (function() {
            const topBar = document.querySelector('#widgetEditorModal .ios-top-bar');
            const modal = document.getElementById('widgetEditorModal');
            let startY = 0;
            let currentY = 0;
            if (topBar && modal) {
                topBar.addEventListener('touchstart', (e) => {
                    startY = e.touches[0].clientY;
                    modal.style.transition = 'none';
                }, { passive: true });
                topBar.addEventListener('touchmove', (e) => {
                    currentY = e.touches[0].clientY;
                    const delta = currentY - startY;
                    if (delta > 0) {
                        modal.style.transform = `translateY(${delta}px)`;
                    }
                }, { passive: true });
                topBar.addEventListener('touchend', () => {
                    const delta = currentY - startY;
                    modal.style.transition = '';
                    modal.style.transform = '';
                    if (delta > 80) {
                        closeWidgetEditor();
                    }
                });
            }
        })();

        function saveWidgetEditor() {
            if (activeWidgetIndex > -1) {
                const widget = currentWidgets[activeWidgetIndex];
                widget.name = document.getElementById('widgetEditName').value.trim() || '未命名组件';
                widget.content = document.getElementById('widgetEditContent').value;
                const lbl = document.getElementById('widgetCustomSizeLabel').innerText;
                const widthVal = lbl !== '自定义大小' ? parseInt(document.getElementById('customW').innerText, 10) * 140 : null;
                const heightVal = lbl !== '自定义大小' ? parseInt(document.getElementById('customH').innerText, 10) * 140 : null;
                const checkedPreset = document.querySelector('input[name="widgetPresetSize"]:checked');
                if (widthVal && heightVal) {
                    widget.width = widthVal;
                    widget.height = heightVal;
                    widget.presetSize = '';
                } else if (checkedPreset) {
                    widget.width = '';
                    widget.height = '';
                    widget.presetSize = checkedPreset.value;
                } else {
                    widget.width = '';
                    widget.height = '';
                    widget.presetSize = '';
                }
                renderWidgetViews();
                if (typeof window.saveCustomWidgetsData === 'function') window.saveCustomWidgetsData();
            }
            closeWidgetEditor();
        }
        window.saveWidgetEditor = saveWidgetEditor;

        function switchWidgetTab(index, progressIndex) {
            if (isWidgetEditing) return;
            widgetSegmentBtns.forEach((btn, i) => btn.classList.toggle('active', i === index));
            if (widgetIndicator) widgetIndicator.style.transform = 'translateX(' + (index * 100) + '%)';
            currentWidgets = index === 0 ? officialWidgets : customWidgets;
            const nextProgress = Number.isInteger(progressIndex) ? progressIndex : 0;
            currentProgress = nextProgress; targetProgress = nextProgress;
            renderWidgetViews();
        }
        window.switchWidgetTab = switchWidgetTab;

        function handleAddWidget() {
            closeWidgetMenus();
            customWidgets.push({
                name: '自定义组件 ' + (customWidgets.length + 1),
                content: '',
                width: '',
                height: '',
                presetSize: ''
            });
            const newWidgetIndex = customWidgets.length - 1;
            switchWidgetTab(1, newWidgetIndex);
            if (typeof window.saveCustomWidgetsData === 'function') window.saveCustomWidgetsData();
            openWidgetEditor(newWidgetIndex);
        }
        window.handleAddWidget = handleAddWidget;

        function renderWidgetViews() {
            widgetTrack.innerHTML = ''; widgetPagination.innerHTML = ''; widgetListContainer.innerHTML = '';
            if (currentWidgets.length === 0) {
                widgetEmptyState.style.display = 'block';
                widgetContentArea.style.display = 'none';
                return;
            }
            widgetEmptyState.style.display = 'none';
            widgetContentArea.style.display = 'flex';

            currentWidgets.forEach((widget, i) => {
                const card = document.createElement('div'); card.className = 'widget-card';
                card.innerHTML = '<div class="widget-card-more-btn" onclick="openWidgetContextMenu(' + i + ', event)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg></div><div class="widget-card-preview">' + makeWidgetFrameHTML(widget.content) + '</div><div class="widget-card-name">' + widget.name + '</div><div class="widget-card-size">' + formatWidgetSizeLabel(widget) + '</div>';
                widgetTrack.appendChild(card);

                const dot = document.createElement('div'); dot.className = 'widget-dot'; widgetPagination.appendChild(dot);

                const listItem = document.createElement('div'); listItem.className = 'widget-list-item';
                listItem.onclick = function () {
                    if (isWidgetEditing) openWidgetEditor(i);
                    else { targetProgress = i; currentProgress = i; toggleWidgetViewMode('carousel'); }
                };
                listItem.innerHTML = '<div class="widget-delete-btn-left" onclick="deleteWidget(' + i + ', event)"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg></div><div class="widget-list-item-icon"></div><div class="widget-list-item-info"><div class="widget-title-wrapper"><div class="widget-list-item-title">' + widget.name + '</div><svg class="widget-edit-pencil" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></div><div class="widget-list-item-sub">Widget</div></div><div class="widget-list-action-trigger" onclick="openWidgetContextMenu(' + i + ', event)"><svg width="20" height="20" viewBox="0 0 24 24" fill="#c7c7cc" stroke="none"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg></div>';
                const listPreviewHost = listItem.querySelector('.widget-list-item-icon');
                const listPreviewFrame = document.createElement('iframe');
                const listPreviewDims = getWidgetDimensions(widget);
                const listPreviewScale = Math.min(48 / listPreviewDims.width, 48 / listPreviewDims.height);
                listPreviewFrame.className = 'widget-list-preview-frame';
                listPreviewFrame.setAttribute('sandbox', 'allow-scripts');
                listPreviewFrame.setAttribute('title', (widget.name || '组件') + '预览');
                listPreviewFrame.style.width = listPreviewDims.width + 'px';
                listPreviewFrame.style.height = listPreviewDims.height + 'px';
                listPreviewFrame.style.left = (48 - listPreviewDims.width * listPreviewScale) / 2 + 'px';
                listPreviewFrame.style.top = (48 - listPreviewDims.height * listPreviewScale) / 2 + 'px';
                listPreviewFrame.style.transform = 'scale(' + listPreviewScale + ')';
                listPreviewFrame.srcdoc = widget.content || '';
                listPreviewHost.appendChild(listPreviewFrame);
                widgetListContainer.appendChild(listItem);
            });
            updateWidgetCardsContinuous();
        }


        function updateWidgetCardsContinuous() {
            if (currentWidgets.length === 0 || widgetViewMode === 'list') return;
            const cards = document.querySelectorAll('#widgetAppGrid .widget-card');
            const dots = document.querySelectorAll('#widgetPagination .widget-dot');
            cards.forEach((card, i) => {
                const rel = i - currentProgress; const absRel = Math.abs(rel);
                const translateX = rel * 110; const rotateY = -rel * 45; const translateZ = -absRel * 100;
                const scale = Math.max(0.8, 1 - absRel * 0.1); const opacity = Math.max(0, 1 - absRel * 0.6);
                card.style.transform = 'translateX(' + translateX + '%) translateZ(' + translateZ + 'px) rotateY(' + rotateY + 'deg) scale(' + scale + ')';
                card.style.opacity = opacity; card.style.zIndex = 100 - Math.round(absRel * 100);
            });
            dots.forEach((dot, i) => {
                dot.style.opacity = Math.max(0.3, 1 - Math.abs(i - currentProgress));
                dot.classList.toggle('active', Math.round(currentProgress) === i);
            });
        }

            // show three-dots button; click to expand vertical capsule menu
        const wCarouselArea = document.getElementById('widgetCarousel');
        if (wCarouselArea) {
            wCarouselArea.addEventListener('touchstart', function (e) {
                if (currentWidgets.length <= 1 || widgetViewMode === 'list') return;
                isDragging = true; startX = e.touches[0].clientX; startProgress = currentProgress;
            }, { passive: true });
            wCarouselArea.addEventListener('touchmove', function (e) {
                if (!isDragging || widgetViewMode === 'list') return;
                e.preventDefault();
                let newProgress = startProgress - ((e.touches[0].clientX - startX) / window.innerWidth) * 1.8;
                if (newProgress < 0) newProgress *= 0.3;
                else if (newProgress > currentWidgets.length - 1) newProgress = (currentWidgets.length - 1) + (newProgress - (currentWidgets.length - 1)) * 0.3;
                currentProgress = newProgress; updateWidgetCardsContinuous();
            }, { passive: false });
            wCarouselArea.addEventListener('touchend', function () {
                if (!isDragging || widgetViewMode === 'list') return;
                isDragging = false; targetProgress = Math.round(currentProgress);
                if (targetProgress < 0) targetProgress = 0;
                if (targetProgress > currentWidgets.length - 1) targetProgress = currentWidgets.length - 1;
            });
        }

            // show three-dots button; click to expand vertical capsule menu
        function animateWidget() {
            if (!isDragging && widgetViewMode === 'carousel') {
                currentProgress += (targetProgress - currentProgress) * 0.15;
                if (Math.abs(targetProgress - currentProgress) < 0.001) currentProgress = targetProgress;
                updateWidgetCardsContinuous();
            }
            requestAnimationFrame(animateWidget);
        }
        animateWidget();
    })();
            // show three-dots button; click to expand vertical capsule menu
