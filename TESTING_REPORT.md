# MyVilla — End‑to‑End Test Report

**Tester:** QA (automated end‑user simulation)
**Date:** 2026‑07‑13
**Build:** local `main`, Next.js dev server on `:3000`, PostgreSQL (Docker `myvilla-pg`, port 5433)
**Method:** Real browser automation (Chrome via `puppeteer-core`, headless) driving the app as an end user — signup → search → booking → payment → account → host tools. Every page was instrumented to capture JS exceptions, console errors and failed network requests. Findings that looked like bugs were re‑verified and, where useful, cross‑checked against the database before being reported.

**Seed logins used:** `tatiana@myvilla.com` (host) and `alena@myvilla.com` / `rachiel@myvilla.com` (guests) — all password `myvilla123`.

---

## 1. Executive summary

The application is in **good shape**. The full guest journey (register → search → filter → villa → book → pay → confirm → manage → cancel) and the host tools (properties, rent requests, packages) all work, and **all 11 public pages load with zero JavaScript/console errors**.

Testing found **2 genuine defects**:

| ID | Severity | Area | One‑line |
|----|----------|------|----------|
| **BUG‑1** | **High** | Profile settings | Emergency contact **cannot be saved** in Profile Settings — the country code is wiped the instant it is selected, so every number is rejected as "needs a country code". |
| **BUG‑2** | **Low** | My Bookings | A **completed *package* stay** shows "Completed" but offers **no "Rate your stay"** prompt (only nightly stays can be reviewed). |

No other functional bugs were found. Several other things that *looked* wrong during automated runs turned out to be test‑harness artifacts and are explicitly noted in §4 so they are not re‑investigated.

---

## 2. Defects (detail)

### 🔴 BUG‑1 — Emergency contact is unsaveable in Profile Settings (High)

**Where:** `Profile` page (`/profile`) → *Emergency Contact* → **Add/Edit**.
**Component:** `src/components/account/ProfileSettings.tsx` (+ `src/components/ui/PhoneNumberInput.tsx`).

