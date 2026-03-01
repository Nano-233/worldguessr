# Hosting WorldGuessr (Step-by-Step, Free Tier)

This guide walks you through hosting WorldGuessr so **multiplayer and Hide & Seek** work. All steps use **free tiers** where possible.

---

## Architecture (what you’re deploying)

| Part | What it does | Free hosting option |
|------|----------------|---------------------|
| **Frontend** | Next.js static site (HTML/JS/CSS) | Vercel, Netlify |
| **API** | Express server (auth, maps, REST) | Railway, Render, Fly.io |
| **WebSocket** | Real-time multiplayer (games, lobbies) | Same as API (separate service) |
| **Utils/Cron** | Serves location data + background jobs | Same app as API or separate service |
| **MongoDB** | User accounts, game history | MongoDB Atlas (free) |
| **Redis** | Sessions/cache (required for multiplayer) | Upstash or Redis Cloud (free) |
| **Google OAuth** | Login (optional for guest-only) | Google Cloud (free) |

---

## Option A: Railway (easiest free backend)

Railway’s free tier gives **$5 credit/month** (enough for 2–3 small services 24/7 and light use with friends).

---

### A.1 Get your MongoDB connection string

1. Go to **https://www.mongodb.com/cloud/atlas** and sign up (or log in).
2. Click **“Build a Database”** (or **Create** → **Cluster**).
3. Choose **M0 FREE** and a region close to you → **Create**.
4. Create a database user:
   - In the left sidebar: **Database Access** → **Add New Database User**.
   - Choose **Password** auth. Set a **Username** and **Password** (save the password somewhere safe).
   - **Database User Privileges**: Read and write to any database (or “Atlas admin”).
   - Click **Add User**.
5. Allow access from anywhere:
   - Left sidebar: **Network Access** → **Add IP Address**.
   - Click **Allow Access from Anywhere** (adds `0.0.0.0/0`).
   - Click **Confirm**.
6. Get the connection string:
   - Left sidebar: **Database** → click **Connect** on your cluster.
   - Choose **“Drivers”** (or “Connect your application”).
   - Driver: **Node.js**. Copy the connection string. It looks like:
     ```text
     mongodb+srv://USERNAME:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - **Replace `<password>`** with the actual password you set for the database user (no angle brackets). If the password has special characters, URL-encode them (e.g. `@` → `%40`).
   - Save this string somewhere; you’ll use it in **.env** and in **Railway** later.

---

### A.2 Dotenv setup: where to put the connection strings

The app uses the **dotenv** package (already in the project). It loads a file named **`.env`** from the **project root** when you run the API, WebSocket, or Cron. You don’t need to run `npm install dotenv` — it’s already installed.

**Where is “project root”?**  
The folder that contains:

- `package.json`
- `server.js`
- the `ws` folder
- `cron.js`

Example paths:

- **Windows:** `D:\Projects\Worldguessr\worldguessr`
- **Mac/Linux:** `/Users/you/Projects/worldguessr` or `~/Projects/Worldguessr/worldguessr`

If you’re not sure: open the project in your editor, go to the folder where you see `package.json` and `server.js` in the same place — that folder is project root.

**Where do the strings go?**

| Where you’re running | Where to put the connection string (and other secrets) |
|----------------------|--------------------------------------------------------|
| **On your PC (local dev)** | A file named **`.env`** in **project root** (see below). |
| **On Railway (Option A)** | Railway dashboard → each service → **Variables** tab. Not in a file. See A.6. |

You use **both**: `.env` for local runs; Railway Variables for the deployed backend.

---

#### Create the `.env` file (for local use)

1. Open your project in VS Code, Cursor, or any editor.
2. In the **file tree**, go to the **project root** (same level as `package.json` and `server.js`).
3. Create a new file **in that folder** named exactly **`.env`** (dot, then “env”, no `.txt`).
   - **Windows:** In VS Code/Cursor: right‑click project root → New File → type `.env`. If you use Notepad, save as `".env"` (with quotes) so it doesn’t become `.env.txt`.
4. Copy the contents of **`.env.example`** into **`.env`** (same folder as `package.json`).  
   Or create `.env` and paste this, then fill in the values:

```env
MONGODB=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
REDIS_URI=rediss://default:xxxx@xxxx.upstash.io:6379
UTILS_URL=http://localhost:3003
API_URL=http://localhost:3001
```

**Format rules:**

- One variable per line.
- `NAME=value` with **no spaces** around the `=`.
- No quotes around the value unless the value itself contains spaces (usually not needed for connection strings).
- Replace `YOUR_USER`, `YOUR_PASSWORD`, and the `cluster0.xxxxx` part with your real Atlas string (the one from A.1 with `<password>` replaced). Use your real Redis URL from A.3 for `REDIS_URI`.

5. Save the file.  
6. **Do not commit `.env`** — it’s in `.gitignore`. For production (Railway), you’ll paste the same strings into each service’s **Variables** tab in A.6.

**How it’s used:** When you run `npm run dev` or `node server.js` (or `node ws/ws.js`, `node cron.js`) from the project root, the app loads `.env` automatically and reads `process.env.MONGODB`, `process.env.REDIS_URI`, etc. No extra setup.

---

### A.3 Get Redis URL (required for multiplayer)

1. Go to **https://upstash.com** (or **https://redis.com/try-free/** for Redis Cloud).
2. Sign up and create a database (e.g. region closest to you).
3. Copy the connection URL. Upstash calls it **REDIS_URI** or “REST URL” — you want the **Redis URI** (starts with `rediss://` or `redis://`).
4. Paste it into your **`.env`** as:
   ```env
   REDIS_URI=rediss://default:xxxx@xxxx.upstash.io:6379
   ```

