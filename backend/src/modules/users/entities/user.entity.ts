import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ default: 'attendant' })
  /**
   * @todo
   * Fututamente será um enum com os valores: admin, attendant, manager
   * Mas apenas no DTO
   */
  role: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
