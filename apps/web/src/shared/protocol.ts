// The handful of constants both halves need. Deliberately importing nothing:
// anything the client pulls in from src/server drags @trpc/server into the
// browser bundle with it, which fails at runtime rather than at build time.

export const TOKEN_HEADER = "x-greyfall-token";

/** Room codes: no I, O, 0 or 1, because these get read aloud. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LEN = 6;
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
