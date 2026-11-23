import "server-only";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/site";

export const permanentUrl = () => `${siteUrl()}/`;
export const eventUrl = (slug: string) => `${siteUrl()}/event/${slug}`;

/** Crisp vector QR, high error correction so it still scans if the sign gets a smudge. */
export function qrSvg(url: string) {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark: "#1b1714", light: "#ffffff" },
  });
}
