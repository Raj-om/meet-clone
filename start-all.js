import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helpers ───────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function waitForServer(port, retries = 40) {
    return new Promise((resolve, reject) => {
        const attempt = (n) => {
            http.get(`http://localhost:${port}`, () => resolve())
                .on('error', () => {
                    if (n <= 0) return reject(new Error(`Server on port ${port} never started.`));
                    setTimeout(() => attempt(n - 1), 2500);
                });
        };
        attempt(retries);
    });
}

function copyToClipboard(text) {
    try {
        execSync(`echo ${text} | clip`, { stdio: 'pipe' });
        return true;
    } catch { return false; }
}

// ── Banner ────────────────────────────────────────────────────────────────────

console.log('\x1b[35m');
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║         🚀  MEET CLONE AI  —  FULL STACK AUTO LAUNCHER      ║");
console.log("║              🇮🇳  Atma Nirbhar Bharat  🇮🇳                   ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log('\x1b[0m');

// ── Step 1: Deepfake Python Server ────────────────────────────────────────────

console.log('\x1b[33m  [1/5] 🐍 Starting Deepfake AI Server...\x1b[0m');
exec('start "🐍 Deepfake AI Server" cmd.exe /k "cd /d "%~dp0deepfake_server" && call start.bat"');
await delay(1000);

// ── Step 2: Ollama AI ─────────────────────────────────────────────────────────

console.log('\x1b[33m  [2/5] 🧠 Starting Ollama DeepSeek AI...\x1b[0m');
exec('start "🧠 Ollama DeepSeek AI" cmd.exe /k "set OLLAMA_ORIGINS=* && ollama serve"');
await delay(1000);

// ── Step 3: Ensure localtunnel is installed ───────────────────────────────────

console.log('\x1b[33m  [3/5] 🌐 Checking localtunnel...\x1b[0m');
try {
    execSync('npx -y localtunnel --version', { stdio: 'pipe' });
    console.log('\x1b[32m       ✅ localtunnel is ready\x1b[0m');
} catch {
    console.log('\x1b[36m       📦 Installing localtunnel (first time only)...\x1b[0m');
    try { execSync('npm install -g localtunnel', { stdio: 'inherit' }); }
    catch { console.log('\x1b[31m       ⚠️  Could not install globally, will use npx\x1b[0m'); }
}

// ── Step 4: Next.js Server ────────────────────────────────────────────────────

console.log('\x1b[33m  [4/5] ⚡ Starting Next.js App Server...\x1b[0m');
console.log('\x1b[90m         Compiling... (this takes ~30 seconds the first time)\x1b[0m\n');

const nextDev = spawn('npx', ['next', 'dev', '--webpack'], {
    stdio: 'inherit',
    shell: true
});

nextDev.on('close', (code) => {
    console.log(`\nNext.js exited with code ${code}`);
    process.exit(code);
});

// ── Step 5: Tunnel (Cloudflare preferred, localtunnel fallback) ───────────────

console.log('\x1b[33m  [5/5] 🌐 Waiting for Next.js, then launching public tunnel...\x1b[0m');

try {
    // Try Cloudflare Tunnel first (most reliable, never 503)
    let tunnelProcess;
    let useCloudflare = false;

    try {
        execSync('cloudflared --version', { stdio: 'pipe' });
        useCloudflare = false; // Forced false due to Cloudflare 530 errors
    } catch {
        console.log('\x1b[90m     cloudflared not found, using localtunnel...\x1b[0m');
    }

    if (useCloudflare) {
        console.log('\x1b[36m  ☁️  Starting Cloudflare Tunnel (using HTTP2 due to firewall)... this may take 10-20 seconds to establish.\x1b[0m');
        tunnelProcess = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000', '--protocol', 'http2'], {
            shell: true, stdio: ['ignore', 'pipe', 'pipe']
        });

        const handleCloudflareOutput = (data) => {
            const out = data.toString();
            const match = out.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
            if (match) {
                const url = match[0].trim();
                copyToClipboard(url);
                printSuccessBanner(url);
            }
        };
        tunnelProcess.stdout.on('data', handleCloudflareOutput);
        tunnelProcess.stderr.on('data', handleCloudflareOutput); // CF logs to stderr
    } else {
        // Fallback: localtunnel with PERSISTENT subdomain
        const subdomainFile = path.join(__dirname, '.tunnel_subdomain');
        let subdomain = '';
        if (fs.existsSync(subdomainFile)) {
            subdomain = fs.readFileSync(subdomainFile, 'utf8').trim();
        } else {
            subdomain = 'meet-clone-' + Math.random().toString(36).substring(2, 12);
            fs.writeFileSync(subdomainFile, subdomain);
        }
        
        console.log(`\x1b[36m  🌐 Starting localtunnel with fixed subdomain: ${subdomain}...\x1b[0m`);
        tunnelProcess = spawn('npx', ['-y', 'localtunnel', '--port', '3000', '--subdomain', subdomain], {
            shell: true, stdio: ['ignore', 'pipe', 'pipe']
        });
        tunnelProcess.stdout.on('data', (data) => {
            const out = data.toString();
            const match = out.match(/your url is: (https:\/\/[^\s]+)/i);
            if (match) {
                const url = match[1].trim();
                copyToClipboard(url);
                printSuccessBanner(url);
            }
        });
    }

    tunnelProcess.on('close', () => {
        console.log('\x1b[31m\n  ⚠️  Tunnel closed. Restart the app to get a new link.\x1b[0m');
    });

} catch (err) {
    console.error('\x1b[31m  ❌ Tunnel failed:', err.message, '\x1b[0m');
}

function printSuccessBanner(url) {
    const padded = url.padEnd(44);
    console.log('\x1b[35m');
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                   🎉  ALL SYSTEMS GO!                       ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  🏠 Your App    →  http://localhost:3000                     ║`);
    console.log(`║                                                              ║`);
    console.log(`║  🌐 Share Link  →  ${padded} ║`);
    console.log("║                                                              ║");
    console.log("║  ✅ Share Link auto-copied to your clipboard!                ║");
    console.log("║  📱 Friend opens this link → downloads app → joins meeting! ║");
    console.log("║                                                              ║");
    console.log("║  ⚠️  Keep this terminal open. Ctrl+C stops everything.       ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log('\x1b[0m');
}

