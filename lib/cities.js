/**
 * Whale city list
 * Palestine (West Bank + Gaza) + Arab towns in Israel.
 */

const CITIES = [
  { id: 'tulkarm', ar: 'طولكرم', en: 'Tulkarem', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'nablus', ar: 'نابلس', en: 'Nablus', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'ramallah', ar: 'رام الله', en: 'Ramallah', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'hebron', ar: 'الخليل', en: 'Hebron', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'jenin', ar: 'جنين', en: 'Jenin', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'jericho', ar: 'أريحا', en: 'Jericho', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'bethlehem', ar: 'بيت لحم', en: 'Bethlehem', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'qalqilya', ar: 'قلقيلية', en: 'Qalqilya', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'salfit', ar: 'سلفيت', en: 'Salfit', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'tubas', ar: 'طوباس', en: 'Tubas', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'jerusalem', ar: 'القدس', en: 'Jerusalem', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'beit_jala', ar: 'بيت جالا', en: 'Beit Jala', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'beit_sahour', ar: 'بيت ساحور', en: 'Beit Sahour', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'anabta', ar: 'عنبتا', en: 'Anabta', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'azzun', ar: 'عزون', en: 'Azzun', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'bidya', ar: 'بدية', en: 'Bidya', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'halhul', ar: 'حلحول', en: 'Halhul', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'yatta', ar: 'يطا', en: 'Yatta', region_ar: 'الضفة الغربية', region_en: 'West Bank' },

  { id: 'gaza_city', ar: 'مدينة غزة', en: 'Gaza City', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'khan_yunis', ar: 'خان يونس', en: 'Khan Yunis', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'rafah', ar: 'رفح', en: 'Rafah', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'deir_balah', ar: 'دير البلح', en: 'Deir al-Balah', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'jabalia', ar: 'جباليا', en: 'Jabalia', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'beit_lahiya', ar: 'بيت لاهيا', en: 'Beit Lahiya', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },

  { id: 'nazareth', ar: 'الناصرة', en: 'Nazareth', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'umm_al_fahm', ar: 'أم الفحم', en: 'Umm al-Fahm', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'rahat', ar: 'رهط', en: 'Rahat', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'tamra', ar: 'طمرة', en: 'Tamra', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'sakhnin', ar: 'سخنين', en: 'Sakhnin', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'baqa_al_gharbiyye', ar: 'باقة الغربية', en: 'Baqa al-Gharbiyye', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'kafr_qasim', ar: 'كفر قاسم', en: 'Kafr Qasim', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'tira', ar: 'الطيرة', en: 'Tira', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'taibeh', ar: 'الطيبة', en: 'Taibeh', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'kafr_kanna', ar: 'كفر كنا', en: 'Kafr Kanna', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'shefaram', ar: 'شفاعمرو', en: 'Shefa-Amr', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'arrabe', ar: 'عرابة', en: 'Arrabe', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'majd_al_krum', ar: 'مجد الكروم', en: 'Majd al-Krum', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'jaljulia', ar: 'جلجولية', en: 'Jaljulia', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'abu_sinan', ar: 'أبو سنان', en: 'Abu Sinan', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'mughar', ar: 'المغار', en: 'Mughar', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'reineh', ar: 'الرينة', en: 'Reineh', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'iksal', ar: 'إكسال', en: 'Iksal', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' }
];

function getCitiesByRegion(lang = 'ar') {
  const grouped = {};
  CITIES.forEach((city) => {
    const region = lang === 'ar' ? city.region_ar : city.region_en;
    if (!grouped[region]) grouped[region] = [];
    grouped[region].push({
      id: city.id,
      value: city.en,
      name: lang === 'ar' ? city.ar : city.en
    });
  });
  return grouped;
}

function getCityOptions(lang = 'ar') {
  return CITIES.map((city) => ({
    id: city.id,
    value: city.en,
    name: lang === 'ar' ? city.ar : city.en,
    region: lang === 'ar' ? city.region_ar : city.region_en
  }));
}

function getCityName(idOrValue, lang = 'ar') {
  const city = CITIES.find((entry) => entry.id === idOrValue || entry.en === idOrValue || entry.ar === idOrValue);
  if (!city) return idOrValue;
  return lang === 'ar' ? city.ar : city.en;
}

module.exports = {
  CITIES,
  getCitiesByRegion,
  getCityOptions,
  getCityName
};
