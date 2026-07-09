export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#fafafa]">
      <span
        role="status"
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand"
      />
    </div>
  );
}
