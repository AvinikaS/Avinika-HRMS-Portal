const PlatformConfig = require('../models/PlatformConfig');
const crypto = require('crypto');

const SIM_URL = 'http://localhost:9000';
const isSimulator = () => process.env.OAUTH_SIMULATOR === 'true';

// OAuth configuration per platform
const OAUTH_CONFIGS = {
    LinkedIn: {
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        scope: 'r_liteprofile w_member_social r_organization_admin w_organization_social rw_organization_admin',
        clientIdEnv: 'LINKEDIN_CLIENT_ID',
        clientSecretEnv: 'LINKEDIN_CLIENT_SECRET'
    },
    Naukri: {
        authUrl: 'https://api.naukri.com/oauth2/authorize',
        tokenUrl: 'https://api.naukri.com/oauth2/token',
        scope: 'job_posting candidate_read',
        clientIdEnv: 'NAUKRI_CLIENT_ID',
        clientSecretEnv: 'NAUKRI_CLIENT_SECRET'
    },
    Indeed: {
        authUrl: 'https://secure.indeed.com/oauth/v2/authorize',
        tokenUrl: 'https://apis.indeed.com/oauth/v2/tokens',
        scope: 'employer_access',
        clientIdEnv: 'INDEED_CLIENT_ID',
        clientSecretEnv: 'INDEED_CLIENT_SECRET'
    },
    Internshala: {
        authUrl: 'https://internshala.com/oauth/authorize',
        tokenUrl: 'https://internshala.com/oauth/token',
        scope: 'post_jobs read_applications',
        clientIdEnv: 'INTERNSHALA_CLIENT_ID',
        clientSecretEnv: 'INTERNSHALA_CLIENT_SECRET'
    },
    Monster: {
        authUrl: 'https://api.monster.com/oauth/authorize',
        tokenUrl: 'https://api.monster.com/oauth/token',
        scope: 'job_post candidate_search',
        clientIdEnv: 'MONSTER_CLIENT_ID',
        clientSecretEnv: 'MONSTER_CLIENT_SECRET'
    },
    Glassdoor: {
        authUrl: 'https://www.glassdoor.com/oauth/authorize',
        tokenUrl: 'https://www.glassdoor.com/oauth/token',
        scope: 'employer jobs',
        clientIdEnv: 'GLASSDOOR_CLIENT_ID',
        clientSecretEnv: 'GLASSDOOR_CLIENT_SECRET'
    }
};

// Get the right URLs (simulator or real)
function getUrls(config) {
    if (isSimulator()) {
        return { authUrl: `${SIM_URL}/authorize`, tokenUrl: `${SIM_URL}/token` };
    }
    return { authUrl: config.authUrl, tokenUrl: config.tokenUrl };
}

// Generate OAuth state token (CSRF protection)
function generateState(platform, userId) {
    const data = `${platform}:${userId}:${Date.now()}`;
    return Buffer.from(data).toString('base64url') + '.' + crypto.createHmac('sha256', process.env.JWT_SECRET || 'hrms-secret').update(data).digest('hex').slice(0, 16);
}

function parseState(state) {
    try {
        const [b64] = state.split('.');
        const decoded = Buffer.from(b64, 'base64url').toString();
        const [platform, userId] = decoded.split(':');
        return { platform, userId };
    } catch { return null; }
}

// GET /api/oauth/:platform/init — Start OAuth flow
exports.initiateOAuth = async (req, res) => {
    try {
        const { platform } = req.params;
        const config = OAUTH_CONFIGS[platform];
        if (!config) return res.status(400).json({ success: false, message: `OAuth not supported for ${platform}` });

        const clientId = process.env[config.clientIdEnv];
        if (!clientId) {
            // Demo mode: simulate OAuth by directly connecting
            return res.json({
                success: true,
                demo: true,
                message: `${platform} OAuth credentials not configured. Using demo mode.`,
                platform
            });
        }

        const { authUrl } = getUrls(config);
        const state = generateState(platform, req.user.id);
        const redirectUri = `${process.env.BASE_URL || 'http://localhost:5000'}/api/oauth/callback`;

        const fullAuthUrl = `${authUrl}?` + new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: config.scope,
            state
        }).toString();

        res.json({ success: true, authUrl: fullAuthUrl, platform });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/oauth/callback — OAuth callback handler
exports.oauthCallback = async (req, res) => {
    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.send(callbackHTML('error', null, `Authorization denied: ${error}`));
        }

        const parsed = parseState(state);
        if (!parsed) return res.send(callbackHTML('error', null, 'Invalid OAuth state'));

        const { platform, userId } = parsed;
        const config = OAUTH_CONFIGS[platform];
        if (!config) return res.send(callbackHTML('error', platform, 'Unknown platform'));

        const clientId = process.env[config.clientIdEnv];
        const clientSecret = process.env[config.clientSecretEnv];
        const redirectUri = `${process.env.BASE_URL || 'http://localhost:5000'}/api/oauth/callback`;

        // Exchange authorization code for access token
        const { tokenUrl } = getUrls(config);
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret
            }).toString()
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || tokenData.error) {
            return res.send(callbackHTML('error', platform, tokenData.error_description || 'Token exchange failed'));
        }

        // Store tokens securely
        await PlatformConfig.findOneAndUpdate(
            { platform },
            {
                platform,
                isConnected: true,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || null,
                tokenExpiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
                connectedBy: userId,
                connectedAt: new Date(),
                oauthGrantType: 'authorization_code'
            },
            { upsert: true, new: true }
        );

        res.send(callbackHTML('success', platform));
    } catch (err) {
        res.send(callbackHTML('error', null, err.message));
    }
};

// POST /api/oauth/:platform/demo-connect — Demo mode connect (when no real OAuth creds)
exports.demoConnect = async (req, res) => {
    try {
        const { platform } = req.params;
        await PlatformConfig.findOneAndUpdate(
            { platform },
            {
                platform,
                isConnected: true,
                accessToken: `demo_token_${platform.toLowerCase()}_${Date.now()}`,
                connectedBy: req.user.id,
                connectedAt: new Date(),
                oauthGrantType: 'demo'
            },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: `${platform} connected (demo mode)` });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// HTML page rendered in the OAuth popup after callback
function callbackHTML(status, platform, error) {
    return `<!DOCTYPE html>
<html>
<head><title>HRMS - Platform Connection</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 48px; text-align: center; max-width: 400px; }
  .icon { font-size: 56px; margin-bottom: 16px; }
  h2 { margin-bottom: 8px; font-size: 20px; }
  p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
  .err { color: #fca5a5; }
  button { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; padding: 12px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
</style></head>
<body>
  <div class="card">
    ${status === 'success' ? `
      <div class="icon">✅</div>
      <h2>${platform} Connected!</h2>
      <p>Your ${platform} account has been linked successfully. You can now publish jobs to ${platform}.</p>
    ` : `
      <div class="icon">❌</div>
      <h2>Connection Failed</h2>
      <p class="err">${error || 'Something went wrong. Please try again.'}</p>
    `}
    <button onclick="window.opener && window.opener.postMessage({ type: 'OAUTH_COMPLETE', status: '${status}', platform: '${platform || ''}' }, '*'); window.close();">
      ${status === 'success' ? 'Done' : 'Close'}
    </button>
  </div>
  <script>
    // Auto-notify parent window
    if (window.opener) {
      window.opener.postMessage({ type: 'OAUTH_COMPLETE', status: '${status}', platform: '${platform || ''}' }, '*');
    }
  </script>
</body></html>`;
}
