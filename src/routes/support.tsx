import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { HashLink } from "@/components/HashLink";

const VENMO_URL = "https://venmo.com/u/studiopique";

export function Support() {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    void QRCode.toDataURL(VENMO_URL, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#10223d",
        light: "#ffffff",
      },
    }).then(setQrUrl);
  }, []);

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <HashLink to="/" className="label-eyebrow hover:text-[var(--color-ink)]">
        ← back to the maker
      </HashLink>

      <div className="mt-16 text-center">
        <p className="label-eyebrow">A small note from the studio</p>
        <h1 className="mt-4 font-display text-5xl">Thanks for exploring with paper today!</h1>
        <p className="mx-auto mt-6 max-w-sm text-[var(--color-ink-soft)]">
          Please support our creative studio
          <br />
          and help us continue creating.
        </p>

        <div className="mx-auto mt-10 w-fit rounded-sm border border-[var(--color-hairline)] bg-white p-4">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="Scan to support Studio Pique on Venmo"
              className="block h-48 w-48"
            />
          ) : (
            <div className="grid h-48 w-48 place-items-center text-xs text-[var(--color-ink-soft)]">
              preparing QR…
            </div>
          )}
        </div>

        <a
          href={VENMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-block text-sm text-[var(--color-oxblood)] hover:underline"
        >
          Support Studio Pique on Venmo ↗
        </a>
      </div>
    </main>
  );
}
