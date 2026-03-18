/**
 * Seed Script - Populates the database with sample products
 * Run: npm run seed
 */

const DataStore = require('./dataStore');
const bcrypt = require('bcryptjs');

const products = new DataStore('products');

const sampleProducts = [
  {
    name: "Gaming PC - RTX 4060",
    nameAr: "جهاز قيمنق RTX 4060",
    category: "desktops",
    price: 3800,
    oldPrice: 4200,
    description: "كمبيوتر قيمنق بمواصفات عالية مناسب لجميع الألعاب الحديثة",
    specs: {
      processor: "Intel Core i5-13400F",
      gpu: "NVIDIA RTX 4060 8GB",
      ram: "16GB DDR4 3200MHz",
      storage: "512GB NVMe SSD",
      psu: "650W 80+ Bronze",
      case: "Gaming Case RGB"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "الأكثر مبيعاً",
    inStock: true,
    featured: true,
    sortOrder: 1
  },
  {
    name: "Gaming PC - RTX 4070",
    nameAr: "جهاز قيمنق RTX 4070",
    category: "desktops",
    price: 5500,
    oldPrice: 6000,
    description: "جهاز قيمنق احترافي بمواصفات ممتازة للألعاب والبث المباشر",
    specs: {
      processor: "Intel Core i7-13700F",
      gpu: "NVIDIA RTX 4070 12GB",
      ram: "32GB DDR4 3600MHz",
      storage: "1TB NVMe SSD",
      psu: "750W 80+ Gold",
      case: "Gaming Case RGB"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "جديد",
    inStock: true,
    featured: true,
    sortOrder: 2
  },
  {
    name: "Lenovo IdeaPad 3",
    nameAr: "لينوفو ايديا باد 3",
    category: "laptops",
    price: 1800,
    oldPrice: null,
    description: "لابتوب مناسب للدراسة والعمل اليومي بمواصفات جيدة",
    specs: {
      processor: "Intel Core i5-1235U",
      ram: "8GB DDR4",
      storage: "256GB SSD",
      display: "15.6\" FHD IPS",
      os: "Windows 11"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "",
    inStock: true,
    featured: true,
    sortOrder: 3
  },
  {
    name: "HP Victus Gaming Laptop",
    nameAr: "اتش بي فيكتوس قيمنق",
    category: "laptops",
    price: 3200,
    oldPrice: 3500,
    description: "لابتوب قيمنق بكرت شاشة RTX 3050 مناسب للألعاب والتصميم",
    specs: {
      processor: "AMD Ryzen 5 7535HS",
      gpu: "NVIDIA RTX 3050 4GB",
      ram: "16GB DDR5",
      storage: "512GB NVMe SSD",
      display: "15.6\" FHD 144Hz",
      os: "Windows 11"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "عرض خاص",
    inStock: true,
    featured: true,
    sortOrder: 4
  },
  {
    name: "Redragon K552 Keyboard",
    nameAr: "كيبورد ريدراغون K552",
    category: "gaming",
    price: 180,
    oldPrice: 220,
    description: "كيبورد ميكانيكي بإضاءة RGB مناسب للألعاب",
    specs: {
      type: "Mechanical",
      switches: "Blue Switches",
      lighting: "RGB LED",
      layout: "87 Keys TKL"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "",
    inStock: true,
    featured: false,
    sortOrder: 5
  },
  {
    name: "Logitech G203 Mouse",
    nameAr: "ماوس لوجيتك G203",
    category: "gaming",
    price: 120,
    oldPrice: null,
    description: "ماوس قيمنق بدقة عالية وإضاءة RGB",
    specs: {
      sensor: "8000 DPI",
      buttons: "6 Programmable",
      lighting: "LIGHTSYNC RGB",
      weight: "85g"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "",
    inStock: true,
    featured: false,
    sortOrder: 6
  },
  {
    name: "Gaming Headset HyperX",
    nameAr: "هيدسيت هايبر اكس",
    category: "gaming",
    price: 250,
    oldPrice: 300,
    description: "هيدسيت قيمنق بصوت محيطي 7.1 وميكروفون",
    specs: {
      driver: "50mm",
      frequency: "15Hz-25kHz",
      microphone: "Detachable",
      connection: "3.5mm + USB"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "",
    inStock: true,
    featured: false,
    sortOrder: 7
  },
  {
    name: "Samsung 24\" Monitor FHD",
    nameAr: "شاشة سامسونج 24 انش",
    category: "monitors",
    price: 650,
    oldPrice: null,
    description: "شاشة سامسونج 24 انش بدقة FHD مناسبة للعمل والألعاب",
    specs: {
      size: "24\"",
      resolution: "1920x1080 FHD",
      refreshRate: "75Hz",
      panel: "IPS"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "",
    inStock: true,
    featured: false,
    sortOrder: 8
  },
  {
    name: "Computer Cleaning Service",
    nameAr: "خدمة تنظيف الكمبيوتر",
    category: "services",
    price: 80,
    oldPrice: null,
    description: "تنظيف كامل للكمبيوتر من الغبار وتغيير المعجون الحراري",
    specs: {
      includes: "تنظيف كامل + تغيير معجون حراري",
      duration: "ساعة واحدة",
      warranty: "مضمون"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "",
    inStock: true,
    featured: false,
    sortOrder: 20
  },
  {
    name: "Windows Installation",
    nameAr: "تنصيب ويندوز",
    category: "services",
    price: 50,
    oldPrice: null,
    description: "تنصيب ويندوز مع التعريفات والبرامج الأساسية",
    specs: {
      includes: "ويندوز + تعريفات + برامج أساسية",
      duration: "ساعة واحدة",
      warranty: "مضمون"
    },
    image: "/images/products/placeholder.svg",
    images: [],
    badge: "",
    inStock: true,
    featured: false,
    sortOrder: 21
  }
];

console.log('🌱 Seeding products...');

// Clear existing
const existing = products.getAll();
if (existing.length > 0) {
  console.log(`  Found ${existing.length} existing products. Clearing...`);
  existing.forEach(p => products.delete(p.id));
}

// Insert sample products
sampleProducts.forEach(product => {
  const created = products.create(product);
  console.log(`  ✅ Created: ${created.nameAr} (${created.id})`);
});

console.log(`\n🎉 Done! ${sampleProducts.length} products created.`);
console.log('\nAdmin login:');
console.log('  URL: http://localhost:3000/admin');
console.log('  Username: admin');
console.log('  Password: PcGaming@2024');
