-- Seed data mirroring the frontend demo catalogue (categories + 31 products).
-- Safe to re-run: existing rows are left untouched. Users are created by the API
-- (the first admin is bootstrapped from ADMIN_* env vars on server start).

insert into categories (name, description, color) values
  ('Plastic Items', 'Buckets, chairs, storage and everyday plastic goods.', '#6574e8'),
  ('School Supplies', 'Books, stationery and learning essentials.', '#2f9d8f'),
  ('Household Essentials', 'Daily household and cleaning products.', '#e5a43a'),
  ('Paper & Packaging', 'Paper bundles, wrapping and packing supplies.', '#de6c75')
on conflict (lower(name)) do nothing;

insert into products (sku, name, category_id, selling_price, cost_price, current_stock, minimum_stock, image_url)
select v.sku, v.name, c.id, v.price, v.cost, v.stock, v.min_stock, v.image
from (values
  ('PL-001', 'Plastic Bucket 10L', 'Plastic Items', 450, 285, 45, 10, '/products/plastic-bucket.webp'),
  ('PL-002', 'Plastic Chair (Standard)', 'Plastic Items', 1250, 790, 7, 12, '/products/plastic-chair.webp'),
  ('PL-003', 'Plastic Lunch Box', 'Plastic Items', 380, 220, 62, 15, '/products/plastic-lunch-box.webp'),
  ('PL-004', 'Water Jug 2L', 'Plastic Items', 550, 340, 0, 8, '/products/water-jug.webp'),
  ('PL-005', 'Storage Container 5L', 'Plastic Items', 890, 560, 24, 10, '/products/storage-container.webp'),
  ('PL-006', 'Plastic Basin 12L', 'Plastic Items', 420, 255, 31, 10, '/products/plastic-basin.webp'),
  ('PL-007', 'Dish Rack', 'Plastic Items', 1450, 940, 18, 5, '/products/dish-rack.webp'),
  ('PL-008', 'Plastic Waste Bin', 'Plastic Items', 780, 490, 9, 10, '/products/plastic-waste-bin.webp'),
  ('ST-001', 'A4 Drawing Book', 'School Supplies', 240, 145, 0, 10, '/products/a4-drawing-book.webp'),
  ('ST-002', 'Pencil Box (Packet of 12)', 'School Supplies', 1680, 1120, 4, 5, '/products/pencil-box-pack.webp'),
  ('ST-003', 'Blue Ballpoint Pen', 'School Supplies', 60, 32, 12, 15, '/products/blue-ballpoint-pen.webp'),
  ('PP-001', 'A4 Paper Bundle 80GSM', 'Paper & Packaging', 1450, 1080, 8, 50, '/products/a4-paper.webp'),
  ('ST-004', 'School Books 200Pgs', 'School Supplies', 320, 205, 14, 40, '/products/school-books.webp'),
  ('ST-005', 'Bristol Board - White', 'School Supplies', 95, 54, 19, 45, '/products/bristol-board-white.webp'),
  ('ST-006', 'Colour Pencils (12 Pack)', 'School Supplies', 650, 410, 36, 12, '/products/colour-pencils.webp'),
  ('ST-007', 'Geometry Box', 'School Supplies', 780, 510, 22, 8, '/products/geometry-box.webp'),
  ('ST-008', 'Glue Stick 20g', 'School Supplies', 180, 105, 54, 20, '/products/glue-stick.webp'),
  ('ST-009', 'Exercise Book 80 Pages', 'School Supplies', 140, 82, 86, 30, '/products/exercise-book.webp'),
  ('ST-010', 'Safety Scissors', 'School Supplies', 350, 205, 17, 8, '/products/safety-scissors.webp'),
  ('HH-001', '1L Water Bottle', 'Household Essentials', 120, 68, 11, 30, '/products/water-bottle-1l.webp'),
  ('PP-002', 'Brown Paper Bundles', 'Paper & Packaging', 550, 355, 5, 25, '/products/brown-paper-bundles.webp'),
  ('HH-002', 'Hand Wash 500ml', 'Household Essentials', 620, 390, 28, 12, '/products/hand-wash.webp'),
  ('HH-003', 'Floor Mop', 'Household Essentials', 1150, 760, 16, 6, '/products/floor-mop.webp'),
  ('HH-004', 'Kitchen Towel Roll', 'Household Essentials', 290, 175, 42, 15, '/products/kitchen-towel-roll.webp'),
  ('PP-003', 'Gift Wrapper Roll', 'Paper & Packaging', 380, 225, 27, 10, '/products/gift-wrapper-roll.webp'),
  ('PP-004', 'Packing Tape', 'Paper & Packaging', 310, 185, 33, 12, '/products/packing-tape.webp'),
  ('ST-011', 'Whiteboard Marker', 'School Supplies', 220, 130, 6, 10, '/products/whiteboard-marker.webp'),
  ('ST-012', 'Plastic File Holder', 'School Supplies', 890, 560, 20, 8, '/products/plastic-file-holder.webp'),
  ('HH-005', 'Steel Flask 750ml', 'Household Essentials', 1890, 1270, 13, 5, '/products/steel-flask.webp'),
  ('HH-006', 'Insulated Lunch Bag', 'Household Essentials', 1350, 880, 0, 6, '/products/insulated-lunch-bag.webp'),
  ('PL-009', 'Disposable Cups (50 Pack)', 'Plastic Items', 420, 260, 38, 12, '/products/disposable-cups.webp')
) as v(sku, name, category_name, price, cost, stock, min_stock, image)
join categories c on lower(c.name) = lower(v.category_name)
on conflict (sku) do nothing;
