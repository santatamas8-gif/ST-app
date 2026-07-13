# ST App – szerepkörök és felállítás

Az app a **profiles** táblát használja (Supabase-ben): id, email, role, created_at.

## Szerepkörök

| Szerepkör | Ki | Mit lát / csinál |
|-----------|-----|------------------|
| **admin** | Te | Összesítés (minden játékos wellness + RPE), Users oldal, játékosok hozzáadása. |
| **staff** | Edzői stáb | Összesítés (minden játékos adata). Users oldal nincs. |
| **player** | Játékosok | **Csak a saját** wellness és RPE adatukat látják, telefonról töltik ki a napi űrlapot. |

- Játékosokat **csak te (admin)** adhatod hozzá az apphoz (pl. fake email).
- Admin és staff látja az **összesítést** (dashboard, wellness, RPE mindenkitől).
- Játékosok **csak a sajátjukat** látják.

## Admin/staff jogok (RLS) – összesítés

Ha már megvan a `profiles`, `wellness`, `sessions` tábla, futtasd a **supabase/add-admin-staff-policies.sql** fájlt a Supabase SQL Editorban. Ez beállítja, hogy admin és staff minden adatot lásson, player csak a sajátját.

## Első admin user

1. Supabase Dashboard → **Authentication** → **Users** → **Add user** (a saját email + jelszó).
2. Másold ki a létrehozott user **UUID**-ját.
3. SQL Editor → futtasd (cseréld a placeholder-eket):

```sql
INSERT INTO public.profiles (id, email, role)
VALUES ('IDE_A_UUID', 'te@email.com', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
```

## Játékos hozzáadása (admin)

**Az appból (ajánlott):** Jelentkezz be adminként → **Users** → „Játékos hozzáadása” kártya → add meg az email és jelszót → „Játékos hozzáadása”. A játékos ezzel az email/jelszóval tud belépni. Ehhez a `.env.local`-ban kell legyen a **SUPABASE_SERVICE_ROLE_KEY** (Supabase → Project Settings → API → service_role secret).

**Supabase-ból (alternatíva):**

1. Supabase Dashboard → **Authentication** → **Users** → **Add user** (pl. fake email: `jatekos1@club.hu`, jelszó).
2. Másold ki az új user **UUID**-ját.
3. SQL Editor:

```sql
INSERT INTO public.profiles (id, email, role)
VALUES ('AZ_ÚJ_JÁTÉKOS_UUID', 'jatekos1@club.hu', 'player')
ON CONFLICT (id) DO UPDATE SET role = 'player', email = EXCLUDED.email;
```

Ezután a játékos be tud lépni ezzel az email/jelszóval és csak a saját adatait látja.

## Staff (edző) hozzáadása

Ugyanígy mint játékos, de `role = 'staff'`:

```sql
INSERT INTO public.profiles (id, email, role)
VALUES ('EDZŐ_UUID', 'edzo@club.hu', 'staff')
ON CONFLICT (id) DO UPDATE SET role = 'staff', email = EXCLUDED.email;
```
