// Shared between the host wizard (client) and the /host page (server).
// Deliberately NOT a "use client" module: values exported from a client module
// become client references in server components — spreading one there yields
// an empty object, silently dropping keys like `step` and `payment`.

/** A chargeable extra service on a villa. price 0 = free. */
export type VillaService = { name: string; price: number };

// Predefined extra services hosts can offer (chargeable, priced per stay).
export const SERVICES = [
  "Free Cancellation before a week",
  "Free Wifi",
  "Free meal on first day",
  "Pre-order mean preperations",
  "Long Stays",
  "Butler",
  "House Keeping",
];

// Facility options — these describe the villa itself (searchable amenities),
// so they save into villa.facilities and are never charged for.
export const FACILITY_CHIPS = [
  "Wifi", "Free Parking", "Air Conditioner", "Long Stays", "Smoke Alarm",
  "Swimming Pool", "Jaccuzzi", "BBQ Corner", "TV",
];

// A listing must show between MIN and MAX photos. Enforced in the wizard and
// again server-side on save (shared so the two can't drift apart).
export const MIN_VILLA_IMAGES = 5;
export const MAX_VILLA_IMAGES = 8;

export type Draft = {
  step: number;
  personal: {
    fullName: string;
    gender: string;
    email: string;
    dob: string;
    address: string;
  };
  villa: {
    kind: string;
    name: string;
    description: string;
    area: string;
    address: string;
    city: string;
    rooms: string;
    maxGuests: string;
    /** Hotels/resorts: max occupancy of one room (empty for whole-villa kinds). */
    peoplePerRoom: string;
    facilities: string[];
  };
  images: string[];
  services: {
    selected: string[];
    /** Dollar amount the owner charges per service; missing/empty = free. */
    prices: Record<string, string>;
    /** Owner-added services (beyond the predefined list). */
    customs: string[];
    /** Legacy free-text field from old saved drafts; folded into customs. */
    custom?: string;
  };
  price: number;
  /** Host-set % off the nightly price (0 = none). */
  discount: number;
  payment: { methods: string[]; accountType: string; cardNumber: string };
};

export const DEFAULT_IMAGES = [
  "/images/host/photo-1.jpg",
  "/images/host/photo-2.jpg",
  "/images/host/photo-3.jpg",
  "/images/host/photo-4.jpg",
  "/images/host/photo-5.jpg",
  "/images/host/photo-6.jpg",
];

export const DEFAULT_DRAFT: Draft = {
  step: 0,
  personal: { fullName: "", gender: "", email: "", dob: "", address: "" },
  villa: {
    kind: "Villa Living",
    name: "",
    description: "",
    area: "",
    address: "",
    city: "",
    rooms: "",
    maxGuests: "",
    peoplePerRoom: "",
    facilities: [],
  },
  images: DEFAULT_IMAGES,
  services: { selected: [], prices: {}, customs: [] },
  price: 135,
  discount: 0,
  payment: { methods: ["Mastercard", "G Pay", "PayPal", "VISA"], accountType: "", cardNumber: "" },
};