**Steps to reproduce (as a user):**
1. Sign in, go to **Profile**.
2. Click **Add** (or **Edit**) next to *Emergency Contact*.
3. Open the country‑code dropdown and pick e.g. **India (+91)**.
4. Notice the dropdown **snaps back to "Code"** (the selection doesn't stick).
5. Type a valid number (e.g. `9876543210`) and click **Apply Changes**.
6. ❌ You get **"Enter a valid emergency contact number with its country code."** — and the field stays **"Not Provided"**. There is no way to save an emergency contact from this screen.

**Verified:** Automation selected `+91` and read the select value back as `""` **immediately, before any number was typed** — i.e. the code is wiped by the act of selecting it. After Apply, the DB value remained empty and the row still showed "Not Provided".

**Root cause:** `PhoneNumberInput`'s code‑select `onChange` fires **both** callbacks in the same event:
```js
onCode(next);
onNumber(capPhoneNumber(number, next));
```
`ProfileSettings` wires them to a single combined updater using state captured at render time:
```js
onCode={(c) => setEmergency(c, emgNumber)}     // sets emgCode = "+91"
onNumber={(n) => setEmergency(emgCode, n)}      // re-sets emgCode = "" (STALE closure)
```
Because both run in one batched render, the second call (`onNumber`) recombines with the **stale `emgCode` ("")** and overwrites the code that `onCode` just set. Net effect: the country code can never be set, and the number‑only value fails the "must have a country code" validation.

**Scope / not affected:** This is **specific to Profile Settings**. The same `PhoneNumberInput` is used at signup (`GuestDetailsForm`) and in the host "Add Villa" wizard (`HostWizard`), and both wire it to **separate** setters (`onCode={setEmgCode}`, `onNumber={setEmgNumber}`) — those have independent state and were verified to work. So a guest *can* set an emergency contact at signup; they just can't edit/add it later from Profile.

**Suggested fix (for reference — not applied):** In `ProfileSettings`, give the emergency editor independent `code`/`number` state (like the other two forms) and derive the combined `"+CC number"` on Apply, instead of recombining inside each keystroke/selection handler.

---

### 🟡 BUG‑2 — Completed package stays can't be reviewed (Low)

**Where:** `My Bookings` (`/profile/bookings`) → **Package stays** section.
**Component:** `src/components/account/MyBookings.tsx`.

**Observation:** Nightly stays whose checkout has passed correctly show a **"Rate your stay"** star widget (verified — a review was submitted successfully end‑to‑end). Package stays render in their own section, which shows the **"Completed"** status but has **no `StarRater`** — only an accepted‑status "Cancel Booking" link. So once a package stay is over, the guest has no way to rate it.

**Root cause:** In `MyBookings.tsx`, the `StarRater` is rendered only in the nightly history list (≈ line 271). The `packageStays.map(...)` block (≈ line 293) renders status + inclusions but no rating control. The backend `rateStayAction` already permits rating a completed stay regardless of package — the gap is purely the missing UI.

**Impact:** Low — package review counts never accrue from completed package stays. Not blocking.

---

## 3. Coverage — verified working ✅

Everything below was exercised through the real UI and passed.

**Platform**
- All public pages return HTTP 200 with **no JS exceptions or console errors**: `/`, `/search`, `/packages`, `/promotions`, `/help`, `/about`, `/terms`, `/blog`, `/login`, `/register`, `/recover`.

**Auth**
- Registration validation: password mismatch, weak (<8‑char) password, and too‑short phone number are all **rejected** with the form staying put.
- Valid registration **succeeds** and lands on the welcome flow; the guest‑details form renders and accepts input.
- Login works for both guest and host; auth‑gated pages (`/profile`, `/welcome/guest`) redirect to login when signed out.

**Search & filters**
- Results render; **whole villa card is clickable** (stretched link present).
- **Real‑time text query** updates results + URL (`?q=`).
- **Price minimum** filter applies (`?min=`).
- **Amenities are data‑driven** — only amenities that a listed property actually offers appear (5 real chips shown, not the full hard‑coded 9); toggling applies `?amenities=`.
- **Clear all filters** resets the URL to `/search`.

**Villa detail & booking**
- Villa page shows **real review data** (e.g. 4.33 / 3 reviews) — the old dummy `4.69 / 32` is gone.
- Nightly booking: **Reserve → payment → "Booking confirmed"** works end‑to‑end (ref generated, e.g. `MV‑0000xx`).
- Confirmation page **"Back to Home" is a proper button** (bordered), matching the other actions.
- **Own‑booking reassurance**: re‑opening your own checkout shows "Your stay is confirmed".
- **Double‑booking prevention**: a second guest attempting the same dates is blocked.

**Payment validation**
- Submitting with empty fields surfaces **all 9 field errors** and **scrolls to + focuses the first invalid field** (the card number).
- **Past card expiry is rejected** ("Card has expired — enter a valid future expiry date.").
- Invalid email format is rejected.
- **Cancellation Policy** text is present and the placeholder **"Learn More" links are gone** (confirmed on a live payment page).

**Packages**
- Listing cards show the correct **Hotel / Resort / Villa** type label.
- Package detail is **start‑date‑only** with fixed nights (no checkout picker).
- Package **booking → payment → confirmed** works.
- Package **checkout "Edit" links go to `/package…` (start‑only)**, never the free date picker.
- **Package manage page** is start‑date‑only, guests read‑only ("set by package"), price shown "all‑inclusive".
- **Nightly manage page** is fixed‑length (shift start date only) with guests still editable and nightly pricing — consistent with the current design.

**Host tools**
- My Properties, Rent Requests, My Packages all load with **no console errors**.
- Rent Requests **"Cancel Booking" → confirmation popup** with the exact required wording: *"…you will need to give a **100% refund** of the amount paid. Are you sure you want to cancel the booking?"* + **Keep booking / Yes, cancel booking**.
- My Packages **create** (count 6 → 7) and **delete** (with confirm dialog, 7 → 6) both work.

**Account**
- **Review submission** end‑to‑end: completed stay → star → composer → **Submit** (dialog closes, no error, review persisted).
- **Favorites**: clicking **Save** on a villa persists the favorite (verified in DB).
- Emergency‑contact **invalid input is correctly rejected** (the validation itself is fine — see BUG‑1 for why *valid* input still can't be saved on this screen).

**Host "Add Villa" wizard**
- `/host` renders the multi‑step wizard (1 Villa Details → 2 Add Images → 3 Extra Services → 4 Pricing → 5 Payment Method), all villa kinds selectable, **no console errors**.

---

## 4. Test‑harness artifacts (NOT bugs — recorded so they aren't re‑investigated)

During automated runs these appeared as failures but were confirmed to be **automation issues**, not app defects:

- *"Price min filter not applied"* — the harness typed into the range **slider** (same `aria-label` as the text box). Using the text box → `?min=` applies correctly.
- *"Valid payment did not confirm"* — the checkout **pre‑fills the guest's email**, and the harness appended to it (`…com…com`). Filling cleanly → booking confirms.
- *"Package manage shows editable guests picker"* — the harness inspected the **nightly** booking (id 34), which correctly keeps guests editable; the actual **package** booking (id 35) correctly hides them.
- *"Favorite not saved" / "no wishlist button"* — the villa page's favorite control is the **"Save"** button (visible text), not the `wishlist` aria‑label the harness searched; clicking "Save" persists the favorite.

---

## 5. Areas not fully exercised (recommend a manual pass)

These were smoke‑tested or verified in code, but not driven to completion by automation:

1. **Host "Add Villa" full submission** — the wizard renders cleanly, but a complete run (map location + uploading 5–8 real image files + services pricing + submit) was not automated. The **image count (5–8) and non‑image rejection** rules exist in `validateVillaInput` / `uploadImagesAction` but should be manually confirmed with real files.
2. **Sold‑out hotel/resort state** — the "Sold out for these dates" behaviour is implemented; not reproduced live (would require booking out every room for a date range).
3. **Password recovery** — `/recover` loads; the actual email link → reset‑password flow was not driven.
4. **Extra‑services Reserve popup total** — encountered and passed through during booking, but the "chargeable services add to total" math was not asserted line‑by‑line.

---

## 6. Recommendation

Ship‑blocking: **BUG‑1** (emergency contact unsaveable in Profile) should be fixed before release, since it makes a user‑facing profile field non‑functional. **BUG‑2** is a minor follow‑up. Everything else in the core guest and host journeys is working and error‑free.
