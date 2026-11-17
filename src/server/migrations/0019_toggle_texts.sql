-- Ja/nej points can say what the protocol should read for each answer
-- (config.yesText / config.noText), e.g. "Dagordningen godkändes." instead
-- of "Ja". The default template now has wording for its two ja/nej points;
-- give the copies of them the same, where no wording is set yet.
--
-- Templates, agendas and open protocols only: a closed protocol is the
-- record of the meeting (maybe justerat and signed), so its text stays.

UPDATE template_items
SET config = json_set(config, '$.yesText', 'Dagordningen godkändes.', '$.noText', 'Dagordningen godkändes inte.')
WHERE type = 'toggle' AND title = 'Godkännande av dagordning'
  AND json_extract(config, '$.yesText') IS NULL AND json_extract(config, '$.noText') IS NULL;

UPDATE template_items
SET config = json_set(config, '$.yesText', 'Föregående protokoll lades till handlingarna.', '$.noText', 'Föregående protokoll lades inte till handlingarna.')
WHERE type = 'toggle' AND title = 'Föregående protokoll'
  AND json_extract(config, '$.yesText') IS NULL AND json_extract(config, '$.noText') IS NULL;

UPDATE agenda_items
SET config = json_set(config, '$.yesText', 'Dagordningen godkändes.', '$.noText', 'Dagordningen godkändes inte.')
WHERE type = 'toggle' AND title = 'Godkännande av dagordning'
  AND json_extract(config, '$.yesText') IS NULL AND json_extract(config, '$.noText') IS NULL;

UPDATE agenda_items
SET config = json_set(config, '$.yesText', 'Föregående protokoll lades till handlingarna.', '$.noText', 'Föregående protokoll lades inte till handlingarna.')
WHERE type = 'toggle' AND title = 'Föregående protokoll'
  AND json_extract(config, '$.yesText') IS NULL AND json_extract(config, '$.noText') IS NULL;

UPDATE protocol_items
SET config = json_set(config, '$.yesText', 'Dagordningen godkändes.', '$.noText', 'Dagordningen godkändes inte.')
WHERE type = 'toggle' AND title = 'Godkännande av dagordning'
  AND json_extract(config, '$.yesText') IS NULL AND json_extract(config, '$.noText') IS NULL
  AND protocol_id IN (SELECT id FROM protocols WHERE closed_at IS NULL);

UPDATE protocol_items
SET config = json_set(config, '$.yesText', 'Föregående protokoll lades till handlingarna.', '$.noText', 'Föregående protokoll lades inte till handlingarna.')
WHERE type = 'toggle' AND title = 'Föregående protokoll'
  AND json_extract(config, '$.yesText') IS NULL AND json_extract(config, '$.noText') IS NULL
  AND protocol_id IN (SELECT id FROM protocols WHERE closed_at IS NULL);
