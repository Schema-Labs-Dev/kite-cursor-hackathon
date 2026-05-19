import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const alt = "Kite — Hold. Send. Spend. Money, set free.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const here = dirname(fileURLToPath(import.meta.url));

export default async function OpengraphImage() {
  const [interBlack, interRegular] = await Promise.all([
    readFile(join(here, "Inter-Black.woff")),
    readFile(join(here, "Inter-Regular.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#f2f2f2",
          color: "#000",
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 70px",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 210,
              fontWeight: 900,
              letterSpacing: "-9px",
              lineHeight: 0.92,
              color: "#000",
            }}
          >
            HOLD.
          </div>
          <div
            style={{
              fontSize: 210,
              fontWeight: 900,
              letterSpacing: "-9px",
              lineHeight: 0.92,
              color: "#a8a8a8",
            }}
          >
            SEND.
          </div>
          <div
            style={{
              fontSize: 210,
              fontWeight: 900,
              letterSpacing: "-9px",
              lineHeight: 0.92,
              color: "#000",
            }}
          >
            SPEND.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 70,
            display: "flex",
            alignItems: "center",
            fontSize: 20,
            fontWeight: 400,
            letterSpacing: "5px",
            color: "#6e6e6e",
          }}
        >
          ● USEKITE.XYZ
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 70,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <svg
            width="46"
            height="58"
            viewBox="0 0 32 40"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M16 2 L4 14 L16 38 Z" fill="#000" fillOpacity="0.5" />
            <path d="M16 2 L28 14 L16 38 Z" fill="#000" />
          </svg>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-2.5px" }}>
            KITE
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: interBlack, weight: 900, style: "normal" },
        { name: "Inter", data: interRegular, weight: 400, style: "normal" },
      ],
    }
  );
}
