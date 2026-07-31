CREATE OR REPLACE FUNCTION notify_survey_response_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payload text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := json_build_object(
      'operation', 'delete',
      'id', OLD.id
    )::text;
  ELSE
    payload := json_build_object(
      'operation', 'upsert',
      'row', json_build_object(
        'id', NEW.id,
        'section', NEW.section,
        'q1', NEW.q1,
        'q2', NEW.q2,
        'q3', NEW.q3,
        'q4', NEW.q4,
        'q5', NEW.q5,
        'avg_weight', NEW.avg_weight,
        'solo_message', NEW.solo_message,
        'submitted_at', NEW.submitted_at
      )
    )::text;
  END IF;

  PERFORM pg_notify('survey_response_changes', payload);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER survey_response_change_notification
AFTER INSERT OR UPDATE OR DELETE ON survey_responses
FOR EACH ROW
EXECUTE FUNCTION notify_survey_response_change();
