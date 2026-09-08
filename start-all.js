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

// ── Step 3: Ensure ngrok is ready ───────────────────────────────────────────

console.log('\x1b[33m  [3/5] 🌐 Checking ngrok...\x1b[0m');
try {
    execSync('ngrok --version', { stdio: 'pipe' });
    console.log('\x1b[32m       ✅ ngrok is ready\x1b[0m');
} catch {
    console.log('\x1b[33m       ⚠️ ngrok not found, will use localtunnel as fallback\x1b[0m');
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

// ── Step 5: Tunnel (ngrok primary, localtunnel fallback) ─────────────────────

console.log('\x1b[33m  [5/5] 🌐 Waiting for Next.js, then launching public tunnel...\x1b[0m');

try {
    let tunnelProcess;
    let hasNgrok = false;

    try {
        execSync('ngrok --version', { stdio: 'pipe' });
        hasNgrok = true;
    } catch {
        console.log('\x1b[90m     ngrok not found, using localtunnel...\x1b[0m');
    }

    if (hasNgrok) {
        console.log('\x1b[36m  🚀 Starting ngrok tunnel on port 3000...\x1b[0m');
        tunnelProcess = spawn('ngrok', ['http', '3000', '--log=stdout'], {
            shell: true, stdio: ['ignore', 'pipe', 'pipe']
        });

        let urlFound = false;
        const handleNgrokOutput = (data) => {
            if (urlFound) return;
            const out = data.toString();
            const match = out.match(/url=(https:\/\/[a-zA-Z0-9\.\-]+ngrok[^\s"']+)/i) || out.match(/(https:\/\/[a-zA-Z0-9\.\-]+\.ngrok[^\s"']+)/i);
            if (match) {
                urlFound = true;
                const url = match[1].trim().replace(/["',]/g, '');
                copyToClipboard(url);
                printSuccessBanner(url);
            }
        };

        tunnelProcess.stdout.on('data', handleNgrokOutput);
        tunnelProcess.stderr.on('data', handleNgrokOutput);

        // API polling fallback
        const pollInterval = setInterval(async () => {
            if (urlFound) {
                clearInterval(pollInterval);
                return;
            }
            try {
                const res = await fetch('http://127.0.0.1:4040/api/tunnels');
                if (res.ok) {
                    const json = await res.json();
                    const publicUrl = json.tunnels?.[0]?.public_url;
                    if (publicUrl) {
                        urlFound = true;
                        clearInterval(pollInterval);
                        copyToClipboard(publicUrl);
                        printSuccessBanner(publicUrl);
                    }
                }
            } catch {}
        }, 1000);
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

