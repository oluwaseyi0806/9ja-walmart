// ============================================================
// PRODUCT CATEGORIES
// Each category lists the details a seller MUST fill in. Only Phones is switched on for now.
// EDIT HERE: to add a new product type (e.g. Laptops) copy the Phones block, rename it, and change the fields
// ============================================================

module.exports = {
  Phones: {
    fields: [
      { key: 'brand', label: 'Brand', type: 'select', required: true, options: ['Apple iPhone', 'Samsung', 'Tecno', 'Infinix', 'Itel', 'Xiaomi', 'Oppo', 'Nokia', 'Google Pixel', 'Other'] },
      { key: 'model', label: 'Model (e.g. Spark 20 Pro)', type: 'text', required: true },
      { key: 'storage', label: 'Storage', type: 'select', required: true, options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'] },
      { key: 'ram', label: 'RAM', type: 'select', required: true, options: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'] },
      { key: 'color', label: 'Colour', type: 'select', required: true, options: ['Black', 'White', 'Silver', 'Gray', 'Blue', 'Navy Blue', 'Green', 'Red', 'Gold', 'Purple', 'Pink', 'Orange', 'Yellow', 'Titanium', 'Midnight', 'Starlight', 'Other'] },
      { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand new (sealed)', 'UK Used', 'Refurbished'] },
      { key: 'network', label: 'Network', type: 'select', required: true, options: ['4G', '5G'] },
      { key: 'warranty', label: 'Warranty', type: 'select', required: true, options: ['No warranty', '1 month', '3 months', '6 months', '12 months'] },
    ],
  },
};
