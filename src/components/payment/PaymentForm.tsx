"use client";

import { useState } from "react";
import Link from "next/link";
import { COUNTRIES, DIAL_CODE_OPTIONS } from "@/lib/countries";
import { createBookingAction } from "@/lib/actions";
import { formatDay, nightsBetween } from "@/lib/dates";

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
}: {
  villaId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
}) {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [expiration, setExpiration] = useState("");
  const [method, setMethod] = useState(CARD_METHOD);
  const [phoneCode, setPhoneCode] = useState("");
  const payingByCard = method === CARD_METHOD;
  const nights = nightsBetween(checkIn, checkOut);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
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
      if (!/^\d{3,4}$/.test(get("cvv"))) next.cvv = "Enter a valid CVV.";
      if (!get("street")) next.street = "Street name is required.";
      if (!get("city")) next.city = "City is required.";
      if (!get("state")) next.state = "State is required.";
      if (!get("zip")) next.zip = "Zip code is required.";
      if (!get("country")) next.country = "Please choose your country or region.";
      const email = get("email");
      if (!email) next.email = "E-mail address is required.";
      else if (!EMAIL_RE.test(email)) next.email = "Enter a valid e-mail address.";
      const phone = get("phoneNumber").replace(/[\s-]/g, "");
      if (!phone || phone.length < 6 || /\D/.test(phone))
        next.phone = "Enter a valid phone number.";
      else if (!get("phoneCode")) next.phone = "Select your country code.";
    }

    setErrors(next);
    setReference(null);
    setFormError("");
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    // Card details stay in the browser — only the booking itself is stored.
    const result = await createBookingAction({
      villaId,
      checkIn,
      checkOut,
      guests,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setReference(result.reference);
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
          <Link href={`/place?id=${villaId}`} className="text-[20px] leading-[2] text-[#121212] underline">
            Edit
          </Link>
        </div>

        <div className="mt-[15px] flex items-start justify-between">
          <div>
            <h3 className="text-[28px] font-medium leading-[1.3] text-black">Guests</h3>
            <p className="mt-[14px] flex items-center gap-[14px] text-[20px] leading-[1.3] text-[#121212]">
              {guests} guest{guests === 1 ? "" : "s"}
              <span className="text-[16px] text-[#4a4a4a]">({guests} Adults)</span>
            </p>
          </div>
          <Link href={`/place?id=${villaId}`} className="text-[20px] leading-[2] text-[#121212] underline">
            Edit
          </Link>
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
          <input
            name="street"
            type="text"
            autoComplete="address-line1"
            placeholder="Street Name"
            aria-label="Street name"
            aria-invalid={!!errors.street}
            className={`${boxBase} h-[79px] w-full rounded-t-[10px] pl-[25px] pr-[10px]`}
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
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Zip Code"
              aria-label="Zip code"
              aria-invalid={!!errors.zip}
              className={`${boxBase} -ml-px h-[79px] flex-1 rounded-br-[10px] pl-[25px] pr-[10px]`}
            />
          </div>
        </div>
        {errors.street && <ErrorText>{errors.street}</ErrorText>}
        {errors.city && <ErrorText>{errors.city}</ErrorText>}
        {errors.state && <ErrorText>{errors.state}</ErrorText>}
        {errors.zip && <ErrorText>{errors.zip}</ErrorText>}

        <div className="relative mt-5">
          <select
            name="country"
            aria-label="Country or region"
            aria-invalid={!!errors.country}
            defaultValue=""
            className={`${boxBase} h-[79px] w-full appearance-none rounded-[10px] bg-white pl-[25px] pr-[70px] text-[#696969]`}
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
        {errors.country && <ErrorText>{errors.country}</ErrorText>}
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
          aria-invalid={!!errors.email}
          className={`${boxBase} mt-[15px] h-[79px] w-full rounded-[10px] pl-[25px] pr-[10px]`}
        />
        {errors.email && <ErrorText>{errors.email}</ErrorText>}

        <div className="mt-5 flex h-[79px] items-center gap-[25px] rounded-[10px] border border-[#4a4a4a] bg-transparent pl-[25px] pr-[10px] focus-within:border-brand">
          <select
            name="phoneCode"
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
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
            name="phoneNumber"
            type="text"
            inputMode="tel"
            autoComplete="tel-national"
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
          Free cancellation before 12:00 PM on Feb 01. After that, cancel before
          12:00 PM on Feb 02 and get a full refund, minus the first night and
          service fee.
          <br />
          <Link href="#" className="font-semibold underline">
            Learn More
          </Link>
        </p>
        <p className="mt-[15px] text-[20px] leading-[1.42] text-black">
          Our Extenuating Circumstances policy does not cover travel disruptions
          caused by COVID-19.
          <br />
          <Link href="#" className="font-semibold underline">
            Learn More
          </Link>
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
      {reference && (
        <p
          role="status"
          className="mt-5 max-w-xl rounded-md bg-brand/10 px-4 py-3 text-sm text-brand-dark"
        >
          Booking confirmed — reference{" "}
          <span className="font-semibold">{reference}</span>. Your stay is
          booked and the host has been notified; find it under{" "}
          <Link href="/profile/bookings" className="font-semibold underline">
            My Bookings
          </Link>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || reference !== null}
        className="mt-[39px] flex h-16 w-[282px] items-center justify-center rounded-[10px] bg-brand px-[10px] py-[15px] text-[20px] font-medium leading-[1.2] text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Processing…" : "Confirm and Pay"}
      </button>
    </form>
  );
}
