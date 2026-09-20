# Client Computer Setup & Deployment Guide

This step-by-step guide walks you through setting up the **Bara-Awlia Medical Hall - Medicine Shortage Management System** on a client's local Windows PC directly from GitHub.

---

## 📋 System Requirements
- **Operating System:** Windows 10 or Windows 11 (64-bit)
- **Processor:** Intel Core i3 / AMD Ryzen 3 or higher
- **RAM:** 4 GB minimum (8 GB recommended)
- **Local Network:** Wi-Fi router (Internet is only required for initial download; **no internet is needed during daily pharmacy operation**).

---

## 🚀 Method 1: Quick Automated Setup (Recommended)

### Step 1: Install Node.js on Client PC
1. Go to [https://nodejs.org](https://nodejs.org) on the client PC.
2. Download the **LTS (Long Term Support)** version (v20 or newer).
3. Run the installer (`.msi`).
4. Click **Next** through the setup. **Ensure the option "Add to PATH" is checked**.
5. Finish the installation and restart any open command windows.

---

### Step 2: Download the Project from GitHub
Choose either option:

#### Option A: Using Git (Recommended)
Open PowerShell and clone the repository to your desired drive (e.g., `C:\PharmacyApp` or `D:\PharmacyApp`):
```powershell
git clone https://github.com/your-username/your-repository.git "C:\PharmacyApp"
```

#### Option B: Download as ZIP
1. On GitHub, click the green **Code** button and select **Download ZIP**.
2. Extract the ZIP file to a permanent folder, for example: `C:\PharmacyApp`.

---

### Step 3: 1-Click Start (`start-server.bat`)
In the extracted project folder (`C:\PharmacyApp`), locate:
```text
start-server.bat
```
**Double-click `start-server.bat`.**

The script automatically:
1. Verifies Node.js is installed.
2. Generates the `.env` configuration file.
3. Installs all required project packages (`npm install`).
4. Sets up the local SQLite database (`prisma/dev.db`) and seeds initial users and sample data.
5. Builds the optimized Next.js production bundle.
6. Starts the server on port `3000` and opens `http://localhost:3000` in the default browser.

> ⏳ *Note: The very first launch takes 2–3 minutes to install packages and build. Subsequent launches will start within 3 seconds.*

---

## 🛠️ Method 2: Manual Step-by-Step Setup

If you prefer running the commands manually via terminal:

### 1. Open Terminal in the Project Folder
Open PowerShell or Command Prompt in the project folder:
```powershell
cd "C:\PharmacyApp"
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
Ensure `.env` contains:
```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="pharmacy-local-secret-key-salt-9823471029384710293847"
COOKIE_SECURE="false"
PORT=3000
```
*(Keep `COOKIE_SECURE="false"` because local Wi-Fi operates over HTTP).*

### 3. Install Dependencies
```powershell
npm install
```

### 4. Initialize Database & Seed
```powershell
npx prisma db push
npx prisma db seed
```

*(Optional: If you want to load the complete 25,000+ medicine catalog from the included dataset):*
```powershell
node scripts/import-medex-to-db.mjs
```

### 5. Build & Start Production Server
```powershell
npm run build
npm start
```
The server is now live at `http://localhost:3000`.

---

## 📶 Step 4: Allow Wi-Fi Connections (Windows Firewall)

To allow staff phones on the pharmacy Wi-Fi to open the system, open port `3000` in the Windows Firewall:

1. Right-click the Windows Start menu and select **Terminal (Admin)** or **PowerShell (Run as Administrator)**.
2. Paste and run this command:
```powershell
New-NetFirewallRule -DisplayName "Pharmacy System (Port 3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```
3. Press **Enter**. You will see `Rule status: OK`.

---

## 📱 Step 5: Connect Staff Mobile Phones

1. Connect the staff member's mobile phone to the **Pharmacy Wi-Fi router**.
2. Find the server PC's Local IP address:
   - In PowerShell, run: `ipconfig` (look for `IPv4 Address`, e.g., `192.168.1.100`).
   - Or on the server PC browser, log in to `http://localhost:3000/admin/settings` to see the IP and live QR code.
3. On the phone's browser (Chrome or Safari), visit:
   ```text
   http://192.168.1.100:3000
   ```
   *(Replace `192.168.1.100` with the actual server IP, or simply scan the QR code).*
4. **Install App on Phone (1-Tap Access):**
   - Tap the **"Install App"** banner at the top of the mobile screen.
   - Or tap the browser menu (⋮) → **"Add to Home screen"** / **"Install"**.
   - A dedicated app icon will appear on the phone's home screen.

---

## 🔑 Default Login Credentials

| Role | Employee ID | Password / PIN | Access Level |
| :--- | :--- | :--- | :--- |
| **Administrator** | `ADMIN` | `admin123` | Full control: Dashboard, Shortages, Medicines, Employees, Backup, Print |
| **Staff Member** | `EMP001` | `1234` | Rahim Ahmed (Staff entry) |
| **Staff Member** | `EMP002` | `1234` | Karim Uddin (Staff entry) |
| **Staff Member** | `EMP003` | `1234` | Hasan Mahmud (Staff entry) |
| **Staff Member** | `EMP004` | `1234` | Jamal Hossain (Staff entry) |

> 🔒 **Security Tip:** Immediately log in to `/admin/employees` on the client PC to change default passwords and add actual pharmacy employees.

---

## 🖥️ Step 6: Create Desktop Shortcut for Client

To make starting the server effortless for pharmacy staff:

1. In the project folder, right-click `start-server.bat`.
2. Click **Show more options** → **Send to** → **Desktop (create shortcut)**.
3. Go to the Windows Desktop, right-click the shortcut, and rename it to:
   ```text
   Bara-Awlia Medical Hall - Start Server
   ```
4. *(Optional)* Right-click the shortcut → **Properties** → **Change Icon** → browse to `public/favicon.ico` or any pharmacy icon.

Every morning, the client just double-clicks this desktop shortcut to launch the pharmacy server!

---

## 🔄 Daily Pharmacy Workflow

### Morning (Start of Day)
1. Turn on the PC and connect to the pharmacy Wi-Fi router.
2. Double-click the **Start Server** shortcut on the desktop.
3. Staff open the app from their phone home screens.

### During the Day
- Staff search and report out-of-stock items in 5–10 seconds.
- Staff can edit or remove their own reports from today.
- Admin views consolidated medicine quantities on `/admin` or `/admin/shortages`.

### Evening (End of Day / Ordering)
1. Admin visits `/admin/print` to print the A4 shortage purchase list or export CSV.
2. Admin visits `/admin/settings` and clicks **"Backup Database"** to save a timestamped backup to PC/USB.
3. Close the server terminal window when closing the pharmacy.

---

## ❓ Troubleshooting & FAQs

### 1. Phones cannot open `http://<IP>:3000` ("Site can't be reached")
- **Cause 1:** Phone is not connected to the pharmacy Wi-Fi router (e.g. phone is on mobile data). Connect the phone to the exact same Wi-Fi.
- **Cause 2:** Windows Firewall is blocking incoming traffic. Re-run the PowerShell firewall command from **Step 4**.
- **Cause 3:** The PC's Wi-Fi network profile is set to "Public" instead of "Private". Go to Windows Settings → Network & Internet → Wi-Fi → set network profile to **Private network**.

### 2. The Server PC's IP address changed after router reboot
- In the router settings (usually `192.168.1.1`), navigate to **DHCP Reservation** or **Static IP Binding** and assign a permanent IP to the server PC's MAC address.
- Alternatively, assign a Static IP in Windows Network Adapter Settings.

### 3. How to restore from a backup
1. Stop the server (`Ctrl + C` in the terminal).
2. Go to the `backup/` folder and copy your desired backup file (e.g. `pharmacy-2026-09-17-025733.db`).
3. Paste it into the `prisma/` folder and rename it to `dev.db` (overwrite existing).
4. Restart the server via `start-server.bat`.

### 4. Can the system start by itself after a power cut or PC restart?
Yes — install the optional 24/7 auto-start once, from an **Administrator** PowerShell:

```powershell
cd C:\PharmacyApp
npm run autostart
```

This registers two Windows tasks that start at **every boot** without anyone logging in:

| Task | Purpose |
| :--- | :--- |
| `BMH Pharmacy Server` | web app on port `3000` |
| `BMH Pharmacy Tunnel` | keeps the ngrok public internet link online |

They have no time limit, do **not** stop when the PC is idle, and restart the server/tunnel automatically if they crash. Check them any time with:

```powershell
Get-ScheduledTask -TaskName "BMH Pharmacy *" | Format-Table TaskName, State
```

To remove the auto-start: `npm run autostart:remove`. Full details are in section **6a** of [README.md](README.md).

### 5. The public ngrok link shows "ERR_NGROK_3200 - endpoint is offline"
That message only means the tunnel process is not running on the server PC:
- **With 24/7 auto-start installed:** check the task is alive (command above) and read `logs\tunnel.log`. Also make sure the PC has an internet connection.
- **Without auto-start:** start it manually on the server PC with `npm run tunnel` (or `scripts\tunnel.bat`) and leave that window open.
- The public URL itself never changes, so you never need to share a new link.

### 6. Where are the log files?
| File | Contents |
| :--- | :--- |
| `logs\server.log` | Web server output (auto-rotated at ~5 MB) |
| `logs\tunnel.log` | ngrok tunnel output: the public URL plus every reconnect/restart |

### 7. Does the pharmacy still work without internet?
Yes. The local Wi-Fi app (`http://<server IP>:3000`) is completely offline and keeps working with no internet at all. Only the optional public ngrok link (accessed from outside the pharmacy) needs internet.
