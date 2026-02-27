// DOM Elements
const cookieInput = document.getElementById('cookie-input');
const loadFileBtn = document.getElementById('load-file-btn');
const pasteBtn = document.getElementById('paste-btn');
const clearBtn = document.getElementById('clear-btn');
const generateBtn = document.getElementById('generate-btn');
const progress = document.getElementById('progress');
const status = document.getElementById('status');
const results = document.getElementById('results');
const copyResultsBtn = document.getElementById('copy-results-btn');
const modeOptions = document.querySelectorAll('.mode-option');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const batchFiles = document.getElementById('batch-files');
const fileList = document.getElementById('file-list');
const processBatchBtn = document.getElementById('process-batch-btn');
const batchProgress = document.getElementById('batch-progress');
const batchStatus = document.getElementById('batch-status');
const batchResults = document.getElementById('batch-results');
const saveResultsBtn = document.getElementById('save-results-btn');
const totalFiles = document.getElementById('total-files');
const validFiles = document.getElementById('valid-files');
const invalidFiles = document.getElementById('invalid-files');
const notification = document.getElementById('notification');

// Telegram Elements
const telegramToggle = document.getElementById('telegram-toggle');
const telegramConfig = document.getElementById('telegram-config');
const botTokenInput = document.getElementById('bot-token');
const chatIdInput = document.getElementById('chat-id');
const testTelegramBtn = document.getElementById('test-telegram-btn');
const telegramStatus = document.getElementById('telegram-status');

// Global variables
let currentMode = 'fullinfo';
let selectedFiles = [];
let batchResultsData = [];

// Event Listeners — gắn sau khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initApp();

    loadFileBtn.addEventListener('click', handleLoadFile);
    pasteBtn.addEventListener('click', handlePaste);
    clearBtn.addEventListener('click', handleClear);
    generateBtn.addEventListener('click', handleGenerate);
    copyResultsBtn.addEventListener('click', handleCopyResults);

    // Delegation cho mode-option: hoạt động dù tab ẩn hay hiện
    document.addEventListener('click', e => {
        const opt = e.target.closest('.mode-option');
        if (opt) handleModeChange(opt);
    });

    tabs.forEach(tab => tab.addEventListener('click', handleTabChange));
    batchFiles.addEventListener('change', handleBatchFilesChange);
    processBatchBtn.addEventListener('click', handleProcessBatch);
    saveResultsBtn.addEventListener('click', handleSaveResults);

    // ── Xóa dữ liệu đã lưu ──
    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (!confirm('Xóa toàn bộ cookie và kết quả đã lưu?')) return;
            localStorage.removeItem('cookieInput');
            localStorage.removeItem('lastResult');   // key đúng
            if (cookieInput) cookieInput.value = '';
            // Reset kết quả
            const resultsEl = document.getElementById('results');
            if (resultsEl) resultsEl.innerHTML = '<div class="result-item"><div class="result-title"><i class="fas fa-circle-info"></i> Chưa có kết quả</div><div class="result-content">Xử lý cookie để xem kết quả tại đây.</div></div>';
            const copyBtn = document.getElementById('copy-results-btn');
            if (copyBtn) copyBtn.disabled = true;
            // Dừng tất cả countdown
            clearInterval(window._countdownTimer);
            clearInterval(window._statusCountdown);
            window._countdownTimer = null;
            window._statusCountdown = null;
            if (status) status.textContent = 'Sẵn sàng';
            // Ẩn TV widget
            const tvWidget = document.querySelector('.tv-widget');
            if (tvWidget) tvWidget.style.display = 'none';
            showNotification('Đã xóa dữ liệu cũ');
        });
    }

    // ── TV Activation Boxes ──
    const tvBoxes = Array.from(document.querySelectorAll('.tv-box'));
    const tvBtn = document.getElementById('tv-activate-btn');

    tvBoxes.forEach((box, i) => {
        box.addEventListener('input', () => {
            const v = box.value.replace(/\D/g, '');
            box.value = v ? v.slice(-1) : '';
            box.classList.toggle('filled', !!box.value);
            if (box.value && i < tvBoxes.length - 1) tvBoxes[i + 1].focus();
            // Caret luôn cuối
            box.setSelectionRange(box.value.length, box.value.length);
        });
        // Di caret về cuối khi focus/click vào ô đã có số
        box.addEventListener('focus', () => {
            setTimeout(() => box.setSelectionRange(box.value.length, box.value.length), 0);
        });
        box.addEventListener('click', () => {
            box.setSelectionRange(box.value.length, box.value.length);
        });
        box.addEventListener('keydown', e => {
            // Chỉ cho phép: số 0-9, Backspace, Tab, mũi tên, Delete, Ctrl/Cmd shortcuts
            const allowed = /^[0-9]$/.test(e.key) ||
                ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
                e.ctrlKey || e.metaKey;
            if (!allowed) { e.preventDefault(); return; }

            if (e.key === 'Backspace') {
                if (box.value) {
                    // Xóa số trong ô hiện tại
                    box.value = '';
                    box.classList.remove('filled');
                    e.preventDefault();
                } else if (i > 0) {
                    // Ô trống → lùi về ô trước và xóa
                    tvBoxes[i - 1].value = '';
                    tvBoxes[i - 1].classList.remove('filled');
                    tvBoxes[i - 1].focus();
                }
            }
        });
        box.addEventListener('paste', e => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData)
                .getData('text').replace(/\D/g, '').slice(0, 8);
            tvBoxes.forEach((b, j) => {
                b.value = text[j] || '';
                b.classList.toggle('filled', !!b.value);
            });
            const last = Math.min(text.length, tvBoxes.length) - 1;
            if (last >= 0) tvBoxes[last].focus();
        });
    });

    if (tvBtn) {
        tvBtn.addEventListener('click', () => {
            const code = tvBoxes.map(b => b.value).join('');
            if (code.length < 8) { showNotification('Vui lòng nhập đủ 8 số mã TV', true); return; }
            navigator.clipboard.writeText(code).catch(() => { });
            showNotification(`Đã copy mã ${code.slice(0, 4)}-${code.slice(4)} → Ctrl+V để dán vào Netflix`);
            setTimeout(() => window.open('https://www.netflix.com/tv2', '_blank', 'noopener,noreferrer'), 600);
        });
    }
});

