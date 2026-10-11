/**
 * Class-pack product ids confirmed for Mindbody site 9853.
 * Copied from adminbondi/mindbody-chatwoot-sync shared/account.ts so pack
 * credit attributes use the same ids as Chatwoot. A service name is not read.
 */

export const INTRO_PASS_PRODUCT_ID = 486;

export type ClassPackType = "reformer" | "mat_barre" | "breathwork_yoga";

export const CLASS_PACK_TYPE_BY_PRODUCT: ReadonlyMap<number, ClassPackType> = new Map([
  [507, "reformer"],
  [529, "reformer"],
  [316, "reformer"],
  [489, "reformer"],
  [531, "reformer"],
  [576, "reformer"],
  [153, "reformer"],
  [490, "reformer"],
  [530, "reformer"],
  [506, "mat_barre"],
  [526, "mat_barre"],
  [528, "mat_barre"],
  [425, "mat_barre"],
  [487, "mat_barre"],
  [577, "mat_barre"],
  [392, "mat_barre"],
  [488, "mat_barre"],
  [527, "mat_barre"],
  [476, "breathwork_yoga"],
  [477, "breathwork_yoga"],
]);
