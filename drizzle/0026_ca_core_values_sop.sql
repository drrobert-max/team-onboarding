-- All tracks: fold "Memorize Core Values" into the "Core Values & Mission,
-- Vision, Purpose" video module, then remove the standalone module.
-- 1) The video module gets a watch + memorize checklist (bullets render as
--    checkboxes that gate completion) and the Core Values SOP.
UPDATE `modules`
SET `description` = 'Watch the Core Values & Mission, Vision, Purpose video, then memorize the Core Values.\n- Watch the Core Values & Mission, Vision, Purpose video\n- Memorize the Reformation Chiropractic Core Values'
WHERE LOWER(`title`) = 'core values & mission, vision, purpose';
--> statement-breakpoint
UPDATE `modules` m
JOIN (
  SELECT s.`id` FROM `sops` s
  WHERE s.`isActive` = true AND LOWER(s.`title`) LIKE '%core values%'
  ORDER BY (LOWER(s.`title`) LIKE '%mvp%' OR LOWER(s.`title`) LIKE '%mission%') DESC, s.`id` DESC
  LIMIT 1
) cv
SET m.`sopId` = cv.`id`
WHERE LOWER(m.`title`) = 'core values & mission, vision, purpose';
--> statement-breakpoint
-- 2) Delete the standalone "Memorize Core Values" module on every track.
DELETE FROM `modules` WHERE LOWER(`title`) = 'memorize core values';
