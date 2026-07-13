import Link from "next/link";
import Logo from "./Logo";

const COLUMNS: {
  title: string;
  links: { label: string; href: string }[];
  width: string;
}[] = [
  {
    title: "About",
    width: "lg:w-[200px]",
    links: [
      { label: "About MyVilla", href: "/about" },
      { label: "How it works", href: "/help" },
      { label: "Packages", href: "/packages" },
      { label: "Blog", href: "/blog" },
      { label: "Host your villa", href: "/host" },
    ],
  },
  {
    title: "Partner with us",
    width: "lg:w-[220px]",
    links: [
      { label: "Partnership programs", href: "#" },
      { label: "Affiliate program", href: "#" },
      { label: "Connectivity partners", href: "#" },
      { label: "Promotions and events", href: "/promotions" },
      { label: "Integrations", href: "#" },
      { label: "Community", href: "#" },
      { label: "Loyalty program", href: "#" },
    ],
  },
  {
    title: "Support",
    width: "lg:w-[200px]",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Contact us", href: "/help#contact" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Trust and safety", href: "#" },
      { label: "Accessibility", href: "#" },
    ],
  },
];

const SOCIALS = [
  { label: "Twitter", icon: "/icons/twitter.svg" },
  { label: "Instagram", icon: "/icons/instagram.svg" },
  { label: "Facebook", icon: "/icons/facebook.svg" },
];

export default function Footer() {
  return (
    <footer className="bg-[#fafafa]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[17px] bg-white py-4">
        <div className="flex flex-col gap-8 px-8 pb-6 pt-[60px] lg:flex-row lg:items-start lg:justify-between lg:gap-0 lg:px-[120px]">
          <div className="p-[10px]">
            <Logo />
          </div>
          {COLUMNS.map((col) => (
            <div
              key={col.title}
              className={`flex flex-col gap-2 py-4 pr-4 ${col.width}`}
            >
              <h3 className="p-1 font-nunito text-[18px] font-bold text-heading">
                {col.title}
              </h3>
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="p-1 font-nunito text-[16px] text-gray transition-colors hover:text-heading"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="flex flex-col gap-3 lg:w-[200px]">
            <div className="flex flex-col gap-2 py-4 pr-4">
              <h3 className="p-1 font-nunito text-[18px] font-bold text-heading">
                Get the app
              </h3>
              {["MyVilla for Android", "MyVilla for iOS", "Mobile site"].map(
                (label) => (
                  <Link
                    key={label}
                    href="#"
                    className="p-1 font-nunito text-[16px] text-gray transition-colors hover:text-heading"
                  >
                    {label}
                  </Link>
                ),
              )}
            </div>
            <a href="#" aria-label="Download on the App Store">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/badge-appstore.svg"
                alt="App Store"
                width={135}
                height={40}
                className="h-10 w-[135px]"
              />
            </a>
            <a href="#" aria-label="Get it on Google Play">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/badge-googleplay.png"
                alt="Google Play"
                width={135}
                height={40}
                className="h-10 w-[135px]"
              />
            </a>
          </div>
        </div>

        <div className="h-px w-full bg-line" />

        <div className="flex h-16 items-center justify-between px-8 py-3 lg:px-[120px]">
          <div className="flex items-center gap-5 p-2">
            {SOCIALS.map((s) => (
              <a key={s.label} href="#" aria-label={s.label}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.icon} alt="" width={24} height={24} className="h-6 w-6" />
              </a>
            ))}
          </div>
          <p className="text-right font-nunito text-[18px] text-gray">
            © 2022 MyVilla incorporated
          </p>
        </div>
      </div>
    </footer>
  );
}
