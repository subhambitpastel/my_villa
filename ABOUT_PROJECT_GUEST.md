# MyVilla — The Complete Guest Guide

Everything a guest can ask about MyVilla: how to find a place, how booking differs
between a villa, a hotel and a resort, what packages are, how the room limits work,
what you pay, and what happens after you book.

This guide is written **entirely from the guest's point of view**. Anything only an
owner/host does is mentioned only where it affects you.

> **Note on accuracy.** This describes the app as it actually behaves today. Where
> something is a demo stand-in or where the wording on screen doesn't match the
> code, it's called out in [Known gaps](#19-known-gaps--things-that-are-simulated)
> rather than glossed over.

---

## Table of contents

1. [What MyVilla is](#1-what-myvilla-is)
2. [Accounts: signing up, signing in, passwords](#2-accounts-signing-up-signing-in-passwords)
3. [Where you can find a place to book](#3-where-you-can-find-a-place-to-book)
4. [Searching and filtering](#4-searching-and-filtering)
5. [Property types — villa vs hotel vs resort](#5-property-types--villa-vs-hotel-vs-resort)
6. [The villa detail page](#6-the-villa-detail-page)
7. [Booking a nightly stay](#7-booking-a-nightly-stay)
8. [Rooms at a hotel or resort](#8-rooms-at-a-hotel-or-resort)
9. [The booking-days limit — and how to book more](#9-the-booking-days-limit--and-how-to-book-more)
10. [Adjusted stays (rooms that change mid-stay)](#10-adjusted-stays-rooms-that-change-mid-stay)
11. [Overlapping your own bookings](#11-overlapping-your-own-bookings)
12. [Packages](#12-packages)
13. [Prices, discounts and fees](#13-prices-discounts-and-fees)
14. [Checkout and payment](#14-checkout-and-payment)
15. [After you book: view, change, cancel](#15-after-you-book-view-change-cancel)
16. [Payment Pending — stays your host arranged](#16-payment-pending--stays-your-host-arranged)
17. [Reviews, favorites and notifications](#17-reviews-favorites-and-notifications)
18. [Your account](#18-your-account)
19. [Known gaps & things that are simulated](#19-known-gaps--things-that-are-simulated)
20. [Quick reference — every limit and rule](#20-quick-reference--every-limit-and-rule)
21. [Appendix A — Help Center FAQ (verbatim)](#21-appendix-a--help-center-faq-verbatim)
22. [Appendix B — Site navigation & support](#22-appendix-b--site-navigation--support)

---

## 1. What MyVilla is

MyVilla is a stay-booking platform. Hosts list properties — private villas,
bungalows, hotels and resorts — and guests book them, either **night by night** or as
a **fixed all-inclusive package**.

Two things are worth knowing straight away, because they shape everything else:

- **Bookings are instant.** There is no host approval step. When your payment goes
  through, your stay is confirmed. (The one exception is a stay a host arranges *for*
  you — see [section 16](#16-payment-pending--stays-your-host-arranged).)
- **Prices are in US dollars**, everywhere, with no currency switcher.

### Public pages

| Page | What it's for |
|---|---|
| `/` | Home — hero search, top picks, featured listings |
| `/search` | Full search with filters |
| `/packages` | All packages, grouped by type |
| `/promotions` | Current deals |
| `/place?id=N` | A property's detail page |
| `/package?id=N` | A package's detail page |
| `/help` | FAQ + support contact |
| `/about`, `/blog`, `/terms`, `/privacy` | Static pages |

You can browse all of these signed out. You need an account only to **book**, **save
a favorite**, or **request a call**.

---

## 2. Accounts: signing up, signing in, passwords

### There is only one kind of account

There is **no separate guest and host signup**. Everyone registers the same way and
starts as a guest. Hosting is a switch on your existing account — you can turn it on
in Settings, and listing a property turns it on automatically and permanently. You
never need a second account to do both.

### Registering (`/register`)

You'll be asked for:

- Email address
- Phone number + country dial code
- Country / region
- Password, and a confirmation

Rules that actually apply:

- **Password must be at least 8 characters.** That's the only strength rule.
- Your email must be unique — a duplicate gets "An account with this email already exists."
- **There is no email verification.** You're signed in immediately after registering.
- Signup is rate-limited to 5 attempts per minute from one address.

After registering you land on `/welcome` — *"Welcome to MyVilla! How would you like
to start?"* — with two cards:

- **"I'm looking for a place"** — *"Browse villas around the world, save your
  favorites and book your next stay."* (button: **Start exploring**)
- **"I have a villa to rent"** — *"List your property, set your price and start
  receiving bookings from guests."* (button: **Host your villa**)

The choice writes nothing to your account — it's just a signpost. If your profile is
missing a name, date of birth or address, the guest card routes you through
`/welcome/guest` to fill those in first (18+ required); otherwise it drops you on the
home page. The footer reminds you: *"You can always do both — host a villa or book a
stay anytime from your account."*

> **You must be 18 or older to book.** Date of birth is checked both when you complete
> your profile and whenever you edit it.

### Signing in (`/login`)

Email and password. A wrong email and a wrong password give the same message —
"Incorrect email or password" — so the form can't be used to discover who has an
account. Sign-in is rate-limited to 10 attempts per minute.

Your session lasts **30 days**.

> The "Remember me" checkbox on the login form does nothing — sessions are always 30
> days either way. The social sign-in buttons are also placeholders and don't work.

### Forgot your password (`/recover`)

Enter your email and a reset link is sent to it. Things to know:

- **The link expires in 15 minutes.**
- The page always shows the same confirmation whether or not the email exists, so the
  form can't be used to check who's registered.
- Resetting your password **signs you out of every device**. That's deliberate — if
  someone else had your password, the reset should end their session too.
- **There is no way to change your password while signed in.** Settings →
  "Login & Security" just sends you to the same emailed-link flow.

### Signing in mid-booking

If you hit Reserve while signed out, you're sent to sign in and then dropped **back
onto the exact checkout you were on** — your villa, dates, guests, rooms and chosen
extras are all preserved. You never have to rebuild the booking.

---

## 3. Where you can find a place to book

There are more doors into a booking than most guests notice:

| Where | What you get |
|---|---|
| **Home hero search** | Pick a tab (Resort / Hotels / Rent), a location, guests and dates → takes you to `/search` |
| **Home — "Top picks by myVilla"** | The first 4 properties of whichever tab is active |
| **Home — "Featured …"** | Up to 8 host-promoted listings for the active tab. The row simply isn't there if that tab has none |
| **Home — promo banners** | Shortcuts to resorts and to `/promotions` |
| **`/search`** | The full filter rail — the main way to find something specific |
| **`/packages`** | Every package, grouped by type |
| **A villa's own page** | Its packages appear in a `#packages` section |
| **`/promotions`** | Three live deal cards plus per-city shortcut chips |
| **`/profile/favorites`** | Everything you've hearted |
| **Direct links** | `/place?id=N` and `/package?id=N` |
| **Header & footer nav** | Home · Search · Packages · Promotions · Help · Blog |

> **Hosts never see their own listings while browsing.** Every browse surface filters
> them out, so a host can't accidentally try to book their own place.

Two home-page sections are decorative rather than functional: **"Explore unique places
to stay"** (Maldives / Morocco / Mongolia) and the **testimonials** are hardcoded
artwork, not real listings or real reviews.

---

## 4. Searching and filtering

On `/search` you can filter by:

| Filter | Notes |
|---|---|
| **Text** | Searches property **name, city and address**. Debounced as you type |
| **Price** | Dual slider $0–$1,000 (step $10); the text boxes accept up to $30,000 |
| **Dates** | Pick **both** dates to show only places free for that whole stay |
| **Guests** | "N guests or more" — matches the property's total capacity |
| **Property type** | All types / Resorts / Hotels / Rent |
| **Amenities** | Only chips that can still return a result are shown |
| **Rating** | 1–5 stars |
| **Sort** | Newest first (default) · Price low→high · Price high→low · Top rated |

### How text search behaves

- **With a comma** — `"The Bund, Shanghai"` — the first part must match the **name**
  and the second must match the **city or address**. This is how you narrow to one
  property when a name is used in several cities.
- **Without a comma**, the whole string is matched against name, city or address.

> **There is no separate city or area filter.** The home page's location dropdown just
> writes your choice into the search text box. Searching a city name works; it's just
> free text underneath.

### Reading a result card

Each card shows the photo (with a `% OFF` badge if the host set a discount), the
**name and city**, the **property kind spelled out** ("Hotel", "Villa Living",
"Bungalow"…), the rating and review count — or **"New listing"** if nobody has
reviewed it yet — up to three amenity chips, and the nightly price. The heart saves
it to favorites.

**A rating filter hides unrated listings.** If you filter to 4+ stars, brand-new
properties with no reviews won't appear — they have no rating to meet the bar.

---

## 5. Property types — villa vs hotel vs resort

**This is the single most important distinction in MyVilla.** It determines what you
are actually buying.

### The kinds a host can choose

`Villa Living` · `Combinative Villa` · `Hotel` · `Resort` · `Bungalow` ·
`Others (specify)`

### But there are really only two booking models

| | **Hotel · Resort** | **Everything else** (Villa Living, Combinative Villa, Bungalow, Others) |
|---|---|---|
| **What you book** | A **number of rooms** | **The whole property** |
| **Can others book it on your dates?** | **Yes** — you take some rooms, other guests take others | **No** — you have the entire place |
| **Room picker?** | Yes | No — there's nothing to pick |
| **Capacity limit** | rooms × people-per-room | The property's total guest cap |
| **Price scales with** | rooms × nights | nights only |
| **Calendar blocks a date when** | **every** room is taken | **any** booking exists |
| **Per-guest room cap** | None — book as many rooms as exist | Not applicable |
| **Per-guest day limit** | Optional, host-set (max nights per guest) | Not applicable |
| **Rooms can vary mid-stay** | Yes ("adjusted stay") | No |

### ⚠️ There are no room numbers

A common assumption is that booking a hotel means picking room 204. **MyVilla has no
concept of a room number, room type, floor or bed configuration.** A hotel or resort
has one number — how many rooms exist — and one nightly price that applies to all of
them.

When you book "3 rooms", you are reserving **three rooms' worth of the property's
capacity for those nights**. Which physical rooms you get is between you and the host
at check-in. This also means:

- Every room at a property costs the same.
- You can't choose a sea-view room over a courtyard room.
- There's no room-level availability, only a count of how many are still free.

### Why "Villa Living" bookings block the whole calendar

Because there's nothing to share. If someone books a villa for 12–15 July, those
nights are gone for everyone else — the calendar greys them out. At a hotel, those
same dates stay bookable until the **last** room goes, which is why hotel calendars
show a per-night count of rooms still free instead of a simple blocked/free state.

### The guest-facing grouping

However many kinds exist, search and the home tabs collapse them into three buckets:

- **Resorts** — kind is exactly `Resort`
- **Hotels** — kind is exactly `Hotel`
- **Rent** — literally *everything else*

So a Bungalow and a Combinative Villa both live under "Rent". The precise kind is
still printed on the search card and the detail page.

---

## 6. The villa detail page

`/place?id=N` shows:

- Photo gallery (click to open a lightbox)
- Name, city, rating and review count
- **Description**
- **Facilities Provided** — what comes with the stay, free
- **Extra Services** — paid add-ons, each with a price
- **Packages** — this property's fixed bundles, if it has any
- Reviews, with a star distribution
- The **booking card** on the right

### Facilities vs Extra Services

- **Facilities** are included. Wifi, free parking, and any service the host prices at
  $0.
- **Extra Services** cost money — typical ones are Airport Pickup ($25), Daily
  Housekeeping ($15), Private Chef ($60). You tick these directly on the booking card
  and they're added to your total.

A paid add-on never appears in both lists — if a host offers something both free and
paid, it shows only under Extra Services.

---

## 7. Booking a nightly stay

The flow is: **pick dates → pick rooms (hotels/resorts only) → pick guests → tick any
extras → Reserve → checkout → confirmed.**

### Date rules

| Rule | Value |
|---|---|
| How far ahead you can book | **3 months** from today |
| Longest stay bookable online | **30 nights** |
| Earliest check-in | Today |
| Minimum stay | 1 night |

Dates are **half-open** — the day you check out is free for the next guest, so a
14th→17th booking occupies the nights of the 14th, 15th and 16th.

You *can* select a stay longer than 30 nights on the calendar. It isn't refused —
Reserve simply becomes **"Request a call from the host"**, because a stay that long is
a real request that just can't complete itself online.

### Availability is checked when you click, not announced

The card doesn't nag you about availability while you're choosing. If you press
Reserve on dates that are actually taken, *then* it tells you:

> "This villa is already booked for 14 Jul-17 Jul. Please choose different dates."
> — or, for a hotel — "No rooms left for 14 Jul-17 Jul. Try fewer rooms or different
> dates."

### Guests

The guest picker's ceiling depends on the property type: a villa's own guest cap, or
`rooms × people-per-room` for a hotel/resort. You can't select more guests than the
place sleeps.

### Booking your own place

You can't. Owners are redirected away from checkout for their own listings.

### Locked listings

A host can stop taking new bookings without deleting the property. When that happens
the listing **disappears from search, home, packages and even your favorites** (the
favorite itself survives — the card returns if the host unlocks it). Stays already
booked go ahead as normal.

---

## 8. Rooms at a hotel or resort

The Rooms picker offers **the property's entire inventory** — every room it has, since
rooms aren't rationed per guest. Asking for the whole building is a legitimate request.

Next to your choice you'll see live context:

- `3 rooms · 5 available` — how many are free on every night of your range
- `· only 2 bookable by you` — your ask is short, and evenly so
- `Sold out for these dates` — no rooms at all

Counts above 6 are **dimmed and marked with ☎** before you even pick them, with a
tooltip explaining the host will arrange it.

### The calendar shows how full it is

For hotels and resorts, each date on the calendar carries the number of rooms still
free that night. A date is only blocked (struck through) when **every** room is gone.

---

## 9. The booking-days limit — and how to book more

There is **no cap on rooms.** A hotel or resort lets you book **as many rooms as it
physically has** for your dates — pick 1, 9, or the whole building.

### The rule

What a property *can* limit is **how many nights** one guest books there:

> **A property may set a maximum number of booking days per guest — the most distinct
> nights one guest can hold across all their stays there. 0 (blank) means no limit.**

Three details matter:

1. **It's counted in distinct nights, not rooms or bookings.** Taking more rooms on a
   night you already hold — or making a second booking on that night — costs **no
   extra days**. Booking the 22nd and 23rd uses 2 of your nights however many rooms
   you take.
2. **It counts nights you already hold there.** With a 4-night limit, booking the
   22nd–25th uses all 4; after that you can't book another date at that property.
   Book only the 22nd–23rd and you have **2 nights left** to book later — but no more
   than that. Splitting across several bookings can't beat it: the app adds up every
   night you already hold before deciding.
3. **Most properties set no limit at all.** When they don't, you book freely up to the
   30-night per-stay ceiling.

### So how do you book more nights than the limit?

**You ask the host to arrange it.** This is a first-class flow, not a workaround —
exactly the same one used for over-long stays.

1. Pick the dates you actually want. When they'd put you over the property's day
   limit, the Reserve button is replaced by a panel: *"The host arranges this one with
   you directly"*, listing exactly why (e.g. "5 nights at this property — the host
   lets one guest book at most 4 online").
2. Optionally add a note (up to 500 characters) — *"Anything else the host should
   know?"*
3. Press **"Request a call from the host"**.

**What's sent with the request:** your dates, your room count, your party size, any
paid extras you'd already ticked, and your note. The card tells you this explicitly
so you don't waste the note retyping dates:

> "Your dates (14 Jul-17 Jul), 9 rooms and 18 guests are sent with the request."

**What happens next:**

- You see *"Call requested — the host will be in touch soon."*
- The host gets a notification with someone genuinely waiting on the other end.
- A **My Requests** section appears in your account (it's hidden until you have one)
  where you can **chat with the host** — your opening note becomes the first message
  of the thread. Messages are capped at 500 characters. Enter sends, Shift+Enter
  makes a new line, Escape closes; the empty thread reads *"No messages yet. Say
  hello — they'll see it in their account and get a notification."*
- **The chat is live.** When the host replies while your thread is open, the new
  message appears **without a refresh** — MyVilla keeps a real-time connection open
  for chat. If your connection drops, it reconnects on its own, and you still get a
  notification either way, so nothing is missed. You'll get a notification when the
  host replies, and the section badges unread replies.
- When the host sets the stay up, it arrives as a **Payment Pending** booking (see
  [section 16](#16-payment-pending--stays-your-host-arranged)).

**Rules on requests:**

- You must be signed in. Signed out, you're sent to log in and returned to the
  property page.
- You can't request a call about your own property.
- **One open request per property per date range** — asking twice gets *"You've
  already requested a call for these dates. The host will be in touch."*
- Rate-limited to 5 requests a minute.
- The thread is deleted when the host marks the request handled. There's no archive
  by design — the chat exists to arrange one booking.

### The other reason you'd be routed to a call

Same flow, different trigger: **a single stay longer than 30 nights**. Both reasons can
apply at once, and the panel lists each one.

### What a call *can't* fix

**A call cannot conjure rooms that don't exist.** If the property is genuinely sold
out, you get "Sold out for these dates", not a call offer. The call route exists for
limits *the host can waive* — the property's per-guest day limit and the 30-night
ceiling — not for physical inventory.

**Packages are exempt from the day limit entirely.** A package's length is the host's
own design — a Monthly Retreat runs its full 28 nights — and refusing the host's own
bundle would be absurd. Only real inventory limits it.

---

## 10. Adjusted stays (rooms that change mid-stay)

A hotel often has fewer rooms free at the start of your range than at the end. Rather
than capping your whole stay at the worst night — or quietly selling you less than you
asked for — MyVilla offers a **room plan**: different room counts over consecutive
stretches.

Say you ask for 4 rooms, 16–20 July, and only 2 are free on the 16th–17th:

> **We can't hold 4 rooms for every night**
> Here's what's free across your dates:
> - 16 Jul-18 Jul — **2 rooms**
> - 18 Jul-20 Jul — **4 rooms**

You then choose between three options:

1. **Book with this adjustment** (default) — keep all your nights, pay only for the
   rooms you have each night.
2. **Keep 2 rooms for the whole stay** — the same count every night, nothing changes
   mid-stay.
3. **Need all 4 rooms every night?** — request a call, and the host arranges it.

That third option matters: the first two are both compromises, and a guest who
genuinely needs 4 rooms every night shouldn't have to accept one or walk away.

### How an adjusted stay is priced and how many it sleeps

- **You're charged per room-night** — you only pay for the rooms you actually have on
  each night.
- **Occupancy sums each leg**, it isn't the peak. A 1-room leg (2 guests) plus a
  6-room leg (12 guests) offers **14**, not 12 — the legs host on different nights.

The split you're shown is **recalculated on the server** at checkout and again when
you confirm, from live availability. The price can never be set by your browser, and
an offer can't go stale between being shown and being booked.

**One catch:** an adjusted stay **can't have its dates changed afterwards**. Its room
counts are tied leg-by-leg to specific nights, so there's no honest way to re-price it
against new dates. You can still cancel it and rebook. You'll be told this plainly if
you try.

---

## 11. Overlapping your own bookings

If your new dates overlap rooms you already hold at the same property, MyVilla works
out what you actually need rather than refusing you:

| Situation | What happens |
|---|---|
| **You're extending** — hold 4 rooms 24–26, ask for 4 rooms 24–29 | Books **only 26–29**. You're told: *"Your rooms already cover part of these dates — this booking adds 26 Jul-29 Jul, and you only pay for the new nights"* |
| **Fully covered** — you already hold everything you asked for | Nothing to book. You're pointed at **My Bookings** to change the existing stay, or told to pick a higher room count to add rooms |
| **Topping up** — hold 4, ask for 5 | Adds **1 room** on those nights, not 5. The ask is a total, not an addition |
| **Your rooms cover the middle** | A single booking can't skip its own middle nights, so you're told to book the two ends separately |

When your booking overlaps stays you've already paid for, the price breakdown shows
**the full stay including the rooms you already hold**, then subtracts **what you
already paid — service fee and all** — on its own line:

> "You only pay the difference — what you paid earlier is taken off above, service fee
> and all."

The deducted figure is the amount you'd find on your bank statement, so the villa
page, checkout and your receipt all tell the same story.

---

## 12. Packages

### What a package is

> **An all-inclusive bundle a host puts together: a fixed number of nights, a set
> price, and every listed experience included.**

The defining traits:

- **The nights are fixed.** You don't choose the length.
- **The price is one flat total** for the whole stay — accommodation *and* inclusions.
- **No nightly rate, no service fee, no long-stay discount** is added on top.
- **The inclusions can't be unbundled.** It's all-or-nothing — you can't drop the
  airport pickup for a discount.
- **You can't add Extra Services** to a package. The inclusions *are* the bundle.
- **The occupancy is fixed** at the package's "up to N guests". It's a cap sold at a
  fixed price, not a per-head charge — so you pay the same whether you bring 4 or 8.

**The only thing you choose is the start date.**

### The four package types

| Type | Nights | Advertised discount | Blurb |
|---|---|---|---|
| **Curated Package** | Host's choice | Host's choice | "One-off getaways our hosts put together — your own nights and price." |
| **Weekend Getaway** | 3 | 0% | "A short 3-night escape at the standard nightly rate." |
| **Weekly Escape** | 7 | 15% | "A full week with a 15% long-stay discount baked in." |
| **Monthly Retreat** | 28 | 30% | "Live like a local for a month — 30% off the nightly rate." |

### Booking one

1. Find it on `/packages`, on the property's page, or via `/package?id=N`.
2. The widget shows what's fixed — **Duration**, **Guests** ("Up to N"), and
   **Reserves** ("3 rooms" or "The whole villa").
3. **Pick a start date.** Dates where the full span won't fit are greyed out — the
   calendar checks the *entire* run of nights, not just your start day.
4. **Book this package** → checkout, which shows "Package Details" and one
   all-inclusive `Total (USD)`.

### Packages at a hotel or resort

**The rooms are worked out for you.** A package that sleeps 12 at a hotel with 2
people per room automatically reserves 6 rooms. You never pick a room count, and the
property's per-guest day limit doesn't apply.

### Other package facts

- **Packages ignore the 30-night ceiling** — a Monthly Retreat is 28 nights by design,
  and its length is the host's, not yours.
- Start dates are still bound by the **3-month booking window**.
- Your package is **snapshotted onto your booking** — its name, nights, guests, price
  and inclusions are frozen at the moment you book, so your history stays true even if
  the host later edits or deletes the package.
- **A locked package** still opens by direct link (so guests who booked it can follow
  their links) but the booking widget is replaced by: *"Not taking bookings — if you
  already booked it, your stay goes ahead as normal."*
- **Locking a property takes its packages down with it.**
- A package stay can only have its **start date** moved afterwards — length, occupancy
  and price are fixed. See [section 15](#15-after-you-book-view-change-cancel).

---

## 13. Prices, discounts and fees

### The nightly formula

```
subtotal      = nightly price × rooms × nights
discount      = the BETTER of { host's standing discount, length-of-stay discount }
service fee   = 18% of (subtotal − discount)
total         = subtotal − discount + service fee   (+ any paid extras)
```

### Automatic length-of-stay discounts

| Stay length | Discount |
|---|---|
| **7+ nights** | **15% off** |
| **28+ nights** | **30% off** |

**No promo code needed** — it's applied automatically at checkout.

### Host discount vs stay discount

You always get **whichever is larger**. If a host offers a standing 20% and your
14-night stay earns 15%, you get the 20%. You're never charged more than either would
give, and the two don't stack.

### The service fee

**18%**, charged on nightly stays only, calculated *after* the discount. **Packages
carry no service fee at all** — their price is the whole price.

### What "Total before taxes" means

The booking card's headline figure. Taxes aren't calculated anywhere in the app.

---

## 14. Checkout and payment

Reaching `/payment` requires an account — signed-out guests are sent to log in and
returned to the identical checkout.

### What checkout shows

- Confirmation the place is free for your dates
- **Price Details** (or **Package Details**) — the full breakdown
- Your contact details, prefilled from your profile
- Payment method
- The **cancellation policy**, spelled out before you pay

### Payment methods

**Credit/Debit Card**, **PayPal**, or **Google Pay**. Choosing a wallet hides the card
form — *"You'll pay with PayPal — no card details needed."*

Card entry validates the number (13–19 digits), the expiry (**a past expiry is
rejected**) and a 3–4 digit CVV.

> ### Your card details are never stored
> This is a demo payment step. Card details stay in your browser and are used only to
> simulate the payment — **only the booking itself is saved**. There are no saved cards
> on your account, so you enter details fresh each time. (The card fields that *do*
> exist in the database belong to **hosts**, for payouts — they're nothing to do with
> your card.)

### A stay starting today

Checkout warns you **before** you pay rather than after:

> **Your stay starts today, so this booking can't be cancelled.** A booking can only be
> cancelled before its check-in date.

### Confirmation

You get a booking reference in the form **`MV-000123`**, and the page survives a
refresh or a shared link. Your host is notified. **Booking a property removes it from
your favorites** — the wishlist tracks places still to book.

### If the dates went while you were paying

Two different outcomes, deliberately distinguished:

- **Someone else took them** — "Already booked for these dates", with links to pick
  new dates or find similar places in the same city.
- **It was your own booking** — *"Your stay is confirmed"*, not a scary error. This is
  what you see if you paid and then refreshed.

---

## 15. After you book: view, change, cancel

### My Bookings (`/profile/bookings`)

Four sections:

1. **Payment Due** — host-arranged stays awaiting your payment
2. **Active Bookings** — confirmed stays
3. **Booking History** — everything past or closed
4. **Package stays** — kept separate

You can search your bookings by villa, kind, package, dates, reference or status, and
sort each section newest/oldest. Expanding a row shows the amount, reference, nights,
rooms, add-ons and receipt.

### Statuses

| Status | Meaning |
|---|---|
| **Confirmed** | Paid and held |
| **Payment pending** | A host arranged it; **it holds nothing until you pay** |
| **Completed** | Your checkout date has passed |
| **Cancelled** | Called off by you or the host |
| **Declined** | Rejected |

"Completed" is derived from the calendar — a confirmed stay whose checkout date has
passed is Completed, automatically.

### Changing a booking

Manage a stay at `/booking?id=N`. What you can change depends on what kind of stay it
is:

| Stay type | What you can change |
|---|---|
| **Nightly** | **Everything** — dates, length, rooms, guests, add-ons |
| **Package** | **Start date only** — the whole span shifts, price unchanged |
| **Adjusted (room plan)** | **Nothing.** Read-only — cancel and rebook instead |

**How the money reconciles:**

- **Costs more** → you're sent to checkout to pay **only the difference**. Checkout
  shows "Already paid" and "Balance due now".
- **Costs the same or less** → applied immediately, and the difference is refunded to
  your original payment method. The button says exactly what will happen — e.g.
  *"Update & refund $84.00"*.

**On a locked property**, your dates are frozen but **rooms, guests and add-ons can
still change**, and you can still cancel. Only re-dating is refused.

**A host-arranged, night-by-night stay** can't be edited online: *"Your host arranged
this stay night by night to fit the calendar… ask your host to change the dates, rooms
or guests and they'll rearrange it for you. You can still cancel below."*

### Cancelling and refunds

> ### The policy as shown to you
> **You can cancel any time before your check-in date and get a 50% refund of your
> booking total. Once your stay begins, the booking can no longer be cancelled.**

- **Who** — only you, for your own bookings.
- **When** — before your check-in date. The Cancel button disappears on the check-in
  day itself.
- **What you get back** — **50%** of your booking total.
- **Cancelling a "Payment pending" stay** is just declining something you never asked
  for and never paid for. Same button, no money involved.
- Cancelling can't be undone, frees the dates immediately, and notifies your host.

**If your *host* cancels on you, you get a 100% refund** — the full amount, because the
cancellation wasn't your choice. You're notified.

> ⚠️ **The Extenuating Circumstances policy does not cover travel disruption caused by
> COVID-19.**

See [Known gaps](#19-known-gaps--things-that-are-simulated) — the 50% refund is
currently displayed text rather than something the code calculates or pays out.

---

## 16. Payment Pending — stays your host arranged

This is how a booking the host set up for you — typically after a call about a big
room block — reaches you.

### The critical thing to understand

> **A "Payment pending" booking holds nothing.** The rooms are **not** reserved. Someone
> else can still take them. **Paying is what reserves them.**

The app never pretends otherwise:

> "*Alena* booked this stay for you at The Bund and is asking you to pay for it. Paying
> is what reserves the rooms for 14 Jul – 17 Jul — until then they aren't held."

### Where you'll find it

**Payment Pending** (`/profile/payments`) — badged in your account nav with a count, so
you don't have to open the page to notice. Despite the route name, it is **not** a
payment history and **not** saved cards — only unsettled stays appear, and stays you
book yourself are paid at checkout so they never show up here.

### The two shapes

1. **Pending** — a fresh host-arranged booking. Nothing is held yet (amber warning).
2. **Accepted with a balance due** — an **upgrade that absorbed a stay you already
   paid for**. Your rooms **are** held; you only owe the difference (green note).

### What you'll see

Villa, kind, status, reference, dates, guests, rooms, add-ons and a three-row receipt:

```
Full stay
− Host's discount
− You already paid       (credit from the stay this replaced)
= Due now
```

Your host can grant a discount (percentage and/or fixed amount) on a stay they
arrange, and it's shown on its own line.

**You're never charged for anything you leave unpaid.** You can decline by cancelling.

If the rooms are taken before you pay, you're told **before** being charged: *"Those
rooms were taken before this booking was paid for. Ask your host to arrange new
dates."*

---

## 17. Reviews, favorites and notifications

### Reviews

- **When** — only after your **checkout date has passed**. Earlier attempts get "You
  can rate this stay after your checkout date."
- **What** — **1 to 5 stars**, plus an optional comment (up to 1,000 characters).
- **One review per booking**, not per property. Stay somewhere three times, review it
  three times.
- **You can't edit or delete a review.** Rating is one-shot and permanent.
- Your rating immediately folds into the property's running average, and the host is
  notified — good or bad.
- Rate from **Booking History** by clicking a star, which opens the composer prefilled
  with that rating.

> **Reviews on your own profile page** are a host feature. If you don't list
> properties, `/account` won't show a review count or a reviews section — you have no
> reviews *about you* to show. This has nothing to do with your ability to write them.

### Favorites

- **The heart on any card** toggles it. Signed out, you're prompted to log in rather
  than shown an error.
- They live at **My Favorites** (`/profile/favorites`), newest first, searchable.
- **Booking a saved place removes it automatically** — the wishlist is for places still
  to book. You're told this on the page.
- **Locked listings vanish from the list but the favorite survives** — the card returns
  if the host unlocks it.

### Notifications

The bell in the header. As a guest you'll receive:

| Type | Why |
|---|---|
| **Payment request** | A host arranged a stay awaiting your payment — the one kind with something to do |
| **Booking cancelled** | Your host called off your stay |
| **New message** | A host replied in a call-request thread |

How it behaves: the dropdown lists your 12 most recent, but **the badge counts all
unread** (it shows "9+" past nine). **Closing the dropdown marks everything read** —
not opening it, which would clear the bold and dots you came to read. Notification
text is written when the event happens and stored as-is, so "Alena booked The Bund"
still reads true even if the property is renamed later.

---

## 18. Your account

### Two different pages

- **`/profile` — "Profile Settings"** — your details
- **`/profile/settings` — "Settings"** — the hosting toggle, plus links to the above
  and to password recovery

### What you can edit

Full name · Gender (Female / Male / Non-binary / Prefer not to say) · Date of birth ·
Address · Profile picture

Saving asks you to confirm first.

### What you can't edit

> **Your email address can never be changed from the app.** It's read-only by design —
> it's what keeps your Customer ID stable.

**Phone number, dial code and country** are set at signup and are read-only afterward,
though your phone is displayed on `/account`.

### Profile picture

"Change Picture" → pick a file → it's **previewed first and only uploaded when you
confirm**. JPG, PNG, WEBP, GIF or AVIF, **up to 8 MB**. Files are checked by their
actual content, not just their extension.

### Your Customer ID

A public identifier like **`subhamdas@a9345ds`** — a readable half from your email plus
a random half that makes it unique. You'll find it on `/account` as a **click-to-copy
chip**.

> **It's assigned at signup and fixed for life.** It deliberately doesn't follow your
> name: an identifier that mutates isn't an identifier. Anything you've already quoted
> — a support ticket, a receipt — must keep resolving. It's read-only by design;
> there's nothing to edit.

Quote it when contacting support. Hosts also see it when booking on your behalf, so
they can confirm they've got the right person when names collide.

### Your public account page (`/account`)

Reached as **"My Account"** from the avatar menu. It shows your avatar, name,
*"Joined in {Month YYYY}"*, your email and phone, your click-to-copy Customer ID
chip, an **"Identity Verified"** badge, and an **"Edit Profile"** button (→
`/profile`). It also carries a safety reminder:

> *"To protect your payment, never transfer money or communicate outside of the
> MyVilla website or app."*

As a plain guest (you don't list properties) this page **won't** show a review
count, a "My Villas" section, or a "Reviews" section — those are host-only, because
reviews attach to properties you don't own. (The "Identity Verified" badge is
static — see [Known gaps](#19-known-gaps--things-that-are-simulated).)

### Becoming a host

Flip **Hosting mode** in Settings, or just list a property (which enables it
permanently). Turning it *off* is refused while you still own listings — you'll be
asked to remove them from My Property first.

### Support

- **support@myvilla.com**
- **+1 (300) 2590-212** — Mon–Fri, 9:00–18:00
- Answers within one business day

---

## 19. Known gaps & things that are simulated

Documented honestly so nobody — guest, support agent or chatbot — promises something
the app doesn't do.

### Payments and refunds are simulated

- **No real money moves.** Card details are used only in the browser to simulate the
  payment step. Nothing is charged, and no card is stored.
- **The 50% cancellation refund is displayed text, not code.** Cancelling flips the
  booking's status; nothing calculates, records or issues a refund. There is no refund
  ledger and no payment-processor integration. The same is true of the 100% host-cancel
  refund. (The one place refund *arithmetic* exists is the modification top-up/refund
  difference.)

### Contradictions in on-screen text

- **My Bookings still carries pre-policy boilerplate** — "Cancellation charges vary
  from property to property…" — which contradicts the flat, platform-wide 50%.
  **Per-property cancellation policies don't exist anywhere in the system.**
- **Cancel deadline off-by-one.** Everything you can see blocks cancelling on the
  check-in day, but the server action would still accept it if called directly.
- **The Promotions "top-rated" card** counts properties at 4.5+ stars but its link
  filters at 4+, so the destination shows more than the card advertises.
- **Package type blurbs advertise discounts** ("15% long-stay discount baked in") but a
  package's price is whatever the host set — the advertised percentage is never applied
  to it at checkout. The flat price is the price.

### Inert or placeholder UI

- **"Remember me"** on login does nothing — sessions are always 30 days.
- **Social sign-in buttons** are placeholders.
- **`/about` is Lorem ipsum.** **`/blog` is entirely mock data** — every article links
  to the same page.
- **Home testimonials** are hardcoded, not real guest reviews.
- **The "Explore unique places to stay" cards** (Maldives / Morocco / Mongolia) aren't
  real listings and don't link to one.
- **The search sidebar's promo banners** don't go anywhere.
- **The service-fee and policy links** at checkout are placeholders.

### Missing coverage

- **The FAQ says nothing about packages**, despite Packages being top-level
  navigation — nothing on fixed nights, the start-date-only pick, the non-unbundleable
  inclusions, or the absent service fee.
- **There's no signed-in password change** — only the emailed-link flow.
- **There's no city/area filter** on search, only free text.
- **`"Others (specify)"`** is stored and displayed to you literally as the property
  kind — there's no free-text capture behind it.

---

## 20. Quick reference — every limit and rule

| Rule | Value |
|---|---|
| **Rooms one guest may hold per night, per property** | **6** (packages exempt) |
| **Longest stay bookable online** | **30 nights** (packages exempt) |
| **How far ahead you can book** | **3 months** |
| **Minimum stay** | 1 night |
| **Minimum age to book** | **18** |
| **Service fee** | **18%**, nightly stays only — never on packages |
| **7+ night discount** | **15%**, automatic |
| **28+ night discount** | **30%**, automatic |
| **Host vs stay discount** | The larger one wins; they don't stack |
| **Cancellation refund (you cancel)** | **50%**, before check-in only |
| **Cancellation refund (host cancels)** | **100%** |
| **Cancellation deadline** | Before the check-in date |
| **Review window** | After your checkout date |
| **Review** | 1–5 stars, one per booking, permanent |
| **Review comment limit** | 1,000 characters |
| **Password minimum** | 8 characters |
| **Session length** | 30 days |
| **Password reset link** | **15 minutes** |
| **Avatar upload** | 8 MB — JPG/PNG/WEBP/GIF/AVIF |
| **Call-request note / chat message** | 500 characters |
| **Chat delivery** | Real-time (live) while the thread is open; notification as fallback |
| **Open call requests** | One per property, per date range |
| **Booking reference format** | `MV-000123` |
| **Currency** | USD |
| **Room numbers** | **Don't exist** — you book a count of rooms |
| **Host approval** | **Not required** — payment confirms your booking |

### The five things guests most often get wrong

1. **Hotels don't have room numbers here.** You book a *quantity* of rooms. Which
   rooms you get is arranged with the host.
2. **A villa books whole; a hotel books by the room.** That's why villa calendars
   block entirely and hotel calendars count down.
3. **There's no room cap — book as many rooms as the hotel has.** What a property can
   limit is your total *nights* there (an optional host-set booking-days limit).
4. **To book more nights than a property's day limit, pick the dates you want anyway**
   and press "Request a call from the host". It's the intended route, not a failure.
5. **A package's price is the whole price** — no service fee, no extras, no per-head
   charge, and the inclusions can't be split apart.

---

## 21. Appendix A — Help Center FAQ (verbatim)

This is the actual FAQ shown at `/help` ("Help Center" → *"Quick answers about
booking, hosting and your account."*), reproduced so answers match the app exactly.
It's grouped into three sections.

### Booking a villa

**How do I book a villa?**
Find a place via Search, open it, pick your check-in and check-out dates and number
of guests, then press Reserve and complete checkout. Paying confirms your stay
instantly — you'll get a booking reference (like MV-000123) and the host is notified.

**What do the booking statuses mean?**
Confirmed means your stay is booked — that happens as soon as you pay at checkout,
with nothing for the host to approve. Cancelled shows bookings you called off, and
Completed appears automatically after your checkout date passes.

**Why can't I select certain dates?**
Dates that overlap another guest's confirmed stay can't be booked — the villa page
tells you when your selection is unavailable. Past dates can't be booked either.

**How do discounts work?**
Stays of 7 nights or more get 15% off, and 28 nights or more get 30% off. The
discount is applied automatically on the villa page and at checkout — no promo code
needed.

**How do I cancel a booking?**
Open My Bookings and press Cancel Booking next to an active stay. Cancellation
charges may apply depending on the property.

### Account & payments

**How do I change my profile details or picture?**
Everything is under Profile Settings — edit any field and press Apply Changes, or use
Change Picture to upload a new photo.

**I forgot my password.**
Use "Recover your password" from the sign-in page to set a new one.

**Is my card information stored?**
No. Card details are used only in your browser to simulate the payment step and are
never sent to or stored on our servers. Only the booking itself (dates, guests,
villa) is saved.

> **What the FAQ leaves out.** It says nothing about **packages** (fixed nights,
> start-date-only booking, non-removable inclusions, no service fee), and the cancel
> answer's *"charges may apply depending on the property"* contradicts the flat,
> platform-wide **50%** policy shown at checkout — per-property cancellation policies
> don't exist. Trust [section 15](#15-after-you-book-view-change-cancel) over the FAQ
> on cancellation.

There's also a **hosting** FAQ section on the same page, relevant only if you list a
property (how to list, where bookings appear, how to edit or remove a listing).

### Still need help?

*"Our support team answers within one business day."*
- **Email:** support@myvilla.com
- **Phone:** +1 (300) 2590-212 — Mon–Fri, 9:00–18:00

---

## 22. Appendix B — Site navigation & support

### Header (top nav)

**Home · Search · Packages · Promotions · Help · Blog.** Signed out, you also see
**Signin** and a **Get Started** button (→ register). Signed in, the nav is followed
by the **notification bell** and your **avatar menu**.

The avatar menu lists: **My Account**, then your account sections (My Bookings,
Payment Pending, My Favorites, My Requests — plus host sections if you host), then
**Settings**, then **Sign out**. An amber dot on the avatar means something needs
attention (an unpaid stay, or — if you host — a guest waiting on a call).

### Footer

Grouped into columns. Working links: **About MyVilla** (`/about`), **How it works** /
**Help Center** / **Contact us** (`/help`), **Packages**, **Blog**, **Host your
villa**, **Promotions and events**, **Privacy policy**, **Terms of service**. Many
others — Partnership programs, Affiliate program, Connectivity partners,
Integrations, Community, Loyalty program, Trust and safety, Accessibility, the app
badges, and the social icons — are **placeholders that go nowhere** (`#`). The
copyright reads *"© 2022 MyVilla incorporated"*.

### Static pages

- **`/about`** — an About Us page whose body text is **Lorem ipsum** placeholder.
- **`/blog`** — a blog with **mock articles** (every article links to the same page).
- **`/terms`**, **`/privacy`** — terms of service and privacy policy pages with
  generic content and cross-links to Help.

### Support

- **support@myvilla.com**
- **+1 (300) 2590-212** — Mon–Fri, 9:00–18:00
- Answers within one business day.
