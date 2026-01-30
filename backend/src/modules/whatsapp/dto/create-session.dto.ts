import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateSessionDto {
    @IsString()
    @IsNotEmpty({ message: 'Session name is required' })
    @MinLength(3, { message: 'Session name must be at least 3 characters long' })
    @MaxLength(50, { message: 'Session name must not exceed 50 characters' })
    @Matches(/^[a-zA-Z0-9_-]+$/, {
        message: 'Session name can only contain letters, numbers, hyphens, and underscores',
    })
    sessionName: string;
}
