# MyVilla — The Complete Owner & Host Guide

Everything an owner can ask about MyVilla: how to become a host, how to list and
manage a property, how villas differ from hotels and resorts when you set them
up, how packages and coupons and discounts work, how bookings reach you, how you
arrange a stay for a guest who can't book it themselves, and how you chat, get
notified, and are reviewed.

This guide is written **from the owner/host's point of view**. Guest-only
behaviour is mentioned only where it affects you. A companion guide,
`ABOUT_PROJECT_GUEST.md`, covers the guest side in the same depth.

> **On accuracy.** This describes the app as it actually behaves today, with
> on-screen wording quoted where it matters. Where something is a demo stand-in,
> or where the screen says one thing and the code does another, it's called out
> in [Known gaps](#26-known-gaps--things-that-are-simulated) rather than glossed
> over.

---

## Table of contents

1. [What MyVilla is, for an owner](#1-what-myvilla-is-for-an-owner)
2. [One account: you're a guest and a host at once](#2-one-account-youre-a-guest-and-a-host-at-once)
3. [Becoming a host & Hosting mode](#3-becoming-a-host--hosting-mode)
4. [Your account & navigation map](#4-your-account--navigation-map)
5. [Property types — what you choose and what it changes](#5-property-types--what-you-choose-and-what-it-changes)
6. [Listing a property: the six-step wizard](#6-listing-a-property-the-six-step-wizard)
7. [After you publish](#7-after-you-publish)
8. [Managing your properties (My Property)](#8-managing-your-properties-my-property)
9. [Featuring a listing](#9-featuring-a-listing)
10. [Locking (unpublishing) a listing](#10-locking-unpublishing-a-listing)
11. [Editing a listing & the booking lock](#11-editing-a-listing--the-booking-lock)
12. [Deleting a listing](#12-deleting-a-listing)
13. [Pricing: how your price becomes the guest's price](#13-pricing-how-your-price-becomes-the-guests-price)
14. [Discounts you control](#14-discounts-you-control)
15. [Coupons](#15-coupons)
16. [Packages](#16-packages)
17. [Your booking inbox (Rent Requests)](#17-your-booking-inbox-rent-requests)
18. [Cancelling a guest's booking](#18-cancelling-a-guests-booking)
19. [Call Requests: when guests need you to arrange it](#19-call-requests-when-guests-need-you-to-arrange-it)
20. [Fulfilling a request: the owner booking form](#20-fulfilling-a-request-the-owner-booking-form)
21. [Chatting with guests (real-time)](#21-chatting-with-guests-real-time)
22. [Notifications you receive](#22-notifications-you-receive)
23. [Reviews you receive](#23-reviews-you-receive)
24. [Payouts & the Payment Method step](#24-payouts--the-payment-method-step)
25. [Being a guest yourself](#25-being-a-guest-yourself)
26. [Known gaps & things that are simulated](#26-known-gaps--things-that-are-simulated)
27. [Quick reference — every owner limit and rule](#27-quick-reference--every-owner-limit-and-rule)

---

## 1. What MyVilla is, for an owner

MyVilla is a stay-booking marketplace. As an owner you list properties — private
villas, bungalows, hotels, resorts — and guests book them, either **night by
night** or as a **fixed all-inclusive package**. You can also build discount
**coupons**, run **packages**, and, when a guest's request is too big for the
self-serve flow, **arrange the booking for them directly** after a call or chat.

Three facts shape everything you do as a host:

- **Guest bookings are instant and need no approval from you.** When a guest pays
  at checkout, the stay is confirmed and the dates are blocked. Your "Rent
  Requests" page is a record of what's been booked, not an approval queue.
- **The one booking you approve is your own.** A stay *you* arrange for a guest is
  created unpaid; it holds nothing until the guest pays it.
- **All prices are in US dollars**, everywhere, with no currency switcher, and
  **no real money moves anywhere in the app** — see
  [Known gaps](#26-known-gaps--things-that-are-simulated).

---

## 2. One account: you're a guest and a host at once

**There is one kind of account.** There is no separate "owner account", no role
field, and no admin. Whether you see the hosting tools is decided by a single
flag on your user — `hosting_enabled` — plus whether you own any listings.
Concretely, the app treats you as a host when:

```
hosting_enabled = 1   OR   you own at least one villa
```

Being a host is purely **additive**: it appends host-only sections to the very
same account menu a guest has. You keep My Bookings, My Favorites, Payment
Pending — everything a guest has — and gain My Property, My Packages, Rent
Requests, Call Requests, and Coupons after them. Turning hosting on only ever
adds to the end of the list.

**You can book other people's properties as a guest** — only your *own* listings
are off-limits to you (you're redirected away from your own checkout, and your
listings are filtered out of search, the home page, the featured row, and the
guest picker). See [Being a guest yourself](#25-being-a-guest-yourself).

---

## 3. Becoming a host & Hosting mode

There are two ways hosting turns on, and it's a one-way ratchet once you list:

- **Choosing "host" at welcome does nothing to your account.** After signup the
  `/welcome` page offers two cards — *"I'm looking for a place"* (→ browse or
  finish your guest profile) and *"I have a villa to rent"* (→ the listing
  wizard). Picking the host card just links you to `/host`; it writes nothing.
- **Listing your first villa flips `hosting_enabled = 1` permanently**, in the
  same transaction that saves the villa.
- **The manual switch** lives in **Profile → Settings** as a `role="switch"`
  labelled "Hosting mode", calling the server. But once you own a live listing it
  **locks on**: trying to turn it off is refused with *"You still have listed
  villas. Remove them from My Property first."* Remove every listing before you
  can hide the host tools.

---

## 4. Your account & navigation map

Your account sections appear in one canonical order, shared by the header's
avatar menu and the profile sidebar so they never drift. Guest-facing sections
come first; host-only ones are appended.

| Section | Route | Host-only | What it is for you |
|---|---|---|---|
| Profile Settings | `/profile` | — | Your personal details + avatar (sidebar only) |
| My Bookings | `/profile/bookings` | — | Stays *you* booked as a guest |
| Payment Pending | `/profile/payments` | — | Stays a host arranged for you, awaiting your payment |
| My Favorites | `/profile/favorites` | — | Places you hearted |
| My Requests | `/profile/my-requests` | — | Call requests *you* sent (appears only when you have one) |
| **My Property** | `/profile/properties` | **Yes** | Create & manage your listings |
| **My Packages** | `/profile/packages` | **Yes** | Build & manage stay packages |
| **Rent Requests** | `/profile/requests` | **Yes** | Every booking on your listings |
| **Call Requests** | `/profile/calls` | **Yes** | Guests waiting for you to arrange a stay |
| **Coupons** | `/profile/coupons` | **Yes** | Discount codes for your properties |

Also present but not in that list: **Settings** (`/profile/settings`, header
menu; holds the Hosting mode switch and links to Profile and password recovery),
**My Account** (`/account`, your public host profile), **the listing wizard**
(`/host`), and **the owner booking form** (`/host/booking`).

**Badges.** The avatar shows an amber dot when anything needs attention
(unpaid stays you owe + guests waiting on a call). Inside the menu and sidebar,
**Call Requests** badges the number of guests waiting for a call, and **Payment
Pending** badges unpaid stays. Host-only *pages* are not individually
server-gated — they render for any signed-in user but are empty because their
queries filter on `owner_id`. The nav hides them; the data is what protects them.

---

## 5. Property types — what you choose and what it changes

When you list, you pick a **kind**. This is the single most consequential choice
you make, because it decides how your property is booked.

**The six kinds** (in the order shown in the wizard): `Villa Living` (default) ·
`Combinative Villa` · `Hotel` · `Resort` · `Bungalow` · `Others (specify)`.

But there are really only **two booking models**, and only `Hotel` and `Resort`
are in the first one:

| | **Hotel · Resort** | **Everything else** (Villa Living, Combinative Villa, Bungalow, Others) |
|---|---|---|
| **What a guest books** | A **number of rooms** | **The whole property** |
| **Concurrent guests?** | Yes — different guests take different rooms | No — one booking holds the whole place |
| **Capacity you set** | Rooms × **guests-per-room** (computed for you) | A **max-guests** number you type |
| **Price scales with** | rooms × nights | nights only |
| **A date is blocked when** | **every** room is taken | **any** booking exists |
| **`people_per_room`** | You set it | Stored as 0 (not used) |

### There are no room numbers

MyVilla has **no concept of a room number, room type, floor, or bed layout**. A
hotel or resort has one number — how many rooms exist — and one nightly price
that applies to all of them. When a guest books "3 rooms", they reserve three
rooms' worth of your capacity for those nights; which physical rooms they get is
between you and them at check-in. Every room costs the same, and there is no
room-level availability, only a count of how many are free.

### The guest-facing grouping

However many kinds exist, search and the home tabs collapse them into three
buckets: **Resort** (kind is exactly `Resort`), **Hotel** (kind is exactly
`Hotel`), and **Rent** (literally everything else). So a Bungalow and a
Combinative Villa both appear under "Rent". Your exact kind is still printed on
the search card and the property page.

> `Others (specify)` is stored and shown to guests **literally as the kind** —
> there is no free-text capture behind it, and it silently gets whole-property
> behaviour.

---

## 6. Listing a property: the six-step wizard

You list at **`/host`** (and edit at `/host?edit=<id>`). The page title is
*"Add your Villa"* (edit: *"Edit your Villa"*). Signed out, you get a gate:
*"To add your villa you must be signed in first."* / *"Login to your account to
start hosting right now!"*

The wizard has **six steps**: **Personal Details → Villa Details → Add Images →
Extra Services → Pricing → Payment Method.** A progress stepper runs across the
top. In create mode your draft **autosaves to the browser** (localStorage key
`myvilla.hostDraft`) at each step and is cleared once the villa is created; in
edit mode nothing is stored locally — **each section saves to the server
immediately**, with a *"{Section} saved."* confirmation.

If you're a returning host whose profile is already complete, **Step 1 is
skipped** and the wizard starts at Villa Details. Leaving mid-wizard warns you:
create mode says *"Leave without finishing? The villa details you've entered
won't be saved."*; edit mode says *"You have unsaved changes in this section.
Leave without saving? Your changes here will be lost."*

The final button reads **"Host your Villa"** when creating (or **"Save"** per
section when editing).

### Step 1 — Personal Details

Heading: *"First time hosting? You must add your personal details first to start
hosting."* This step doubles as your host profile.

| Field | Label / placeholder | Rule |
|---|---|---|
| Full name | "Full name" / "Add Full name" | Required — *"Full name is required."* |
| Gender | "Gender" (select) | Options: Female, Male, Non-binary, Prefer not to say. Required |
| Email Address | "Email Address (can't be changed)" | **Read-only** — it's what keeps your Customer ID stable |
| Date of Birth | "Date of Birth" / "Add date of birth" | Required; **must be 18+** — *"You must be at least 18 years old."* |
| Address | "Address" | Required — *"Address is required."* |

An avatar column lets you **"Upload your profile picture"** (default
`/images/host/avatar.png`); it previews instantly and uploads on the spot.

### Step 2 — Villa Details

Heading: *"What kind of a villa are you hosting?"* — followed by the six kind
chips. Then a **Details** section:

| Field | Label / placeholder | Rule |
|---|---|---|
| Name | "Name of your Villa" / "Complete Name" | Required — *"Villa name is required."* |
| Description | "Describe your Villa (Max 150 words)" | Optional |
| Dimensions | "Villa Dimensions" / "Total Build up Area (in Square Yards)" | Digits only |
| Address | "Villa Address" / "Registered Address of Villa" | Required |
| City | "City" / "City where the Villa is located" | Required — *"City is required."* |
| Number of Rooms | "Number of Rooms" / "e.g. 3" | Digits only |

Then **one capacity field that depends on the kind**:

- **Hotel / Resort → "Guests per Room"** ("How many guests fit in one room? e.g.
  2"). A helper reads *"Guests book individual rooms — total capacity is rooms ×
  guests per room."* Your listing's max guests is computed as **rooms ×
  guests-per-room**.
- **Everything else → "Maximum Number of Guests"** ("How many guests can stay?
  e.g. 6"), which you set directly (clamped 1–30 server-side).

A **"Villa Location on Map"** preview appears but is decorative — there's no real
map picker.

### Step 3 — Add Images

Heading: *"Add clear and sharp images of your villa."* Sub-copy notes you can add
**5–8 images** and shows your live count.

- **Minimum 5, maximum 8 photos**, enforced in the wizard *and* on the server.
- Each file: **up to 8 MB**; **JPG, PNG, WEBP, GIF, or AVIF**. Files are validated
  by their **actual bytes**, not just the extension — a mislabelled file is
  rejected, and one bad file fails the whole batch.
- Add via **"Add photo"** (shows "Uploading…" during upload); thumbnails have a
  hover **"Remove photo N"** control.
- Exact errors you may see: *"You can upload at most 8 images. You have N — add up
  to N more."*; on submit, *"Please add at least 5 images of your villa — you have
  N, add N more."*; and for a bad file, *`"filename" isn't a valid image. Only
  JPG, PNG, WEBP, GIF or AVIF images up to 8 MB are allowed.`*
- Photos are stored **in the database**, not on disk, so they survive redeploys.

### Step 4 — Extra Services

Heading: *"Select the extra services you would be providing to your guests."*
Sub-copy: *"Set a price to charge guests for a service — leave it empty and the
service is free."*

Two distinct concepts live here:

- **Services** (chargeable extras) — the preset list is: *Free Cancellation
  before a week, Free Wifi, Free meal on first day, Pre-order mean preperations,
  Long Stays, Butler, House Keeping.* Each row has a `$` price box (placeholder
  "Free"). A price makes it a paid add-on; left empty, it's free.
- **Facilities** (searchable amenities describing the property) — the preset
  chips are: *Wifi, Free Parking, Air Conditioner, Long Stays, Smoke Alarm,
  Swimming Pool, Jaccuzzi, BBQ Corner, TV.* These are free and searchable unless
  you type a price on one (which promotes it to a paid service).

By default three services are pre-selected: *Free Cancellation before a week,
Free Wifi, Long Stays.* You can add your own with **"Add your own service"** →
**"Add Service"**. A paid add-on never appears in both lists — if a name is
priced, it shows only under Extra Services.

> The preset lists contain their original typos (`Jaccuzzi`, `Pre-order mean
> preperations`); those strings are what guests actually see.

### Step 5 — Pricing

Heading: *"Set your price according to your place."*

- **Nightly price** stepper — *"You are offering [$X] per night for your villa!"*,
  adjustable ±5, floored at $5, default **$135**. A hint reads *"Places like
  yours have an average price range from $130 to $200."* Required — *"Please set a
  nightly price for your villa."*
- **Discount** — *"Offer a discount of [X%] off the nightly price"*, adjustable
  ±5, **0–90%**. When set, a preview shows *"Guests will see $Y/night after the
  X% discount."* A tip card suggests: *"Offer discount to your first 3 guests to
  help your villa get booked faster!"*

For a hotel/resort, this nightly price is **per room**; for a whole-villa kind
it's for the whole property. See [Pricing](#13-pricing-how-your-price-becomes-the-guests-price).

### Step 6 — Payment Method

Heading: *"Add payment method for guests."* / *"Guests can pay using:"*

- **Payment logos** to accept: Mastercard, G Pay, PayPal, VISA (all four
  pre-checked; at least one required).
- **"Add your account details:"** / *"Payments from your guests will be
  transferred to this account."*
- **Account type** (select): "Credit Card or Debit Card" (default), "Bank
  Account", or "PayPal Account".
- **Card / account number** — placeholder "1111 1111 1111 1111", auto-grouped in
  fours, 8–19 digits.
- A legal line: *"By clicking the button below, I agree to the Host's House
  Rules, MyVilla's COVID-19 Safety Requirements and the Guest Refund Policy."*
  (the links are placeholders).

> **These payout details do nothing.** They're stored as plaintext, exactly as
> typed, and nothing ever reads them to pay you — see
> [Payouts](#24-payouts--the-payment-method-step).

---

## 7. After you publish

On success you see *"Your villa has been registered!"* and a review-styled
message: *"{name} is now under review. We'll notify you at {email} once it goes
live. Guest payments will be transferred to your account ending in {last4}."* A
small summary lists Villa, Type, Price, and Payout account, with buttons **"Go to
Home"** and **"View in My Property"**.

> **Despite the "under review" wording, there is no approval or moderation.** Your
> listing is live the instant you publish — it appears in search and browse
> immediately, and there is no admin, no verification, and no `approved` state.
> The "Identity Verified" badge on your account page is likewise static markup,
> not a real check.

---

## 8. Managing your properties (My Property)

**My Property** (`/profile/properties`) is your management hub — heading
*"Property Owned"*, with an **"Add Property"** button (→ `/host`) and a search box
(*"Search your properties by name, city or type"*) once you have at least one.

Each property card shows:

- The photo (greyed and red-tinted when the listing is locked), and the title
  *"{name}, {city}"*.
- A **kind chip**, and conditionally a **Featured** badge (star, only when
  featured and not locked) and a **Locked** badge (padlock, red).
- The **price line**: discounted price + struck-through original + a red *"X%
  off"* chip when you set a discount, else *"$X/night"*.
- **Rating**: stars + *"{rating} ({reviews})"*, or a *"New listing"* chip if
  nobody has reviewed it.
- A *"Posted N days ago"* chip. If the villa has live bookings, a warning button:
  *"Editing & removal locked · N active bookings"* with a *"Why?"* link.

Controls: a **Feature** toggle, a **Lock** toggle, a **Create booking** button
(→ the owner booking form), an **Edit** link, and a **Remove** action. Empty
state (no properties): *"No properties yet"* / *"Register your villa and it will
show up here."*

---

## 9. Featuring a listing

The **Feature** toggle promotes a listing into the home page's "Featured villas"
row. Turning it **on** opens a confirm dialog titled *"Feature this villa?"*:

> *"Featuring {name} promotes it in the Featured villas section on the home page.
> This is a paid service — your account will be charged for the promotion. You can
> turn it off any time."*

The confirm button reads **"Feature & accept charge"**. Turning it **off** is
immediate, no dialog. While a listing is locked, the toggle is disabled with a
tooltip: *"Restore this listing before featuring it — locked listings don't
appear on the home page."*

> **Nothing is actually charged.** "Feature" just sets a flag; the "your account
> will be charged" copy is a demo stand-in.

---

## 10. Locking (unpublishing) a listing

**Locking is the safe way to take a listing off the market without deleting it.**
The **Lock** toggle:

- Removes the listing from **search, browse, the home page, and the packages
  pages**, takes down **any packages on it**, and makes it stop accepting new
  bookings.
- **Leaves already-booked stays untouched** — nothing is cancelled.
- Silently removes the listing from guests' **favorites** while locked (the
  favorite survives and returns if you unlock).
- Is **always available**, even when editing is frozen by active bookings — it's
  the escape hatch.

Turning it **on** opens *"Lock this villa?"*:

> *"{name} will disappear from search and stop taking new bookings, along with any
> packages on it. Bookings guests have already made still go ahead — nothing is
> cancelled. You can restore the listing at any time."*

Confirm reads **"Lock villa"**. Unlocking (restoring) is immediate. Locking is
fully reversible — only a timestamp flag changes.

---

## 11. Editing a listing & the booking lock

You edit via **Edit** on a property card, which reopens the wizard at Villa
Details with your data prefilled. Each section saves on its own, live.

**But a villa with live bookings can't be edited at all.** Because a guest booked
the villa exactly as listed — its capacity gates availability, its name/city show
on their booking — editing would rewrite what someone already paid for. So the
whole listing is **frozen until every stay completes (or you cancel them)**.

When you try, you get a full-page notice titled *"This listing can't be
edited yet"*:

> *"{villa} has N active bookings. Guests booked it exactly as it's listed, so its
> details stay put until those stays are done — the last one checks out on
> {date}. You can wait for them to complete, or cancel them all in Rent Requests
> to edit now."*

with buttons **"Go to Rent Requests"** and **"Back to My Properties"**, and an
amber callout pointing you at **Lock** instead if you only want to stop new
bookings. The same guard runs on the property card (Edit and Remove become
greyed buttons that open a *"Why locked?"* dialog) and, as the final authority, in
the save action itself.

---

## 12. Deleting a listing

**Remove** opens *"Remove this villa?"*:

> *"Are you sure you want to remove {name}? This permanently deletes the listing
> and can't be undone."*

Confirm reads **"Remove villa"**. Deletion is a hard delete and cascades to the
villa's bookings — **but it's refused while the villa has active bookings**, with:

> *"This villa still has active bookings. Cancel all of them in Rent Requests
> before removing the villa."*

The dialog then offers an inline "Go to Rent Requests" link and suggests locking
instead: *"Or lock it instead — it stops taking new bookings and disappears from
search right away, while those stays still go ahead."*

---

## 13. Pricing: how your price becomes the guest's price

Your nightly price is the base of a fixed formula. Discounts come off **before**
the service fee.

```
subtotal      = your nightly price × nights            (whole-villa)
              = your nightly price × rooms × nights     (hotel/resort — price is per room)
discount      = the LARGER of { your standing discount, the automatic long-stay discount }
service fee   = 18% of (subtotal − discount)
guest total   = subtotal − discount + service fee   (+ any paid add-ons the guest ticks)
```

- **The 18% service fee** is charged on the discounted subtotal, on nightly stays
  only. **Packages carry no service fee** — the package price is the whole price.
- **Your standing discount and the automatic long-stay discount don't stack** —
  the guest gets whichever is larger.
- The exact same maths runs on the villa page, at checkout, and on the stored
  receipt, so the advertised price is always the one charged.

---

## 14. Discounts you control

You have three separate discount levers:

1. **Your standing discount** — set on the listing (Pricing step, 0–90%). Applies
   to every nightly booking of that property.
2. **The automatic long-stay discount** — applied by the system, not you: **15%
   at 7+ nights, 30% at 28+ nights.** It competes with your standing discount;
   the guest gets the larger, never both.
3. **A per-booking discount** — when you arrange a booking for a guest yourself
   (the owner booking form), you can grant **a percentage (up to 90%) and/or a
   flat dollar amount off**. Unlike the first two, these *do* combine with each
   other, and they're shown to the guest on their payment page exactly as you set
   them.

There is **no early-bird or seasonal discount**. The `/promotions` page is
marketing only — no discount logic behind it.

---

## 15. Coupons

**Coupons are yours to create; there is no guest coupon wallet.** You make a code
and share it; the guest types it at checkout. You manage them at **Coupons**
(`/profile/coupons`), whose subtitle states the model plainly: *"Each coupon
belongs to one property. Guests enter the code at checkout; a discount can never
make a stay free — the price floors at $1."*

If you own no properties yet: *"List a property first — coupons attach to one of
your properties."*

### Creating one

The form (which doubles as the editor — header *"New coupon"* or *"Editing
{code}"*):

- **Property** — pick one of your listings (labelled *"{name} · {kind}"*).
- **Code** — placeholder *"Code, e.g. SUMMER-10"*, forced uppercase, only
  letters/numbers/hyphens, 3–20 characters.
- **Discount type** — a **"% off"** / **"$ off"** toggle.
- **Value** — placeholder *"1–99 (%)"* or *"amount ($)"* depending on the toggle.
- Submit reads **"Create coupon"** (or **"Save changes"** when editing).

### Rules, quoted

- **One discount type only** — *"Give the coupon ONE discount: a percentage or a
  fixed amount."*
- **Percentage 1–99** — *"A percentage discount must be between 1 and 99."* (0
  isn't a coupon; 100 is a free stay.)
- **Fixed must be positive** — *"A fixed discount must be more than $0."*
- **Codes are globally unique across all of MyVilla** (case-insensitively). On a
  clash you get *"A {CODE} coupon already exists. Coupon codes are unique across
  MyVilla — try one of these instead:"* followed by clickable suggestions
  (`CODE-2`, `CODE-3`, … then `-NEW`, `-PLUS`, `-VIP`).
- Success: *"Coupon {CODE} saved — guests can use it at checkout now."*

### What coupons deliberately lack

**No minimum spend, no maximum-discount cap, no usage limit, no per-guest limit,
no expiry, no multi-property scope.** A coupon is tied to **one property**, is
**unlimited-use**, and **never expires**. Treat a code as public the moment you
share it. Your only control is deletion.

### Deleting

*"Delete coupon {code}?"* → *"Guests won't be able to redeem it any more. Stays
that already used it keep their discount."* (**"Keep coupon"** / **"Yes, delete
it"**). Deletion stops *new* redemptions only; the coupon's discount is
snapshotted onto bookings that already used it.

### How a coupon behaves at checkout (guest side)

The code applies to the **whole checkout** (stay + add-ons, or the package
price), **after** every other discount, and **can never take the total below $1**.
Coupons work on **new checkouts only** — not on settling a stay you arranged, and
not on a modification.

---

## 16. Packages

**A package is a named, fixed, all-inclusive stay bundle you build on one of your
properties.** Unlike optional add-ons, a guest can't unbundle the inclusions —
it's all-or-nothing, at one flat price.

You manage them at **My Packages** (`/profile/packages`). Intro copy: *"Build a
fixed getaway for one of your villas — set the number of nights, how many guests
it's for, and one all-inclusive price that covers the stay plus every experience
(airport pickup, sightseeing, meals). Guests pick a start date and get the whole
bundle; unlike optional extra services, they can't remove individual items."* If
you own no villas: *"List a villa first — packages attach to a villa you own."*

### The package form

- **Package type** (select) — one of:

  | Type | Nights | Advertised discount |
  |---|---|---|
  | Curated Package | You choose | You choose |
  | Weekend Getaway (3 nights) | 3 | 0% |
  | Weekly Escape (7 nights) | 7 | 15% |
  | Monthly Retreat (28 nights) | 28 | 30% |

  Picking a **preset** auto-fills nights, discount, and a suggested price (nightly
  rate × nights, long-stay discount, + service fee). Editing any of those fields
  afterward flips the type back to **Curated**. Helper copy: curated → *"Set your
  own nights and price."*; preset → *"Nights and price auto-filled — edit either
  and it becomes a Curated Package."*
- **Villa** — pick one of yours (*"{name}, {city}"*).
- **Package name** — *"e.g. Explorer Weekend"*.
- **Description** — *"What makes this package special?"*
- **Nights** — *"e.g. 3"*.
- **For up to N guests** — *"e.g. 4"*. **Locked while the package has live
  bookings** (tooltip: *"Locked while this package has active bookings — it
  unlocks once those stays are completed."*).
- **Discount** — *"% off"*.
- **All-inclusive price** — a `$` field. Typing a price clears the discount (you
  drive price *or* discount, not both).
- **Included experiences** — add with *"e.g. Airport pickup & drop"* → **"Add"**;
  each becomes a removable chip. **At least one is required.**

Live hints tell you the capacity fit (e.g. *"3-night stay · books the whole villa
· fits up to 8 guests."* or, over capacity, *"…over capacity — this villa fits up
to N guests."*) and a reference-price comparison against a normal booking.

### Package rules

- **One property.** A package can't span several, and can't be booked against a
  different villa.
- **Fixed length** (exact, not a minimum) and **fixed guest cap** ("up to N").
- **One flat price** covering the stay *and* inclusions — **no nightly rate, no
  service fee** added.
- **Guest cap can't exceed capacity** — *"This villa fits up to N guests."* For a
  hotel/resort that's rooms × guests-per-room; otherwise the listing's max guests.
- **You can't change the guest count while the package has live bookings** —
  *"This package has N active bookings, so its guest count can't be changed until
  those stays are completed."* Everything else stays editable (a package booking
  snapshots its details, so edits only affect future stays).
- Validation messages: *"Package name is required."*, *"A package must run for at
  least 1 night."*, *"A package must be for at least 1 guest."*, *"Add at least one
  included experience."*

### Package cards & lifecycle

Each card shows the name, a type chip, a green *"X% off"* chip if discounted,
lock badges, the villa, *"N nights · up to N guests"*, the price (or **"Free"**),
and **Edit / Lock (or Restore) / Delete**. You can **lock** a package to stop new
bookings (*"Hidden from guests and taking no new bookings. Stays already booked
still go ahead."*), and a package is also **automatically unbookable when its
villa is locked** (badge: *"This package's villa is locked…"*). Deleting: *"Delete
this package? … removes the package from your villa and can't be undone."*

Guests book a package by choosing **only a start date** — nights, guest count, and
price all come from the package, and the whole bundle is snapshotted onto their
booking so history survives edits. Packages are **exempt** from the guest's
6-room cap and the 30-night limit; coupons still apply to them.

---

## 17. Your booking inbox (Rent Requests)

**Rent Requests** (`/profile/requests`) is where every booking on your listings
appears — it's a *record, not an approval queue*. The footer says it directly:
*"Guests pay in full at checkout, so their stay is confirmed automatically — no
approval needed. The booked dates are blocked for other guests right away."*

- Heading: *"{N} Confirmed Bookings"* (counts confirmed stays).
- A **sort** dropdown: *"Sort: Latest to Oldest"* / *"Sort: Oldest to Latest"*.
  There is **no text search** here (unlike Call Requests).
- Columns: **Tenant · Property · Stay Duration · No. of Guests · Status.**

**Status labels**: `accepted → Confirmed`, `pending → Payment pending`,
`completed → Completed`, `declined → Declined`, `cancelled → Cancelled`. Pending
and upgrade rows carry an amber badge — *"Awaiting payment · holds no rooms"* or
*"Upgrade balance due from guest"*.

Expanding a row reveals: **Amount paid/due**, **Reference** (`MV-000042`), **Stay
length**, **Rooms**, when it was **Booked**, a receipt line (full stay − discount
− already-paid = due/paid), a night-by-night room breakdown for adjusted stays,
paid add-ons, package inclusions, and the guest's contact details (email, phone,
Customer ID).

**Package bookings** get their own section — *"Fixed all-inclusive packages guests
booked — with the rooms each reserved on your property."*

---

## 18. Cancelling a guest's booking

From a Rent Requests row you can **Cancel Booking** (shown for confirmed or
payment-pending stays). The confirm dialog is *"Cancel this booking?"*:

> *"If you cancel {tenant}'s booking of {villa} ({dates}), you will need to give a
> 100% refund of the amount paid."* / *"Are you sure you want to cancel the
> booking?"*

Buttons: **"Keep booking"** / **"Yes, cancel booking"**. The stay flips to
cancelled, the dates free up, and the guest is notified. Cancelling a
payment-pending stay you arranged simply withdraws it (nothing was held or paid).

> The **100% refund** is stated policy shown in the dialog. As with all refunds
> in the app, no money actually moves — see
> [Known gaps](#26-known-gaps--things-that-are-simulated).

---

## 19. Call Requests: when guests need you to arrange it

Some stays the self-serve flow won't take: **more than 6 rooms for one guest**, or
**a stay longer than 30 nights**. When a guest hits either, their Reserve button
becomes *"Request a call from the host"*, and their request lands in your **Call
Requests** (`/profile/calls`).

Header: *"{NN} Call Requests"* (zero-padded). Intro: *"Guests who wanted a stay
that can't be completed online — more rooms than one guest may book, or a longer
stay than the nightly flow takes. Give them a ring and set the booking up
directly, then mark it as called."* There's a search box (*"Search by name,
email, customer ID or property"*). Empty state: *"No call requests"* / *"When a
guest asks for more rooms or a longer stay than they can book online, their
request shows up here."*

Each request card (an amber panel) shows the guest's avatar and name, when they
asked (*"Requested 2 hours ago"*), and a facts grid — **Customer ID, Email,
Phone, Property, Dates, Rooms wanted, Guests, Add-ons wanted** — plus **Their
message** if they left a note. Unstated values read distinctly: dates/rooms/guests
show *"Not stated"*, phone *"Not provided"*, add-ons *"None"*, Customer ID *"—"*.

**Four actions**, in order:

1. **"Fulfil this request"** → the owner booking form, prefilled with everything
   the guest stated (see next section).
2. **Chat** → opens the thread (see [Chat](#21-chatting-with-guests-real-time)).
3. **"Call {phone}"** (a `tel:` link) — or **"Email guest"** (`mailto:`) if they
   have no phone on file.
4. **"Mark as called"** — closes the request. **No confirmation, and it deletes
   the chat thread.**

> **Closing a request permanently deletes its chat, for both sides.** This is by
> design — the thread exists to arrange one booking — but "Mark as called" is a
> plain grey link with no warning, and "Fulfil this request" also closes it once
> the booking is made. Only you (the owner) can close a request; a guest can't
> withdraw one.

---

## 20. Fulfilling a request: the owner booking form

**`/host/booking`** is where you arrange a stay for a guest — reached from
"Create booking" on a property card or "Fulfil this request" on a call request.
Page banner: *"You're booking {villa}. The usual limits on length, headcount and
rooms don't apply here — only what's actually free does."* (If the listing is
locked: *"This listing is locked, so guests can't book it themselves. You can
still book it for someone directly."*)

The form:

- **Booking for** — a guest picker: *"Search by name, email or customer ID"*
  (minimum 2 characters; too short shows *"Type at least 2 characters…"*). You
  **cannot pick yourself**, and the search excludes you.
- **Dates** — no maximum length applies to an owner booking. For hotels/resorts
  it shows per-night availability.
- **Rooms** (hotels/resorts) — 1…full inventory. Clamped to real inventory, **not**
  to the guest's 6-room allowance. Sold out shows *"Sold out for these dates"*.
- **Adjusted stay** (when the room count isn't free every night) — an amber panel
  offering *"Book it with this adjustment"* (each night gets what it has, guest
  pays only for rooms they get) or *"Keep N rooms for the whole stay"*.
- **Guests** — capped by occupancy (*"N rooms sleep N"*); you can offer more
  rooms, not more beds.
- **Extra Services (optional)** — the villa's paid add-ons.
- **Discount (optional)** — a **"% off"** / **"$ off"** toggle and a value; a live
  preview reads *"The guest will see −$X at payment."* (percentage capped at 90).
- If the guest already has an overlapping stay, a blue notice explains the booking
  will **upgrade** it into one booking, crediting what they already paid.

Submit reads **"Send payment request"**, with the note: *"The guest gets a payment
request for this stay. The rooms aren't held until they pay — until then it stays
pending and someone else can still book them."*

The booking you create is **`pending` with payment due**, **holds nothing**, and
the guest gets a **payment request** notification pointing at their Payment
Pending list. Rooms are reserved only when they pay — and availability is
re-checked at payment time, so if the rooms went in the meantime the guest's
payment is refused rather than overbooking you. Fulfilling from a call request
**closes that request automatically** once the booking is created.

> **The quote *is* the booking.** There's no separate "send a quote" message — you
> deliver a price by creating this discounted unpaid booking, which the guest
> accepts by paying or walks away from.
>
> **Known quirk:** on success you're sent to `/profile/requests?created=<REF>`,
> but nothing on that page reads the `created` param — there is currently **no
> success banner**; you just land on Rent Requests with a stray query string.

---

## 21. Chatting with guests (real-time)

Every call request carries **its own chat thread** with the guest. You open it
from Call Requests; the guest opens the same thread from their My Requests. It's
one shared component — you both see the same messages and composer.

- **The guest's original note becomes the first message**, so the thread reads as
  one conversation.
- Messages are capped at **500 characters**. Enter sends, Shift+Enter makes a new
  line, Escape closes. The composer placeholder is *"Message {first name}…"*.
- Empty thread: *"No messages yet. Say hello — they'll see it in their account and
  get a notification."*
- Opening a thread marks the other side's messages read.

**It is genuinely real-time.** MyVilla runs on a custom Node server (`server.mjs`)
that hosts a WebSocket endpoint. When either party sends a message, the other's
open thread updates **live**, without a refresh. The mechanics, since they explain
the guarantees:

- The socket is authenticated with a **single-use, 30-second ticket** the browser
  requests from the app (so the socket layer never has to read your session).
- The socket carries **only "thread N changed"** — never message content. The
  browser then re-reads the thread through the normal authorized query, so
  there's one read path with one permission check.
- Only the **two participants** (the request's guest and the villa's owner)
  receive a given thread's pings.
- It's **best-effort with automatic reconnect**. If the socket drops or you're
  offline, chat degrades to *"updates when you act"* — messages still send through
  the server action, and a **notification always fires** regardless, so someone
  not on the page still finds out.

---

## 22. Notifications you receive

The header bell shows your 12 most recent notifications; the badge counts all
unread (shows "9+" past nine) and turns to "9+"/a number. **Closing** the panel
marks everything read (not opening it). Each notification is written as prose when
it happens and stored as-is, so it still reads true even after a property is
renamed.

As an owner you'll receive:

| Notification | Fires when | Sends you to |
|---|---|---|
| **New booking** | A guest booked one of your listings | Rent Requests |
| **Booking cancelled** | A guest called off a stay | Rent Requests |
| **Booking changed** | A guest changed the dates/rooms of their stay | Rent Requests |
| **Call request** | A guest asked you to arrange a stay | Call Requests |
| **New message** | A guest replied in a request thread | Call Requests |
| **New review** | A guest rated a finished stay | Your account page |

(As a guest yourself you'd also get **Payment request** and guest-side **Booking
cancelled** notifications.)

---

## 23. Reviews you receive

**Guests review your properties; you cannot review guests.** There is no reverse
review path anywhere.

- A guest can rate a stay **after its checkout date**, **once per booking**, 1–5
  stars with an optional comment (up to 1000 characters). It's permanent — no
  edits.
- The property's average and review count update immediately, and you get a **New
  review** notification.

Your reviews surface on the property page, on booking pages, on the owner booking
view, and on **your account page** (`/account`) — which shows a **Reviews**
section (up to 6 commented reviews, newest first), a summary (*"{avg} Rating ·
{count} reviews"*), and a star distribution (5→1). These review sections, plus the
review-count stat and "My Villas", are **host-only** — a pure guest with no
listings sees none of them, because reviews attach to properties they don't own.

---

## 24. Payouts & the Payment Method step

**No money moves, and there is no payout system.** This is the single most
important thing to be honest about with hosts.

- The Payment Method step of the wizard collects payout logos, an account type,
  and a card/account number. These are stored **as plaintext, exactly as typed**,
  and **nothing ever reads them to pay you**.
- **There is no earnings page, no payout history, and no balance anywhere.**
  "Payment Pending" in your account is entirely *guest-facing* (stays *you* owe as
  a guest), not host revenue.
- When a guest "pays", the booking is just flipped to paid — no gateway, no
  charge, no transfer. The success copy about payments being "transferred to your
  account" is a demo stand-in.

The availability engine, concurrency guards, pricing maths, and authorization are
all real and carefully built. It is only the **money layer** that is simulated.

---

## 25. Being a guest yourself

Your host account is also a full guest account. You can book any property except
your own, save favorites, request calls on other people's listings, leave
reviews, and manage your own stays — all from the same account. The only
boundaries the app enforces are:

- **You can't book, or check out, your own listing** — you're redirected to its
  manage/place view, and the payment page refuses it (*"You cannot book your own
  villa."*).
- **Your own listings are hidden from you while browsing** — search, home, the
  featured row, and the guest picker all filter them out.
- **You can't request a call about your own property** (*"This is your own
  property."*).

For everything a guest does — searching, the villa page, booking, checkout,
managing/cancelling stays, packages, favorites — see `ABOUT_PROJECT_GUEST.md`.

---

## 26. Known gaps & things that are simulated

Documented honestly so nobody — host, support agent, or chatbot — promises
something the app doesn't do.

### Money is simulated end-to-end

- **No real money moves.** Guest card details are used only in the browser to
  simulate payment; nothing is charged or stored. Your payout details are stored
  but never used to pay you. There is no gateway, no ledger, no balance, no payout
  history.
- **All refunds are displayed text, not code.** The guest-cancel 50% refund and
  the owner-cancel 100% refund are policy sentences; cancelling flips a status and
  moves nothing. (The only refund *arithmetic* anywhere is the modification
  top-up/refund difference, which is also display-only.)
- **The "Feature" promotion charges nothing** despite saying your account will be
  charged.

### Approval, verification, and "review" copy

- **There is no listing approval or moderation.** Your villa is live the instant
  you publish; the *"now under review"* / *"once it goes live"* success copy is a
  stand-in.
- **"Identity Verified"** on the account page is static markup, not a check.

### On-screen wording that can mislead

- **The `?created=<REF>` success banner after an owner booking is not
  implemented** — no page reads the param, so you just land on Rent Requests with
  a stray query string.
- **Package type blurbs advertise a discount** ("15% long-stay discount baked in")
  but a package's price is whatever you set — the advertised percentage isn't
  applied at checkout. The flat price is the price.
- **The Help Center says nothing about packages**, despite Packages being
  top-level navigation.
- **"Mark as called" deletes the chat thread** with no confirmation dialog.

### Structural notes

- **The property kind is unvalidated free text** with no database constraint, and
  the wizard's kind list, the room-based list in code, and the search filters each
  hardcode the grouping separately — they can drift with nothing to catch it.
- **A guest can open unlimited concurrent call requests** on one property by
  nudging the check-in date a day (the duplicate check keys on exact dates).
- **Rate limits are per-process, in-memory** (e.g. 5 call requests/min, 20 chat
  messages/min).

---

## 27. Quick reference — every owner limit and rule

| Rule | Value |
|---|---|
| Property kinds | Villa Living, Combinative Villa, Hotel, Resort, Bungalow, Others (specify) |
| Room-based kinds (sell rooms) | **Hotel, Resort** — everything else books whole |
| Listing photos | **5–8**, max **8 MB** each — JPG/PNG/WEBP/GIF/AVIF |
| Max guests (whole-villa) | You set it, clamped **1–30** |
| Max guests (hotel/resort) | Computed as **rooms × guests-per-room** |
| Nightly price | Set on Pricing step, min $5, default $135 |
| Your standing discount | **0–90%** off the nightly rate |
| Automatic long-stay discount | 15% at 7+ nights, 30% at 28+ (guest gets the larger of this vs your discount) |
| Service fee | **18%**, on the discounted subtotal, nightly stays only |
| Per-booking discount (owner arranges) | Up to **90%** and/or any flat amount, combinable |
| Coupon code | 3–20 chars, letters/numbers/hyphens, **globally unique** |
| Coupon percentage | **1–99%** |
| Coupon floor | Total can't drop below **$1** |
| Coupon limits | **None** — unlimited use, one property, never expires |
| Package length | Fixed (exact), presets 3 / 7 / 28 nights, curated any |
| Package inclusions | **1–20**, all mandatory |
| Package price | One flat all-inclusive total, **no service fee** |
| Guest self-serve room cap | **6 rooms/night/guest** (packages & owner bookings exempt) |
| Guest self-serve stay length | **30 nights** (packages & owner bookings exempt) |
| Call-request note / chat message | **500 characters** |
| Chat | **Real-time** over WebSocket; degrades to notifications if offline |
| Owner-cancel refund (stated) | **100%** |
| Reviews | Guest → property only; 1–5 stars; one per booking; permanent |
| Listing approval | **None** — live on publish |
| Money movement | **None** — fully simulated |

### The five things owners most often get wrong

1. **Rent Requests is not an approval queue.** Guest bookings are already
   confirmed and the dates already blocked; there's nothing to approve.
2. **Hotels/resorts sell a count of rooms, not room numbers.** You set rooms and
   guests-per-room; the app never assigns a specific room.
3. **You can't edit a listing that has live bookings** — wait them out or cancel
   them, or **Lock** the listing to stop new bookings in the meantime.
4. **A coupon you share is effectively public forever** — no expiry, no usage cap.
   Delete it to stop new redemptions.
5. **No money reaches you through the app.** Payout fields are collected but
   never used; the entire payment layer is a demo.
