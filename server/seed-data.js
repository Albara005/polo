'use strict';
// Sample catalogue used on the first run (server) and in the browser preview.
// imgPath(file) returns the URL each environment serves the seed image from.
function seedData(imgPath) {
  const img = (f, w, h) => ({ src: imgPath(f), thumb: imgPath(f), w, h });
  const shoes = ['40', '41', '42', '43', '44', '45', '46'];
  const apparel = ['S', 'M', 'L', 'XL'];
  const P = [
    ['air-jordan-12-retro', 'Air Jordan 12 Retro', 'Air Jordan 12 Retro', 'shoes', 14900, 'shoe', shoes, img('source-tatum-5-orbit-copy.webp', 400, 400), 'Low-top sneaker in light grey and cream with a dark brown swoosh.', 'حذاء منخفض بلون رمادي فاتح وكريمي مع شعار بني داكن.'],
    ['tshirt', 'Tshirt', 'تيشيرت', 'tshirts', 19900, 'size', apparel, img('source-tshirt.webp', 400, 563), 'Black jersey tee with a pink rib collar and a white gothic print.', 'تيشيرت جيرسي أسود بياقة وردية وطباعة قوطية بيضاء.'],
    ['sweatshirt', 'Sweatshirt', 'سويت شيرت', 'sweatshirts', 19900, 'size', apparel, img('source-sweatshirt.webp', 400, 581), 'Beige crew-neck sweatshirt with a small chest print.', 'سويت شيرت بيج بياقة دائرية وطباعة صغيرة على الصدر.'],
    ['tatum-5-orbit', 'Tatum 5 Orbit', 'Tatum 5 Orbit', 'shoes', 14900, 'shoe', shoes, img('source-tatum-5-orbit.webp', 400, 400), 'White leather sneaker with a black collar, grey print and red accents.', 'حذاء جلد أبيض بياقة سوداء وطباعة رمادية ولمسات حمراء.'],
    ['hoodie-black', 'Hoodie Black', 'هودي أسود', 'hoodies', 19900, 'size', apparel, img('source-hoodie-black.webp', 400, 536), 'Black hoodie with a grey star graphic.', 'هودي أسود برسمة نجمة رمادية.'],
    ['sweatshirt-plus', 'Sweatshirt Plus', 'سويت شيرت بلس', 'hoodies', 19900, 'size', apparel, img('source-sweatshirt-plus.webp', 393, 600), 'Bottle-green hoodie with cream varsity lettering.', 'هودي أخضر داكن بكتابة كريمية بأسلوب الجامعات.'],
    ['hoodie', 'Hoodie', 'هودي', 'hoodies', 19900, 'size', apparel, img('source-hoodie.webp', 400, 555), 'Heather-grey hoodie with a black slogan print.', 'هودي رمادي بطباعة عبارة سوداء.'],
    ['luka-5', 'Luka 5', 'Luka 5', 'shoes', 14900, 'shoe', shoes, img('source-air-jordan-12-retro-copy.webp', 400, 400), 'Black low-top leather sneaker with a white midsole.', 'حذاء جلد أسود منخفض بنعل أبيض.']
  ];
  const pins = [[50, 28], [48, 58], [45, 88]];
  const L = [
    ['The City Edit', 'إطلالة المدينة', 1, ['air-jordan-12-retro', 'tshirt', 'sweatshirt'], [[47, 27], [48, 58], [45, 96]]],
    ['Gallery Opening', 'افتتاح المعرض', 5, ['tatum-5-orbit', 'hoodie-black', 'tshirt'], pins],
    ['Gallery Opening', 'افتتاح المعرض', 4, ['sweatshirt-plus', 'tatum-5-orbit', 'tshirt'], pins],
    ['Studio Day', 'يوم الاستوديو', 6, ['hoodie-black', 'air-jordan-12-retro', 'tshirt'], pins],
    ['Studio Day', 'يوم الاستوديو', 3, ['sweatshirt', 'tatum-5-orbit', 'tshirt'], pins],
    ['Studio Day', 'يوم الاستوديو', 2, ['hoodie', 'luka-5', 'tshirt'], pins]
  ];
  return { P, L };
}
module.exports = { seedData };
