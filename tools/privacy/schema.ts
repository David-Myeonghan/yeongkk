export type Tables = Record<string, string[]>;

const CREATE_TABLE = /^CREATE TABLE (\w+) \((.*)\)$/s;
const ADD_COLUMN = /^ALTER TABLE (\w+) ADD COLUMN (\w+)\s+\w+/;
const CREATE_INDEX = /^CREATE (?:UNIQUE )?INDEX\b/;

const statementsOf = (sql: string): string[] =>
  sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s !== "");

const columnsIn = (body: string): string[] =>
  body
    .split(/,\s*\n|\n/)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line !== "")
    .map((line) => /^(\w+)\s+(?:INTEGER|TEXT|REAL|BLOB)\b/.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);

/** 마이그레이션 SQL 을 순서대로 읽어 표별 칸 목록을 만든다. 모르는 문장 모양은 무시하지 않고 던진다. */
export function tablesFrom(files: string[]): Tables {
  const tables: Tables = {};
  for (const statement of files.flatMap(statementsOf)) {
    const create = CREATE_TABLE.exec(statement);
    const alter = ADD_COLUMN.exec(statement);
    if (create !== null) {
      tables[create[1]] = columnsIn(create[2]);
    } else if (alter !== null) {
      const [, table, column] = alter;
      if (tables[table] === undefined) throw new Error(`없는 표에 칸을 더해요: ${statement}`);
      tables[table].push(column);
    } else if (!CREATE_INDEX.test(statement)) {
      throw new Error(`방침 검사가 모르는 SQL 문장이에요. tools/privacy/schema.ts 를 고치고 방침을 확인하세요: ${statement}`);
    }
  }
  for (const name of Object.keys(tables)) tables[name].sort();
  return tables;
}