// Initialize the application
function initApp() {
    updateFileList();
    initTelegram();
    handleResponsive();

    // Khôi phục cookie đã nhập trước đó
    const saved = localStorage.getItem('cookieInput');
    if (saved) {
        cookieInput.value = saved;
    }

    // Tự động lưu khi người dùng nhập
    cookieInput.addEventListener('input', () => {
        localStorage.setItem('cookieInput', cookieInput.value);
    });

    // Khôi phục kết quả cũ nếu token vẫn còn hạn
    const lastResult = localStorage.getItem('lastResult');
    if (lastResult) {
        try {
            const data = JSON.parse(lastResult);
            const token = data?.token_result;
            const now = Math.floor(Date.now() / 1000);
            if (token?.expires && token.expires > now) {
                // Token vẫn hợp lệ — hiện lại kết quả
                displayResults(data);
                copyResultsBtn.disabled = false;
                const remaining = token.expires - now;
                const h = Math.floor(remaining / 3600);
                const m = Math.floor((remaining % 3600) / 60);
                status.textContent = `Kết quả cũ — token còn ${h}h ${m}m`;
                // Countdown live cho status
                if (window._statusCountdown) clearInterval(window._statusCountdown);
                const statusExpires = token.expires;
                const updateStatus = () => {
                    const rem2 = statusExpires - Math.floor(Date.now() / 1000);
                    if (rem2 <= 0) { status.textContent = 'Token đã hết hạn'; clearInterval(window._statusCountdown); return; }
                    const hh = Math.floor(rem2 / 3600);
                    const mm = Math.floor((rem2 % 3600) / 60);
                    const ss = rem2 % 60;
                    status.textContent = `Kết quả cũ — còn ${hh}h ${mm}m ${String(ss).padStart(2, '0')}s`;
                };
                updateStatus();
                window._statusCountdown = setInterval(updateStatus, 1000);
            } else {
                // Token hết hạn — xóa cache
                localStorage.removeItem('lastResult');
            }
        } catch (e) {
            localStorage.removeItem('lastResult');
        }
    }

    // Drag & drop cho drop zone
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', e => {
            if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const dt = e.dataTransfer;
            if (dt.files.length) {
                // Gán file vào input ẩn và trigger change
                const input = document.getElementById('batch-files');
                const files = Array.from(dt.files).filter(f =>
                    f.name.endsWith('.txt') || f.name.endsWith('.json') || f.name.endsWith('.zip'));
                if (files.length) {
                    // Tạo DataTransfer mới để gán vào input
                    const transfer = new DataTransfer();
                    files.forEach(f => transfer.items.add(f));
                    input.files = transfer.files;
                    input.dispatchEvent(new Event('change'));
                } else {
                    showNotification('Chỉ hỗ trợ .txt, .json, .zip', true);
                }
            }
        });
    }

    // Add resize listener
    window.addEventListener('resize', handleResponsive);
}

