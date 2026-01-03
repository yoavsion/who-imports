// Consumer that imports from various sources
import type { UserId } from './barrel';
import { DEFAULT_VALUE } from './primitives';
import type { GroupId } from './reexporter';
import { utilHelper } from './barrel';

export function consume(id: UserId, group: GroupId) {
  console.log(DEFAULT_VALUE, utilHelper());
  return { id, group };
}
