const RULES: [string, string[]][] = [
  ['Drinks',                ['water','juice','cola','soda','beer','wine','lager','cider','tea','coffee','squash','cordial','energy','fizzy','drink','smoothie','milkshake','cooldrink']],
  ['Tinned & Canned',       ['tin','tinned','can','canned','beans','soup','tomatoes','tuna','sardine','chickpea','lentil','chopped','passata','pilchard']],
  ['Snacks & Confectionery',['crisp','chip','biscuit','cracker','popcorn','nut','pretzel','bar','wafer','flapjack','rice cake','snack','chocolate','sweet','candy','gummy','jelly bean','lollipop','toffee','fudge','mint','marshmallow','nougat','truffle']],
  ['Bakery & Cereals',      ['bread','loaf','roll','bun','muffin','cake','pastry','croissant','bagel','wrap','pitta','scone','doughnut','cereal','oat','muesli','granola','porridge','cornflake','weetabix','bran','pancake mix']],
  ['Home & Cleaning',       ['cleaner','bleach','dishwash','polish','sanitizer','disinfectant','toilet','bin bag','air freshener','candle','tissue','paper towel','washing powder','laundry','fabric softener','stain remover','wool wash','rinse aid']],
  ['Health & Beauty',       ['shampoo','conditioner','body wash','soap','deodorant','antiperspirant','toothpaste','toothbrush','moisturiser','lotion','sunscreen','razor','shaving','skincare','face wash','lip balm','vitamin','supplement','tablet','capsule','pain relief','ibuprofen','paracetamol','cold','flu','first aid','bandage','antiseptic','lozenge','probiotic']],
  ['Baby & Toddler',        ['baby','infant','toddler','nappy','diaper','formula','dummy','rusk','teething']],
  ['Pet',                   ['dog','cat','pet','kibble','pedigree','whiskas','treats','bird seed','fish food']],
  ['Electronics',           ['headphone','earphone','cable','charger','adapter','plug','battery','bulb','lamp','speaker','remote','mouse','keyboard','usb','hdmi','torch','fan','kettle','toaster','iron','blender']],
];

export function categorize(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of RULES) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Other';
}