// Handle responsive behavior
function handleResponsive() {
    const width = window.innerWidth;

    if (width < 768) {
        // Mobile optimizations
        document.body.classList.add('mobile');

        // Adjust card padding for mobile
        document.querySelectorAll('.card').forEach(card => {
            card.style.padding = '15px';
        });

    } else {
        document.body.classList.remove('mobile');

        // Reset card padding for desktop
        document.querySelectorAll('.card').forEach(card => {
            card.style.padding = '25px';
        });
    }
}

// Handle mode change (Full Info / Token Only)
function handleModeChange(el) {
    const mode = el.dataset.mode;
    if (!mode) return;
    currentMode = mode;

    // Chỉ update các mode-option trong cùng container với el đã click
    const container = el.closest('.mode-toggle');
    if (container) {
        container.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('active'));
        el.classList.add('active');
    }
}

// Handle tab change
function handleTabChange(e) {
    const tabEl = e.target.closest('[data-tab]');
    if (!tabEl) return;
    const tabId = tabEl.dataset.tab;

    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    tabEl.classList.add('active');
    const target = document.getElementById(`${tabId}-tab`);
    if (target) target.classList.add('active');
}

// Handle load file
function handleLoadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,.zip';

    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            cookieInput.value = e.target.result;
            showNotification('Tải file thành công');
        };
        reader.readAsText(file);
    };

    input.click();
}

// Handle paste from clipboard
function handlePaste() {
    if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText()
            .then(text => {
                cookieInput.value = text;
                localStorage.setItem('cookieInput', text);
                cookieInput.blur(); // tắt bàn phím mobile
                showNotification('Đã dán từ clipboard');
            })
            .catch(() => fallbackPaste());
    } else {
        fallbackPaste();
    }
}

function fallbackPaste() {
    cookieInput.focus();
    const ok = document.execCommand('paste');
    cookieInput.blur(); // tắt bàn phím sau khi paste
    if (!ok) {
        showNotification('Hãy nhấn giữ vào ô nhập và chọn "Dán"', false);
    }
}

// Handle clear input
function handleClear() {
    cookieInput.value = '';
    localStorage.removeItem('cookieInput');
    showNotification('Đã xóa nội dung');
}

// Handle generate token
async function handleGenerate() {
    const content = cookieInput.value.trim();
    if (!content) {
        showNotification('Vui lòng nhập nội dung trước', true);
        return;
    }

    // Disable button and show progress
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="spinner"></div> Đang xử lý...';
    progress.style.width = '0%';
    status.textContent = 'Đang trích xuất NetflixId...';

    try {
        const response = await fetch('/api/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: content,
                mode: currentMode
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            progress.style.width = '100%';
            status.textContent = 'Hoàn tất';
            displayResults(data);
            // Lưu kết quả vào localStorage
            localStorage.setItem('lastResult', JSON.stringify(data));
            copyResultsBtn.disabled = false;
            showNotification('Tạo token thành công');
        } else {
            progress.style.width = '100%';
            status.textContent = 'Xử lý thất bại';
            displayError(data.message);
            showNotification(data.message, true);
        }
    } catch (error) {
        progress.style.width = '100%';
        status.textContent = 'Xử lý thất bại';
        displayError('Lỗi mạng: ' + error.message);
        showNotification('Lỗi mạng: ' + error.message, true);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-key"></i> Tạo Token';
    }
}

// Handle copy results
function handleCopyResults() {
    const resultsText = results.innerText;
    navigator.clipboard.writeText(resultsText)
        .then(() => {
            showNotification('Đã sao chép kết quả');
        })
        .catch(err => {
            showNotification('Sao chép thất bại', true);
        });
}

