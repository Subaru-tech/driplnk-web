import "server-only";

/**
 * Content Moderation: Weapon / Firearm Part Blocklist
 *
 * Modeled after Thingiverse, Cults3D, and ITAR/EAR Category I control categories.
 * Initial policy is FLAG-NOT-REJECT:
 * Flagged models are queued for mandatory human admin inspection before
 * marketplace publication or Mart manufacturing dispatch.
 *
 * NOTE ON FALSE POSITIVES IN 3D PRINTING:
 * Generic mechanical and workshop words ("frame", "receiver", "magazine", "hammer",
 * "compensator", "conversion kit") are common in legitimate 3D printing (e.g. drone
 * frames, picture frames, audio/ELRS receivers, magazine racks, tool wall hammer hooks,
 * Ender 3 linear rail conversion kits).
 *
 * To prevent flooding the admin review queue, this blocklist strictly uses
 * weapon-specific compound phrases instead of bare mechanical nouns.
 */

// Innocent compounds containing "gun" that should NOT trigger a firearm flag
export const INNOCENT_GUN_COMPOUNDS = [
  "glue gun",
  "heat gun",
  "caulk gun",
  "caulking gun",
  "grease gun",
  "massage gun",
  "staple gun",
  "nail gun",
  "tape gun",
  "radar gun",
  "barcode gun",
  "scanner gun",
  "water gun",
  "nerf gun",
  "airsoft gun",
  "foam gun",
  "tag gun",
  "tagging gun",
  "price gun",
  "blow gun",
  "blowgun",
];

export const WEAPON_TERMS: string[] = [
  // 1. Firearms & Weapon Classifications (Unambiguous)
  "firearm",
  "handgun",
  "pistol",
  "revolver",
  "rifle",
  "shotgun",
  "carbine",
  "machine gun",
  "submachine gun",
  "ghost gun",
  "zip gun",
  "unserialized firearm",
  "slam fire gun",
  "slamfire",

  // 2. Specific Firearm Models & Printed Blueprints
  "ar-15",
  "ar15",
  "ar-10",
  "ar10",
  "m4a1",
  "glock",
  "beretta",
  "sig sauer",
  "ak-47",
  "ak47",
  "ak-74",
  "colt 1911",
  "1911 pistol",
  "1911 frame",
  "p80",
  "poly80",
  "polymer80",
  "fmg-9",
  "fmg9",
  "fgc-9",
  "fgc9",

  // 3. Receivers & Frames (Strictly Compound — Prevents Drone/Picture Frame & Radio Receiver false positives)
  "lower receiver",
  "upper receiver",
  "firearm receiver",
  "rifle receiver",
  "pistol receiver",
  "firearm frame",
  "pistol frame",
  "glock frame",
  "p80 frame",
  "receiver blank",
  "80 percent lower",
  "80% lower",

  // 4. Barrels, Suppressors & Muzzle Devices
  "gun barrel",
  "threaded barrel",
  "silencer",
  "suppressor",
  "solvent trap",
  "flash hider",
  "muzzle brake",
  "muzzle compensator",
  "recoil compensator",
  "barrel compensator",

  // 5. Firearm Internal Mechanisms (Compound — Prevents Tool Hammer & Storage Rack false positives)
  "trigger assembly",
  "trigger guard",
  "auto sear",
  "drop in auto sear",
  "dias",
  "firing pin",
  "bolt carrier",
  "bolt carrier group",
  "bcg",
  "firearm hammer",
  "gun hammer",
  "trigger sear",
  "disconnector",
  "fire selector",
  "safety selector",

  // 6. Magazines & Feed Devices (Compound — Prevents Magazine Rack / Desk File false positives)
  "gun magazine",
  "rifle magazine",
  "pistol magazine",
  "ammo magazine",
  "drum mag",
  "extended magazine",
  "high capacity magazine",
  "high-capacity magazine",
  "glock magazine",
  "ar-15 magazine",

  // 7. Rapid Fire, Bump & Conversion Devices (Strictly Prohibited)
  "full auto",
  "glock switch",
  "auto switch",
  "giggle switch",
  "forced reset trigger",
  "frt",
  "frt-15",
  "bump stock",
  "super safety",
  "firearm conversion",
  "full auto conversion",
  "carbine conversion kit",
  "pistol conversion kit",

  // 8. Ammunition & Reloading Dies
  "ammunition",
  "ammo",
  "bullet mold",
  "bullet casing",
  "cartridge case",
  "primer pocket",
  "reloading die",

  // 9. Explosives & Improvised Devices
  "grenade",
  "explosive device",
  "claymore",
  "landmine",
  "pipe bomb",
  "car bomb",
  "improvised explosive device",
];

export interface WeaponCheckResult {
  flagged: boolean;
  matches: string[];
}

/**
 * Checks model metadata (title, description, tags) against the curated weapon blocklist.
 * Filters out common non-firearm compounds ("glue gun", "heat gun", "drone frame", etc.).
 */
export function checkWeaponTerms(
  title: string = "",
  description: string = "",
  tags: string[] = []
): WeaponCheckResult {
  let combinedText = [
    title,
    description,
    Array.isArray(tags) ? tags.join(" ") : "",
  ]
    .join(" ")
    .toLowerCase();

  // Neutralize innocent non-firearm tool compounds before matching
  for (const innocent of INNOCENT_GUN_COMPOUNDS) {
    if (combinedText.includes(innocent)) {
      combinedText = combinedText.split(innocent).join("tool_device");
    }
  }

  const matchesSet = new Set<string>();

  // If text still contains standalone "gun" (after innocent tool replacement)
  const standaloneGunRegex = /\bgun\b/i;
  if (standaloneGunRegex.test(combinedText)) {
    matchesSet.add("gun");
  }

  for (const term of WEAPON_TERMS) {
    const normalizedTerm = term.toLowerCase().trim();
    if (!normalizedTerm) continue;

    // For multi-word phrases or terms with hyphens/numbers, use substring match
    if (normalizedTerm.includes(" ") || normalizedTerm.includes("-") || normalizedTerm.includes("%")) {
      if (combinedText.includes(normalizedTerm)) {
        matchesSet.add(normalizedTerm);
      }
    } else {
      // For single words, enforce word boundaries
      const regex = new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "i");
      if (regex.test(combinedText)) {
        matchesSet.add(normalizedTerm);
      }
    }
  }

  const matches = Array.from(matchesSet);
  return {
    flagged: matches.length > 0,
    matches,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
