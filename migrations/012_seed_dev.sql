-- 7 warehouses
INSERT INTO warehouses (code, name_th, name_en) VALUES
  ('WH-01', 'คลังสินค้า 1 - กรุงเทพฯ', 'Warehouse 1 - Bangkok'),
  ('WH-02', 'คลังสินค้า 2 - นนทบุรี', 'Warehouse 2 - Nonthaburi'),
  ('WH-03', 'คลังสินค้า 3 - ปทุมธานี', 'Warehouse 3 - Pathum Thani'),
  ('WH-04', 'คลังสินค้า 4 - สมุทรปราการ', 'Warehouse 4 - Samut Prakan'),
  ('WH-05', 'คลังสินค้า 5 - ชลบุรี', 'Warehouse 5 - Chonburi'),
  ('WH-06', 'คลังสินค้า 6 - เชียงใหม่', 'Warehouse 6 - Chiang Mai'),
  ('WH-07', 'คลังสินค้า 7 - ภูเก็ต', 'Warehouse 7 - Phuket')
ON CONFLICT (code) DO NOTHING;

-- Default UOMs
INSERT INTO units_of_measure (code, name_th, name_en) VALUES
  ('PCS', 'ชิ้น', 'Piece'),
  ('BOX', 'กล่อง', 'Box'),
  ('KG', 'กิโลกรัม', 'Kilogram'),
  ('L', 'ลิตร', 'Liter'),
  ('M', 'เมตร', 'Meter'),
  ('SET', 'ชุด', 'Set'),
  ('ROLL', 'ม้วน', 'Roll'),
  ('PAL', 'พาเลท', 'Pallet')
ON CONFLICT (code) DO NOTHING;
