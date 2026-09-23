-- Point every "Care Plan Guide" video module (all tracks) at the current Loom recording.
UPDATE `modules`
SET `loomUrl` = 'https://www.loom.com/share/898ecc969d304f57b9e988be5dc4dd57',
    `loomVideoId` = '898ecc969d304f57b9e988be5dc4dd57'
WHERE `type` = 'video' AND LOWER(`title`) LIKE '%care plan guide%';
