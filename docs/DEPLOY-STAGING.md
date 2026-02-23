# 1. lépés: Web app deploy (staging – Vercel)

A web appot Vercelre tesszük ki, hogy ne localhoston, hanem egy stabil linken legyen elérhető (játékosok, edzők, később mobil is ugyanazt a backendet használja). Ez a **staging** környezet.

---

## Előfeltételek

- A projekt kódja **Git**-ben van (akár csak lokálisan).
- Van **GitHub** (vagy GitLab) fiókod, és a repo fel van töltve.
- **Supabase** projekt már kész, táblák + RLS megvannak.

---

## 1. lépés: Kód feltöltése GitHubra (ha még nincs)

1. A projekt mappájában nyisd a terminált.
2. Ha még nincs git repo:
   ```bash
   git init
   ```
3. **Fontos:** a `.env.local` ne kerüljön fel. Ellenőrizd, hogy a `.gitignore` tartalmazza:
   ```
   .env*
   .env
   ```
4. Commit + push (cseréld a repo URL-t a sajátodra):
   ```bash
   git add .
   git commit -m "Prepare for staging deploy"
   git remote add origin https://github.com/FELHASZNALONEVED/repo-neve.git
   git push -u origin main
   ```
   Ha a branch neved `master`, akkor `master`-t használj.

---

## 2. lépés: Vercel fiók és projekt import

1. Menj a **https://vercel.com** oldalra, jelentkezz be (pl. GitHub fiókkal).
2. Kattints **Add New…** → **Project**.
3. **Import Git Repository:** válaszd ki a **st-ams** (vagy a repo neved) repót. Ha nem látszik, kapcsold össze a GitHubot a Vercellel (Configure GitHub App).
4. **Project Name:** maradhat `st-ams` vagy adj neki egy nevet (pl. `st-ams-staging`).
5. **Framework Preset:** Vercel automatikusan felismeri a Next.js-t, ne változtasd.
6. **Root Directory:** hagyd üresen (ha a Next.js app a gyökérben van).
7. **Build and Output Settings:** hagyd az alapértelmezettet (`npm run build`, `next build`).

---

## 3. lépés: Környezeti változók (Environment Variables)

A **Vercel project** beállításainál (import előtt vagy után) add hozzá a **Environment Variables** szekcióban a következőket. Mind a **Production**, mind a **Preview** (staging) környezethez add meg:

| Name | Value | Megjegyzés |
|------|--------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | A Supabase Project URL (ugyanaz, mint a .env.local-ban). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | A Supabase anon (public) kulcs. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | A Supabase service_role secret (Játékos hozzáadása miatt kell). |

- Ne pipáld be a **"Expose to Browser"** opciót a `SUPABASE_SERVICE_ROLE_KEY`-nál (csak szerveren használjuk).
- A másik kettő (`NEXT_PUBLIC_...`) nyilvános lehet, azt a Vercel általában automatikusan böngészőnek is megadja.

---

## 4. lépés: Deploy indítása

1. Kattints a **Deploy** gombra.
2. Várd meg a build végét (1–2 perc). Ha sikeres, kapsz egy URL-t, pl. `https://st-ams-xxx.vercel.app`.
3. Ha piros hiba van: nyisd meg a **Build Logs**-t, másold ki a hibaüzenetet és javítsuk.

---

## 5. lépés: Supabase Auth redirect URL beállítása

A bejelentkezés csak akkor működik a Vercel URL-en, ha a Supabase tudja, hogy oda szabad redirectelni.

1. Supabase Dashboard → **Authentication** → **URL Configuration** (vagy **Settings** → **Auth**).
2. **Redirect URLs** mezőhöz add hozzá (cseréld a saját Vercel domainre):
   - `https://st-ams-xxx.vercel.app/**`
   - `https://st-ams-xxx.vercel.app/auth/callback`
3. **Site URL**-t állítsd át (opcionális, de ajánlott) staginghez: `https://st-ams-xxx.vercel.app`.
4. Mentsd a beállításokat.

---

## 6. lépés: Tesztelés stagingen

1. Böngészőben nyisd meg a Vercel URL-t (pl. `https://st-ams-xxx.vercel.app`).
2. Át kell irányítania a login oldalra.
3. Jelentkezz be a meglévő admin (vagy játékos) adataiddal.
4. Ellenőrizd: Dashboard, Wellness, RPE, Users (adminként) – mind működik.
5. Ha a játékos hozzáadása is kell: Users → Játékos hozzáadása → teszt email + jelszó → sikeres létrehozás.

---

## Összefoglalva

- **1. lépés** = kód GitHubon.
- **2. lépés** = Vercel projekt import, env változók (URL + anon + service_role key).
- **3. lépés** = Env változók beírása.
- **4. lépés** = Deploy.
- **5. lépés** = Supabase Auth redirect URL + (opcionálisan) Site URL.
- **6. lépés** = Bejelentkezés és funkciók tesztelése a staging URL-en.

Ha ezzel megvagy, a **2. lépés** (mobil projekt váz, architektúra szerint) következik, ugyanazzal a Supabase backenddel.
