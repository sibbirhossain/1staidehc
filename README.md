# 1st Aide Home Care — PCA Master System

A fully self-contained web system for managing PCA members. No backend required — runs entirely in the browser and deploys to GitHub Pages or Netlify with drag & drop.

## Features
- ✅ Import Excel (.xlsx) or Google Sheets live link
- ✅ Add / Edit / Delete members
- ✅ Move members between Active and Left/Dead
- ✅ Comment system with per-member history
- ✅ Filter by MLTC, Marketer, Hiring Status
- ✅ Reports: expiring auth, hiring pending, by MLTC, by Marketer
- ✅ Full Audit Log — every edit tracked with user name + timestamp
- ✅ CSV export
- ✅ Responsive design, works on mobile

## Data Persistence
All data is stored in the browser's `localStorage`. Data persists across sessions on the same browser/device.

## Deploy to Netlify (Drag & Drop)
1. Go to https://netlify.com → Log in
2. Click **"Add new site" → "Deploy manually"**
3. Drag the entire `pca-system` folder onto the upload area
4. Your site is live in seconds — copy the URL

## Deploy to GitHub Pages
1. Create a new GitHub repository
2. Upload all files in `pca-system/` to the repo root
3. Go to Settings → Pages → Source: **main branch / root**
4. Your site will be at `https://YOUR-USERNAME.github.io/REPO-NAME/`

## Using Google Sheets / Drive Link
1. Open your Google Sheet
2. **File → Share → Publish to web**
3. Select the sheet → Format: **CSV** → Click **Publish**
4. Copy the generated CSV link
5. In the app → **Import → Google Sheets / Drive Link** → Paste & Load

## Sheets Required
Your Excel file should have two sheets named (case-insensitive):
- `Active PCA Members` — for active members
- `LeftDead Members` (or any name containing "left" or "dead") — for former members

Both sheets need a header row with these columns:
`S.NO, LAST NAME, FIRST NAME, DOB, ADDRESS, AIDE NAME, Medicaid ID, MLTC-CONTRACT, CONTACT, COMMENT, Start Date, AUTH START DATE, SCHEDULE, WEEKLY HOURS, ICD-10, AUTH EXP DATE, MARKETER, HIRING STATUS`

## Technology
- Pure HTML + CSS + JavaScript (no frameworks, no build step)
- [SheetJS (xlsx.js)](https://sheetjs.com/) for Excel parsing
- Google Fonts for typography
- Data stored in browser localStorage
