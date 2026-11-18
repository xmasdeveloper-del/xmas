/**
 * Fired on `window` whenever a customer's points balance changes in this tab,
 * so the header's Бонус chip and the account panel never disagree.
 *
 * A plain DOM event rather than a store: the two components are in different
 * trees and only ever need to say "go and read it again".
 */
export const POINTS_CHANGED = "xmas:points-changed";
