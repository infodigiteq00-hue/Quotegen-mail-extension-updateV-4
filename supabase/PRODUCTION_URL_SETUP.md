# Production URL setup (Vercel + Supabase)

Live app: **https://quotegen-mail-extension-update-v-4.vercel.app/**

## 1. Supabase → Authentication → URL Configuration

| Field | Value |
|--------|--------|
| **Site URL** | `https://quotegen-mail-extension-update-v-4.vercel.app/` |
| **Redirect URLs** | `https://quotegen-mail-extension-update-v-4.vercel.app/*` |
| (optional, local dev) | `http://localhost:8080/*` |

Click **Save changes**.

## 2. Supabase → Edge Functions → Secrets

Add or update:

```
APP_URL=https://quotegen-mail-extension-update-v-4.vercel.app
```

Then **redeploy** the `send-invite` function (Dashboard → Edge Functions → send-invite → Deploy).

Invite emails use this for links like `/accept-invite?token=...`.

## 3. Vercel → Project → Settings → Environment Variables

For **Production** (and Preview if needed):

- `VITE_SUPABASE_URL` = `https://ghvgppvrmnmtwprasimm.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = your Supabase **anon** key

Redeploy after changing env vars.

## 4. Redeploy checklist

1. Push code (includes `vercel.json` SPA rewrites for `/accept-invite`, `/login`, etc.)
2. Vercel redeploy
3. Supabase `APP_URL` secret + `send-invite` redeploy
