ALTER TABLE "parking_zones" ADD COLUMN "zone_code" TEXT;

UPDATE "parking_zones"
SET "zone_code" = CASE "name"
  WHEN 'North Lot' THEN 'N'
  WHEN 'Engineering Building' THEN 'B'
  WHEN 'Library Deck' THEN 'L'
  WHEN 'South Campus' THEN 'S'
  WHEN 'Sports Centre' THEN 'SC'
  ELSE NULL
END
WHERE "zone_code" IS NULL;

DO $$
DECLARE
  zone_record RECORD;
  base_code TEXT;
  candidate_code TEXT;
  suffix_number INTEGER;
BEGIN
  FOR zone_record IN
    SELECT "id", "name"
    FROM "parking_zones"
    WHERE "zone_code" IS NULL
    ORDER BY "display_order" ASC, "name" ASC, "id" ASC
  LOOP
    SELECT string_agg(substr(word, 1, 1), '')
    INTO base_code
    FROM regexp_split_to_table(upper(regexp_replace(zone_record."name", '[^A-Za-z0-9 ]', '', 'g')), '\s+') AS word
    WHERE word <> '';

    base_code := regexp_replace(coalesce(nullif(base_code, ''), 'Z'), '[^A-Z0-9]', '', 'g');
    base_code := substr(base_code, 1, 4);
    candidate_code := base_code;
    suffix_number := 1;

    WHILE EXISTS (
      SELECT 1
      FROM "parking_zones"
      WHERE "zone_code" = candidate_code
    ) LOOP
      candidate_code := substr(base_code, 1, greatest(1, 4 - length(suffix_number::TEXT))) || suffix_number::TEXT;
      suffix_number := suffix_number + 1;
    END LOOP;

    UPDATE "parking_zones"
    SET "zone_code" = candidate_code
    WHERE "id" = zone_record."id";
  END LOOP;
END $$;

ALTER TABLE "parking_zones" ALTER COLUMN "zone_code" SET NOT NULL;
CREATE UNIQUE INDEX "parking_zones_zone_code_key" ON "parking_zones"("zone_code");
