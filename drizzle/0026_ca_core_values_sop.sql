-- CA track: fold "Memorize Core Values" into the "Core Values & Mission,
-- Vision, Purpose" video module, then remove the standalone module.
-- 1) Video module gets a watch + memorize checklist (bullets render as
--    checkboxes that gate completion) and the Core Values SOP.
UPDATE `modules` m
JOIN `milestones` ms ON ms.`id` = m.`milestoneId`
JOIN `tracks` t ON t.`id` = ms.`trackId` AND t.`teamRole` = 'ca'
SET m.`description` = 'Watch the Core Values & Mission, Vision, Purpose video, then memorize the Core Values.\n- Watch the Core Values & Mission, Vision, Purpose video\n- Memorize the Reformation Chiropractic Core Values'
WHERE LOWER(m.`title`) = 'core values & mission, vision, purpose';
--> statement-breakpoint
UPDATE `modules` m
JOIN `milestones` ms ON ms.`id` = m.`milestoneId`
JOIN `tracks` t ON t.`id` = ms.`trackId` AND t.`teamRole` = 'ca'
JOIN (
  SELECT s.`id` FROM `sops` s
  WHERE s.`isActive` = true AND LOWER(s.`title`) LIKE '%core values%'
  ORDER BY (LOWER(s.`title`) LIKE '%mvp%' OR LOWER(s.`title`) LIKE '%mission%') DESC, s.`id` DESC
  LIMIT 1
) cv
SET m.`sopId` = cv.`id`
WHERE LOWER(m.`title`) = 'core values & mission, vision, purpose';
--> statement-breakpoint
-- 2) Delete the standalone module, only if the combined module exists.
DELETE m FROM `modules` m
JOIN `milestones` ms ON ms.`id` = m.`milestoneId`
JOIN `tracks` t ON t.`id` = ms.`trackId` AND t.`teamRole` = 'ca'
WHERE LOWER(m.`title`) = 'memorize core values'
  AND EXISTS (
    SELECT 1 FROM (
      SELECT v.`id` FROM `modules` v
      JOIN `milestones` vms ON vms.`id` = v.`milestoneId`
      JOIN `tracks` vt ON vt.`id` = vms.`trackId` AND vt.`teamRole` = 'ca'
      WHERE LOWER(v.`title`) = 'core values & mission, vision, purpose'
      LIMIT 1 -- LIMIT forces materialization (avoids MySQL error 1093)
    ) keep
  );
