// DOM Elements
const cookieInput = document.getElementById('cookie-input');
const loadFileBtn = document.getElementById('load-file-btn');
const pasteBtn = document.getElementById('paste-btn');
const clearBtn = document.getElementById('clear-btn');
const generateBtn = document.getElementById('generate-btn');
const sendTelegramBtn = document.getElementById('send-telegram-btn');
const progress = document.getElementById('progress');
const status = document.getElementById('status');
const results = document.getElementById('results');
const copyResultsBtn = document.getElementById('copy-results-btn');
const sendResultTelegramBtn = document.getElementById('send-result-telegram-btn');
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

    // Update share/download button label based on device
    if (sendResultTelegramBtn) {
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
        if (isMobileDevice) {
            sendResultTelegramBtn.innerHTML = '<i class="fas fa-share-nodes"></i> Chia Sẻ';
        } else {
            sendResultTelegramBtn.innerHTML = '<i class="fas fa-download"></i> Tải File';
            sendResultTelegramBtn.style.background = 'linear-gradient(135deg,#059669,#047857)';
            sendResultTelegramBtn.style.boxShadow = '0 2px 12px rgba(5,150,105,0.3)';
        }
    }

    loadFileBtn.addEventListener('click', handleLoadFile);
    pasteBtn.addEventListener('click', handlePaste);
    clearBtn.addEventListener('click', handleClear);
    generateBtn.addEventListener('click', handleGenerate);
    if (sendTelegramBtn) sendTelegramBtn.addEventListener('click', handleSendTelegram);
    copyResultsBtn.addEventListener('click', handleCopyResults);
    if (sendResultTelegramBtn) sendResultTelegramBtn.addEventListener('click', handleShareResult);

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

    // Khôi phục kết quả batch cũ nếu có
    try {
        const savedBatch = localStorage.getItem('batchResults');
        if (savedBatch) {
            batchResultsData = JSON.parse(savedBatch);
            if (batchResultsData.length > 0) {
                displayBatchResults(batchResultsData);
                saveResultsBtn.disabled = false;
                const validCount = batchResultsData.filter(r => r.status === 'success').length;
                batchStatus.textContent = `Kết quả cũ — ${validCount} hợp lệ (${batchResultsData.length} tổng)`;
            }
        }
    } catch (e) {
        localStorage.removeItem('batchResults');
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
                if (sendResultTelegramBtn) sendResultTelegramBtn.disabled = false;
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
                const files = Array.from(dt.files).filter(f =>
                    f.name.endsWith('.txt') || f.name.endsWith('.json') || f.name.endsWith('.zip'));
                if (files.length) {
                    // Merge + dedup thay vì replace
                    const existingNames = new Set(selectedFiles.map(f => f.name));
                    const added = files.filter(f => !existingNames.has(f.name));
                    selectedFiles = [...selectedFiles, ...added];
                    updateFileList();
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

async function parseApiResponse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        const cleanMsg = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
        throw new Error(`Máy chủ phản hồi HTTP ${response.status}: ${cleanMsg || response.statusText || 'Lỗi không xác định'}`);
    }
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

        const data = await parseApiResponse(response);

        if (data.status === 'success') {
            progress.style.width = '100%';
            status.textContent = 'Hoàn tất';
            displayResults(data);
            // Lưu kết quả vào localStorage
            localStorage.setItem('lastResult', JSON.stringify(data));
            copyResultsBtn.disabled = false;
            if (sendResultTelegramBtn) sendResultTelegramBtn.disabled = false;
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

// Handle send telegram (generate token + send to Telegram)
async function handleSendTelegram() {
    const content = cookieInput.value.trim();
    if (!content) {
        showNotification('Vui lòng nhập nội dung trước', true);
        return;
    }

    sendTelegramBtn.disabled = true;
    sendTelegramBtn.innerHTML = '<div class="spinner"></div>';
    generateBtn.disabled = true;
    progress.style.width = '0%';
    status.textContent = 'Đang tạo token và gửi Telegram...';

    try {
        const response = await fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: content,
                mode: currentMode,
                send_telegram: true
            })
        });

        const data = await parseApiResponse(response);

        if (data.status === 'success') {
            progress.style.width = '100%';
            status.textContent = 'Đã gửi Telegram!';
            displayResults(data);
            localStorage.setItem('lastResult', JSON.stringify(data));
            copyResultsBtn.disabled = false;
            if (sendResultTelegramBtn) sendResultTelegramBtn.disabled = false;
        } else {
            progress.style.width = '100%';
            status.textContent = 'Xử lý thất bại';
            displayError(data.message);
        }
    } catch (error) {
        progress.style.width = '100%';
        status.textContent = 'Lỗi mạng';
        displayError('Lỗi mạng: ' + error.message);
        showNotification('Lỗi mạng: ' + error.message, true);
    } finally {
        sendTelegramBtn.disabled = false;
        sendTelegramBtn.innerHTML = '<i class="fab fa-telegram"></i> Tele';
        generateBtn.disabled = false;
    }
}

