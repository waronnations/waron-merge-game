/**
 * Server-only Nations types and static country data.
 * Phase 1: protection, contribution & redemption fields.
 * Phase 2: faction alignment (wardog | warcat | null).
 */

export type NationFaction = "wardog" | "warcat";

export interface NationRow {
  id: number;
  name: string;
  tag: string;
  emblem: string;
  leaderId: number | null;
  isDefault: boolean;
  totalGlory: number;
  memberCount: number;
  listedPrice: number | null;
  listedAt: string | null;
  vaultWardog?: number;
  vaultWarcat?: number;
  reputation?: number;
  activeBuff?: string | null;
  buffExpiresAt?: string | null;
  /** Sum of nukesOwned across all members of this nation */
  nukesOwnedTotal?: number;
  /** How many times this nation has been nuked */
  timesNuked?: number;
  // Phase 1
  isProtected?: boolean;
  protectionExpiresAt?: string | null;
  joinContributionWardog?: number;
  joinContributionWarcat?: number;
  redemptionPriceWardog?: number;
  redemptionPriceWarcat?: number;
  // Phase 2
  faction?: NationFaction | null;
}

export interface NationMember {
  userId: number;
  username: string | null;
  firstName: string | null;
  role: "leader" | "officer" | "member";
  weeklyGlory: number;
  glory: number;
  isTraitor?: boolean;
}

export interface NationDetails {
  id: number;
  name: string;
  tag: string;
  emblem: string;
  leaderId: number | null;
  isDefault: boolean;
  totalGlory: number;
  memberCount: number;
  listedPrice: number | null;
  listedAt: string | null;
  vaultWardog: number;
  vaultWarcat: number;
  reputation: number;
  activeBuff: string | null;
  buffExpiresAt: string | null;
  lastNukeReceivedAt?: string | null;
  lastNukeLaunchedAt?: string | null;
  // Phase 1
  isProtected: boolean;
  protectionExpiresAt: string | null;
  joinContributionWardog: number;
  joinContributionWarcat: number;
  redemptionPriceWardog: number;
  redemptionPriceWarcat: number;
  // Phase 2
  faction: NationFaction | null;
  leader: {
    userId: number;
    username: string | null;
    firstName: string | null;
    isTraitor?: boolean;
  } | null;
  topMembers: NationMember[];
  myRole: "leader" | "officer" | "member" | null;
  isMember: boolean;
  canClaim: boolean;
  canBuy: boolean;
}

export interface NationRankRow {
  id: number;
  name: string;
  tag: string;
  emblem: string;
  isDefault: boolean;
  totalGlory: number;
  memberCount: number;
  leaderName: string | null;
  reputation?: number;
  faction?: NationFaction | null;
}

