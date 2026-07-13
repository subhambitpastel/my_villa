"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COUNTRIES,
  DIAL_CODE_OPTIONS,
  countryFromDialValue,
  capPhoneNumber,
  isValidPhoneNumber,
  postalRuleFor,
  capPostalCode,
} from "@/lib/countries";
import { createBookingAction } from "@/lib/actions";
import { addDays, formatDay, formatMonthDay, nightsBetween } from "@/lib/dates";

/* eslint-disable @next/next/no-img-element */

type Errors = Partial<
  Record<
    | "card"
    | "expiration"
    | "cvv"
    | "street"
    | "city"
    | "state"
    | "zip"
    | "country"
    | "email"
    | "phone",
    string
  >
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CARD_METHOD = "Credit Card or Debit Card";
const METHODS = [CARD_METHOD, "PayPal", "Google Pay"];

/** Error keys paired with the form field to scroll to, in top-to-bottom DOM
 *  order — so a failed submit lands the guest on the first thing to fix. */
const ERROR_FIELD_ORDER: { key: keyof Errors; name: string }[] = [
  { key: "card", name: "card" },
  { key: "expiration", name: "expiration" },
  { key: "cvv", name: "cvv" },
  { key: "street", name: "street" },
  { key: "city", name: "city" },
  { key: "state", name: "state" },
  { key: "zip", name: "zip" },
  { key: "country", name: "country" },
  { key: "email", name: "email" },
  { key: "phone", name: "phoneNumber" },
];

/** "1111222233334444" → "1111 2222 3333 4444" (max 19 digits). */
const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

/** "1226" → "12/26" — the slash appears by itself after the month. */
const formatExpiration = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

/** True when a well-formed MM/YY expiry is in the past. A card is valid through
 *  the end of its expiry month, so it lapses on the 1st of the next month. */
const isExpiryPast = (mmYY: string): boolean => {
  const [mm, yy] = mmYY.split("/").map(Number);
  // JS months are 0-indexed, so `mm` (1–12) is the 1st of the month AFTER expiry.
  return new Date(2000 + yy, mm, 1) <= new Date();
};

/** Digits only, at most 4 — a CVV is 3 digits (Visa/Mastercard) or 4 (Amex). */
const formatCvv = (value: string) => value.replace(/\D/g, "").slice(0, 4);

const boxBase =
  "border border-[#4a4a4a] bg-transparent text-[22px] text-[#121212] placeholder:text-[#696969] focus:outline-none focus:border-brand";

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 text-sm text-red-600">
      {children}
    </p>
  );
}

function Chevron() {
  return (
    <img
      src="/icons/pay-chevron.svg"
      alt=""
      width={47}
      height={38}
      className="pointer-events-none absolute right-[10px] top-1/2 h-[38px] w-[47px] -translate-y-1/2 -rotate-90"
    />
  );
}

