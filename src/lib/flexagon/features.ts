/**
 * The lightest option is a small attribution; the card adds the QR code and
 * support message. Keeping this as one choice prevents both from appearing
 * accidentally at the same time.
 */
export type StudioPiqueCredit = "none" | "simple-name" | "support-card";
export const STUDIO_PIQUE_CREDIT: StudioPiqueCredit = "simple-name";
