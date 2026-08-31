UPDATE [AuditEvent]
SET [afterJson] = JSON_MODIFY(
  JSON_MODIFY(
    JSON_MODIFY(
      JSON_MODIFY([afterJson], '$.latitude', NULL),
      '$.longitude', NULL
    ),
    '$.accuracyMeters', NULL
  ),
  '$.distanceMeters', NULL
)
WHERE [action] LIKE 'field[_]visit.%'
  AND [afterJson] IS NOT NULL
  AND ISJSON([afterJson]) = 1;