// Handle batch files change
function handleBatchFilesChange(e) {
    selectedFiles = Array.from(e.target.files);
    updateFileList();
}

// Update file list display
function updateFileList() {
    fileList.innerHTML = '';

    if (selectedFiles.length === 0) {
        fileList.innerHTML = '<div class="file-item"><span>Chưa chọn file nào</span></div>';
        return;
    }

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>${file.name}</span>
            <span class="file-status">Chờ xử lý</span>
        `;
        fileList.appendChild(fileItem);
    });

    totalFiles.textContent = selectedFiles.length;
    validFiles.textContent = '0';
    invalidFiles.textContent = '0';
}

// Update file list to show processing status
function updateFileListProcessing() {
    fileList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>${file.name}</span>
            <span class="file-status processing">Đang xử lý...</span>
        `;
        fileList.appendChild(fileItem);
    });
}

// Handle process batch
async function handleProcessBatch() {
    if (selectedFiles.length === 0) {
        showNotification('Vui lòng chọn file trước', true);
        return;
    }

    // Reset results
    batchResultsData = [];
    batchResults.innerHTML = '';
    saveResultsBtn.disabled = true;

    // Disable button and show progress
    processBatchBtn.disabled = true;
    processBatchBtn.innerHTML = '<div class="spinner"></div> Đang xử lý...';
    batchProgress.style.width = '0%';
    batchStatus.textContent = 'Đang xử lý hàng loạt...';

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    formData.append('mode', currentMode);

    try {
        // Update file list status to processing
        updateFileListProcessing();

        const response = await fetch('/api/batch-check', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.status === 'success') {
            batchResultsData = data.results;
            displayBatchResults(batchResultsData);
            batchProgress.style.width = '100%';
            batchStatus.textContent = 'Xử lý hàng loạt hoàn tất';
            saveResultsBtn.disabled = false;
            showNotification(`Hoàn tất: ${batchResultsData.filter(r => r.status === 'success').length} hợp lệ, ${batchResultsData.filter(r => r.status === 'error').length} không hợp lệ`);
        } else {
            batchProgress.style.width = '100%';
            batchStatus.textContent = 'Xử lý hàng loạt thất bại';
            showNotification(data.message, true);
        }
    } catch (error) {
        batchProgress.style.width = '100%';
        batchStatus.textContent = 'Xử lý hàng loạt thất bại';
        showNotification('Lỗi mạng: ' + error.message, true);
    } finally {
        processBatchBtn.disabled = false;
        processBatchBtn.innerHTML = '<i class="fas fa-bolt"></i> Xử Lý Hàng Loạt';
    }
}

// Display batch results in detailed single line format
function displayBatchResults(results) {
    batchResults.innerHTML = '';

    let validCount = 0;
    let invalidCount = 0;

    results.forEach(result => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item single-line-result';

        if (result.status === 'success') {
            const account = result.account_info;
            const token = result.token_result;

            let statusText = `✅ ${result.filename} | `;
            statusText += `Trạng thái: ${account.ok ? 'Hợp lệ' : 'Không hợp lệ'} | `;
            statusText += `Premium: ${account.premium ? 'Có' : 'Không'} | `;
            statusText += `Quốc gia: ${account.country} | `;
            statusText += `Gói: ${account.plan} | `;
            statusText += `Giá: ${account.plan_price} | `;
            statusText += `Tạm giữ TT: ${account.on_payment_hold} | `;
            statusText += `Luồng tối đa: ${account.max_streams}`;

            if (token.status === 'Success') {
                statusText += ` | Token: ${token.token.substring(0, 15)}...`;
            }

            fileItem.innerHTML = `
                <div class="file-info">
                    <span>${statusText}</span>
                </div>
                <span class="file-status valid">Hợp lệ</span>
            `;
            validCount++;
        } else {
            fileItem.innerHTML = `
                <div class="file-info">
                    <span>❌ ${result.filename}: ${result.message}</span>
                </div>
                <span class="file-status invalid">Không hợp lệ</span>
            `;
            invalidCount++;
        }

        batchResults.appendChild(fileItem);
    });

    validFiles.textContent = validCount;
    invalidFiles.textContent = invalidCount;

    // Update success rate
    const successRate = ((validCount / results.length) * 100).toFixed(2);
    batchStatus.textContent = `Hoàn tất - Tỉ lệ thành công: ${successRate}%`;
}

