import type { ScannedItem, ItemTag } from '@/types'

export interface TagSuggestion {
  tag: ItemTag
  confidence: number
  reason: string
}

const PREDEFINED_TAGS: ItemTag[] = [
  { id: 'vintage', name: 'Vintage', color: 'oklch(0.68 0.18 75)', icon: '🕰️' },
  { id: 'high-value', name: 'High Value', color: 'oklch(0.52 0.20 145)', icon: '💎' },
  { id: 'electronics', name: 'Electronics', color: 'oklch(0.50 0.18 250)', icon: '⚡' },
  { id: 'clothing', name: 'Clothing', color: 'oklch(0.65 0.20 330)', icon: '👕' },
  { id: 'collectible', name: 'Collectible', color: 'oklch(0.68 0.22 25)', icon: '🎯' },
  { id: 'brand-name', name: 'Brand Name', color: 'oklch(0.55 0.18 260)', icon: '✨' },
  { id: 'rare', name: 'Rare', color: 'oklch(0.62 0.24 310)', icon: '⭐' },
  { id: 'fast-seller', name: 'Fast Seller', color: 'oklch(0.58 0.22 140)', icon: '🚀' },
  { id: 'seasonal', name: 'Seasonal', color: 'oklch(0.72 0.16 50)', icon: '🍂' },
  { id: 'luxury', name: 'Luxury', color: 'oklch(0.45 0.15 285)', icon: '👑' },
  { id: 'sports', name: 'Sports', color: 'oklch(0.60 0.20 120)', icon: '⚽' },
  { id: 'home-decor', name: 'Home Decor', color: 'oklch(0.64 0.18 200)', icon: '🏠' },
  { id: 'toys-games', name: 'Toys & Games', color: 'oklch(0.70 0.22 340)', icon: '🎮' },
  { id: 'jewelry', name: 'Jewelry', color: 'oklch(0.58 0.24 45)', icon: '💍' },
  { id: 'books', name: 'Books', color: 'oklch(0.48 0.12 230)', icon: '📚' },
  { id: 'damaged', name: 'Damaged', color: 'oklch(0.65 0.15 35)', icon: '⚠️' },
  { id: 'needs-repair', name: 'Needs Repair', color: 'oklch(0.62 0.18 40)', icon: '🔧' },
  { id: 'new-with-tags', name: 'New With Tags', color: 'oklch(0.54 0.22 150)', icon: '🏷️' },
  { id: 'handmade', name: 'Handmade', color: 'oklch(0.66 0.20 60)', icon: '✋' },
  { id: 'limited-edition', name: 'Limited Edition', color: 'oklch(0.52 0.20 295)', icon: '🎨' },
]