export const COUNTRY_NATIONS: { name: string; tag: string; emblem: string }[] = [
  // Americas
  { name: "United States", tag: "US", emblem: "🇺🇸" },
  { name: "Canada", tag: "CA", emblem: "🇨🇦" },
  { name: "Mexico", tag: "MX", emblem: "🇲🇽" },
  { name: "Brazil", tag: "BR", emblem: "🇧🇷" },
  { name: "Argentina", tag: "AR", emblem: "🇦🇷" },
  { name: "Colombia", tag: "CO", emblem: "🇨🇴" },
  { name: "Chile", tag: "CL", emblem: "🇨🇱" },
  { name: "Peru", tag: "PE", emblem: "🇵🇪" },
  { name: "Venezuela", tag: "VE", emblem: "🇻🇪" },
  { name: "Ecuador", tag: "EC", emblem: "🇪🇨" },
  { name: "Bolivia", tag: "BO", emblem: "🇧🇴" },
  { name: "Paraguay", tag: "PY", emblem: "🇵🇾" },
  { name: "Uruguay", tag: "UY", emblem: "🇺🇾" },
  { name: "Costa Rica", tag: "CR", emblem: "🇨🇷" },
  { name: "Panama", tag: "PA", emblem: "🇵🇦" },
  { name: "Guatemala", tag: "GT", emblem: "🇬🇹" },
  { name: "Honduras", tag: "HN", emblem: "🇭🇳" },
  { name: "El Salvador", tag: "SV", emblem: "🇸🇻" },
  { name: "Nicaragua", tag: "NI", emblem: "🇳🇮" },
  { name: "Cuba", tag: "CU", emblem: "🇨🇺" },
  { name: "Dominican Republic", tag: "DO", emblem: "🇩🇴" },
  { name: "Haiti", tag: "HT", emblem: "🇭🇹" },
  { name: "Jamaica", tag: "JM", emblem: "🇯🇲" },
  { name: "Trinidad and Tobago", tag: "TT", emblem: "🇹🇹" },
  { name: "Bahamas", tag: "BS", emblem: "🇧🇸" },
  { name: "Barbados", tag: "BB", emblem: "🇧🇧" },
  { name: "Belize", tag: "BZ", emblem: "🇧🇿" },
  { name: "Guyana", tag: "GY", emblem: "🇬🇾" },
  { name: "Suriname", tag: "SR", emblem: "🇸🇷" },
  { name: "Antigua and Barbuda", tag: "AG", emblem: "🇦🇬" },
  { name: "Dominica", tag: "DM", emblem: "🇩🇲" },
  { name: "Grenada", tag: "GD", emblem: "🇬🇩" },
  { name: "Saint Kitts and Nevis", tag: "KN", emblem: "🇰🇳" },
  { name: "Saint Lucia", tag: "LC", emblem: "🇱🇨" },
  { name: "Saint Vincent and the Grenadines", tag: "VC", emblem: "🇻🇨" },

  // Europe
  { name: "United Kingdom", tag: "GB", emblem: "🇬🇧" },
  { name: "Germany", tag: "DE", emblem: "🇩🇪" },
  { name: "France", tag: "FR", emblem: "🇫🇷" },
  { name: "Italy", tag: "IT", emblem: "🇮🇹" },
  { name: "Spain", tag: "ES", emblem: "🇪🇸" },
  { name: "Poland", tag: "PL", emblem: "🇵🇱" },
  { name: "Netherlands", tag: "NL", emblem: "🇳🇱" },
  { name: "Belgium", tag: "BE", emblem: "🇧🇪" },
  { name: "Sweden", tag: "SE", emblem: "🇸🇪" },
  { name: "Norway", tag: "NO", emblem: "🇳🇴" },
  { name: "Denmark", tag: "DK", emblem: "🇩🇰" },
  { name: "Finland", tag: "FI", emblem: "🇫🇮" },
  { name: "Switzerland", tag: "CH", emblem: "🇨🇭" },
  { name: "Austria", tag: "AT", emblem: "🇦🇹" },
  { name: "Portugal", tag: "PT", emblem: "🇵🇹" },
  { name: "Greece", tag: "GR", emblem: "🇬🇷" },
  { name: "Czechia", tag: "CZ", emblem: "🇨🇿" },
  { name: "Romania", tag: "RO", emblem: "🇷🇴" },
  { name: "Hungary", tag: "HU", emblem: "🇭🇺" },
  { name: "Ukraine", tag: "UA", emblem: "🇺🇦" },
  { name: "Ireland", tag: "IE", emblem: "🇮🇪" },
  { name: "Croatia", tag: "HR", emblem: "🇭🇷" },
  { name: "Serbia", tag: "RS", emblem: "🇷🇸" },
  { name: "Bulgaria", tag: "BG", emblem: "🇧🇬" },
  { name: "Slovakia", tag: "SK", emblem: "🇸🇰" },
  { name: "Lithuania", tag: "LT", emblem: "🇱🇹" },
  { name: "Latvia", tag: "LV", emblem: "🇱🇻" },
  { name: "Estonia", tag: "EE", emblem: "🇪🇪" },
  { name: "Slovenia", tag: "SI", emblem: "🇸🇮" },
  { name: "Bosnia and Herzegovina", tag: "BA", emblem: "🇧🇦" },
  { name: "North Macedonia", tag: "MK", emblem: "🇲🇰" },
  { name: "Albania", tag: "AL", emblem: "🇦🇱" },
  { name: "Montenegro", tag: "ME", emblem: "🇲🇪" },
  { name: "Kosovo", tag: "XK", emblem: "🇽🇰" },
  { name: "Moldova", tag: "MD", emblem: "🇲🇩" },
  { name: "Belarus", tag: "BY", emblem: "🇧🇾" },
  { name: "Iceland", tag: "IS", emblem: "🇮🇸" },
  { name: "Luxembourg", tag: "LU", emblem: "🇱🇺" },
  { name: "Malta", tag: "MT", emblem: "🇲🇹" },
  { name: "Cyprus", tag: "CY", emblem: "🇨🇾" },
  { name: "Andorra", tag: "AD", emblem: "🇦🇩" },
  { name: "Monaco", tag: "MC", emblem: "🇲🇨" },
  { name: "Liechtenstein", tag: "LI", emblem: "🇱🇮" },
  { name: "San Marino", tag: "SM", emblem: "🇸🇲" },
  { name: "Vatican City", tag: "VA", emblem: "🇻🇦" },
  { name: "Russia", tag: "RU", emblem: "🇷🇺" },

  // Asia
  { name: "China", tag: "CN", emblem: "🇨🇳" },
  { name: "India", tag: "IN", emblem: "🇮🇳" },
  { name: "Japan", tag: "JP", emblem: "🇯🇵" },
  { name: "South Korea", tag: "KR", emblem: "🇰🇷" },
  { name: "North Korea", tag: "KP", emblem: "🇰🇵" },
  { name: "Indonesia", tag: "ID", emblem: "🇮🇩" },
  { name: "Turkey", tag: "TR", emblem: "🇹🇷" },
  { name: "Saudi Arabia", tag: "SA", emblem: "🇸🇦" },
  { name: "Iran", tag: "IR", emblem: "🇮🇷" },
  { name: "Iraq", tag: "IQ", emblem: "🇮🇶" },
  { name: "Pakistan", tag: "PK", emblem: "🇵🇰" },
  { name: "Bangladesh", tag: "BD", emblem: "🇧🇩" },
  { name: "Philippines", tag: "PH", emblem: "🇵🇭" },
  { name: "Vietnam", tag: "VN", emblem: "🇻🇳" },
  { name: "Thailand", tag: "TH", emblem: "🇹🇭" },
  { name: "Malaysia", tag: "MY", emblem: "🇲🇾" },
  { name: "Singapore", tag: "SG", emblem: "🇸🇬" },
  { name: "United Arab Emirates", tag: "AE", emblem: "🇦🇪" },
  { name: "Israel", tag: "IL", emblem: "🇮🇱" },
  { name: "Palestine", tag: "PS", emblem: "🇵🇸" },
  { name: "Qatar", tag: "QA", emblem: "🇶🇦" },
  { name: "Kuwait", tag: "KW", emblem: "🇰🇼" },
  { name: "Bahrain", tag: "BH", emblem: "🇧🇭" },
  { name: "Oman", tag: "OM", emblem: "🇴🇲" },
  { name: "Yemen", tag: "YE", emblem: "🇾🇪" },
  { name: "Jordan", tag: "JO", emblem: "🇯🇴" },
  { name: "Lebanon", tag: "LB", emblem: "🇱🇧" },
  { name: "Syria", tag: "SY", emblem: "🇸🇾" },
  { name: "Kazakhstan", tag: "KZ", emblem: "🇰🇿" },
  { name: "Uzbekistan", tag: "UZ", emblem: "🇺🇿" },
  { name: "Turkmenistan", tag: "TM", emblem: "🇹🇲" },
  { name: "Kyrgyzstan", tag: "KG", emblem: "🇰🇬" },
  { name: "Tajikistan", tag: "TJ", emblem: "🇹🇯" },
  { name: "Afghanistan", tag: "AF", emblem: "🇦🇫" },
  { name: "Myanmar", tag: "MM", emblem: "🇲🇲" },
  { name: "Cambodia", tag: "KH", emblem: "🇰🇭" },
  { name: "Laos", tag: "LA", emblem: "🇱🇦" },
  { name: "Nepal", tag: "NP", emblem: "🇳🇵" },
  { name: "Sri Lanka", tag: "LK", emblem: "🇱🇰" },
  { name: "Bhutan", tag: "BT", emblem: "🇧🇹" },
  { name: "Maldives", tag: "MV", emblem: "🇲🇻" },
  { name: "Mongolia", tag: "MN", emblem: "🇲🇳" },
  { name: "Brunei", tag: "BN", emblem: "🇧🇳" },
  { name: "Timor-Leste", tag: "TL", emblem: "🇹🇱" },
  { name: "Taiwan", tag: "TW", emblem: "🇹🇼" },
  { name: "Hong Kong", tag: "HK", emblem: "🇭🇰" },
  { name: "Macau", tag: "MO", emblem: "🇲🇴" },
  { name: "Georgia", tag: "GE", emblem: "🇬🇪" },
  { name: "Armenia", tag: "AM", emblem: "🇦🇲" },
  { name: "Azerbaijan", tag: "AZ", emblem: "🇦🇿" },

  // Africa
  { name: "South Africa", tag: "ZA", emblem: "🇿🇦" },
  { name: "Nigeria", tag: "NG", emblem: "🇳🇬" },
  { name: "Egypt", tag: "EG", emblem: "🇪🇬" },
  { name: "Ethiopia", tag: "ET", emblem: "🇪🇹" },
  { name: "Kenya", tag: "KE", emblem: "🇰🇪" },
  { name: "Ghana", tag: "GH", emblem: "🇬🇭" },
  { name: "Morocco", tag: "MA", emblem: "🇲🇦" },
  { name: "Algeria", tag: "DZ", emblem: "🇩🇿" },
  { name: "Tunisia", tag: "TN", emblem: "🇹🇳" },
  { name: "Libya", tag: "LY", emblem: "🇱🇾" },
  { name: "Sudan", tag: "SD", emblem: "🇸🇩" },
  { name: "South Sudan", tag: "SS", emblem: "🇸🇸" },
  { name: "Angola", tag: "AO", emblem: "🇦🇴" },
  { name: "Tanzania", tag: "TZ", emblem: "🇹🇿" },
  { name: "Uganda", tag: "UG", emblem: "🇺🇬" },
  { name: "Democratic Republic of the Congo", tag: "CD", emblem: "🇨🇩" },
  { name: "Congo", tag: "CG", emblem: "🇨🇬" },
  { name: "Cameroon", tag: "CM", emblem: "🇨🇲" },
  { name: "Ivory Coast", tag: "CI", emblem: "🇨🇮" },
  { name: "Senegal", tag: "SN", emblem: "🇸🇳" },
  { name: "Mali", tag: "ML", emblem: "🇲🇱" },
  { name: "Burkina Faso", tag: "BF", emblem: "🇧🇫" },
  { name: "Niger", tag: "NE", emblem: "🇳🇪" },
  { name: "Chad", tag: "TD", emblem: "🇹🇩" },
  { name: "Somalia", tag: "SO", emblem: "🇸🇴" },
  { name: "Zimbabwe", tag: "ZW", emblem: "🇿🇼" },
  { name: "Zambia", tag: "ZM", emblem: "🇿🇲" },
  { name: "Mozambique", tag: "MZ", emblem: "🇲🇿" },
  { name: "Madagascar", tag: "MG", emblem: "🇲🇬" },
  { name: "Botswana", tag: "BW", emblem: "🇧🇼" },
  { name: "Namibia", tag: "NA", emblem: "🇳🇦" },
  { name: "Rwanda", tag: "RW", emblem: "🇷🇼" },
  { name: "Burundi", tag: "BI", emblem: "🇧🇮" },
  { name: "Malawi", tag: "MW", emblem: "🇲🇼" },
  { name: "Mauritius", tag: "MU", emblem: "🇲🇺" },
  { name: "Seychelles", tag: "SC", emblem: "🇸🇨" },
  { name: "Gabon", tag: "GA", emblem: "🇬🇦" },
  { name: "Equatorial Guinea", tag: "GQ", emblem: "🇬🇶" },
  { name: "Guinea", tag: "GN", emblem: "🇬🇳" },
  { name: "Guinea-Bissau", tag: "GW", emblem: "🇬🇼" },
  { name: "Sierra Leone", tag: "SL", emblem: "🇸🇱" },
  { name: "Liberia", tag: "LR", emblem: "🇱🇷" },
  { name: "Togo", tag: "TG", emblem: "🇹🇬" },
  { name: "Benin", tag: "BJ", emblem: "🇧🇯" },
  { name: "Mauritania", tag: "MR", emblem: "🇲🇷" },
  { name: "Gambia", tag: "GM", emblem: "🇬🇲" },
  { name: "Eritrea", tag: "ER", emblem: "🇪🇷" },
  { name: "Djibouti", tag: "DJ", emblem: "🇩🇯" },
  { name: "Comoros", tag: "KM", emblem: "🇰🇲" },
  { name: "Cape Verde", tag: "CV", emblem: "🇨🇻" },
  { name: "São Tomé and Príncipe", tag: "ST", emblem: "🇸🇹" },
  { name: "Lesotho", tag: "LS", emblem: "🇱🇸" },
  { name: "Eswatini", tag: "SZ", emblem: "🇸🇿" },
  { name: "Central African Republic", tag: "CF", emblem: "🇨🇫" },

  // Oceania
  { name: "Australia", tag: "AU", emblem: "🇦🇺" },
  { name: "New Zealand", tag: "NZ", emblem: "🇳🇿" },
  { name: "Papua New Guinea", tag: "PG", emblem: "🇵🇬" },
  { name: "Fiji", tag: "FJ", emblem: "🇫🇯" },
  { name: "Solomon Islands", tag: "SB", emblem: "🇸🇧" },
  { name: "Vanuatu", tag: "VU", emblem: "🇻🇺" },
  { name: "Samoa", tag: "WS", emblem: "🇼🇸" },
  { name: "Tonga", tag: "TO", emblem: "🇹🇴" },
  { name: "Kiribati", tag: "KI", emblem: "🇰🇮" },
  { name: "Micronesia", tag: "FM", emblem: "🇫🇲" },
  { name: "Marshall Islands", tag: "MH", emblem: "🇲🇭" },
  { name: "Palau", tag: "PW", emblem: "🇵🇼" },
  { name: "Nauru", tag: "NR", emblem: "🇳🇷" },
  { name: "Tuvalu", tag: "TV", emblem: "🇹🇻" },
];
