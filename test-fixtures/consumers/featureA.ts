// Consumer in a different folder
import type { SharedId } from '../exports/shared';
import { SHARED_CONSTANT, sharedHelper } from '../exports/shared';

export function useShared(id: SharedId): void {
  console.log(SHARED_CONSTANT);
  sharedHelper();
}
