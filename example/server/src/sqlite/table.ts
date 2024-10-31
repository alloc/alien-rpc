export function table(name: string) {
  return new Table(name)
}

export type InferTableType<T extends Table<any>> = T[typeof kSchemaSymbol]

export interface Column {
  name: string
  type: string
  constraints: string[]
}

export interface ColumnConstraints {
  primaryKey?: boolean
  unique?: boolean
  notNull?: boolean
  default?: string
}

type Simplify<T> = { [K in keyof T]: T[K] } & {}

const kSchemaSymbol = Symbol('schema')

export class Table<TSchema extends object = {}> {
  declare [kSchemaSymbol]: TSchema
  readonly name: string
  readonly columns: Column[] = []
  constructor(name: string) {
    this.name = name
  }

  text<TColumn extends string>(
    name: TColumn,
    constraints?: ColumnConstraints,
  ): Table<Simplify<TSchema & { [k in TColumn]: string }>> {
    return this.addColumn(name, 'TEXT', constraints)
  }

  integer<TColumn extends string>(
    name: TColumn,
    constraints?: ColumnConstraints,
  ): Table<Simplify<TSchema & { [k in TColumn]: number }>> {
    return this.addColumn(name, 'INTEGER', constraints)
  }

  real<TColumn extends string>(
    name: TColumn,
    constraints?: ColumnConstraints,
  ): Table<Simplify<TSchema & { [k in TColumn]: number }>> {
    return this.addColumn(name, 'REAL', constraints)
  }

  blob<TColumn extends string>(
    name: TColumn,
    constraints?: ColumnConstraints,
  ): Table<Simplify<TSchema & { [k in TColumn]: Uint8Array }>> {
    return this.addColumn(name, 'BLOB', constraints)
  }

  numeric<TColumn extends string>(
    name: TColumn,
    constraints?: ColumnConstraints,
  ): Table<Simplify<TSchema & { [k in TColumn]: number }>> {
    return this.addColumn(name, 'NUMERIC', constraints)
  }

  toString() {
    return `CREATE TABLE IF NOT EXISTS ${this.name} (${this.columns.map((column) => `${column.name} ${column.type} ${column.constraints.join(' ')}`.trim()).join(', ')});`
  }

  private addColumn(
    name: string,
    type: string,
    constraints?: ColumnConstraints,
  ): Table<any> {
    const constraintsList: string[] = []
    if (constraints?.primaryKey) constraintsList.push('PRIMARY KEY')
    if (constraints?.unique) constraintsList.push('UNIQUE')
    if (constraints?.notNull) constraintsList.push('NOT NULL')
    if (constraints?.default)
      constraintsList.push(`DEFAULT ${constraints.default}`)

    this.columns.push({
      name,
      type,
      constraints: constraintsList,
    })
    return this
  }
}
