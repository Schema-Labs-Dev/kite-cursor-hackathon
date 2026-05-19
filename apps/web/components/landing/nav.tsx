import Link from "next/link";
import { KiteMark } from "./kite-mark";

export function Nav() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex h-[62px] w-full max-w-[420px] items-center justify-between gap-3 rounded-[20px] border border-hairline bg-paper/55 px-3 pl-5 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 text-ink" aria-label="Kite home">
          <KiteMark size={20} withWord />
        </Link>

        <Link
          href="#testflight"
          className="inline-flex h-[46px] items-center rounded-[14px] bg-ink px-5 text-paper transition-colors hover:bg-ink-soft"
        >
          <span className="text-[14px] font-semibold tracking-tight">Get the App</span>
        </Link>
      </div>
    </header>
  );
}