// Handle save results
function handleSaveResults() {
    if (batchResultsData.length === 0) {
        showNotification('Không có kết quả để lưu', true);
        return;
    }

    let content = 'Kiểm Tra Cookie Netflix - Kết Quả Hàng Loạt\n';
    content += 'Tạo lúc: ' + new Date().toLocaleString() + '\n';
    content += 'Tạo bởi: Huy Vũ - https://beacons.ai/huyvu2512\n\n';
    content += '='.repeat(80) + '\n\n';

    let validCount = 0;
    let invalidCount = 0;

    batchResultsData.forEach(result => {
        if (result.status === 'success') {
            validCount++;
            const account = result.account_info;
            const token = result.token_result;

            content += `✅ ${result.filename}\n`;
            content += `NetflixId: ${result.netflix_id}\n`;
            content += `Trạng thái: ${account.ok ? 'Hợp lệ' : 'Không hợp lệ'}\n`;
            content += `Premium: ${account.premium ? 'Có' : 'Không'}\n`;
            content += `Quốc gia: ${account.country}\n`;
            content += `Gói cước: ${account.plan}\n`;
            content += `Giá: ${account.plan_price}\n`;
            content += `Thành viên từ: ${account.member_since}\n`;
            content += `Thanh toán qua: ${account.payment_method}\n`;
            content += `Điện thoại: ${account.phone}\n`;
            content += `ĐT đã xác minh: ${account.phone_verified}\n`;
            content += `Chất lượng video: ${account.video_quality}\n`;
            content += `Luồng tối đa: ${account.max_streams}\n`;
            content += `Tạm giữ TT: ${account.on_payment_hold}\n`;
            content += `Thành viên thêm: ${account.extra_member}\n`;
            content += `Email: ${account.email}\n`;
            content += `Email đã xác minh: ${account.email_verified}\n`;
            content += `Hồ sơ: ${account.profiles}\n`;
            content += `Ngày thanh toán tiếp: ${account.next_billing}\n`;

            if (token.status === 'Success') {
                content += `Token: ${token.token}\n`;
                content += `URL đăng nhập: ${token.direct_login_url}\n`;
                content += `Token hết hạn: ${new Date(token.expires * 1000).toLocaleString()}\n`;
                content += `Còn lại: ${Math.floor(token.time_remaining / 86400)}d ${Math.floor((token.time_remaining % 86400) / 3600)}h ${Math.floor((token.time_remaining % 3600) / 60)}m\n`;
            } else {
                content += `Lỗi token: ${token.error}\n`;
            }

            content += '\n' + '─'.repeat(80) + '\n\n';
        } else {
            invalidCount++;
            content += `❌ ${result.filename}: ${result.message}\n\n`;
            content += '─'.repeat(80) + '\n\n';
        }
    });

    content += `\nTHỐNG KÊ\n`;
    content += `Tổng file: ${batchResultsData.length}\n`;
    content += `Hợp lệ: ${validCount}\n`;
    content += `Không hợp lệ: ${invalidCount}\n`;
    content += `Tỉ lệ thành công: ${((validCount / batchResultsData.length) * 100).toFixed(2)}%\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netflix_batch_results_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Đã lưu kết quả thành công');
}

// Enhanced displayResults function with dropdown and scroll
function displayResults(data) {
    let html = '';

    if (currentMode === 'fullinfo') {
        const account = data.account_info;

        html = `
            <div class="result-item">
                <div class="result-title">
                    <i class="fas fa-user-circle"></i>
                    TỔNG QUAN TÀI KHOẢN
                    ${data.telegram_sent ? '<span class="telegram-hit-indicator"><i class="fab fa-telegram"></i> Telegram</span>' : ''}
                </div>
                <div class="result-content">
                    <div class="quick-stats">
                        <div class="stat-badge ${account.ok ? 'valid' : 'invalid'}">${account.ok ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'}</div>
                        <div class="stat-badge ${account.premium ? 'premium' : 'basic'}">${account.premium ? 'PREMIUM' : 'CƠ BẢN'}</div>
                        <div class="stat-badge country">${account.country}</div>
                    </div>
                    
                    <button class="dropdown-toggle" onclick="toggleResults(this)">
                        <i class="fas fa-chevron-down"></i>
                        Xem Chi Tiết Tài Khoản
                    </button>
                    <div class="dropdown-content" style="display: none;">
                        <div class="section-header">
                            <i class="fas fa-id-card"></i>
                            THÔNG TIN TÀI KHOẢN
                        </div>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Trạng thái:</span>
                                <span class="info-value ${account.ok ? 'status-valid' : 'status-invalid'}">${account.ok ? 'Hợp lệ' : 'Không hợp lệ'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Premium:</span>
                                <span class="info-value ${account.premium ? 'status-premium' : ''}">${account.premium ? 'Có' : 'Không'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Quốc gia:</span>
                                <span class="info-value">${account.country}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Gói cước:</span>
                                <span class="info-value">${account.plan}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Giá:</span>
                                <span class="info-value">${account.plan_price}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Thành viên từ:</span>
                                <span class="info-value">${account.member_since}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Thanh toán qua:</span>
                                <span class="info-value">${account.payment_method}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Điện thoại:</span>
                                <span class="info-value">${account.phone}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">ĐT đã xác minh:</span>
                                <span class="info-value">${account.phone_verified}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Chất lượng video:</span>
                                <span class="info-value">${account.video_quality}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Luồng tối đa:</span>
                                <span class="info-value">${account.max_streams}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Tạm giữ thanh toán:</span>
                                <span class="info-value">${account.on_payment_hold}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Thành viên thêm:</span>
                                <span class="info-value">${account.extra_member}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Email:</span>
                                <span class="info-value">${account.email.replace(/\\x40/g, '@')}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Email đã xác minh:</span>
                                <span class="info-value">${account.email_verified}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Hồ sơ:</span>
                                <span class="info-value">${account.profiles}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    const token = data.token_result;
    if (token.status === 'Success') {
        const genTime = new Date(token.generation_time * 1000).toLocaleString();
        const expTime = new Date(token.expires * 1000).toLocaleString();

        const days = Math.floor(token.time_remaining / 86400);
        const hours = Math.floor((token.time_remaining % 86400) / 3600);
        const minutes = Math.floor((token.time_remaining % 3600) / 60);
        const seconds = token.time_remaining % 60;

        html += `
            <div class="result-item">
                <div class="result-title">
                    <i class="fas fa-key"></i>
                    THÔNG TIN TOKEN
                    <span id="token-countdown" style="margin-left:auto; font-size:0.82rem; font-weight:700; font-family:'Courier New',monospace; color:#e6a817; background:#1c1408; border:1px solid #6b3d00; padding:4px 12px; border-radius:6px; letter-spacing:0.05em;">--:--:--</span>
                </div>
                <div class="result-content">
                    <div class="token-info">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Trạng thái:</span>
                                <span class="info-value status-valid">${token.status}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Thời điểm tạo:</span>
                                <span class="info-value">${genTime}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Hết hạn:</span>
                                <span class="info-value">${expTime}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Còn lại:</span>
                                <span class="info-value" id="remaining-countdown">${days}d ${hours}h ${minutes}m ${seconds}s</span>
                            </div>
                        </div>
                        
                        <div style="margin-top: 15px;">
                            <div class="info-label" style="margin-bottom: 8px;">URL Đăng Nhập Điện Thoại:</div>
                            <div class="token-url">${token.direct_login_url}</div>
                            <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                                <button class="copy-btn" data-text="${token.direct_login_url}">
                                    <i class="fas fa-mobile-alt"></i> Sao chép
                                </button>
                                <a href="${token.direct_login_url}" target="_blank" rel="noopener noreferrer" class="copy-btn" style="text-decoration:none; background:rgba(34,197,94,0.12); border-color:rgba(34,197,94,0.4); color:#22c55e;">
                                    <i class="fas fa-sign-in-alt"></i> Đăng Nhập ĐT
                                </a>
                            </div>
                        </div>

                        <div style="margin-top: 15px;">
                            <div class="info-label" style="margin-bottom: 8px;">URL Đăng Nhập Máy Tính:</div>
                            <div class="token-url">https://www.netflix.com/account?nftoken=${encodeURIComponent(token.token)}</div>
                            <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                                <button class="copy-btn" data-text="https://www.netflix.com/account?nftoken=${encodeURIComponent(token.token)}">
                                    <i class="fas fa-desktop"></i> Sao chép
                                </button>
                                <a href="https://www.netflix.com/account?nftoken=${encodeURIComponent(token.token)}" target="_blank" rel="noopener noreferrer" class="copy-btn" style="text-decoration:none; background:rgba(34,197,94,0.12); border-color:rgba(34,197,94,0.4); color:#22c55e;">
                                    <i class="fas fa-sign-in-alt"></i> Đăng Nhập MT
                                </a>
                            </div>
                        </div>
                        
                        <div style="margin-top: 15px;">
                            <div class="info-label" style="margin-bottom: 8px;">Token:</div>
                            <div class="token-url">${token.token}</div>
                            <button class="copy-btn" data-text="${token.token}">
                                <i class="fas fa-copy"></i> Sao chép Token
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="result-item">
                <div class="result-title">
                    <i class="fas fa-times-circle" style="color: var(--danger);"></i>
                    TẠO TOKEN THẤT BẠI
                </div>
                <div class="result-content">
                    <div class="info-item">
                        <span class="info-label">Lỗi:</span>
                        <span class="info-value">${token.error}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Update the results container
    results.innerHTML = html;

    // Hiện TV widget khi token thành công
    const tvWidget = document.querySelector('.tv-widget');
    if (tvWidget) tvWidget.style.display = data.token_result?.status === 'Success' ? 'block' : 'none';

    // Khởi động đồng hồ đếm ngược token
    if (data.token_result && data.token_result.status === 'Success') {
        const expiresAt = data.token_result.expires; // unix timestamp
        if (window._countdownTimer) clearInterval(window._countdownTimer);

        const countdownEl = document.getElementById('token-countdown');
        const tick = () => {
            if (!countdownEl) { clearInterval(window._countdownTimer); return; }
            const remaining = expiresAt - Math.floor(Date.now() / 1000);
            if (remaining <= 0) {
                countdownEl.textContent = 'Đã hết hạn';
                countdownEl.style.color = '#ef4444';
                countdownEl.style.background = 'rgba(239,68,68,0.1)';
                countdownEl.style.borderColor = 'rgba(239,68,68,0.3)';
                const remEl = document.getElementById('remaining-countdown');
                if (remEl) remEl.textContent = 'Hết hạn';
                clearInterval(window._countdownTimer);
                return;
            }
            const d = Math.floor(remaining / 86400);
            const h = Math.floor((remaining % 86400) / 3600);
            const m = Math.floor((remaining % 3600) / 60);
            const s = remaining % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            countdownEl.textContent = d > 0 ? `${d}d ${timeStr}` : timeStr;
            // Cập nhật ô Còn lại:
            const remEl = document.getElementById('remaining-countdown');
            if (remEl) remEl.textContent = d > 0 ? `${d}d ${timeStr}` : timeStr;
        };
        tick(); // chạy ngay lập tức
        window._countdownTimer = setInterval(tick, 1000);
    }

    // Enable copy buttons
    copyResultsBtn.disabled = false;

    // Add event listeners to copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const text = this.dataset.text;
            navigator.clipboard.writeText(text)
                .then(() => {
                    showNotification('Đã sao chép');
                })
                .catch(err => {
                    showNotification('Sao chép thất bại', true);
                });
        });
    });
}

// Display error
function displayError(message) {
    results.innerHTML = `
        <div class="result-item">
            <div class="result-title">
                <i class="fas fa-times-circle" style="color: var(--danger);"></i>
                Error
            </div>
            <div class="result-content">
                ${message}
            </div>
        </div>
    `;
    copyResultsBtn.disabled = false;
}

// Show notification — đã tắt
function showNotification(message, isError = false) { /* disabled */ }

// Toggle dropdown for results
function toggleResults(button) {
    const dropdownContent = button.nextElementSibling;
    const isVisible = dropdownContent.style.display === 'block';

    if (isVisible) {
        dropdownContent.style.display = 'none';
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-chevron-down"></i> Xem Chi Tiết Tài Khoản';
    } else {
        dropdownContent.style.display = 'block';
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-chevron-up"></i> Ẩn Chi Tiết Tài Khoản';
    }
}

// Close all dropdowns when clicking outside
document.addEventListener('click', function (event) {
    if (!event.target.closest('.dropdown-toggle')) {
        document.querySelectorAll('.dropdown-content').forEach(content => {
            content.style.display = 'none';
        });
        document.querySelectorAll('.dropdown-toggle').forEach(button => {
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-chevron-down"></i> Xem Chi Tiết Tài Khoản';
        });
    }
});

// Telegram Hit Sender functionality

// Load saved Telegram config
function loadTelegramConfig() {
    const savedConfig = localStorage.getItem('telegramConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        telegramToggle.checked = config.enabled || false;
        botTokenInput.value = config.bot_token || '';
        chatIdInput.value = config.chat_id || '';
        updateTelegramUI();
    }
}

// Update Telegram UI based on toggle state
function updateTelegramUI() {
    if (telegramToggle.checked) {
        telegramConfig.style.display = 'block';
        telegramStatus.className = 'telegram-status enabled';
        telegramStatus.innerHTML = '<i class="fas fa-check-circle"></i> Gửi Telegram đang bật';
    } else {
        telegramConfig.style.display = 'none';
        telegramStatus.className = 'telegram-status disabled';
        telegramStatus.innerHTML = '<i class="fas fa-times-circle"></i> Gửi Telegram đang tắt';
    }
}

// Save Telegram config
function saveTelegramConfig() {
    const config = {
        enabled: telegramToggle.checked,
        bot_token: botTokenInput.value,
        chat_id: chatIdInput.value
    };
    localStorage.setItem('telegramConfig', JSON.stringify(config));

    // Send to server
    fetch('/api/telegram-config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Đã lưu cấu hình Telegram');
            } else {
                showNotification('Lỗi khi lưu cấu hình Telegram', true);
            }
        })
        .catch(error => {
            showNotification('Lỗi khi lưu cấu hình Telegram', true);
        });
}

// Test Telegram connection
function testTelegramConnection() {
    if (!botTokenInput.value || !chatIdInput.value) {
        showNotification('Vui lòng nhập Bot Token và Chat ID', true);
        return;
    }

    testTelegramBtn.disabled = true;
    testTelegramBtn.innerHTML = '<div class="spinner"></div> Đang kiểm tra...';
    telegramStatus.className = 'telegram-status testing';
    telegramStatus.innerHTML = '<i class="fas fa-sync-alt"></i> Đang kiểm tra kết nối Telegram...';

    // Simple test by sending a test message
    const testMessage = {
        chat_id: chatIdInput.value,
        text: '✅ Kiểm Tra Cookie Netflix\n\nĐây là tin nhắn thử từ Kiểm Tra Cookie Netflix. Nếu bạn nhận được tin này, cấu hình Telegram đã hoạt động!',
        parse_mode: 'Markdown'
    };

    fetch(`https://api.telegram.org/bot${botTokenInput.value}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(testMessage)
    })
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                telegramStatus.className = 'telegram-status enabled';
                telegramStatus.innerHTML = '<i class="fas fa-check-circle"></i> Kết nối Telegram thành công!';
                showNotification('Kiểm tra Telegram thành công!');
            } else {
                telegramStatus.className = 'telegram-status disabled';
                telegramStatus.innerHTML = `<i class="fas fa-times-circle"></i> Lỗi Telegram: ${data.description || 'Không xác định'}`;
                showNotification('Kiểm tra Telegram thất bại: ' + (data.description || 'Không xác định'), true);
            }
        })
        .catch(error => {
            telegramStatus.className = 'telegram-status disabled';
            telegramStatus.innerHTML = '<i class="fas fa-times-circle"></i> Kết nối Telegram thất bại';
            showNotification('Kiểm tra Telegram thất bại: Lỗi mạng', true);
        })
        .finally(() => {
            testTelegramBtn.disabled = false;
            testTelegramBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kiểm Tra Kết Nối';
        });
}

// Initialize Telegram functionality
function initTelegram() {
    loadTelegramConfig();

    telegramToggle.addEventListener('change', function () {
        updateTelegramUI();
        saveTelegramConfig();
    });

    botTokenInput.addEventListener('input', saveTelegramConfig);
    chatIdInput.addEventListener('input', saveTelegramConfig);
    testTelegramBtn.addEventListener('click', testTelegramConnection);

    updateTelegramUI();
}