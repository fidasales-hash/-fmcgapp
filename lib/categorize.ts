const RULES: [string, string[]][] = [
  ['Drinks',             ['water','juice','cola','soda','beer','wine','lager','cider','tea','coffee','squash','cordial','energy','fizzy','drink','smoothie','milkshake','cooldrink']],
  ['Tinned & Canned',   ['tin','tinned','can','canned','beans','soup','tomatoes','tuna','sardine','chickpea','lentil','chopped','passata','pilchard']],
  ['Confectionery',     ['chocolate','sweet','candy','gummy','jelly bean','lollipop','toffee','fudge','mint','marshmallow','nougat','truffle']],
  ['Snacks',            ['crisp','chip','biscuit','cracker','popcorn','nut','pretzel','bar','wafer','flapjack','rice cake','snack']],
  ['Dairy',             ['milk','cheese','yogurt','yoghurt','butter','cream','cheddar','mozzarella','feta','brie','custard']],
  ['Bakery',            ['bread','loaf','roll','bun','muffin','cake','pastry','croissant','bagel','wrap','pitta','scone','doughnut']],
  ['Frozen',            ['frozen','ice cream','pizza','burger','fish finger','nugget','ice lolly']],
  ['Cereals & Breakfast',['cereal','oat','muesli','granola','porridge','cornflake','weetabix','bran','pancake mix']],
  ['Condiments & Sauces',['sauce','ketchup','mayo','mayonnaise','mustard','vinegar','dressing','relish','pickle','chutney','marinade','peri','sriracha','soy','Worcester']],
  ['Cooking & Baking',  ['flour','sugar','oil','salt','baking powder','yeast','spice','herb','stock','seasoning','paste','extract','vanilla']],
  ['Cleaning & Household',['cleaner','bleach','dishwash','polish','sanitizer','disinfectant','toilet','bin bag','air freshener','candle','tissue','paper towel']],
  ['Personal Care',      ['shampoo','conditioner','body wash','soap','deodorant','antiperspirant','toothpaste','toothbrush','moisturiser','lotion','sunscreen','razor','shaving','skincare','face wash','lip balm']],
  ['Health & Pharmacy',  ['vitamin','supplement','tablet','capsule','pain relief','ibuprofen','paracetamol','cold','flu','first aid','bandage','antiseptic','lozenge','probiotic']],
  ['Baby & Toddler',     ['baby','infant','toddler','nappy','diaper','formula','dummy','rusk','teething']],
  ['Laundry',            ['washing powder','laundry','fabric softener','stain remover','wool wash','rinse aid']],
  ['Pet',                ['dog','cat','pet','kibble','pedigree','whiskas','treats','bird seed','fish food']],
  ['Electronics',        ['headphone','earphone','cable','charger','adapter','plug','battery','bulb','lamp','speaker','remote','mouse','keyboard','usb','hdmi','torch','fan','kettle','toaster','iron','blender']],
];

export function categorize(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of RULES) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Other';
}
