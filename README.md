# Freezer Inventory (Netlify version)

No server to keep running, no terminal window to leave open. This deploys
as a static site + serverless function on Netlify, with the data itself
stored in Netlify Blobs (Netlify's built-in storage — no separate database
to set up).

## One-time setup

1. **Push this folder to GitHub**
   ```
   cd freezer-inventory-netlify
   git init
   git add .
   git commit -m "Freezer inventory"
   ```
   Then create a new (empty) repo on GitHub and follow the "push an
   existing repository" instructions it gives you.

2. **Connect it to Netlify**
   - In Netlify: "Add new site" → "Import an existing project" → pick the
     GitHub repo you just made.
   - Build settings: leave everything as detected — `netlify.toml`
     already tells Netlify where the functions and the static files are,
     so there's no build command to configure.
   - Deploy.

3. **That's it.** Netlify gives you a URL like
   `https://your-site-name.netlify.app`. That's your permanent address —
   always on, no PC or Pi required.

## Generating the door stickers

Once deployed, make QR codes for:
- `https://your-site-name.netlify.app/freezer1`
- `https://your-site-name.netlify.app/freezer2`

These work from anywhere with internet, not just at home — no VPN needed.

## Making future changes

Any time you (or I) update the code, just push to GitHub — Netlify
redeploys automatically. No redeploy steps to remember.

## Renaming the site / custom domain

By default Netlify gives you a random-ish subdomain. You can rename it
(or point a domain you own at it) from Site settings → Domain management
if `your-site-name.netlify.app` isn't the address you want on a sticker.

## Local testing (optional)

If you want to test on your laptop before pushing:
```
npm install
npx netlify dev
```
This runs the whole thing locally, including an emulated version of
Netlify Blobs, at whatever local address it prints.
