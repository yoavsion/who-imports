// Another consumer in a different folder
import type { SharedId } from '../exports/shared';

export function processId(id: SharedId): string {
  return id.toUpperCase();
}
