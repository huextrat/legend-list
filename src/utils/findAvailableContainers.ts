import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { comparatorDefault } from "@/utils/helpers";

export function findAvailableContainers(
    ctx: StateContext,
    state: InternalState,
    numNeeded: number,
    startBuffered: number,
    endBuffered: number,
    pendingRemoval: number[],
): number[] {
    const numContainers = peek$(ctx, "numContainers") as number;

    const result: number[] = [];
    const availableContainers: Array<{ index: number; distance: number }> = [];

    // First pass: collect unallocated containers (most efficient to use)
    for (let u = 0; u < numContainers; u++) {
        const key = peek$(ctx, `containerItemKey${u}`);
        let isOk = key === undefined;
        if (!isOk) {
            const index = pendingRemoval.indexOf(u);
            if (index !== -1) {
                pendingRemoval.splice(index, 1);
                isOk = true;
            }
        }
        // Hasn't been allocated yet or is pending removal, so use it
        if (isOk) {
            result.push(u);
            if (result.length >= numNeeded) {
                return result; // Early exit if we have enough unallocated containers
            }
        }
    }

    // Second pass: collect containers that are out of view
    for (let u = 0; u < numContainers; u++) {
        const key = peek$(ctx, `containerItemKey${u}`);
        if (key === undefined) continue; // Skip already collected containers

        const index = state.indexByKey.get(key)!;
        if (index < startBuffered) {
            availableContainers.push({ index: u, distance: startBuffered - index });
        } else if (index > endBuffered) {
            availableContainers.push({ index: u, distance: index - endBuffered });
        }
    }

    // If we need more containers than we have available so far
    const remaining = numNeeded - result.length;
    if (remaining > 0) {
        if (availableContainers.length > 0) {
            // Only sort if we need to
            if (availableContainers.length > remaining) {
                // Sort by distance (furthest first)
                availableContainers.sort(comparatorByDistance);
                // Take just what we need
                availableContainers.length = remaining;
            }

            // Add to result, keeping track of original indices
            for (const container of availableContainers) {
                result.push(container.index);
            }
        }

        // If we still need more, create new containers
        const stillNeeded = numNeeded - result.length;
        if (stillNeeded > 0) {
            for (let i = 0; i < stillNeeded; i++) {
                result.push(numContainers + i);
            }

            if (__DEV__ && numContainers + stillNeeded > peek$(ctx, "numContainersPooled")) {
                console.warn(
                    "[legend-list] No unused container available, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize or increasing initialContainerPoolRatio.",
                    {
                        debugInfo: {
                            numContainers,
                            numNeeded,
                            stillNeeded,
                            numContainersPooled: peek$(ctx, "numContainersPooled"),
                        },
                    },
                );
            }
        }
    }

    // Sort by index for consistent ordering
    return result.sort(comparatorDefault);
}

function comparatorByDistance(a: { distance: number }, b: { distance: number }) {
    return b.distance - a.distance;
}
