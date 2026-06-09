/**
 * Fast, in-memory regex scrubber for Personally Identifiable Information (PII).
 * This runs locally with ~0ms latency and zero API costs.
 */

export function scrubPII(text: string | undefined | null): string {
  if (!text) return "";

  let scrubbedText = text;

  // 1. Scrub Emails
  // Matches standard email formats
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  scrubbedText = scrubbedText.replace(emailRegex, "[REDACTED_EMAIL]");

  // 2. Scrub Credit Cards
  // Matches 13-19 digit numbers, optionally separated by spaces or dashes
  const creditCardRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  
  // We need to be careful not to scrub normal long numbers like Aadhar or tracking IDs if not intended,
  // but for generic safety, standard 16 digit scrubbing is common.
  scrubbedText = scrubbedText.replace(creditCardRegex, (match) => {
    // Only redact if it looks specifically like a CC (no letters, just numbers/spaces/dashes)
    const digitsOnly = match.replace(/[^0-9]/g, "");
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      return "[REDACTED_CREDIT_CARD]";
    }
    return match;
  });

  // Note: We deliberately do NOT aggressively scrub phone numbers here because
  // residents frequently share vendor phone numbers in the community bot.
  // Aggressively scrubbing 10-digit numbers would break functionality.

  return scrubbedText;
}