---

### A.4 Google OAuth (optional; for login)

1. Go to **https://console.cloud.google.com** → create or select a project.
2. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. **Authorized JavaScript origins**: add `http://localhost:3000` and later your Vercel URL (e.g. `https://your-app.vercel.app`).
5. **Authorized redirect URIs**: add `http://localhost:3000` and `https://your-app.vercel.app` (you can add the Vercel URL after you deploy).
6. Copy **Client ID** and **Client Secret**.
7. In **`.env`** add (optional):
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

---

### A.5 Push code to GitHub

1. Create a new repository on **https://github.com** (e.g. `worldguessr`).
2. In your project root, run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/worldguessr.git
   git push -u origin main
   ```
   (Replace `YOUR_USERNAME` and repo name with yours.)  
   Make sure **`.env` is not committed** (it’s in `.gitignore`). Secrets go only in **Railway** and **Vercel** for production.

---

### A.6 Deploy backend on Railway (3 services)

**Important:** On Railway you don’t use a `.env` file. You paste the **same** values (MongoDB connection string, Redis URL, etc.) into each service’s **Variables** tab in the Railway dashboard. So: same strings as in your local `.env`, but entered in the web UI.

1. Go to **https://railway.app** and sign in with **GitHub**.
2. **New Project** → **Deploy from GitHub repo** → select your `worldguessr` repo.  
   Railway will create one service from the repo. You’ll add two more and set each one’s start command and variables.

---

#### A.6.1 First service: Utils (Cron)

1. In the project, click the existing service (or **Add Service** → **GitHub Repo** → same repo).
2. Open **Settings** (or the service’s gear icon):
   - **Build**: Build Command — leave **empty**.
   - **Deploy**: Start Command — set to: **`node cron.js`**
   - **Networking**: click **Generate Domain**. Copy the URL (e.g. `https://worldguessr-cron-xxxx.up.railway.app`). You’ll use it as `UTILS_URL` in the other services.
3. Open **Variables** (or **Variables** tab):
   - Click **New Variable** (or **+**) and add each row below. For `MONGODB`, paste the **exact same** connection string you have in your local `.env` file (the one from A.1 with `<password>` replaced).

   | Variable   | Value |
   |-----------|--------|
   | `NODE_ENV` | `production` |
   | `MONGODB`  | Paste your Atlas connection string (same as in your `.env`: `mongodb+srv://USER:PASS@cluster0.xxx.mongodb.net/...`) |
   | `PORT`     | `3003` (optional; Railway may set PORT automatically; cron.js uses `process.env.PORT \|\| 3003`) |

4. Save. Railway will redeploy. Wait until the deploy is successful.

---

#### A.6.2 Second service: API

1. In the same Railway project: **Add Service** → **GitHub Repo** → select the **same** `worldguessr` repo.
2. **Settings**:
   - **Deploy** → Start Command: **`node server.js`**
   - **Networking** → **Generate Domain**. Copy the URL (e.g. `https://worldguessr-api-xxxx.up.railway.app`). This is your **API URL** for the frontend and for the WebSocket service.
