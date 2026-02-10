import { validate } from 'class-validator';
import { CreateSessionDTO } from './create-session.dto';

describe('CreateSessionDTO Validation', () => {
  it('should pass validation with valid data', async () => {
    const dto = new CreateSessionDTO();
    dto.sessionName = 'valid_session_123';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation if sessionName is empty', async () => {
    const dto = new CreateSessionDTO();
    dto.sessionName = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('should fail validation if sessionName is too short', async () => {
    const dto = new CreateSessionDTO();
    dto.sessionName = 'ab';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should fail validation if sessionName contains invalid characters', async () => {
    const dto = new CreateSessionDTO();
    dto.sessionName = 'invalid session!';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('matches');
  });
});
