import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteSessionDTO {
  @IsString()
  @IsNotEmpty()
  sessionName: string;
}
