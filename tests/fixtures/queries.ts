import { EXAMPLE_QUERIES } from '../../src/domain/schema/examples'
import demo001 from './schemas/demo-001.json'
import demo002 from './schemas/demo-002.json'
import demo003 from './schemas/demo-003.json'
import demo004 from './schemas/demo-004.json'
import demo005 from './schemas/demo-005.json'

const expectedSchemas: Record<(typeof EXAMPLE_QUERIES)[number]['id'], unknown> = {
  'demo-001': demo001,
  'demo-002': demo002,
  'demo-003': demo003,
  'demo-004': demo004,
  'demo-005': demo005,
}

export const EXAMPLE_FIXTURES = EXAMPLE_QUERIES.map((example) => ({
  ...example,
  expectedSchema: expectedSchemas[example.id],
}))
