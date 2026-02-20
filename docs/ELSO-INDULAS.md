# ST App – Első indulás (lépésről lépésre)

Ez az első appod, ezért mindent lépésről lépésre írok. Cél: a böngészőben megnyitod az appot, bejelentkezel, és működik a wellness űrlap.

---

## Mi kell hozzá?

1. **Supabase fiók** (ingyenes) – itt tárolódik a bejelentkezés és a wellness adat.
2. **Node.js** – már van a gépeden (a projekt miatt).
3. **Két fájl** a projektben: `.env.local` és a kód (ez már megvan).

---

## 1. lépés: Supabase fiók és projekt

1. Menj a **https://supabase.com** oldalra.
2. Kattints **Start your project** (vagy Sign in).
3. Jelentkezz be **GitHub**-bal (vagy email/jelszó).
4. Kattints **New project**.
5. Töltsd ki:
   - **Name:** pl. `st-app`
   - **Database password:** találj ki egy erős jelszót, **írd le magadnak** (később kell).
   - **Region:** válassz egy közeli régiót (pl. Frankfurt).
6. Kattints **Create new project**.
7. Várd meg, amíg a projekt felépül (1–2 perc). Ha kész, látni fogod a projekt irányítópultját.

---

## 2. lépés: Az app „jelszava” másolása Supabase-ból

Az appnak tudnia kell, hogy a *te* Supabase projektedhez kapcsolódjon. Ehhez két dolgot kell kimásolni.

1. A Supabase bal oldali menüjében kattints a **fogaskerék ikonra** (⚙️) → **Project Settings**.
2. Bal oldalon kattints **API**.
3. Ezen az oldalon látni fogod:
   - **Project URL** – egy link, pl. `https://xxxxx.supabase.co`
   - **Project API keys** alatt az **anon public** kulcs – egy hosszú szöveg, ami `eyJ...`-tal kezdődik.

**Másold ki** (egyszerre egyet):
- a **Project URL**-t (Copy gomb mellette),
- az **anon public** kulcsot (Copy gomb mellette).

---

## 3. lépés: A projekt mappádban lévő .env.local fájl megnyitása

1. Nyisd meg a **Cursor**-t (vagy a kódszerkesztőt).
2. A bal oldali fájl listában menj a **st-app** mappába (a projekt gyökere).
3. Kattints a **.env.local** fájlra.  
   (Ha nem látod: lehet, hogy rejtett fájl. A Cursor-ban általában megjelenik.)

A fájlban valami ilyesmi van (vagy üres):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

4. **Írd be** a másolt értékeket így (idézőjel nélkül, nincs szóköz a `=` után):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

- Az első sor végén **a te Project URL-ed** legyen.
- A második sor végén **a te anon public kulcsod** legyen (az egész hosszú szöveg).

5. **Mentsd** a fájlt (Ctrl+S).  
   Fontos: ez a fájl titkos adatot tartalmaz, **soha** ne töltsd fel sehova (pl. GitHub) és ne oszd meg senkivel.

---

## 4. lépés: Táblák létrehozása Supabase-ban (egy kattintással)

Az appnak kell egy „táblázat” a felhasználóknak, egy a wellness adatoknak, egy az edzéseknek. Ezt egy SQL szkripttel hozod létre.

1. A Supabase bal menüjében kattints **SQL Editor**.
2. Kattints **New query** (új lekérdezés).
3. Nyisd meg a **saját gépeden** a projektben a fájlt:  
   **st-app** → **supabase** → **schema.sql**
4. Nyisd meg a **schema.sql** fájlt a Cursor-ban, nyomd meg **Ctrl+A** (mindent kijelöl), majd **Ctrl+C** (másolás).
5. Válts vissza a **Supabase SQL Editor** ablakra, illeszd be a másolt szöveget (Ctrl+V).
6. Kattints lent a **Run** (vagy F5) gombra.
7. Ha minden rendben, alul zöld üzenet jelenik meg (pl. „Success. No rows returned”).  
   Ha piros hiba van: másold ki a hibaüzenetet és kérj segítséget (pl. engem), és add meg a szöveget.

Ezzel létrejöttek a táblák és a jogosultságok (játékos csak a saját adatát látja, te és az edzők mindent).

---

## 5. lépés: Első felhasználó (te = admin) létrehozása

Ehhez két dolgot kell csinálni: egy usert az „bejelentkező rendszerben”, és egy sort a „szerepkör” táblában, hogy az app tudja: te vagy az admin.

### 5a) User a bejelentkezéshez

1. Supabase bal menü: **Authentication** → **Users**.
2. Kattints **Add user** → **Create new user**.
3. Írd be:
   - **Email:** a saját email címed (amivel be akarsz lépni az appba).
   - **Password:** egy jelszó (jegyezd meg).
4. Kattints **Create user**.
5. A listában megjelenik az új user. Kattints rá. Látni fogod az **User UID**-t (hosszú azonosító, pl. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`). **Másold ki** ezt az UID-t.

### 5b) Megmondani az appnak, hogy te vagy az admin

1. Supabase bal menü: **SQL Editor** → **New query**.
2. Írd be pontosan ezt (és **cseréld ki** a két helyet a saját adataidra):

```sql
INSERT INTO public.users (id, email, role)
VALUES ('IDE_IRD_A_USER_UID_T', 'IDE_IRD_A_SAJAT_EMAILEDET', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
```

Példa (te ne ezt másold, a saját UID-od és email-ed legyen benne):

```sql
INSERT INTO public.users (id, email, role)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'en@example.com', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
```

3. Kattints **Run**.  
   Ha sikerült, alul „Success” üzenet jelenik meg.

---

## 6. lépés: Az app futtatása a gépeden

1. Nyisd meg a **terminált** (Cursor-ban: Terminal → New Terminal, vagy a projekt mappáját nyisd meg a parancssorban).
2. Írd be (Enter):

   ```
   cd c:\Users\berde\st-app
   ```

3. Utána:

   ```
   npm run dev
   ```

4. Várd meg, amíg megjelenik valami ilyesmi: `Local: http://localhost:3000`.
5. Nyisd meg a **böngészőt** (Chrome, Edge, stb.) és a címsorba írd: **http://localhost:3000** (Enter).

---

## 7. lépés: Bejelentkezés az appban

1. Az app átirányít a **bejelentkezési** oldalra.
2. Írd be:
   - **Email:** ugyanaz, amit a Supabase-ban adtál meg (5a lépés).
   - **Password:** ugyanaz a jelszó.
3. Kattints **Sign in**.
4. Ha minden jó, belépsz és megjelenik a **Dashboard**.  
   A bal oldali menüből elérhető: Dashboard, Wellness, RPE; adminként később a Users is.

---

## Összefoglalva – mi történt?

- **Supabase** = a „háttér”: itt tárolódik ki vagy bejelentkezve, és a wellness/edzés adat.
- **.env.local** = az app így tudja, melyik Supabase projekthez csatlakozzon (URL + kulcs).
- **schema.sql** = létrehozza a táblákat és a szabályt: játékos csak a saját adatát látja, te (admin) és az edzők mindent.
- **Users tábla + admin sor** = az app így tudja, hogy te admin vagy, és láthatsz mindent, kezelheted a usereket.

Ha valahol elakadsz, írd meg pontosan:
- melyik lépésnél (pl. „4. lépés, Run után”),
- és mit látsz (pl. piros hiba szövege, vagy „nem tudok bejelentkezni”).

Akár egy képernyőképet is beilleszthetsz a hibaüzenetről.
