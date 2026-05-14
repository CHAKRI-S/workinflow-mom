-- Add one combined product-level note for color/surface/finishing instructions.
-- Existing defaultColor/defaultSurfaceFinish columns stay for legacy data but are no longer edited by the Product form.
ALTER TABLE "Product" ADD COLUMN "finishingNotes" TEXT;

-- Preserve legacy product defaults by moving existing color/surface values into the new combined note.
UPDATE "Product"
SET "finishingNotes" = CONCAT_WS(
  E'\n',
  CASE
    WHEN NULLIF("defaultColor", '') IS NOT NULL THEN 'สีเดิม: ' || "defaultColor"
  END,
  CASE
    WHEN NULLIF("defaultSurfaceFinish", '') IS NOT NULL THEN 'ผิวสำเร็จเดิม: ' || "defaultSurfaceFinish"
  END
)
WHERE NULLIF("finishingNotes", '') IS NULL
  AND (
    NULLIF("defaultColor", '') IS NOT NULL
    OR NULLIF("defaultSurfaceFinish", '') IS NOT NULL
  );