export default function PaymentForm({
  villaId,
  checkIn,
  checkOut,
  guests,
  rooms = 1,
  roomBased = false,
  services = [],
  packageId,
  profile,
}: {
  villaId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Rooms to reserve — hotels/resorts only; ignored elsewhere. */
  rooms?: number;
  /** Hotels/resorts book rooms — show the room count in the trip summary. */
  roomBased?: boolean;
  /** Chosen paid add-ons, as indices into the villa's service list. */
  services?: number[];
  /** Set when booking a fixed package instead of a nightly stay. */
  packageId?: number;
  /** The signed-in guest's saved contact details. Email + phone prefill the
   *  Additional Information; the billing country is prefilled from their saved
   *  country (it drives the ZIP-code format) while the street address is left
   *  blank for the guest to enter the address tied to their card. */
  profile?: {
    email?: string;
    phoneCode?: string;
    phoneNumber?: string;
    country?: string;
  };
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiration, setExpiration] = useState("");
  const [cvv, setCvv] = useState("");
  const [zip, setZip] = useState("");
  const [method, setMethod] = useState(CARD_METHOD);
  const [phoneCode, setPhoneCode] = useState(profile?.phoneCode ?? "");
  // Billing country is prefilled from the guest's saved country and drives the
  // ZIP-code format below. Picking a phone dial code also auto-selects the
  // matching country (the guest can still change either afterwards).
  const [country, setCountry] = useState(profile?.country ?? "");
  // Postal-code format (regex/length/example) for the selected country — e.g.
  // India accepts 6 digits ("734004"), the US 5 or 5+4.
  const zipRule = postalRuleFor(country);
  // Show a numeric keypad only when the format is purely digits (India, US…),
  // not for alphanumeric ones (UK, Canada, Netherlands).
  const zipNumeric = /^[\d\s-]*$/.test(zipRule.example);
  // The phone number field is uncontrolled — a ref lets us re-trim it to the
  // new country's max length when the dial code changes.
  const phoneRef = useRef<HTMLInputElement>(null);
  const payingByCard = method === CARD_METHOD;
  const nights = nightsBetween(checkIn, checkOut);
  const isPackage = packageId != null;
  // "Edit" reopens where the booking was configured. A package fixes its length,
  // occupancy and price — the guest only picks a start date — so editing returns
  // to the package page (start-date-only), never the villa's free date picker
  // where they could shorten a 7-night package. A nightly stay carries its
  // dates, guests, rooms and chosen services back so the card reopens as it was.
  const editHref = isPackage
    ? `/package?id=${packageId}&in=${checkIn}`
    : `/place?id=${villaId}&in=${checkIn}&out=${checkOut}&guests=${guests}` +
      `&rooms=${rooms}` +
      (services.length > 0 ? `&svc=${services.join(",")}` : "");
  // Cancellation windows, both at 12:00 PM: a full free cancellation up to 2
  // days before check-in, then a partial refund (minus first night + service
  // fee) up to 1 day before. Dates are derived from the actual check-in.
  const freeCancelBy = formatMonthDay(addDays(checkIn, -2));
  const partialCancelBy = formatMonthDay(addDays(checkIn, -1));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "").trim();

    // Wallets (PayPal / Google Pay) collect payment and billing details on
    // their own side — one click confirms the booking directly.
    const next: Errors = {};
    if (payingByCard) {
      const card = get("card").replace(/[\s-]/g, "");
      if (!card) next.card = "Card number is required.";
      else if (!/^\d{13,19}$/.test(card)) next.card = "Enter a valid card number.";
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(get("expiration")))
        next.expiration = "Enter expiration as MM/YY.";
      else if (isExpiryPast(get("expiration")))
        next.expiration = "Card has expired — enter a valid future expiry date.";
      if (!/^\d{3,4}$/.test(get("cvv"))) next.cvv = "Enter a valid CVV.";
      if (!get("street")) next.street = "Street name is required.";
      if (!get("city")) next.city = "City is required.";
      if (!get("state")) next.state = "State is required.";
      const zipValue = get("zip");
      if (!zipValue) next.zip = "Zip code is required.";
      else if (!zipRule.regex.test(zipValue))
        next.zip = `Enter a valid ${country || "postal"} code (e.g. ${zipRule.example}).`;
      if (!get("country")) next.country = "Please choose your country or region.";
      const email = get("email");
      if (!email) next.email = "E-mail address is required.";
      else if (!EMAIL_RE.test(email)) next.email = "Enter a valid e-mail address.";
      const phone = get("phoneNumber").replace(/[\s-]/g, "");
      if (!phone) next.phone = "Enter a valid phone number.";
      else if (!get("phoneCode")) next.phone = "Select your country code.";
      else if (!isValidPhoneNumber(phone, get("phoneCode")))
        next.phone = "Enter a valid phone number.";
    }

    setErrors(next);
    setFormError("");
    if (Object.keys(next).length > 0) {
      // Bring the first invalid field into view (and focus it) so the guest
      // sees what needs fixing instead of a silently-rejected submit.
      const first = ERROR_FIELD_ORDER.find((f) => next[f.key]);
      const el = first && form.querySelector<HTMLElement>(`[name="${first.name}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
      return;
    }

    setSubmitting(true);
    // Card details stay in the browser — only the booking itself is stored.
    const result = await createBookingAction({
      villaId,
      checkIn,
      checkOut,
      guests,
      rooms,
      services,
      packageId,
    });
    if (!result.ok) {
      setSubmitting(false);
      setFormError(result.error);
      return;
    }
    // Booking created — take villas AND hotels to the same confirmation page.
    // Keep `submitting` true so the button stays disabled through navigation.
    router.push(`/booking/confirmed?ref=${encodeURIComponent(result.reference)}`);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <section>
        <h2 className="text-[24px] font-semibold leading-[1.3] text-[#121212]">
          Your Trip Details
        </h2>

        <div className="mt-[15px] flex items-start justify-between">
          <div>
            <h3 className="text-[28px] font-medium leading-[1.3] text-black">Duration</h3>
            <p className="mt-4 flex items-center gap-3 text-[20px] leading-[1.2] text-[#121212]">
              {nights} Night{nights === 1 ? "" : "s"}
              <span className="text-[16px] text-[#4a4a4a]">
                ({formatDay(checkIn)} to {formatDay(checkOut)})
              </span>
            </p>
          </div>
          <Link href={editHref} className="text-[20px] leading-[2] text-[#121212] underline">
            Edit
          </Link>
        </div>

        {roomBased && (
          <div className="mt-[15px] flex items-start justify-between">
            <div>
              <h3 className="text-[28px] font-medium leading-[1.3] text-black">Rooms</h3>
              <p className="mt-[14px] text-[20px] leading-[1.3] text-[#121212]">
                {rooms} room{rooms === 1 ? "" : "s"}
              </p>
            </div>
            {/* A package fixes room count with its occupancy — nothing to edit. */}
            {!isPackage && (
              <Link href={editHref} className="text-[20px] leading-[2] text-[#121212] underline">
                Edit
              </Link>
            )}
          </div>
        )}

        <div className="mt-[15px] flex items-start justify-between">
          <div>
            <h3 className="text-[28px] font-medium leading-[1.3] text-black">Guests</h3>
            <p className="mt-[14px] flex items-center gap-[14px] text-[20px] leading-[1.3] text-[#121212]">
              {guests} guest{guests === 1 ? "" : "s"}
              <span className="text-[16px] text-[#4a4a4a]">({guests} Adults)</span>
            </p>
          </div>
          {/* Package occupancy is fixed; only nightly stays let guests change it. */}
          {!isPackage && (
            <Link href={editHref} className="text-[20px] leading-[2] text-[#121212] underline">
              Edit
            </Link>
          )}
        </div>
      </section>

      <section className="mt-[15px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="p-[10px] pl-0 text-[32px] font-medium leading-[1.3] text-[#121212]">
            Pay using
          </h2>
          <img
            src="/images/pay-logos.svg"
            alt="Mastercard, Google Pay, PayPal and Visa"
            width={301}
            height={58}
            className="h-[58px] w-[301px]"
          />
        </div>

        <div className="relative mt-[35px]">
          <select
            name="method"
            aria-label="Payment method"
            className={`${boxBase} h-[79px] w-full appearance-none rounded-[10px] bg-white p-[10px] pr-[70px] text-[#696969]`}
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setErrors({});
              setFormError("");
            }}
          >
            {METHODS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <Chevron />
        </div>

        {!payingByCard && (
          <div className="mt-[22px] rounded-[10px] border border-[#4a4a4a] p-[25px]">
            <p className="text-[22px] leading-[1.4] text-[#121212]">
              You&apos;ll pay with <span className="font-semibold">{method}</span> —
              no card details needed.
            </p>
            <p className="mt-2 text-[16px] leading-[1.5] text-[#696969]">
              Your payment and billing details are handled by {method}. Click
              Confirm and Pay below to confirm your booking.
            </p>
          </div>
        )}

        {payingByCard && (
        <div className="mt-[22px]">
          <input
            name="card"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1111 1111 1111 1111"
            maxLength={23}
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            aria-label="Card number"
            aria-invalid={!!errors.card}
            className={`${boxBase} h-[79px] w-full rounded-t-[10px] pl-[25px] pr-[10px]`}
          />
          <div className="-mt-px flex">
            <label className={`${boxBase} flex h-[79px] w-[54.3%] items-center rounded-bl-[10px] pl-[25px] pr-[10px]`}>
              <span className="sr-only">Expiration</span>
              <span aria-hidden className="mr-2 flex flex-col text-[#696969]">
                <span className="text-[16px] leading-tight">Expiration</span>
              </span>
              <input
                name="expiration"
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                maxLength={5}
                value={expiration}
                onChange={(e) => setExpiration(formatExpiration(e.target.value))}
                aria-invalid={!!errors.expiration}
                className="w-full bg-transparent text-[22px] text-[#121212] placeholder:text-[#696969] focus:outline-none"
              />
            </label>
            <input
              name="cvv"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="CVV"
              aria-label="CVV"
              maxLength={4}
              value={cvv}
              onChange={(e) => setCvv(formatCvv(e.target.value))}
              aria-invalid={!!errors.cvv}
              className={`${boxBase} -ml-px h-[79px] flex-1 rounded-br-[10px] pl-[25px] pr-[10px]`}
            />
          </div>
        </div>
        )}
        {errors.card && <ErrorText>{errors.card}</ErrorText>}
        {errors.expiration && <ErrorText>{errors.expiration}</ErrorText>}
        {errors.cvv && <ErrorText>{errors.cvv}</ErrorText>}
      </section>

      {payingByCard && (
      <section className="mt-[35px]">
        <h2 className="text-[28px] font-medium leading-[1.3] text-black">Billing Address</h2>
        <div className="mt-[15px]">
          {/* Country comes first — it sets the ZIP/postal-code format below. */}
          <div className="relative">
            <select
              name="country"
              aria-label="Country or region"
              aria-invalid={!!errors.country}
              value={country}
              onChange={(e) => {
                // Re-trim any entered ZIP to the new country's format/length.
                const next = e.target.value;
                setCountry(next);
                setZip((z) => capPostalCode(z, postalRuleFor(next).maxLength));
              }}
              className={`${boxBase} h-[79px] w-full appearance-none rounded-t-[10px] bg-white pl-[25px] pr-[70px] ${
                country ? "text-[#121212]" : "text-[#696969]"
              }`}
            >
              <option value="" disabled>
                Country or Region
              </option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
          <input
            name="street"
            type="text"
            autoComplete="address-line1"
            placeholder="Street Name"
            aria-label="Street name"
            aria-invalid={!!errors.street}
            className={`${boxBase} -mt-px h-[79px] w-full pl-[25px] pr-[10px]`}
          />
          <input
            name="apartment"
            type="text"
            autoComplete="address-line2"
            placeholder="Apartment Number"
            aria-label="Apartment number"
            className={`${boxBase} -mt-px h-[79px] w-full pl-[25px] pr-[10px]`}
          />
          <input
            name="city"
            type="text"
            autoComplete="address-level2"
            placeholder="City"
            aria-label="City"
            aria-invalid={!!errors.city}
            className={`${boxBase} -mt-px h-[79px] w-full pl-[25px] pr-[10px]`}
          />
          <div className="-mt-px flex">
            <input
              name="state"
              type="text"
              autoComplete="address-level1"
              placeholder="State"
              aria-label="State"
              aria-invalid={!!errors.state}
              className={`${boxBase} h-[79px] w-[54.3%] rounded-bl-[10px] pl-[25px] pr-[10px]`}
            />
            <input
              name="zip"
              type="text"
              inputMode={zipNumeric ? "numeric" : "text"}
              autoComplete="postal-code"
              placeholder={`Zip Code (${zipRule.example})`}
              aria-label="Zip code"
              maxLength={zipRule.maxLength}
              value={zip}
              onChange={(e) => setZip(capPostalCode(e.target.value, zipRule.maxLength))}
              aria-invalid={!!errors.zip}
              className={`${boxBase} -ml-px h-[79px] flex-1 rounded-br-[10px] pl-[25px] pr-[10px]`}
            />
          </div>
        </div>
        {errors.country && <ErrorText>{errors.country}</ErrorText>}
        {errors.street && <ErrorText>{errors.street}</ErrorText>}
        {errors.city && <ErrorText>{errors.city}</ErrorText>}
        {errors.state && <ErrorText>{errors.state}</ErrorText>}
        {errors.zip && <ErrorText>{errors.zip}</ErrorText>}
      </section>
      )}

      {payingByCard && (
      <section className="mt-[35px]">
        <h2 className="text-[28px] font-medium leading-[1.3] text-black">
          Additional Information
        </h2>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="E-mail Address"
          aria-label="E-mail address"
          defaultValue={profile?.email ?? ""}
          aria-invalid={!!errors.email}
          className={`${boxBase} mt-[15px] h-[79px] w-full rounded-[10px] pl-[25px] pr-[10px]`}
        />
        {errors.email && <ErrorText>{errors.email}</ErrorText>}

        <div className="mt-5 flex h-[79px] items-center gap-[25px] rounded-[10px] border border-[#4a4a4a] bg-transparent pl-[25px] pr-[10px] focus-within:border-brand">
          <select
            name="phoneCode"
            value={phoneCode}
            onChange={(e) => {
              const next = e.target.value;
              setPhoneCode(next);
              setCountry(countryFromDialValue(next));
              // Trim any already-typed number to the new country's max length.
              if (phoneRef.current)
                phoneRef.current.value = capPhoneNumber(phoneRef.current.value, next);
            }}
            autoComplete="tel-country-code"
            aria-label="Phone country code"
            aria-invalid={!!errors.phone}
            className={`w-[210px] shrink-0 cursor-pointer bg-transparent text-[22px] focus:outline-none ${
              phoneCode ? "text-[#121212]" : "text-[#696969]"
            }`}
          >
            <option value="" disabled>
              Code
            </option>
            {DIAL_CODE_OPTIONS.map((d) => (
              <option key={d.value} value={d.value} className="text-[#121212]">
                {d.label}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="h-[49px] w-px shrink-0 bg-[#4a4a4a]" />
          <input
            ref={phoneRef}
            name="phoneNumber"
            type="text"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={20}
            defaultValue={profile?.phoneNumber ?? ""}
            onInput={(e) => {
              e.currentTarget.value = capPhoneNumber(e.currentTarget.value, phoneCode);
            }}
            placeholder="Phone Number"
            aria-label="Phone number"
            aria-invalid={!!errors.phone}
            className="min-w-0 flex-1 bg-transparent text-[22px] text-[#121212] placeholder:text-[#696969] focus:outline-none"
          />
        </div>
        {errors.phone && <ErrorText>{errors.phone}</ErrorText>}
      </section>
      )}

      <section className="mt-[55px]">
        <h2 className="text-[28px] font-medium leading-[1.3] text-black">
          Cancellation Policy
        </h2>
        <p className="mt-[15px] text-[20px] leading-[1.42] text-black">
          Free cancellation before 12:00 PM on {freeCancelBy}. After that, cancel
          before 12:00 PM on {partialCancelBy} and get a full refund, minus the
          first night and service fee.
        </p>
        <p className="mt-[15px] text-[20px] leading-[1.42] text-black">
          Our Extenuating Circumstances policy does not cover travel disruptions
          caused by COVID-19.
        </p>
      </section>

      <hr className="mt-[20px] border-t border-[#c6c6c6]" />

      <p className="mt-[15px] text-[16px] leading-normal text-black">
        By selecting the button below, I agree to the{" "}
        <Link href="#" className="underline">Host&apos;s House Rules</Link>,{" "}
        <Link href="#" className="underline">MyVilla&apos;s COVID-19 Safety Requirements</Link>{" "}
        and the <Link href="#" className="underline">Guest Refund Policy.</Link>
      </p>

      {formError && (
        <p
          role="alert"
          className="mt-5 max-w-xl rounded-md bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-[39px] flex h-16 w-[282px] items-center justify-center rounded-[10px] bg-brand px-[10px] py-[15px] text-[20px] font-medium leading-[1.2] text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Processing…" : "Confirm and Pay"}
      </button>
    </form>
  );
}
