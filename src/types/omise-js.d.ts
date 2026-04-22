/**
 * Type declarations for the browser-side Omise.js SDK
 * (loaded as a <script> tag from https://cdn.omise.co/omise.js).
 *
 * The Omise CDN bundle has no first-party TypeScript types, so we declare
 * only the shape we actually consume from the client. Kept ambient (no
 * imports/exports at top level) so `OmiseCardData` / `OmiseTokenResponse` /
 * `OmiseSdk` are usable globally without an import.
 */

declare global {
  interface OmiseCardData {
    name: string;
    number: string;
    expiration_month: number;
    expiration_year: number;
    security_code: string;
  }

  interface OmiseTokenResponse {
    id: string; // "tokn_xxxxxxx"
    object: "token";
    livemode: boolean;
    card: { last_digits: string; brand: string };
  }

  type OmiseCreateTokenCallback = (
    statusCode: number,
    response: OmiseTokenResponse | { message?: string; code?: string }
  ) => void;

  interface OmiseSdk {
    setPublicKey: (key: string) => void;
    createToken: (
      type: "card",
      data: OmiseCardData,
      callback: OmiseCreateTokenCallback
    ) => void;
  }

  interface Window {
    Omise?: OmiseSdk;
  }
}

export {};
