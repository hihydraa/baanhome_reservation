-- Three more banquet venues: ลานบน, ลานน้ำตก and พูลวิลล่า. Capacity and prices are left empty to be set on the pricing page.
-- Skipped for a name that already exists as a banquet room, so running it twice (or after adding one by hand) is harmless.
INSERT INTO "Resource" ("id", "name", "zone", "type", "sortOrder")
SELECT v."id", v."name", 'BANQUET'::"ResourceZone", 'BANQUET'::"ResourceType", v."sortOrder"
FROM (VALUES
  ('banquet-lan-bon', 'ลานบน', 3),
  ('banquet-lan-namtok', 'ลานน้ำตก', 4),
  ('banquet-poolvilla', 'พูลวิลล่า', 5)
) AS v("id", "name", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM "Resource" r WHERE r."type" = 'BANQUET'::"ResourceType" AND r."name" = v."name"
);
