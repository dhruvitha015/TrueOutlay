// Seed catalog (all prices in INR)
const products = [
  {
    id: 1,
    name: "Apple iPhone 15 (128 GB, Black)",
    category: "Smartphones",
    history: [79900, 74999, 71999],
    merchants: [
      { name: "Flipkart", price: 65999, discount: 17, apr: 0, minDown: 0, fee: 199 },
      { name: "Amazon India", price: 66999, discount: 16, apr: 0, minDown: 0, fee: 99 },
      { name: "Croma", price: 69900, discount: 12, apr: 12, minDown: 5000, fee: 299 },
      { name: "Reliance Digital", price: 70990, discount: 11, apr: 14, minDown: 10000, fee: 399 }
    ]
  },
  {
    id: 2,
    name: "Sony WH-1000XM5 Noise Cancelling Headphones",
    category: "Audio",
    history: [34990, 29990, 28990],
    merchants: [
      { name: "Amazon India", price: 26990, discount: 23, apr: 0, minDown: 0, fee: 0 },
      { name: "Croma", price: 27990, discount: 20, apr: 0, minDown: 2000, fee: 199 },
      { name: "Reliance Digital", price: 28490, discount: 18, apr: 12, minDown: 0, fee: 199 }
    ]
  },
  {
    id: 3,
    name: "Apple MacBook Air M2 Chip (16GB / 256GB SSD)",
    category: "Laptops",
    history: [99900, 94900, 89900],
    merchants: [
      { name: "Amazon India", price: 84990, discount: 15, apr: 0, minDown: 0, fee: 199 },
      { name: "Flipkart", price: 86990, discount: 13, apr: 13, minDown: 10000, fee: 299 },
      { name: "Croma", price: 89900, discount: 10, apr: 0, minDown: 5000, fee: 0 }
    ]
  },
  {
    id: 4,
    name: "Sony Bravia 55-inch 4K Ultra HD Smart LED TV",
    category: "Appliances",
    history: [69990, 64990, 59990],
    merchants: [
      { name: "Reliance Digital", price: 54990, discount: 21, apr: 0, minDown: 5000, fee: 0 },
      { name: "Amazon India", price: 57990, discount: 17, apr: 12, minDown: 0, fee: 199 },
      { name: "Flipkart", price: 58490, discount: 16, apr: 14, minDown: 0, fee: 299 }
    ]
  },
  {
    id: 5,
    name: "OnePlus 12 (12GB RAM, 256GB Storage)",
    category: "Smartphones",
    history: [64999, 62999, 59999],
    merchants: [
      { name: "Amazon India", price: 59999, discount: 8, apr: 0, minDown: 0, fee: 0 },
      { name: "Croma", price: 61999, discount: 5, apr: 10, minDown: 2000, fee: 199 },
      { name: "Reliance Digital", price: 62499, discount: 4, apr: 12, minDown: 5000, fee: 299 }
    ]
  }
];

const CATEGORIES = ["Smartphones", "Laptops", "Audio", "Appliances"];
const MERCHANTS = ["Amazon India", "Flipkart", "Croma", "Reliance Digital"];

module.exports = { products, CATEGORIES, MERCHANTS };