3. **Variables** — add (paste the same `MONGODB` and `REDIS_URI` values from your local `.env`):

   | Variable | Value |
   |----------|--------|
   | `NODE_ENV` | `production` |
   | `API_PORT` | `${{PORT}}` (Railway provides PORT; server.js uses API_PORT) |
   | `MONGODB` | Same as in your `.env`: your full Atlas connection string |
   | `REDIS_URI` | Same as in your `.env`: your Upstash/Redis URI |
   | `UTILS_URL` | Utils service URL from A.6.1 (e.g. `https://worldguessr-cron-xxxx.up.railway.app`) |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID (if using login) |
   | `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret (if using login) |

4. Save and wait for deploy.

---

#### A.6.3 Third service: WebSocket

1. **Add Service** → **GitHub Repo** → same `worldguessr` repo.
2. **Settings**:
   - **Deploy** → Start Command: **`node ws/ws.js`**
   - **Networking** → **Generate Domain**. Copy the URL (e.g. `https://worldguessr-ws-xxxx.up.railway.app`). This is your **WebSocket host** for the frontend (use the **host only** in Vercel: `worldguessr-ws-xxxx.up.railway.app`; the app will add `wss://` and `/wg`).
3. **Variables** — add (same `MONGODB` and `REDIS_URI` as in your `.env`; `UTILS_URL` and `API_URL` are the Railway URLs from the steps above):

   | Variable | Value |
   |----------|--------|
   | `NODE_ENV` | `production` |
   | `WS_PORT` | `${{PORT}}` |
   | `MONGODB` | Same as in your `.env`: your full Atlas connection string |
   | `REDIS_URI` | Same as in your `.env`: your Upstash/Redis URI |
   | `UTILS_URL` | Utils service URL from A.6.1 (e.g. `https://worldguessr-cron-xxxx.up.railway.app`) |
   | `API_URL` | API service URL from A.6.2 (e.g. `https://worldguessr-api-xxxx.up.railway.app`) |

4. Save and wait for deploy.

---

### A.7 Deploy frontend on Vercel

1. Go to **https://vercel.com** and sign in with **GitHub**.
2. **Add New** → **Project** → **Import** your `worldguessr` repo.
3. **Configure**:
   - **Framework Preset**: Next.js (auto-detected).
   - **Build Command**: `next build` (or leave default).
   - **Output Directory**: set to **`out`** (the app uses `output: 'export'` in `next.config.js`).
4. **Environment Variables** — add these (use **Production**; you can add Preview/Development later if needed). **These are required:** without them, the hosted UI will show "error connecting to multiplayer server" and singleplayer will not load the map (it fetches locations from the API).

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_API_URL` | Your Railway API base URL, e.g. `https://worldguessr-api-xxxx.up.railway.app` (or just `worldguessr-api-xxxx.up.railway.app`) |
   | `NEXT_PUBLIC_WS_HOST` | Your Railway WebSocket service host, e.g. `worldguessr-ws-xxxx.up.railway.app` (or full URL like `https://worldguessr-ws-xxxx.up.railway.app`; the app adds `wss://` and `/wg`) |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same Google Client ID (if using login) |

5. Click **Deploy**. **Redeploy** after changing any `NEXT_PUBLIC_*` variable (they are baked in at build time). When it’s done, note your frontend URL (e.g. `https://worldguessr-xxx.vercel.app`).

---

### A.8 Finish Google OAuth (if you use login)

1. In **Google Cloud Console** → **APIs & Services** → **Credentials** → your OAuth client.
2. **Authorized JavaScript origins**: add `https://your-actual-vercel-url.vercel.app`.
3. **Authorized redirect URIs**: add `https://your-actual-vercel-url.vercel.app`.
4. Save.

---

### A.9 Test

1. Open your **Vercel URL** in a browser.
2. Create a game (multiplayer), get the code.
3. Open a second tab (or another device), join with the code.
4. Optionally enable **Hide & Seek** in the lobby and run through hide/seek once.

If the game creates/joins and you can play, the connection string, Redis, and env vars are set correctly.

