const RULES: [string, string[]][] = [
  ['Drinks',        ['water','juice','cola','soda','beer','wine','lager','cider','tea','coffee','squash','cordial','energy','fizzy','drink','smoothie','milkshake']],
  ['Tinned & Canned',['tin','tinned','can','canned','beans','soup','tomatoes','tuna','sardine','chickpea','lentil','chopped','passata']],
  ['Snacks',        ['crisp','chip','biscuit','cracker','chocolate','sweet','candy','popcorn','nut','pretzel','bar','wafer','flapjack']],
  ['Dairy',         ['milk','cheese','yogurt','yoghurt','butter','cream','cheddar','mozzarella','feta','brie']],
  ['Bakery',        ['bread','loaf','roll','bun','muffin','cake','pastry','croissant','bagel','wrap','pitta','scone']],
  ['Frozen',        ['frozen','ice cream','pizza','burger','fish finger','nugget','chips frozen']],
];

export function categorize(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of RULES) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Other';
}