// Detect mobile device
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

// Format billing date: if already dd/MM/yyyy keep it, else parse ISO → dd/MM/yyyy
function formatBillingDate(raw) {
    if (!raw || raw === 'Unknown') return raw || '';
    // Already formatted (dd/MM/yyyy)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    try {
        const clean = raw.replace(/\\x2B|%2B/g, '+').split('.')[0].replace(/[+-]\d{2}:?\d{2}$/, '');
        const dt = new Date(clean);
        if (!isNaN(dt)) {
            return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        // Fallback: grab date part before T
        const d = raw.split('T')[0];
        const [y, m, dd] = d.split('-');
        return `${dd}/${m}/${y}`;
    } catch (e) { return raw; }
}


async function handleShareResult() {
    try {
        const saved = localStorage.getItem('lastResult');
        if (!saved) return;
        const data = JSON.parse(saved);
        const account = data.account_info || {};
        const token = data.token_result || {};

        const email = (account.email || 'unknown').replace(/\\x40/g, '@');
        const country = (account.country || 'XX').replace(/\s+/g, '');
        const plan = account.premium ? 'Premium' : 'Basic';
        const fileName = `${email.split('@')[0]}_${country}_${plan}.txt`;

        const lines = [];
        lines.push('🎬 TỔNG QUAN TÀI KHOẢN');
        lines.push('━'.repeat(26));
        lines.push('');
        lines.push('📋 THÔNG TIN CƠ BẢN');
        lines.push('Trạng thái:     ' + (account.ok ? '✅ Hợp lệ' : '❌ Không hợp lệ'));
        lines.push('Premium:        ' + (account.premium ? '👑 Có' : '❌ Không'));
        lines.push('Quốc gia:       ' + (account.country || ''));
        lines.push('');
        lines.push('💳 CHI TIẾT GÓI');
        lines.push('Gói:            ' + (account.plan || ''));
        lines.push('Giá:            ' + (account.plan_price || ''));
        lines.push('Thành viên từ:  ' + (account.member_since || ''));
        lines.push('Phương thức TT: ' + (account.payment_method || ''));
        lines.push('Ngày gia hạn:   ' + formatBillingDate(account.next_billing || ''));
        lines.push('');
        lines.push('👤 HỒ SƠ');
        lines.push('Email:          ' + email);
        lines.push('Xác minh Email: ' + (account.email_verified === 'Yes' ? 'Có' : 'Không'));
        lines.push('Điện thoại:     ' + (account.phone || ''));
        lines.push('Xác minh ĐT:    ' + (account.phone_verified === 'Yes' ? 'Có' : 'Không'));
        lines.push('Hồ sơ:          ' + (account.profiles || ''));
        lines.push('');
        lines.push('⚙️ TÍNH NĂNG');
        lines.push('Chất lượng:     ' + (account.video_quality || ''));
        lines.push('Số màn hình:    ' + (account.max_streams || ''));
        lines.push('Tạm giữ TT:     ' + (account.on_payment_hold === 'Yes' ? 'Có' : 'Không'));
        lines.push('Thành viên phụ: ' + (account.extra_member === 'Yes' ? 'Có' : 'Không'));

        if (token.status === 'Success') {
            const exp = new Date(token.expires * 1000).toLocaleString('vi-VN');
            const gen = new Date(token.generation_time * 1000).toLocaleString('vi-VN');
            const d = Math.floor(token.time_remaining / 86400);
            const h = Math.floor((token.time_remaining % 86400) / 3600);
            const m = Math.floor((token.time_remaining % 3600) / 60);
            const s = token.time_remaining % 60;
            lines.push('');
            lines.push('🔑 THÔNG TIN TOKEN');
            lines.push('Tạo lúc:        ' + gen);
            lines.push('Hết hạn:        ' + exp);
            lines.push('Còn lại:        ' + d + 'd ' + h + 'h ' + m + 'm ' + s + 's');
            lines.push('');
            lines.push('📱 ĐĂNG NHẬP ĐIỆN THOẠI');
            lines.push(token.direct_login_url || '');
            lines.push('');
            lines.push('🖥️ ĐĂNG NHẬP MÁY TÍNH');
            lines.push('https://www.netflix.com/account?nftoken=' + encodeURIComponent(token.token));
        }

        lines.push('');
        lines.push('━'.repeat(26));
        lines.push('🤖 Được tạo bởi Netflix Cookies Checker');
        lines.push('👤 Chủ sở hữu: @huyvu2512');

        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain' });

        if (isMobile && navigator.canShare) {
            const file = new File([blob], fileName, { type: 'text/plain' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Kết quả Netflix' });
                return;
            }
        }
        // Desktop hoặc fallback: download file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) { }
}

// Handle copy results
function handleCopyResults() {
    try {
        const saved = localStorage.getItem('lastResult');
        if (!saved) return;
        const data = JSON.parse(saved);
        const token = data.token_result || {};

        const lines = [];

        if (token.status === 'Success') {
            const exp = new Date(token.expires * 1000).toLocaleString('vi-VN');
            const d = Math.floor(token.time_remaining / 86400);
            const h = Math.floor((token.time_remaining % 86400) / 3600);
            const m = Math.floor((token.time_remaining % 3600) / 60);
            const s = token.time_remaining % 60;
            lines.push('🔑 THÔNG TIN TOKEN');
            lines.push('Hết hạn:  ' + exp);
            lines.push('Còn lại:  ' + d + 'd ' + h + 'h ' + m + 'm ' + s + 's');
            lines.push('');
            lines.push('📱 ĐĂNG NHẬP ĐIỆN THOẠI');
            lines.push(token.direct_login_url || '');
            lines.push('');
            lines.push('🖥️ ĐĂNG NHẬP MÁY TÍNH');
            lines.push('https://www.netflix.com/account?nftoken=' + encodeURIComponent(token.token));
        }

        lines.push('');
        lines.push('━'.repeat(21));
        lines.push('Được tạo bởi Netflix Cookies Checker');
        lines.push('Chủ sở hữu: @huyvu2512');

        navigator.clipboard.writeText(lines.join('\n'));
    } catch (e) { }
}

// Handle batch files change — merge và dedup theo tên
function handleBatchFilesChange(e) {
    const newFiles = Array.from(e.target.files)
        .filter(f => f.name.endsWith('.txt') || f.name.endsWith('.json') || f.name.endsWith('.zip'));
    const existingNames = new Set(selectedFiles.map(f => f.name));
    const added = newFiles.filter(f => !existingNames.has(f.name));
    selectedFiles = [...selectedFiles, ...added];
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

        const data = await parseApiResponse(response);

        if (data.status === 'success') {
            batchResultsData = data.results;
            displayBatchResults(batchResultsData);
            // Lưu kết quả vào localStorage
            try { localStorage.setItem('batchResults', JSON.stringify(batchResultsData)); } catch (e) { }
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

// Handle save results — ghi từng file vào thư mục
async function handleSaveResults() {
    if (batchResultsData.length === 0) {
        showNotification('Không có kết quả để lưu', true);
        return;
    }

    const validResults = batchResultsData.filter(r => r.status === 'success');
    if (validResults.length === 0) {
        showNotification('Không có tài khoản hợp lệ để lưu', true);
        return;
    }

    saveResultsBtn.disabled = true;
    saveResultsBtn.innerHTML = '<div class="spinner"></div> Đang lưu...';

    // Tạo nội dung từng file
    function buildFileContent(result) {
        const account = result.account_info || {};
        const token = result.token_result || {};
        const lines = [];
        lines.push('🎬 TỔNG QUAN TÀI KHOẢN');
        lines.push('━'.repeat(26));
        lines.push('');
        lines.push('📋 THÔNG TIN CƠ BẢN');
        lines.push('Trạng thái:     ' + (account.ok ? '✅ Hợp lệ' : '❌ Không hợp lệ'));
        lines.push('Premium:        ' + (account.premium ? '👑 Có' : '❌ Không'));
        lines.push('Quốc gia:       ' + (account.country || ''));
        lines.push('');
        lines.push('💳 CHI TIẾT GÓI');
        lines.push('Gói:            ' + (account.plan || ''));
        lines.push('Giá:            ' + (account.plan_price || ''));
        lines.push('Thành viên từ:  ' + (account.member_since || ''));
        lines.push('Phương thức TT: ' + (account.payment_method || ''));
        lines.push('Ngày gia hạn:   ' + formatBillingDate(account.next_billing || ''));
        lines.push('');
        lines.push('👤 HỒ SƠ');
        lines.push('Email:          ' + (account.email || '').replace(/\\x40/g, '@'));
        lines.push('Xác minh Email: ' + (account.email_verified === 'Yes' ? 'Có' : 'Không'));
        lines.push('Điện thoại:     ' + (account.phone || ''));
        lines.push('Xác minh ĐT:    ' + (account.phone_verified === 'Yes' ? 'Có' : 'Không'));
        lines.push('Hồ sơ:          ' + (account.profiles || ''));
        lines.push('');
        lines.push('⚙️ TÍNH NĂNG');
        lines.push('Chất lượng:     ' + (account.video_quality || ''));
        lines.push('Số màn hình:    ' + (account.max_streams || ''));
        lines.push('Tạm giữ TT:     ' + (account.on_payment_hold === 'Yes' ? 'Có' : 'Không'));
        lines.push('Thành viên phụ: ' + (account.extra_member === 'Yes' ? 'Có' : 'Không'));

        if (token.status === 'Success') {
            const exp = new Date(token.expires * 1000).toLocaleString('vi-VN');
            const gen = new Date(token.generation_time * 1000).toLocaleString('vi-VN');
            const d = Math.floor(token.time_remaining / 86400);
            const h = Math.floor((token.time_remaining % 86400) / 3600);
            const m = Math.floor((token.time_remaining % 3600) / 60);
            const s = token.time_remaining % 60;
            lines.push('');
            lines.push('🔑 THÔNG TIN TOKEN');
            lines.push('Tạo lúc:        ' + gen);
            lines.push('Hết hạn:        ' + exp);
            lines.push('Còn lại:        ' + d + 'd ' + h + 'h ' + m + 'm ' + s + 's');
            lines.push('');
            lines.push('📱 ĐĂNG NHẬP ĐIỆN THOẠI');
            lines.push(token.direct_login_url || '');
            lines.push('');
            lines.push('🖥️ ĐĂNG NHẬP MÁY TÍNH');
            lines.push('https://www.netflix.com/account?nftoken=' + encodeURIComponent(token.token));
        }

        lines.push('');
        lines.push('━'.repeat(26));
        lines.push('🤖 Được tạo bởi Netflix Cookies Checker');
        lines.push('👤 Chủ sở hữu: @huyvu2512');
        return lines.join('\n');
    }

    function getFileName(result) {
        const account = result.account_info || {};
        const email = (account.email || '').replace(/\\x40/g, '@').replace(/[<>:"/\\|?*]/g, '_');
        const country = (account.country || 'XX').replace(/\s+/g, '');
        const plan = account.premium ? 'Premium' : 'Basic';
        const rawName = email && email !== 'Unknown'
            ? `${email.split('@')[0]}_${country}_${plan}`
            : (result.filename || 'account').replace(/\.txt$/i, '');
        return `${rawName}.txt`;
    }

    try {
        const zip = new JSZip();
        const dateStr = new Date().toISOString().slice(0, 10);
        validResults.forEach(result => {
            zip.file(getFileName(result), buildFileContent(result));
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `netflix_token_${dateStr}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification(`Đã lưu ${validResults.length} file vào ZIP`);
    } catch (e) {
        if (e.name !== 'AbortError') showNotification('Lỗi: ' + e.message, true);
    } finally {
        saveResultsBtn.disabled = false;
        saveResultsBtn.innerHTML = '<i class="fas fa-download"></i> Lưu Kết Quả';
    }
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

// Show notification — disabled
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

// ── Internal list of chat IDs ──
let chatIdList = [];

// Load saved Telegram config
function loadTelegramConfig() {
    const savedConfig = localStorage.getItem('telegramConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        telegramToggle.checked = config.enabled || false;
        botTokenInput.value = config.bot_token || '';
        // Support old string array, new {id,name} array, or single chat_id
        if (Array.isArray(config.chat_ids)) {
            chatIdList = config.chat_ids.map(item =>
                typeof item === 'object' && item.id ? item : { id: String(item), name: '' }
            );
        } else if (config.chat_id) {
            chatIdList = [{ id: config.chat_id, name: '' }];
        } else {
            chatIdList = [];
        }
        renderChatIdList();
        updateTelegramUI();

        // Auto-sync to server on page load
        if (config.enabled && config.bot_token && chatIdList.length > 0) {
            fetch('/api/telegram-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: config.enabled, bot_token: config.bot_token, chat_ids: chatIdList.map(x => x.id) })
            }).catch(() => { });
        }
    }
}

// Render chat ID list in UI
function renderChatIdList() {
    const listEl = document.getElementById('chat-id-list');
    if (!listEl) return;
    if (chatIdList.length === 0) {
        listEl.innerHTML = '<div style="color:rgba(255,255,255,0.35); font-size:0.82rem; text-align:center; padding:20px 0;">Chưa có Chat ID nào</div>';
        return;
    }
    listEl.innerHTML = chatIdList.map((item, i) => {
        const label = item.name ? `${item.id} <span style="color:rgba(255,255,255,0.5);">(${item.name})</span>` : item.id;
        return `
        <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px;">
            <i class="fas fa-user" style="color:rgba(255,255,255,0.4); font-size:0.8rem;"></i>
            <span style="flex:1; font-family:'Courier New',monospace; font-size:0.88rem; color:#e2e8f0;">${label}</span>
            <button onclick="removeChatId(${i})" style="background:rgba(229,9,20,0.15); border:1px solid rgba(229,9,20,0.3); color:#e05461; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:0.78rem;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        `;
    }).join('');
}

// Add a new chat ID
function addChatId() {
    const idInput = document.getElementById('new-chat-id');
    const nameInput = document.getElementById('new-chat-name');
    const id = (idInput?.value || '').trim();
    const name = (nameInput?.value || '').trim();
    if (!id) return;
    if (chatIdList.some(x => x.id === id)) { idInput.value = ''; return; }
    chatIdList.push({ id, name });
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    renderChatIdList();
    saveTelegramConfig();
}

// Remove chat ID by index
function removeChatId(index) {
    chatIdList.splice(index, 1);
    renderChatIdList();
    saveTelegramConfig();
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
    const ids = chatIdList.map(x => x.id);
    const config = {
        enabled: telegramToggle.checked,
        bot_token: botTokenInput.value,
        chat_ids: chatIdList,       // lưu full {id,name}
        chat_id: ids[0] || ''
    };
    localStorage.setItem('telegramConfig', JSON.stringify(config));
    fetch('/api/telegram-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, chat_ids: ids })  // API chỉ nhận ID
    }).catch(() => { });
}

// Test Telegram connection — sends to all Chat IDs
function testTelegramConnection() {
    if (!botTokenInput.value || chatIdList.length === 0) {
        alert('Vui lòng nhập Bot Token và thêm ít nhất 1 Chat ID');
        return;
    }

    testTelegramBtn.disabled = true;
    testTelegramBtn.innerHTML = '<div class="spinner"></div> Đang kiểm tra...';
    telegramStatus.className = 'telegram-status testing';
    telegramStatus.innerHTML = '<i class="fas fa-sync-alt"></i> Đang kiểm tra kết nối...';

    const sends = chatIdList.map(id =>
        fetch(`https://api.telegram.org/bot${botTokenInput.value}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: id,
                text: '✅ *Kiểm Tra Cookie Netflix*\n\nKết nối thành công! Bot đã được cấu hình đúng.',
                parse_mode: 'Markdown'
            })
        }).then(r => r.json())
    );

    Promise.all(sends)
        .then(results => {
            const allOk = results.every(r => r.ok);
            if (allOk) {
                telegramStatus.className = 'telegram-status enabled';
                telegramStatus.innerHTML = `<i class="fas fa-check-circle"></i> Kết nối thành công (${chatIdList.length} ID)`;
            } else {
                const failed = results.filter(r => !r.ok).length;
                telegramStatus.className = 'telegram-status disabled';
                telegramStatus.innerHTML = `<i class="fas fa-times-circle"></i> ${failed}/${results.length} ID thất bại`;
            }
        })
        .catch(() => {
            telegramStatus.className = 'telegram-status disabled';
            telegramStatus.innerHTML = '<i class="fas fa-times-circle"></i> Kết nối thất bại - Lỗi mạng';
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
    testTelegramBtn.addEventListener('click', testTelegramConnection);

    const addBtn = document.getElementById('add-chat-id-btn');
    if (addBtn) addBtn.addEventListener('click', addChatId);

    const newIdInput = document.getElementById('new-chat-id');
    if (newIdInput) {
        newIdInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') addChatId();
        });
    }

    updateTelegramUI();
}