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

export type Draft = {
  step: number;
  personal: {
    fullName: string;
    gender: string;
    email: string;
    dob: string;
    address: string;
    emergency: string;
  };
  villa: {
    kind: string;
    name: string;
    description: string;
    area: string;
    address: string;
    city: string;
    rooms: string;
    bathrooms: string;
    maxGuests: string;
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
  personal: { fullName: "", gender: "", email: "", dob: "", address: "", emergency: "" },
  villa: {
    kind: "Villa Living",
    name: "",
    description: "",
    area: "",
    address: "",
    city: "",
    rooms: "",
    bathrooms: "",
    maxGuests: "",
    facilities: [],
  },
  images: DEFAULT_IMAGES,
  services: { selected: [], prices: {}, customs: [] },
  price: 135,
  payment: { methods: ["Mastercard", "G Pay", "PayPal", "VISA"], accountType: "", cardNumber: "" },
};
