-- Associate Doctor track: assign "What the Heck is EOS" (start in Week 1,
-- graded finish in the Week 6 test-out). Each insert is skipped if the module
-- already exists in its milestone, so re-running is a no-op.
INSERT INTO `modules` (`milestoneId`, `title`, `description`, `type`, `sortOrder`, `isRequired`, `quizEnabled`)
SELECT ms.`id`, 'Start ''What the Heck is EOS''',
       'Begin reading the EOS book. Must be finished by your Week 6 test-out.',
       'task', COALESCE((SELECT MAX(m.`sortOrder`) FROM `modules` m WHERE m.`milestoneId` = ms.`id`), 0) + 1, true, false
FROM `milestones` ms
JOIN `tracks` t ON t.`id` = ms.`trackId` AND t.`teamRole` = 'associate_doctor'
WHERE ms.`weekNumber` = 1 AND LOWER(ms.`title`) NOT LIKE '%test out%'
  AND NOT EXISTS (SELECT 1 FROM `modules` x WHERE x.`milestoneId` = ms.`id` AND LOWER(x.`title`) LIKE '%what the heck is eos%')
ORDER BY ms.`sortOrder`, ms.`id`
LIMIT 1;
--> statement-breakpoint
INSERT INTO `modules` (`milestoneId`, `title`, `description`, `type`, `sortOrder`, `isRequired`, `quizEnabled`)
SELECT ms.`id`, 'Finish ''What the Heck is EOS''',
       'Finish the EOS book and discuss the key takeaways with your supervising doctor at this test-out.',
       'task', COALESCE((SELECT MAX(m.`sortOrder`) FROM `modules` m WHERE m.`milestoneId` = ms.`id`), 0) + 1, true, false
FROM `milestones` ms
JOIN `tracks` t ON t.`id` = ms.`trackId` AND t.`teamRole` = 'associate_doctor'
WHERE ms.`weekNumber` = 6 AND LOWER(ms.`title`) LIKE '%test out%'
  AND NOT EXISTS (SELECT 1 FROM `modules` x WHERE x.`milestoneId` = ms.`id` AND LOWER(x.`title`) LIKE '%what the heck is eos%')
ORDER BY ms.`sortOrder`, ms.`id`
LIMIT 1;