export function createTagSuggestionService() {
  function suggestTags(item: ScannedItem): TagSuggestion[] {
    const suggestions: TagSuggestion[] = []
    
    const productName = item.productName?.toLowerCase() || ''
    const description = item.description?.toLowerCase() || ''
    const category = item.category?.toLowerCase() || ''
    const profit = item.estimatedSellPrice ? item.estimatedSellPrice - item.purchasePrice : 0
    const profitMargin = item.profitMargin || 0
    
    const textContent = `${productName} ${description} ${category}`
    
    const vintageKeywords = ['vintage', 'retro', 'antique', 'classic', '90s', '80s', '70s', '60s', 'old', 'collectible']
    if (vintageKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'vintage')!,
        confidence: 0.9,
        reason: 'Product description contains vintage indicators'
      })
    }
    
    if (profit >= 30 || profitMargin >= 200) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'high-value')!,
        confidence: profit >= 50 ? 0.95 : 0.85,
        reason: `High profit potential: $${profit.toFixed(2)}`
      })
    }
    
    const electronicsKeywords = ['phone', 'laptop', 'computer', 'tablet', 'camera', 'console', 'gaming', 'headphones', 'speaker', 'electronic', 'digital', 'smart', 'apple', 'samsung', 'sony']
    if (electronicsKeywords.some(kw => textContent.includes(kw)) || category.includes('electron')) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'electronics')!,
        confidence: 0.88,
        reason: 'Identified as electronics product'
      })
    }
    
    const clothingKeywords = ['shirt', 'jacket', 'pants', 'dress', 'shoes', 'hoodie', 'sweater', 'jeans', 'coat', 'clothing', 'apparel', 'fashion', 'wear']
    if (clothingKeywords.some(kw => textContent.includes(kw)) || category.includes('cloth') || category.includes('apparel')) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'clothing')!,
        confidence: 0.87,
        reason: 'Identified as clothing item'
      })
    }
    
    const collectibleKeywords = ['collectible', 'rare', 'limited', 'edition', 'signed', 'autograph', 'mint', 'sealed', 'first edition']
    if (collectibleKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'collectible')!,
        confidence: 0.85,
        reason: 'Contains collectible indicators'
      })
    }
    
    const brandKeywords = ['nike', 'adidas', 'gucci', 'prada', 'chanel', 'louis vuitton', 'lv', 'rolex', 'apple', 'samsung', 'sony', 'north face', 'patagonia', 'supreme', 'yeezy']
    if (brandKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'brand-name')!,
        confidence: 0.92,
        reason: 'Recognized brand name detected'
      })
    }
    
    const rareKeywords = ['rare', 'hard to find', 'htf', 'discontinued', 'exclusive', 'prototype', 'one of a kind', 'unique']
    if (rareKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'rare')!,
        confidence: 0.83,
        reason: 'Rarity indicators found'
      })
    }
    
    if (item.marketData?.ebaySellThroughRate && item.marketData.ebaySellThroughRate >= 70) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'fast-seller')!,
        confidence: 0.9,
        reason: `High sell-through rate: ${item.marketData.ebaySellThroughRate}%`
      })
    }
    
    const luxuryKeywords = ['luxury', 'designer', 'high-end', 'premium', 'gold', 'diamond', 'platinum', 'cashmere', 'silk']
    if (luxuryKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'luxury')!,
        confidence: 0.86,
        reason: 'Luxury product indicators detected'
      })
    }
    
    const sportsKeywords = ['sport', 'athletic', 'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'fitness', 'running', 'training']
    if (sportsKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'sports')!,
        confidence: 0.84,
        reason: 'Sports-related product'
      })
    }
    
    const homeDecorKeywords = ['vase', 'lamp', 'frame', 'mirror', 'decor', 'furniture', 'chair', 'table', 'shelf', 'wall art', 'rug', 'curtain']
    if (homeDecorKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'home-decor')!,
        confidence: 0.82,
        reason: 'Home decor item identified'
      })
    }
    
    const toysKeywords = ['toy', 'game', 'lego', 'action figure', 'doll', 'puzzle', 'board game', 'video game', 'playstation', 'xbox', 'nintendo']
    if (toysKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'toys-games')!,
        confidence: 0.85,
        reason: 'Toys or games category'
      })
    }
    
    const jewelryKeywords = ['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'watch', 'brooch', 'pendant']
    if (jewelryKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'jewelry')!,
        confidence: 0.89,
        reason: 'Jewelry item detected'
      })
    }
    
    const bookKeywords = ['book', 'novel', 'textbook', 'manual', 'guide', 'encyclopedia', 'magazine']
    if (bookKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'books')!,
        confidence: 0.91,
        reason: 'Book or publication'
      })
    }
    
    const damagedKeywords = ['damaged', 'broken', 'cracked', 'torn', 'stained', 'scratched', 'dent', 'chipped', 'worn']
    if (damagedKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'damaged')!,
        confidence: 0.93,
        reason: 'Damage indicators found'
      })
    }
    
    const repairKeywords = ['needs repair', 'for parts', 'not working', 'as-is', 'repair needed', 'fix']
    if (repairKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'needs-repair')!,
        confidence: 0.94,
        reason: 'Repair needed'
      })
    }
    
    const nwtKeywords = ['new with tags', 'nwt', 'brand new', 'never worn', 'unworn', 'tags attached']
    if (nwtKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'new-with-tags')!,
        confidence: 0.96,
        reason: 'New with tags condition'
      })
    }
    
    const handmadeKeywords = ['handmade', 'hand made', 'hand crafted', 'artisan', 'handcrafted', 'custom made']
    if (handmadeKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'handmade')!,
        confidence: 0.88,
        reason: 'Handmade product'
      })
    }
    
    const limitedKeywords = ['limited edition', 'special edition', 'exclusive', 'numbered', 'limited release']
    if (limitedKeywords.some(kw => textContent.includes(kw))) {
      suggestions.push({
        tag: PREDEFINED_TAGS.find(t => t.id === 'limited-edition')!,
        confidence: 0.87,
        reason: 'Limited edition item'
      })
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }
  
  function getAllTags(): ItemTag[] {
    return [...PREDEFINED_TAGS]
  }
  
  function getTagById(id: string): ItemTag | undefined {
    return PREDEFINED_TAGS.find(t => t.id === id)
  }
  
  function createCustomTag(name: string, color?: string, icon?: string): ItemTag {
    return {
      id: `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name,
      color: color || 'oklch(0.60 0.15 220)',
      icon: icon || '🏷️'
    }
  }
  
  return {
    suggestTags,
    getAllTags,
    getTagById,
    createCustomTag,
    PREDEFINED_TAGS
  }
}
