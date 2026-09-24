/**
 * The owner's default wording for every campaign message.
 *
 * This is the single source for pre-filled text: the campaign builder starts
 * new campaigns with these as real, editable values, and the worker, preview
 * and detail page fall back to them when a saved campaign has no text of its
 * own. Written in the owner's DM voice (short, warm, English, 🙌 ⬇️), learned
 * from their own outgoing Instagram DMs.
 *
 * Button labels must stay within Instagram's 20-character button title limit.
 */
export const CAMPAIGN_DEFAULTS = {
  dmMessage: "Yo thanks for commenting {username}! 🙌\n\nHere's the guide I mentioned ⬇️",
  linkButtonLabel: "Get the guide",
  secondaryButtonLabel: "Open link",
  /** DM body used when the owner's message is only a {link} placeholder. */
  linkIntro: "Here you go ⬇️",

  openingDmMessage:
    "Hey {username}! Thanks for commenting 🙌\n\nTap the button below and I'll send it over ⬇️",
  openingDmButtonLabel: "Send it to me",

  followPromptMessage:
    "Hey {username}! Almost there 🙌\n\nFollow me first, then tap the button below and I'll send it straight to you ⬇️",
  followPromptButtonLabel: "Done, I followed ✅",

  publicReplyMessages: [
    "Sent! Check your DMs 📩",
    "Done! Check your inbox 🙌",
    "Just DM'd you, enjoy ⬇️",
  ],

  followUpMessage:
    "Hope the guide helps! 🙌 If you have any questions, just reply here, I read every message.",
} as const;
