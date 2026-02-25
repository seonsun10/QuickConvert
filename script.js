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

    // Feature Tabs
    const featureTabBtns = document.querySelectorAll('.feature-tab-btn');
    const featureTabContents = document.querySelectorAll('.feature-tab-content');

    // File Converter UI Elements
    const fileDropZone = document.getElementById('file-drop-zone');
    const documentFileInput = document.getElementById('document-file-input');
    const fileUploadReadyList = document.getElementById('file-upload-ready-list');
    const fileOptionsPanel = document.getElementById('file-options-panel');
    const fileResultSection = document.getElementById('file-result-section');
    const fileResultList = document.getElementById('file-result-list');
    const convertFileBtn = document.getElementById('convert-file-btn');

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

    // File Converter State
    let uploadedFiles = [];
    let hwpJsInstance = null; // To hold hwp.js instance if needed globally

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

    // Feature Tabs logic
    featureTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            featureTabBtns.forEach(b => b.classList.remove('active'));
            featureTabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.dataset.target;
            document.getElementById(targetId).classList.add('active');
        });
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

    // --- File Converter Event Listeners ---
    fileDropZone.addEventListener('click', () => documentFileInput.click());
    documentFileInput.addEventListener('change', (e) => handleDocumentFiles(e.target.files));
    fileDropZone.addEventListener('dragover', (e) => { e.preventDefault(); fileDropZone.classList.add('dragover'); });
    fileDropZone.addEventListener('dragleave', () => fileDropZone.classList.remove('dragover'));
    fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropZone.classList.remove('dragover');
        handleDocumentFiles(e.dataTransfer.files);
    });

    convertFileBtn.addEventListener('click', async () => {
        if (uploadedFiles.length === 0) return;
        showLoader(true);
        loader.querySelector('p').textContent = '문서를 PDF로 변환 중...';

        fileResultList.innerHTML = '';
        fileResultSection.style.display = 'block';
        const targetFormat = document.querySelector('#file-format-tabs .tab-btn.active').dataset.value;

        for (let i = 0; i < uploadedFiles.length; i++) {
            const item = uploadedFiles[i];
            try {
                let generatedBlob = null;
                const ext = item.file.name.split('.').pop().toLowerCase();

                if (targetFormat === 'application/pdf') {
                    if (ext === 'hwp') generatedBlob = await processDocumentToPDF(item.file);
                    else if (ext === 'docx') generatedBlob = await processDocxToPDF(item.file);
                    else if (ext === 'txt') generatedBlob = await processTxtToPDF(item.file);
                } else if (targetFormat === 'text/plain') {
                    if (ext === 'hwp') generatedBlob = await processHwpToTxt(item.file);
                    else if (ext === 'docx') generatedBlob = await processDocxToTxt(item.file);
                } else if (targetFormat === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    if (ext === 'txt') generatedBlob = await processTxtToDocx(item.file);
                }

                if (generatedBlob) {
                    const outputName = getOutputFilename(item.file.name, targetFormat);
                    renderFileResult({
                        url: URL.createObjectURL(generatedBlob),
                        name: outputName,
                        originalSize: item.file.size,
                        newSize: generatedBlob.size,
                        blob: generatedBlob
                    });
                }
            } catch (err) {
                console.error('File conversion error:', err);
                alert(`${item.file.name} 변환 중 오류가 발생했습니다: ${err.message}`);
            }
        }

        showLoader(false);
        loader.querySelector('p').textContent = '변환 중입니다...'; // reset
        fileResultSection.scrollIntoView({ behavior: 'smooth' });
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

    // Handle Document Files (HWP)
    function handleDocumentFiles(files) {
        if (files.length === 0) return;
        for (const file of files) {
            const fileName = file.name.toLowerCase();
            if (!(fileName.endsWith('.hwp') || fileName.endsWith('.docx') || fileName.endsWith('.txt'))) {
                alert(`${file.name}은(는) 지원되지 않는 파일 형식입니다. HWP, DOCX, TXT 파일만 지원됩니다.`);
                continue;
            }
            // Check for duplicates
            if (!uploadedFiles.find(f => f.file.name === file.name)) {
                uploadedFiles.push({ file, id: Date.now() + Math.random() });
            }
        }

        if (uploadedFiles.length > 0) {
            fileOptionsPanel.style.display = 'block';
            fileOptionsPanel.scrollIntoView({ behavior: 'smooth' });
            renderFileUploadList();
        }
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

    function renderFileUploadList() {
        fileUploadReadyList.innerHTML = '';
        fileUploadReadyList.style.display = uploadedFiles.length > 0 ? 'grid' : 'none';
        uploadedFiles.forEach(item => {
            const div = document.createElement('div');
            div.className = 'upload-item document-item';
            div.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 10px;">📄</div>
                <span>${item.file.name}</span>
                <span class="file-size">${formatBytes(item.file.size)}</span>
            `;
            fileUploadReadyList.appendChild(div);
        });

        // 탭 가시성 업데이트 로직
        updateFormatTabsVisibility(uploadedFiles);

        convertFileBtn.textContent = `${uploadedFiles.length}개의 파일 변환하기`;
    }

    function updateFormatTabsVisibility(files) {
        const tabs = document.querySelectorAll('#file-format-tabs .tab-btn');
        tabs.forEach(t => t.style.display = 'none'); // 초기화

        // 항상 PDF는 지원
        const pdfTab = document.querySelector('#file-format-tabs .tab-btn[data-value="application/pdf"]');
        if (pdfTab) pdfTab.style.display = 'inline-block';

        if (files.length > 0) {
            // 편의상 첫 번째 아이템의 확장자로 판별 (일괄처리의 경우 확장자가 섞일 수 있으나 최소한 첫 번째를 기준으로 UI 설정)
            const ext = files[0].file.name.split('.').pop().toLowerCase();
            const txtTab = document.querySelector('#file-format-tabs .tab-btn[data-value="text/plain"]');
            const docxTab = document.querySelector('#file-format-tabs .tab-btn[data-value="application/vnd.openxmlformats-officedocument.wordprocessingml.document"]');

            if (ext === 'hwp' || ext === 'docx') {
                if (txtTab) txtTab.style.display = 'inline-block';
            } else if (ext === 'txt') {
                if (docxTab) docxTab.style.display = 'inline-block';
            }
        }

        // 활성 탭이 숨김처리 되었다면 PDF로 초기화
        let activeTab = document.querySelector('#file-format-tabs .tab-btn.active');
        if (activeTab && activeTab.style.display === 'none') {
            tabs.forEach(t => t.classList.remove('active'));
            if (pdfTab) pdfTab.classList.add('active');
        }
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

    async function processDocumentToPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const arrayBuffer = e.target.result;
                    // Create a hidden container for rendering HWP
                    const container = document.createElement('div');
                    container.style.width = '794px'; // A4 width in px (approx)
                    container.style.padding = '20px';
                    container.style.background = 'white';
                    container.style.color = 'black';
                    container.style.position = 'absolute';
                    container.style.left = '-9999px';
                    document.body.appendChild(container);

                    // Initialize hwp.js and display
                    const hwpObj = new window.hwp.HWP(arrayBuffer);
                    await window.hwp.display(hwpObj, container);

                    // Convert rendered HTML to PDF
                    const canvas = await html2canvas(container, {
                        scale: 2, // better quality
                        useCORS: true
                    });

                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

                    const pdfOutput = pdf.output('blob');

                    // Cleanup
                    document.body.removeChild(container);

                    resolve(pdfOutput);
                } catch (error) {
                    console.error("Error during HWP extraction/PDF generation:", error);
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    async function processDocxToPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const arrayBuffer = e.target.result;

                    // Convert DOCX to HTML using Mammoth
                    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                    const html = result.value;

                    // Container for rendering
                    const container = document.createElement('div');
                    container.style.width = '794px';
                    container.style.padding = '40px';
                    container.style.background = 'white';
                    container.style.color = 'black';
                    container.style.position = 'absolute';
                    container.style.left = '-9999px';
                    container.style.fontFamily = "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
                    container.innerHTML = html;
                    document.body.appendChild(container);

                    // Generate PDF via canvas
                    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    const pdfOutput = pdf.output('blob');

                    document.body.removeChild(container);
                    resolve(pdfOutput);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    async function processTxtToPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const text = e.target.result;

                    // Container for rendering TXT
                    const container = document.createElement('div');
                    container.style.width = '794px';
                    container.style.padding = '40px';
                    container.style.background = 'white';
                    container.style.color = 'black';
                    container.style.position = 'absolute';
                    container.style.left = '-9999px';
                    container.style.fontFamily = "monospace";
                    container.style.whiteSpace = "pre-wrap"; // Preserve formatting
                    container.style.wordWrap = "break-word";
                    container.innerText = text;
                    document.body.appendChild(container);

                    // Generate PDF via canvas
                    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    const pdfOutput = pdf.output('blob');

                    document.body.removeChild(container);
                    resolve(pdfOutput);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, 'utf-8'); // read as text
        });
    }

    // --- 상호 문서 변환 로직 시작 ---

    async function processHwpToTxt(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const arrayBuffer = e.target.result;
                    // 문서 추출용 컨테이너 생성 및 파싱 (보이지 않게)
                    const tempDoc = document.createElement('div');
                    const hwpObj = new window.hwp.HWP(arrayBuffer);
                    await window.hwp.display(hwpObj, tempDoc);

                    const extractedText = tempDoc.innerText;
                    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
                    resolve(blob);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    async function processDocxToTxt(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const arrayBuffer = e.target.result;
                    // Use mammoth.extractRawText for getting pure text from docx
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    const extractedText = result.value;
                    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
                    resolve(blob);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    async function processTxtToDocx(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n');

                    // Create docx Paragraphs from lines
                    const docxLib = typeof docx !== 'undefined' ? docx : window.docx;
                    const paragraphs = lines.map(line => {
                        return new docxLib.Paragraph({
                            children: [new docxLib.TextRun(line)]
                        });
                    });

                    const doc = new docxLib.Document({
                        sections: [{
                            properties: {},
                            children: paragraphs
                        }]
                    });

                    const blob = await docxLib.Packer.toBlob(doc);
                    resolve(blob);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, 'utf-8');
        });
    }

    // --- 상호 문서 변환 로직 끝 ---

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

    function renderFileResult(res) {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <div style="font-size: 2.5rem; width: 60px; text-align: center;">📑</div>
            <div class="file-info">
                <div class="file-name">${res.name}</div>
                <span style="color:var(--success-color)">변환 성공</span>
            </div>
            <div class="size-compare">
                <div class="size-old">${formatBytes(res.originalSize)}</div>
                <div class="size-new">${formatBytes(res.newSize)}</div>
            </div>
            <div class="result-actions">
                <button class="action-btn" onclick="window.open('${res.url}', '_blank')">미리보기</button>
                <a href="${res.url}" download="${res.name}" class="action-btn download-btn" style="text-decoration:none; background:var(--primary-color); color:white;">다운로드</a>
            </div>
        `;
        fileResultList.appendChild(item);
    }

    function getOutputFilename(originalName, mimeType) {
        const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        let ext = 'bin';
        if (mimeType === 'image/webp') ext = 'webp';
        else if (mimeType === 'image/jpeg') ext = 'jpg';
        else if (mimeType === 'image/png') ext = 'png';
        else if (mimeType === 'application/pdf') ext = 'pdf';
        else if (mimeType === 'text/plain') ext = 'txt';
        else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx';
        else ext = mimeType.split('/')[1].replace('jpeg', 'jpg').replace('image/', '');
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
