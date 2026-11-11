-- Every protocol point now records whether it has been dealt with ("Klar")
-- as value.done. Ja/nej points used value.done for their answer; that moves
-- to value.answer.

UPDATE protocol_items
SET value = json_remove(
  json_set(value, '$.answer', json(json_type(value, '$.done'))),
  '$.done'
)
WHERE type = 'toggle' AND json_type(value, '$.done') IN ('true', 'false');

-- Points with something recorded counted as dealt with; tabled points did not.
UPDATE protocol_items
SET value = json_set(value, '$.done', json('true'))
WHERE json_valid(value)
  AND json_type(value, '$.tabled') IS NOT 'true'
  AND json_remove(value, '$.tabled', '$.followUp') <> '{}';
