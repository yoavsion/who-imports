// Import-then-export pattern
import type { GroupId } from './primitives';
import { DEFAULT_VALUE } from './primitives';

export type { GroupId };
export { DEFAULT_VALUE as REEXPORTED_VALUE };

// Local export
export const LOCAL_CONST = 'local';
