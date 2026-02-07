import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { EntityManager } from 'typeorm';

interface ExistsInterface {
  tableName: string;
  column: string;
}

@ValidatorConstraint({ name: 'ExistsConstraint', async: true })
@Injectable()
export class ExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly entityManager: EntityManager) {}
  async validate(value: any, args?: ValidationArguments): Promise<boolean> {
    const { tableName, column }: ExistsInterface = args.constraints[0];

    if (Array.isArray(value)) {
      const dataExist = await this.entityManager
        .getRepository(tableName)
        .createQueryBuilder(tableName)
        .whereInIds(value)
        .getCount();

      return dataExist === value.length;
    } else {
      const dataExist = await this.entityManager
        .getRepository(tableName)
        .createQueryBuilder(tableName)
        .where({ [column]: value })
        .getExists();

      return dataExist;
    }
  }

  defaultMessage(validationArguments?: ValidationArguments): string {
    const field: string = validationArguments.property;
    const value: string = validationArguments.value;

    return `${field}: ${value} não encontrado!`;
  }
}

export function Exists(
  options: ExistsInterface,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'Exists',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: ExistsConstraint,
    });
  };
}
