# LAN Testing Guide — Access Localhost from Other Devices

Test WealthJourney on phones, tablets, or other computers on the same Wi-Fi network.

## Prerequisites

- All devices must be on the **same local network** (Wi-Fi or Ethernet)
- macOS firewall must allow incoming connections
- Backend and frontend dev servers running

## Step 1: Find Your Mac's Local IP

```bash
ipconfig getifaddr en0
```

This returns your LAN IP address (e.g., `192.168.1.100`).

> **Tip:** You can also find it in **System Settings → Wi-Fi → Details → IP Address**.

## Step 2: Configure Environment Variables

### Frontend (`src/wj-client/.env.local`)

Update `NEXT_PUBLIC_API_URL` to use your LAN IP instead of `localhost`:

```env
# Before (only works on the same machine)
NEXT_PUBLIC_API_URL=http://localhost:5000

# After (accessible from other devices)
NEXT_PUBLIC_API_URL=http://192.168.1.100:5000
```

Replace `192.168.1.100` with your actual IP from Step 1.

### Backend (`.env.local`)

No changes needed — the Go backend already binds to `0.0.0.0` (all interfaces) by default:

```go
// internal/app/app.go
srv := &http.Server{
    Addr: ":" + cfg.Server.Port,  // Equivalent to 0.0.0.0:5000
}
```

## Step 3: Start Dev Servers

### Option A: Using Taskfile

```bash
# Start both backend and frontend
task dev
```

> **Note:** By default, Next.js dev server binds to `localhost` only. You need to modify the dev command to bind to all interfaces. See Option B.

### Option B: Start Manually with LAN Binding

**Backend** (already binds to all interfaces):

```bash
task backend:dev
```

**Frontend** (must explicitly bind to `0.0.0.0`):

```bash
cd src/wj-client
npx next dev -H 0.0.0.0
```

Or update `package.json` dev script temporarily:

```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--max-old-space-size=4096' next dev -H 0.0.0.0"
  }
}
```

## Step 4: Access from Other Devices

Open a browser on your phone/tablet/other computer:

| Service  | URL                            | Default Port |
| -------- | ------------------------------ | ------------ |
| Frontend | `http://192.168.1.100:3000`    | 3000         |
| Backend  | `http://192.168.1.100:5000`    | 5000         |

Replace `192.168.1.100` with your actual LAN IP.

## Step 5: Firewall Configuration (if blocked)

### Check macOS Firewall Status

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

### Allow Incoming Connections

**Option A — Disable firewall temporarily** (development only):

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

Re-enable after testing:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

**Option B — Allow specific apps** (recommended):

Go to **System Settings → Network → Firewall → Options** and add:
- `node` (for Next.js frontend)
- Your Go binary (for backend)

## Troubleshooting

### Device can't reach the server

1. **Verify same network** — both devices must be on the same Wi-Fi/LAN
2. **Check IP** — re-run `ipconfig getifaddr en0` (IP may change on reconnect)
3. **Ping test** — from the other device, try pinging your Mac's IP
4. **Port check** — ensure ports 3000 and 5000 are not blocked

### API calls fail from mobile device

The frontend makes API calls to `NEXT_PUBLIC_API_URL`. If this is set to `localhost`, the mobile browser will try to reach its own localhost (not your Mac).

**Fix:** Ensure `NEXT_PUBLIC_API_URL` uses the LAN IP:

```env
NEXT_PUBLIC_API_URL=http://192.168.1.100:5000
```

Then restart the frontend dev server (env vars are baked in at build time for `NEXT_PUBLIC_*`).

### CORS errors

If you see CORS errors in the browser console, ensure the backend allows your LAN IP origin. Check the CORS middleware in `handlers/middleware.go`.

### Mixed content warnings

Browsers may block HTTP requests from HTTPS pages. During LAN testing, access the frontend via `http://` (not `https://`).

## Quick Reference

```bash
# 1. Get your IP
ipconfig getifaddr en0

# 2. Set frontend env
echo 'NEXT_PUBLIC_API_URL=http://<YOUR_IP>:5000' >> src/wj-client/.env.local

# 3. Start backend
task backend:dev

# 4. Start frontend on all interfaces
cd src/wj-client && npx next dev -H 0.0.0.0

# 5. Open on other device
# http://<YOUR_IP>:3000
```

## Security Reminder

- Only use this setup on **trusted networks** (home/office Wi-Fi)
- **Never** expose development servers to public networks
- Remember to revert `NEXT_PUBLIC_API_URL` to `localhost` when done
- Re-enable the macOS firewall if you disabled it