**If you see "error connecting to multiplayer server" or singleplayer map won’t load:** the frontend is still using default URLs (localhost). In **Vercel** → your project → **Settings** → **Environment Variables**, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_HOST` to your **deployed** Railway API and WebSocket URLs (see A.7). Then trigger a **new deployment** (Deployments → … → Redeploy); `NEXT_PUBLIC_*` values are fixed at build time.

**If env vars are correct but it still fails:**

1. **Redeploy Vercel** after changing any `NEXT_PUBLIC_*` (values are baked in at build time).
2. **Railway: app must listen on `PORT`** — Railway sets `PORT`; the API and WS services now fall back to `PORT` if `API_PORT`/`WS_PORT` are not set. Ensure each service’s start command is `node server.js` and `node ws/ws.js` (no hardcoded port).
3. **Check the browser** — Open DevTools (F12) → **Console** and **Network**. For multiplayer, look for WebSocket errors (e.g. failed to connect, 403, wrong URL). For singleplayer map, look for failed fetch to your API URL (CORS, 404, or connection refused).
4. **Check Railway logs** — In Railway, open the API and WebSocket services and check **Deployments** → **View Logs**. Confirm they start without errors and show “listening” on the port. If the API or WS crashes or never listens, fix those first.
5. **CORS** — The API uses `cors()` with default (all origins). If you added custom CORS, ensure your Vercel origin is allowed.

---

## Option B: Single VM (Oracle Cloud Free Tier) – always on

You get a **free, always-on** VM. Run API, WS, and Cron on one machine.

### Step 1: Oracle Cloud free VM

1. Sign up: https://www.oracle.com/cloud/free/
2. Create a VM (e.g. Ubuntu 22.04), 1–4 OCPUs, 1–24 GB RAM (within free tier).
3. Open ports **80, 443, 3001, 3002, 3003** in the VM’s security list / firewall.
4. SSH into the VM.

### Step 2: Install Node and run app

```bash
# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone your repo
git clone https://github.com/YOUR_USER/worldguessr.git
cd worldguessr
npm install
```

### Step 3: Environment file

Create a **`.env`** file in the project root on the VM (same folder as `package.json`):

```bash
nano .env
```

Paste (replace with your real values):

```env
NODE_ENV=production
MONGODB=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
REDIS_URI=rediss://default:xxxx@xxxx.upstash.io:6379
UTILS_URL=http://localhost:3003
API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Save (Ctrl+O, Enter, Ctrl+X). Then run API, WS, and Cron with the right ports (e.g. via PM2 with `API_PORT=3001`, `WS_PORT=3002`).

### Step 4: Run all three processes (PM2)

```bash
sudo npm install -g pm2

API_PORT=3001 WS_PORT=3002 pm2 start server.js --name api
WS_PORT=3002 pm2 start ws/ws.js --name ws
pm2 start cron.js --name cron

pm2 save
pm2 startup
```

### Step 5: Build and serve frontend

Build the app with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_HOST` set to this server’s URL or IP, then serve the `out` folder (e.g. with `npx serve out -l 3000` or Nginx).

---

## Option C: Render (free tier, with caveats)

- Render free web services **spin down** after ~15 minutes of no traffic.
- When they spin down, **WebSocket connections drop**, so multiplayer and Hide & Seek stop until the service is woken again.
- So Render free is **not recommended** for real-time multiplayer; use Railway or a small VM instead.

---

## Checklist (any option)

- [ ] MongoDB Atlas: cluster, database user, network `0.0.0.0/0`, connection string with `<password>` replaced
- [ ] Redis: Upstash or Redis Cloud, `REDIS_URI` in `.env` (local) and in Railway (production)
- [ ] Google OAuth: Client ID and Secret in `.env` and in Railway/Vercel if you use login
- [ ] **Where to put the connection string:**  
  - **Local:** `.env` in project root (same folder as `package.json`).  
  - **Railway:** Variables tab of each service (API, WS, Utils).  
  - **Vercel:** Only frontend vars (`NEXT_PUBLIC_*`); no `MONGODB` or secrets.
- [ ] Backend: API, WS, and Utils running with correct `UTILS_URL` and `API_URL` (and `MONGODB`, `REDIS_URI`)
- [ ] Frontend: built with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_HOST` pointing to your backend
- [ ] Google Console: production frontend URL in OAuth origins and redirect URIs

---

## Summary: “Free” setup

| Service    | Free option        | Notes                          |
|-----------|--------------------|---------------------------------|
| Frontend  | Vercel             | Free, no code change            |
| API + WS + Utils | Railway (3 services) | ~$5 credit/month             |
| Or one backend | Oracle Cloud free VM | Always on, run API + WS + Cron + frontend |
| MongoDB   | Atlas M0           | Free tier                       |
| Redis     | Upstash / Redis Cloud | Free tier                    |
| Google OAuth | Google Cloud     | Free within quotas              |

**Where the connection string goes:** In a **`.env`** file in the **project root** for local development, and in **Railway Variables** for each backend service (Utils, API, WebSocket) in production. Never commit `.env`; use `.env.example` as a template.
