const CITIES = [
  // West Bank
  { id: 'tulkarm', ar: 'طولكرم', en: 'Tulkarem', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'nablus', ar: 'نابلس', en: 'Nablus', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'ramallah', ar: 'رام الله', en: 'Ramallah', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'hebron', ar: 'الخليل', en: 'Hebron', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'bethlehem', ar: 'بيت لحم', en: 'Bethlehem', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'jenin', ar: 'جنين', en: 'Jenin', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'qalqilya', ar: 'قلقيلية', en: 'Qalqilya', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'salfit', ar: 'سلفيت', en: 'Salfit', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'tubas', ar: 'طوباس', en: 'Tubas', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'jericho', ar: 'أريحا', en: 'Jericho', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'jerusalem', ar: 'القدس', en: 'Jerusalem', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'birzeit', ar: 'بيرزيت', en: 'Birzeit', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'al_bireh', ar: 'البيرة', en: 'Al-Bireh', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'beit_jala', ar: 'بيت جالا', en: 'Beit Jala', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'dura', ar: 'دورا', en: 'Dura', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'yatta', ar: 'يطا', en: 'Yatta', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'anabta', ar: 'عنبتا', en: 'Anabta', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  { id: 'azzun', ar: 'عزون', en: 'Azzun', region_ar: 'الضفة الغربية', region_en: 'West Bank' },
  // Gaza Strip
  { id: 'gaza_city', ar: 'مدينة غزة', en: 'Gaza City', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'khan_younis', ar: 'خان يونس', en: 'Khan Younis', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'rafah', ar: 'رفح', en: 'Rafah', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'deir_al_balah', ar: 'دير البلح', en: 'Deir al-Balah', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'jabalia', ar: 'جباليا', en: 'Jabalia', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  { id: 'beit_hanoun', ar: 'بيت حانون', en: 'Beit Hanoun', region_ar: 'قطاع غزة', region_en: 'Gaza Strip' },
  // Arab cities — Israel
  { id: 'nazareth', ar: 'الناصرة', en: 'Nazareth', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'haifa', ar: 'حيفا', en: 'Haifa', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'akka', ar: 'عكا', en: 'Acre', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'lod', ar: 'اللد', en: 'Lod', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'rahat', ar: 'رهط', en: 'Rahat', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'umm_al_fahm', ar: 'أم الفحم', en: 'Umm al-Fahm', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'tayibe', ar: 'الطيبة', en: 'Tayibe', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'shfaram', ar: 'شفاعمرو', en: 'Shfar\'am', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'tamra', ar: 'طمرة', en: 'Tamra', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'sakhnin', ar: 'سخنين', en: 'Sakhnin', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'baqa_al_gharbiyye', ar: 'باقة الغربية', en: 'Baqa al-Gharbiyye', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'tira', ar: 'الطيرة', en: 'Tira', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'kafr_qasim', ar: 'كفر قاسم', en: 'Kafr Qasim', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'kafr_kanna', ar: 'كفر كنا', en: 'Kafr Kanna', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'arara', ar: 'عرعرة', en: 'Ar\'ara', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'jisr_az_zarqa', ar: 'جسر الزرقاء', en: 'Jisr az-Zarqa', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'qalansawe', ar: 'قلنسوة', en: 'Qalansawe', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'arrabe', ar: 'عرابة', en: 'Arrabe', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'deir_hanna', ar: 'دير حنا', en: 'Deir Hanna', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'maghar', ar: 'المغار', en: 'Maghar', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'kabul', ar: 'كابول', en: 'Kabul', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'yafa', ar: 'يافا', en: 'Jaffa', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'ramle', ar: 'الرملة', en: 'Ramle', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'beer_sheva', ar: 'بئر السبع', en: 'Beer Sheva', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'eilaboun', ar: 'عيلبون', en: 'Eilaboun', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
  { id: 'nahf', ar: 'نحف', en: 'Nahf', region_ar: 'مدن عربية — إسرائيل', region_en: 'Arab cities — Israel' },
];

function getCitiesByRegion(lang = 'ar') {
  const grouped = {};
  CITIES.forEach((city) => {
    const region = lang === 'ar' ? city.region_ar : city.region_en;
    if (!grouped[region]) grouped[region] = [];
    grouped[region].push({ id: city.id, value: city.en, name: lang === 'ar' ? city.ar : city.en });
  });
  return grouped;
}

function getCityOptions(lang = 'ar') {
  return CITIES.map((city) => ({
    id: city.id,
    value: city.en,
    name: lang === 'ar' ? city.ar : city.en,
    region: lang === 'ar' ? city.region_ar : city.region_en,
  }));
}

function getCityName(idOrValue, lang = 'ar') {
  const city = CITIES.find((c) => c.id === idOrValue || c.en === idOrValue || c.ar === idOrValue);
  if (!city) return idOrValue;
  return lang === 'ar' ? city.ar : city.en;
}

module.exports = { CITIES, getCitiesByRegion, getCityOptions, getCityName };
