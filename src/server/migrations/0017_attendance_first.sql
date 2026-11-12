-- Attendance moves to right after the opening in templates and in agendas
-- not yet started, since justerare (and the chair and secretary) are chosen
-- among those present. Only where it came later; protocols are left as
-- recorded. Positions are then renumbered 1, 2, 3… in the new order.

UPDATE template_items SET position = (
    SELECT o.position FROM template_items o
    WHERE o.template_id = template_items.template_id AND o.type = 'open'
    ORDER BY o.position LIMIT 1)
  WHERE type = 'attendance' AND position > (
    SELECT MIN(o.position) FROM template_items o
    WHERE o.template_id = template_items.template_id AND o.type = 'open');

UPDATE template_items SET position = (
  SELECT r.n FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY template_id
      ORDER BY position, CASE type WHEN 'open' THEN 0 WHEN 'attendance' THEN 1 ELSE 2 END, id
    ) AS n FROM template_items
  ) r WHERE r.id = template_items.id);

UPDATE agenda_items SET position = (
    SELECT o.position FROM agenda_items o
    WHERE o.agenda_id = agenda_items.agenda_id AND o.type = 'open'
    ORDER BY o.position LIMIT 1)
  WHERE type = 'attendance'
    AND agenda_id NOT IN (SELECT agenda_id FROM protocols WHERE agenda_id IS NOT NULL)
    AND position > (
      SELECT MIN(o.position) FROM agenda_items o
      WHERE o.agenda_id = agenda_items.agenda_id AND o.type = 'open');

UPDATE agenda_items SET position = (
  SELECT r.n FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY agenda_id
      ORDER BY position, CASE type WHEN 'open' THEN 0 WHEN 'attendance' THEN 1 ELSE 2 END, id
    ) AS n FROM agenda_items
  ) r WHERE r.id = agenda_items.id)
  WHERE agenda_id NOT IN (SELECT agenda_id FROM protocols WHERE agenda_id IS NOT NULL);
