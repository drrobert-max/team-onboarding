-- CA track: "Memorize Core Values" was linked to the 12WBR EXT Plan SOP. Point
-- it at the Core Values (+ Mission/Vision/Purpose) SOP instead. No-op if no
-- such SOP exists, so it can never blank the link.
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
WHERE LOWER(m.`title`) = 'memorize core values';
