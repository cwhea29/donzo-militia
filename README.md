# 🎮 Donzo Militia — GTA V Operations Map

A real-time, access-level-gated GTA V location database for the Donzo Militia org.
Built for GitHub Pages with Firebase Firestore for live sync across all devices.

---

## 📁 File Structure

```
/
├── index.html              ← Login page
├── map.html                ← Main map page
├── instructions.html       ← Map guide
├── crafting.html           ← Crafting reference
│
├── css/
│   ├── main.css            ← Shared styles (nav, variables, components)
│   ├── login.css           ← Login page styles
│   ├── map.css             ← Map page styles
│   └── pages.css           ← Instructions & crafting styles
│
├── js/
│   ├── config.js           ← ⚠️ EDIT THIS — Firebase config + constants
│   ├── auth.js             ← Login, logout, session management
│   ├── db.js               ← Firestore database operations
│   ├── nav.js              ← Navigation bar (injected on all pages)
│   └── map.js              ← Map logic (pan, zoom, markers, popup)
│
├── images/
│   ├── maps/               ← Your 6 map background images go here
│   │   └── README.md       ← Filenames required
│   └── locations/          ← Location popup images go here
│       └── README.md
│
└── DM_2.png                ← Your org logo
```

---

## 🚀 Setup (One-Time)

### Step 1 — Create a Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → name it (e.g. `donzo-militia-map`)
3. Disable Google Analytics (not needed) → Create project

### Step 2 — Set Up Firestore
1. In your project, click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Choose **"Start in test mode"** → select a region → Enable
4. *(Optional but recommended later: update the Security Rules)*

### Step 3 — Register Your Web App
1. On the project overview, click the **`</>`** (Web) icon
2. Name your app → Register
3. Copy the `firebaseConfig` object shown

### Step 4 — Update `js/config.js`
Paste your Firebase config into the `firebaseConfig` object at the top of `js/config.js`.

### Step 5 — Add Your First Commander User
1. In the Firebase Console, go to **Firestore Database**
2. Click **"Start collection"** → Collection ID: `users`
3. Click **"Auto-ID"** for the document → Add these fields:

| Field         | Type   | Value            |
|---------------|--------|------------------|
| `username`    | string | `commander`      |
| `password`    | string | `yourpassword`   |
| `displayName` | string | `Commander`      |
| `accessLevel` | number | `4`              |

4. Save. You can now log in and use the **👥 Users** panel to add all other members.

### Step 6 — Deploy to GitHub Pages
1. Push all files to your GitHub repo
2. Go to **Settings → Pages** → Source: `main` branch → Save
3. Your site will be live at `https://yourusername.github.io/reponame/`

---

## 👥 Access Levels

| Level | Name        | Can View                              | Can Add Markers | Can Delete | User Management |
|-------|-------------|---------------------------------------|-----------------|------------|-----------------|
| 1     | Recruit     | Public locations                      | ✗              | ✗          | ✗              |
| 2     | Operative   | Public + Restricted                   | ✗              | ✗          | ✗              |
| 3     | Lieutenant  | Public + Restricted + Confidential    | ✓              | Own only   | ✗              |
| 4     | Commander   | ALL locations (incl. Top Secret)      | ✓              | Any        | ✓              |

---

## 🗺️ Map Images

See `images/maps/README.md` for required filenames.

---

## 🖼️ Location Images

Place any location popup photos in `images/locations/` and reference them by filename only when adding a marker.

---

## 🔒 Firestore Security Rules (Recommended)

Once set up, replace the test rules in Firebase with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read on users for login check
    match /users/{doc} {
      allow read: if true;
      allow write: if false; // Only via Firebase Console
    }
    // Allow all reads/writes on markers
    match /markers/{doc} {
      allow read, write: if true;
    }
  }
}
```

> For tighter security, consider Firebase Authentication integration.

---

## ✏️ Adding Crafting Content

Open `crafting.html` and find the `tab-panel` section for the category you want to fill.
Look for the `<!-- CONTENT GOES HERE -->` comment and add cards, tables, or tip boxes
using the component classes from `css/pages.css`.

---

*Donzo Militia Operations Map — Built for GitHub Pages + Firebase*
