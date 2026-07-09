import Link from "next/link";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex min-h-[60vh] flex-col items-center justify-center bg-[#fafafa] px-6 text-center">
        <p className="text-[64px] font-bold leading-none text-brand">404</p>
        <h1 className="mt-4 text-[26px] font-semibold text-[#121212]">
          Page not found
        </h1>
        <p className="mt-2 max-w-[440px] text-[15px] leading-relaxed text-[#4a4a4a]">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have
          moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="rounded-[8px] bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Go to home
          </Link>
          <Link
            href="/search"
            className="rounded-[8px] border border-brand px-6 py-2.5 text-[14px] font-semibold text-brand transition-colors hover:bg-brand/5"
          >
            Browse villas
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
