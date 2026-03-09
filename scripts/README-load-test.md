# Load test (20+ játékos)

Ellenőrzi, hogy az app 20+ egyidejű felhasználó mellett is stabil marad.

## Futtatás

1. **Locálisan** (a dev szerver fut: `npm run dev`):
   ```bash
   npm run test:load
   ```
   Alapértelmezetten 25 párhuzamos kérés × 3 forduló a `/api/health` felé (DB + auth kapcsolat).

2. **Környezetváltozók**:
   - `BASE_URL` – pl. `https://your-app.vercel.app` (éles teszt)
   - `CONCURRENT` – szimulált felhasználók száma (default: 25)
   - `ROUNDS` – hány forduló (default: 3)

   Példa:
   ```bash
   CONCURRENT=30 ROUNDS=5 BASE_URL=https://st-ams.vercel.app npm run test:load
   ```

3. **Eredmény**: Ha minden kérés sikeres, a script 0-kódot ad. Ha bármi hibás, 1-et és a hibákat kiírja.

## Mit mér?

- **/api/health**: Supabase DB lekérdezés + auth hívás – ha ez 25× párhuzamosan stabil, a backend kapacitása rendben.
- A valódi dashboard/wellness használat hiteles teszteléséhez 20+ tesztfelhasználó és bejelentkezés kellene (pl. k6 + session cookie).
