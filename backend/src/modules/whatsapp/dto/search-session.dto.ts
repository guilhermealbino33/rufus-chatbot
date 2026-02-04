import { IsOptional } from "class-validator";

export class SearchSessionsDTO {
    @IsOptional()
    page?: number;
  
    @IsOptional()
    limit?: number;
}