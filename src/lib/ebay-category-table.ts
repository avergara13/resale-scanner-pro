/** eBay Category lookup table — maps RSP category names to eBay IDs, FVF rates,
 *  default item weights, and recommended shipping services.
 *  Category IDs and FVF rates are current as of Q1 2026. Sneakers/Athletic Shoes
 *  enjoy a preferential 8% FVF rate; all others use 13.25% (most general categories).
 *  Books use 14.95% (media category). Shipping services are recommendations only —
 *  the user can override at listing time. */

export interface CategoryInfo {
  ebayCategoryId: string
  fvfRate: number       // eBay Final Value Fee percentage (e.g. 13.25)
  defaultWeightOz: number
  shippingService: string  // exact "Shipping Strategy" SELECT option string
}

const CATEGORY_TABLE: Array<{ keywords: string[]; info: CategoryInfo }> = [
  // ── Footwear ──────────────────────────────────────────────────────────────
  {
    keywords: ['sneaker', 'athletic shoe', 'running shoe', 'jordan', 'nike shoe',
               'adidas shoe', 'yeezy', 'air force', 'dunk', 'trainer', 'tennis shoe'],
    info: { ebayCategoryId: '15709', fvfRate: 8.0, defaultWeightOz: 28, shippingService: 'USPS Priority Mail' },
  },
  {
    keywords: ["women's sneaker", "women's athletic", "women's running", 'ladies sneaker'],
    info: { ebayCategoryId: '55793', fvfRate: 8.0, defaultWeightOz: 22, shippingService: 'USPS Priority Mail' },
  },
  {
    keywords: ['youth sneaker', "kid's shoe", 'children shoe', 'toddler shoe', 'gs shoe', 'grade school'],
    info: { ebayCategoryId: '57929', fvfRate: 8.0, defaultWeightOz: 16, shippingService: 'USPS Priority Mail' },
  },
  {
    keywords: ['dress shoe', 'oxford', 'loafer', 'boot', 'heel', 'sandal', 'flat', 'pump',
               'moccasin', 'shoe', 'footwear'],
    info: { ebayCategoryId: '11650', fvfRate: 13.25, defaultWeightOz: 24, shippingService: 'USPS Ground Advantage' },
  },
  // ── Clothing ──────────────────────────────────────────────────────────────
  {
    keywords: ["men's clothing", "men's shirt", "men's pants", "men's shorts", "men's clothing",
               'mens apparel', 'mens fashion'],
    info: { ebayCategoryId: '1059', fvfRate: 13.25, defaultWeightOz: 8, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ["women's clothing", "women's shirt", "women's dress", "women's top", "women's pants",
               'womens apparel', 'womens fashion'],
    info: { ebayCategoryId: '15724', fvfRate: 13.25, defaultWeightOz: 8, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['hoodie', 'sweatshirt', 'pullover', 'crewneck', 'fleece'],
    info: { ebayCategoryId: '155183', fvfRate: 13.25, defaultWeightOz: 16, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['jacket', 'coat', 'parka', 'windbreaker', 'raincoat', 'blazer', 'outerwear'],
    info: { ebayCategoryId: '57988', fvfRate: 13.25, defaultWeightOz: 32, shippingService: 'USPS Priority Mail' },
  },
  {
    keywords: ['hat', 'cap', 'beanie', 'snapback', 'fitted cap', 'trucker hat', 'baseball cap'],
    info: { ebayCategoryId: '52365', fvfRate: 13.25, defaultWeightOz: 6, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['bag', 'backpack', 'handbag', 'purse', 'tote', 'duffel', 'messenger bag', 'sling bag'],
    info: { ebayCategoryId: '169291', fvfRate: 13.25, defaultWeightOz: 24, shippingService: 'USPS Priority Mail' },
  },
  // ── Electronics ──────────────────────────────────────────────────────────
  {
    keywords: ['cell phone', 'smartphone', 'iphone', 'android phone', 'mobile phone'],
    info: { ebayCategoryId: '9355', fvfRate: 13.25, defaultWeightOz: 8, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['video game', 'ps4 game', 'ps5 game', 'xbox game', 'nintendo game', 'switch game'],
    info: { ebayCategoryId: '1249', fvfRate: 13.25, defaultWeightOz: 4, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['console', 'playstation', 'xbox', 'nintendo switch', 'game console', 'ps5', 'ps4'],
    info: { ebayCategoryId: '139971', fvfRate: 13.25, defaultWeightOz: 48, shippingService: 'USPS Priority Mail' },
  },
  {
    keywords: ['laptop', 'tablet', 'ipad', 'computer', 'monitor', 'printer', 'keyboard', 'mouse',
               'headphone', 'speaker', 'camera', 'drone', 'smartwatch', 'apple watch',
               'electronics', 'tech', 'gadget'],
    info: { ebayCategoryId: '293', fvfRate: 13.25, defaultWeightOz: 32, shippingService: 'USPS Priority Mail' },
  },
  // ── Toys & Collectibles ──────────────────────────────────────────────────
  {
    keywords: ['sports card', 'trading card', 'pokemon card', 'baseball card', 'basketball card',
               'football card', 'tcg'],
    info: { ebayCategoryId: '212', fvfRate: 13.25, defaultWeightOz: 4, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['lego', 'lego set'],
    info: { ebayCategoryId: '19006', fvfRate: 13.25, defaultWeightOz: 32, shippingService: 'USPS Priority Mail' },
  },
  {
    keywords: ['toy', 'action figure', 'doll', 'plush', 'stuffed animal', 'board game',
               'puzzle', 'playset', 'hot wheels', 'matchbox'],
    info: { ebayCategoryId: '220', fvfRate: 13.25, defaultWeightOz: 16, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['collectible', 'figurine', 'statue', 'funko pop', 'memorabilia', 'autograph',
               'vintage toy', 'rare'],
    info: { ebayCategoryId: '1', fvfRate: 13.25, defaultWeightOz: 8, shippingService: 'USPS Ground Advantage' },
  },
  // ── Home & Kitchen ───────────────────────────────────────────────────────
  {
    keywords: ['kitchen', 'cookware', 'pot', 'pan', 'blender', 'coffee maker', 'appliance',
               'home goods', 'homegoods', 'home decor', 'vase', 'candle', 'picture frame'],
    info: { ebayCategoryId: '20625', fvfRate: 13.25, defaultWeightOz: 32, shippingService: 'USPS Priority Mail' },
  },
  // ── Tools ────────────────────────────────────────────────────────────────
  {
    keywords: ['tool', 'drill', 'saw', 'wrench', 'power tool', 'hand tool', 'hardware',
               'dewalt', 'milwaukee', 'makita', 'craftsman'],
    info: { ebayCategoryId: '631', fvfRate: 13.25, defaultWeightOz: 40, shippingService: 'USPS Priority Mail' },
  },
  // ── Books & Media ────────────────────────────────────────────────────────
  {
    keywords: ['dvd', 'blu-ray', 'blu ray', 'movie', 'tv series', 'box set', 'film'],
    info: { ebayCategoryId: '617', fvfRate: 13.25, defaultWeightOz: 4, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['vinyl record', 'lp', 'record album', 'vinyl'],
    info: { ebayCategoryId: '306', fvfRate: 13.25, defaultWeightOz: 12, shippingService: 'USPS Ground Advantage' },
  },
  {
    keywords: ['book', 'textbook', 'novel', 'paperback', 'hardcover', 'magazine'],
    info: { ebayCategoryId: '267', fvfRate: 14.95, defaultWeightOz: 12, shippingService: 'USPS Ground Advantage' },
  },
  // ── Sports & Outdoors ────────────────────────────────────────────────────
  {
    keywords: ['sports equipment', 'golf club', 'tennis racket', 'football', 'basketball',
               'bicycle', 'bike', 'skateboard', 'camping', 'fishing', 'gym equipment',
               'weights', 'dumbbells'],
    info: { ebayCategoryId: '888', fvfRate: 13.25, defaultWeightOz: 48, shippingService: 'USPS Priority Mail' },
  },
  // ── Jewelry ──────────────────────────────────────────────────────────────
  {
    keywords: ['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'watch', 'gold',
               'silver', 'diamond', 'pendant'],
    info: { ebayCategoryId: '281', fvfRate: 13.25, defaultWeightOz: 4, shippingService: 'USPS Ground Advantage' },
  },
  // ── Vintage & Antiques ───────────────────────────────────────────────────
  {
    keywords: ['vintage', 'antique', 'retro', 'classic', 'art', 'painting', 'print',
               'ceramic', 'pottery'],
    info: { ebayCategoryId: '20081', fvfRate: 13.25, defaultWeightOz: 16, shippingService: 'USPS Ground Advantage' },
  },
]

const DEFAULT_INFO: CategoryInfo = {
  ebayCategoryId: '99',
  fvfRate: 13.25,
  defaultWeightOz: 16,
  shippingService: 'USPS Ground Advantage',
}

/** Returns eBay category info for the given RSP category string.
 *  Matches on keyword substrings (case-insensitive). Falls back to safe defaults. */
export function getCategoryInfo(categoryName: string): CategoryInfo {
  if (!categoryName) return DEFAULT_INFO
  const lower = categoryName.toLowerCase()
  for (const { keywords, info } of CATEGORY_TABLE) {
    if (keywords.some(k => lower.includes(k))) return info
  }
  return DEFAULT_INFO
}
