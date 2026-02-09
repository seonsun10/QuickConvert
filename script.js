document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const optionsPanel = document.getElementById('options-panel');
    const resultSection = document.getElementById('result-section');
    const resultList = document.getElementById('result-list');
    const convertAllBtn = document.getElementById('convert-all-btn');
    const downloadZipBtn = document.getElementById('download-zip-btn');
    const qualityRange = document.getElementById('quality-range');
    const qualityValue = document.getElementById('quality-value');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const resizeWidthInput = document.getElementById('resize-width');
    const renamePrefixInput = document.getElementById('rename-prefix');
    const loader = document.getElementById('loader');
    const themeToggle = document.getElementById('theme-toggle');

    // Modals
    const modalContainer = document.getElementById('modal-container');
    const modalClose = document.getElementById('modal-close');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const cropperWrapper = document.getElementById('cropper-wrapper');
    const cropperImage = document.getElementById('cropper-image');
    const compareWrapper = document.getElementById('compare-wrapper');
    const compareBefore = document.getElementById('compare-before');
    const compareAfter = document.getElementById('compare-after');
    const compareAfterWrapper = document.getElementById('compare-after-wrapper');
    const compareRange = document.getElementById('compare-range');

    // Mode Switching
    const modalModeTabs = document.getElementById('modal-mode-tabs');
    const modalTabs = document.querySelectorAll('.modal-tab');

    // Drawing UI
    const drawWrapper = document.getElementById('draw-wrapper');
    const drawCanvas = document.getElementById('draw-canvas');
    const drawCtx = drawCanvas.getContext('2d');
    const colorBtns = document.querySelectorAll('.color-btn');
    const customColorPicker = document.getElementById('custom-color-picker');
    const brushSizeInput = document.getElementById('brush-size');
    const brushSizeVal = document.getElementById('brush-size-val');
    const drawClearBtn = document.getElementById('draw-clear-btn');

    // Zoom Buttons
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomVal = document.getElementById('zoom-val');

    const uploadReadyList = document.getElementById('upload-ready-list');

    // --- State ---
    let uploadedImages = []; // Array of { file, originalUrl, editedCanvas, id }
    let convertedResults = [];
    let selectedFormat = 'image/webp';
    let cropper = null;
    let currentEditingId = null;
    let currentMode = 'crop';

    // Drawing & Zoom State
    let isDrawing = false;
    let currentColor = '#000000';
    let currentBrushSize = 5;
    let currentZoom = 1;

    // --- Initialization ---
    initTheme();

    // --- Event Listeners ---

    // Zoom Logic
    zoomInBtn.addEventListener('click', () => adjustZoom(0.25));
    zoomOutBtn.addEventListener('click', () => adjustZoom(-0.25));

    function adjustZoom(delta) {
        currentZoom = Math.max(0.25, Math.min(5, currentZoom + delta));
        zoomVal.textContent = Math.round(currentZoom * 100) + '%';
        applyZoom();
    }

    function applyZoom() {
        // We zoom by changing the display style, but keeping the canvas internal size intact
        // This makes drawing precise and high-quality
        const width = drawCanvas.width * currentZoom;
        const height = drawCanvas.height * currentZoom;
        drawCanvas.style.width = width + 'px';
        drawCanvas.style.height = height + 'px';
        // currentZoom is relative to the 'fitted' size
        // We calculate baseScale once in initDrawCanvas
        const baseWidth = drawCanvas.width * (drawCanvas.dataset.fitScale || 1);
        const baseHeight = drawCanvas.height * (drawCanvas.dataset.fitScale || 1);

        drawCanvas.style.width = (baseWidth * currentZoom) + 'px';
        drawCanvas.style.height = (baseHeight * currentZoom) + 'px';
    }

    // Save Button

    // Modal Mode Switching
    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modalTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            updateModalUI();
        });
    });

    // Save Button
    modalSaveBtn.addEventListener('click', () => {
        const index = uploadedImages.findIndex(img => img.id === currentEditingId);
        if (index === -1) return;

        if (currentMode === 'crop' && cropper) {
            uploadedImages[index].editedCanvas = cropper.getCroppedCanvas();
        } else if (currentMode === 'draw') {
            // We need to save the drawing at the canvas internal resolution
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = drawCanvas.width;
            finalCanvas.height = drawCanvas.height;
            finalCanvas.getContext('2d').drawImage(drawCanvas, 0, 0);
            uploadedImages[index].editedCanvas = finalCanvas;
        }

        // Update preview
        const items = uploadReadyList.querySelectorAll('.upload-item');
        const imgEl = items[index].querySelector('img');
        imgEl.src = uploadedImages[index].editedCanvas.toDataURL();

        closeModal();
    });

    // --- Drawing functions ---
    drawCanvas.addEventListener('mousedown', startDrawing);
    drawCanvas.addEventListener('mousemove', draw);
    drawCanvas.addEventListener('mouseup', stopDrawing);
    drawCanvas.addEventListener('mouseout', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        drawCtx.beginPath();
        const pos = getMousePos(drawCanvas, e);
        drawCtx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getMousePos(drawCanvas, e);
        // Adjust brush size relative to zoom so it feels consistent
        drawCtx.lineWidth = currentBrushSize / (drawCanvas.dataset.fitScale * currentZoom || 1);
        drawCtx.lineCap = 'round';
        drawCtx.strokeStyle = currentColor;
        drawCtx.lineTo(pos.x, pos.y);
        drawCtx.stroke();
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        drawCtx.closePath();
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    }

    // Color buttons
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentColor = btn.dataset.color;
        });
    });

    customColorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        colorBtns.forEach(b => b.classList.remove('active'));
    });

    // Brush size
    brushSizeInput.addEventListener('input', (e) => {
        currentBrushSize = parseInt(e.target.value);
        brushSizeVal.textContent = currentBrushSize;
    });

    // Clear canvas
    drawClearBtn.addEventListener('click', () => {
        const item = uploadedImages.find(img => img.id === currentEditingId);
        if (item) initDrawCanvas(item, true); // true to force reload from source
    });

    // Other listeners (Theme, Tabs, Upload, Convert...) -> Keep existing
    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme', !isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedFormat = btn.dataset.value;
        });
    });

    qualityRange.addEventListener('input', () => {
        qualityValue.textContent = qualityRange.value;
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    convertAllBtn.addEventListener('click', async () => {
        if (uploadedImages.length === 0) return;
        showLoader(true);
        resultList.innerHTML = '';
        convertedResults = [];
        resultSection.style.display = 'block';
        const format = selectedFormat;
        const quality = qualityRange.value / 100;
        const resizeWidth = parseInt(resizeWidthInput.value) || null;
        const prefix = renamePrefixInput.value.trim();

        for (let i = 0; i < uploadedImages.length; i++) {
            const item = uploadedImages[i];
            try {
                const converted = await processImage(item, format, quality, resizeWidth);
                let outputName = getOutputFilename(item.file.name, format);
                if (prefix) {
                    const ext = outputName.split('.').pop();
                    outputName = `${prefix}${i + 1}.${ext}`;
                }
                const resultData = { ...converted, name: outputName, originalFile: item.file };
                convertedResults.push(resultData);
                renderResult(resultData);
            } catch (err) {
                console.error('Conversion error:', err);
            }
        }
        downloadZipBtn.style.display = convertedResults.length > 1 ? 'inline-block' : 'none';
        showLoader(false);
        resultSection.scrollIntoView({ behavior: 'smooth' });
    });

    downloadZipBtn.addEventListener('click', async () => {
        const zip = new JSZip();
        convertedResults.forEach(res => zip.file(res.name, res.blob));
        const content = await zip.generateAsync({ type: 'blob' });
        saveBlob(content, 'quickconvert_results.zip');
    });

    modalClose.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { if (e.target === modalContainer) closeModal(); });
    compareRange.addEventListener('input', (e) => { compareAfterWrapper.style.width = e.target.value + '%'; });

    // --- Functions ---

    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        }
    }

    async function handleFiles(files) {
        if (files.length === 0) return;
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            const url = URL.createObjectURL(file);
            uploadedImages.push({
                file,
                originalUrl: url,
                editedCanvas: null,
                id: Date.now() + Math.random()
            });
        }
        optionsPanel.style.display = 'block';
        optionsPanel.scrollIntoView({ behavior: 'smooth' });
        renderUploadList();
    }

    function renderUploadList() {
        uploadReadyList.innerHTML = '';
        uploadReadyList.style.display = uploadedImages.length > 0 ? 'grid' : 'none';
        uploadedImages.forEach(item => {
            const div = document.createElement('div');
            div.className = 'upload-item';
            div.innerHTML = `
                <img src="${item.originalUrl}" alt="Preview">
                <span>${item.file.name}</span>
                <button class="action-btn edit-btn" style="width:100%">편집 (자르기/그리기)</button>
            `;
            div.querySelector('.edit-btn').onclick = () => openEditModal(item);
            uploadReadyList.appendChild(div);
        });
        convertAllBtn.textContent = `${uploadedImages.length}개의 이미지 변환하기`;
    }

    function openEditModal(item) {
        currentEditingId = item.id;

        // --- 1. Capture the Pristine Base State for this session ---
        // This is what 'Clear' will revert to.
        item.sessionBase = item.editedCanvas ? item.editedCanvas.toDataURL() : item.originalUrl;

        // --- 2. Pre-calculate Stable Scaling ---
        // We open the modal first to get accurate measurements of the viewport
        modalContainer.style.display = 'flex';

        const bodyRect = modalContainer.querySelector('.modal-body').getBoundingClientRect();
        const toolbarHeight = drawWrapper.querySelector('.draw-toolbar').offsetHeight;
        const padding = 60;

        const availW = bodyRect.width - padding;
        const availH = bodyRect.height - toolbarHeight - padding;

        const imgTemp = new Image();
        imgTemp.onload = () => {
            const w = imgTemp.naturalWidth || imgTemp.width;
            const h = imgTemp.naturalHeight || imgTemp.height;
            item.sessionFullRes = { w, h };
            item.sessionFitScale = Math.min(1, availW / w, availH / h);

            // Now that we have session data, we can start the first draw mode initialization
            modalModeTabs.style.display = 'flex';
            modalSaveBtn.style.display = 'inline-block';
            modalTabs[0].click(); // Triggers updateModalUI which calls initDrawCanvas
        };
        imgTemp.src = item.sessionBase;
    }

    function updateModalUI() {
        const item = uploadedImages.find(img => img.id === currentEditingId);
        if (!item) return;

        cropperWrapper.style.display = currentMode === 'crop' ? 'block' : 'none';
        drawWrapper.style.display = currentMode === 'draw' ? 'flex' : 'none';
        compareWrapper.style.display = 'none';

        if (currentMode === 'crop') {
            cropperImage.src = item.editedCanvas ? item.editedCanvas.toDataURL() : item.originalUrl;
            if (cropper) cropper.destroy();
            cropperImage.onload = () => {
                cropper = new Cropper(cropperImage, { viewMode: 1, autoCropArea: 0.8 });
            };
        } else if (currentMode === 'draw') {
            initDrawCanvas(item);
        }
    }

    // --- Revised Functions ---

    function initDrawCanvas(item, isClear = false) {
        const img = new Image();
        img.onload = () => {
            currentZoom = 1;
            zoomVal.textContent = '100%';

            // Use the stored session dimensions for absolute stability
            const resWidth = item.sessionFullRes.w;
            const resHeight = item.sessionFullRes.h;
            const fitScale = item.sessionFitScale;

            drawCanvas.width = resWidth;
            drawCanvas.height = resHeight;
            drawCanvas.dataset.fitScale = fitScale;

            // Sync CSS dimensions (stable because fitScale is pre-calculated once)
            drawCanvas.style.width = (resWidth * fitScale) + 'px';
            drawCanvas.style.height = (resHeight * fitScale) + 'px';

            drawCtx.clearRect(0, 0, resWidth, resHeight);
            drawCtx.drawImage(img, 0, 0, resWidth, resHeight);
        };
        // Clear always goes back to the state when the modal was opened
        img.src = isClear ? item.sessionBase : (item.editedCanvas ? item.editedCanvas.toDataURL() : item.originalUrl);
    }

    function showCompareModal(res) {
        modalModeTabs.style.display = 'none';
        cropperWrapper.style.display = 'none';
        drawWrapper.style.display = 'none';
        compareWrapper.style.display = 'block';
        modalSaveBtn.style.display = 'none';
        compareBefore.src = res.originalUrl;
        compareAfter.src = res.url;
        compareAfterWrapper.style.width = '50%';
        compareRange.value = 50;
        modalContainer.style.display = 'flex';
        const sliderWidth = compareWrapper.querySelector('.compare-slider').offsetWidth;
        compareAfterWrapper.style.setProperty('--slider-width', sliderWidth + 'px');
    }

    function closeModal() {
        modalContainer.style.display = 'none';
        if (cropper) { cropper.destroy(); cropper = null; }
    }

    async function processImage(item, format, quality, targetWidth) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const source = item.editedCanvas || img;
                let width = source.width;
                let height = source.height;
                if (targetWidth && targetWidth < width) {
                    const ratio = targetWidth / width;
                    width = targetWidth;
                    height = source.height * ratio;
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(source, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve({
                        blob, url: URL.createObjectURL(blob),
                        originalSize: item.file.size, newSize: blob.size,
                        width, height, originalUrl: item.originalUrl
                    });
                }, format, quality);
            };
            img.src = item.editedCanvas ? item.editedCanvas.toDataURL() : item.originalUrl;
        });
    }

    function renderResult(res) {
        const item = document.createElement('div');
        item.className = 'result-item';
        const reduction = ((1 - (res.newSize / res.originalSize)) * 100).toFixed(1);
        item.innerHTML = `
            <img src="${res.url}" class="preview-img" alt="Preview">
            <div class="file-info"><div class="file-name">${res.name}</div><span>${res.width} x ${Math.round(res.height)} px</span></div>
            <div class="size-compare"><div class="size-old">${formatBytes(res.originalSize)}</div><div class="size-new">${formatBytes(res.newSize)} (${reduction > 0 ? '-' : '+'}${Math.abs(reduction)}%)</div></div>
            <div class="result-actions"><button class="action-btn compare-btn">비교</button><a href="${res.url}" download="${res.name}" class="action-btn download-btn" style="text-decoration:none; background:var(--primary-color); color:white;">다운로드</a></div>
        `;
        item.querySelector('.compare-btn').onclick = () => showCompareModal(res);
        resultList.appendChild(item);
    }

    function getOutputFilename(originalName, mimeType) {
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        const ext = mimeType.split('/')[1].replace('jpeg', 'jpg').replace('image/', '');
        return `${baseName}.${ext}`;
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['Bytes', 'KB', 'MB', 'GB'][i];
    }

    function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }

    function showLoader(show) { loader.style.display = show ? 'flex' : 'none'; }
});
