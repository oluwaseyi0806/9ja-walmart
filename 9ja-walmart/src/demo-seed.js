// ============================================================
// DEMO SEED (only used on Vercel demo hosting, or when DEMO_SEED=1)
// Creates one approved demo store with 4 phones so a client can try the shop.
// Demo seller login: demo@9jawalmart.com / Demo12345
// ============================================================
const crypto = require('crypto');

module.exports = db => {
  if (db.prepare('SELECT COUNT(*) AS n FROM products WHERE seller_id IS NOT NULL').get().n) return;
  const salt = crypto.randomBytes(16).toString('hex'), hash = crypto.scryptSync('Demo12345', salt, 64).toString('hex');
  const u = db.prepare("INSERT OR IGNORE INTO users(email,name,phone,salt,hash) VALUES ('demo@9jawalmart.com','Demo Seller','08000000000',?,?)").run(salt, hash);
  const id = u.lastInsertRowid || db.prepare("SELECT id FROM users WHERE email='demo@9jawalmart.com'").get().id;
  db.prepare("INSERT OR IGNORE INTO sellers(user_id,store_name,phone,address,business_id,bank_name,account_no,account_name,status,state,city) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, 'Demo Mobile Store', '08000000000', '12 Market Road', 'DEMO', 'Demo Bank', '0000000000', 'Demo Seller', 'approved', 'Ekiti', 'Ado Ekiti');
  const phones = [['Samsung Galaxy A15', 'Samsung', 11000000, 14000000, '6GB', '128GB', 'Brand new (sealed)', 'Black'], ['Tecno Spark 20 Pro', 'Tecno', 13000000, 16000000, '8GB', '256GB', 'Brand new (sealed)', 'Blue'],
    ['iPhone 12', 'Apple iPhone', 28000000, 32000000, '4GB', '64GB', 'UK Used', 'White'], ['Infinix Hot 40', 'Infinix', 15500000, 18000000, '8GB', '128GB', 'Brand new (sealed)', 'Green']];
  for (const [name, brand, price, old, ram, storage, condition, color] of phones)
    db.prepare("INSERT INTO products(name,category,price,old_price,emoji,rating,stock,seller,seller_id,image,images,verified,brand,model_key,specs,state,city) VALUES (?,'Phones',?,?,'📱',4.5,5,'Demo Mobile Store',?,NULL,'[]',1,?,?,?,'Ekiti','Ado Ekiti')")
      .run(name, price, old, id, brand, name.toLowerCase(), JSON.stringify({ brand, model: name, storage, ram, color, condition, network: '4G', warranty: '3 months' }));
};
