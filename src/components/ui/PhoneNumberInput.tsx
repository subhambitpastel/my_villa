"use client";

import { DIAL_CODES, capPhoneNumber } from "@/lib/countries";

/**
 * Controlled country-code + phone-number input. `bare` drops the outer border
 * so it can sit inside an existing bordered/underlined field (the profile
 * inline editor); otherwise it renders as a boxed field matching the wizard
 * form inputs. The number box strips anything that isn't a digit/space/dash as
 * the user types, so letters can never be entered.
 */
export default function PhoneNumberInput({
  code,
  number,
  onCode,
  onNumber,
  label,
  invalid = false,
  bare = false,
}: {
  code: string;
  number: string;
  onCode: (v: string) => void;
  onNumber: (v: string) => void;
  label: string;
  invalid?: boolean;
  bare?: boolean;
}) {
  const wrapper = bare
    ? "flex w-full items-center gap-2"
    : `flex w-full overflow-hidden rounded-[8px] border bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
        invalid ? "border-red-500" : "border-[#d9d9d9]"
      }`;
  const selectCls = bare
    ? `max-w-[130px] shrink-0 cursor-pointer bg-transparent text-[15px] focus:outline-none ${
        code ? "text-ink" : "text-muted"
      }`
    : `w-[135px] shrink-0 cursor-pointer bg-white px-3 py-2.5 text-[15px] focus:outline-none ${
        code ? "text-ink" : "text-[#9d9da6]"
      }`;
  const inputCls = bare
    ? "min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
    : "min-w-0 flex-1 bg-white px-3 py-2.5 text-[15px] text-ink placeholder:text-[#9d9da6] focus:outline-none";

  return (
    <div className={wrapper}>
      <select
        value={code}
        onChange={(e) => {
          const next = e.target.value;
          onCode(next);
          // Re-trim to the new country's max length so switching to a shorter
          // country doesn't leave an over-long number behind.
          onNumber(capPhoneNumber(number, next));
        }}
        aria-label={`${label} country code`}
        aria-invalid={invalid}
        className={selectCls}
      >
        <option value="">Code</option>
        {DIAL_CODES.map((d) => (
          <option key={d.country} value={d.code} className="text-ink">
            {d.country} ({d.code})
          </option>
        ))}
      </select>
      {!bare && <span aria-hidden className="my-2 w-px shrink-0 bg-[#d9d9d9]" />}
      <input
        type="tel"
        inputMode="tel"
        value={number}
        onChange={(e) => onNumber(capPhoneNumber(e.target.value, code))}
        maxLength={20}
        placeholder="Phone number"
        aria-label={label}
        aria-invalid={invalid}
        className={inputCls}
      />
    </div>
  );
}
