import { beforeEach, describe, expect, it } from "bun:test";

// Create a simplified version of the function for testing
function findAvailableContainers(
    containerData: Record<string, any>,
    state: { indexByKey: Map<string, number> },
    numNeeded: number,
    startBuffered: number,
    endBuffered: number,
    pendingRemoval: number[],
): number[] {
    const numContainers = containerData.numContainers || 0;

    const result: number[] = [];
    const availableContainers: Array<{ index: number; distance: number }> = [];

    // Early return if no containers needed
    if (numNeeded === 0) {
        return result;
    }

    // First pass: collect unallocated containers (most efficient to use)
    for (let u = 0; u < numContainers; u++) {
        const key = containerData[`containerItemKey${u}`];
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
                return result.sort((a, b) => a - b); // Early exit if we have enough unallocated containers
            }
        }
    }

    // Second pass: collect containers that are out of view
    for (let u = 0; u < numContainers; u++) {
        const key = containerData[`containerItemKey${u}`];
        if (key === undefined) continue; // Skip already collected containers

        const index = state.indexByKey.get(key);
        if (index === undefined) continue;

        if (index < startBuffered) {
            availableContainers.push({ distance: startBuffered - index, index: u });
        } else if (index > endBuffered) {
            availableContainers.push({ distance: index - endBuffered, index: u });
        }
    }

    // If we need more containers than we have available so far
    const remaining = numNeeded - result.length;
    if (remaining > 0) {
        if (availableContainers.length > 0) {
            // Only sort if we need to
            if (availableContainers.length > remaining) {
                // Sort by distance (furthest first)
                availableContainers.sort((a, b) => b.distance - a.distance);
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
        }
    }

    // Sort by index for consistent ordering
    return result.sort((a, b) => a - b);
}

describe("findAvailableContainers", () => {
    let mockState: { indexByKey: Map<string, number> };

    beforeEach(() => {
        mockState = {
            indexByKey: new Map(),
        };
    });

    describe("when there are unallocated containers", () => {
        it("should return unallocated containers first", () => {
            const containerData = {
                containerItemKey0: undefined,
                containerItemKey1: undefined,
                containerItemKey2: undefined,
                containerItemKey3: "item3",
                containerItemKey4: "item4",
                numContainers: 5,
            };

            const result = findAvailableContainers(containerData, mockState, 2, 0, 10, []);

            expect(result).toEqual([0, 1]);
        });

        it("should use pending removal containers as unallocated", () => {
            const containerData = {
                containerItemKey0: "item0",
                containerItemKey1: "item1",
                containerItemKey2: "item2",
                numContainers: 3,
            };

            const pendingRemoval = [1];
            const result = findAvailableContainers(containerData, mockState, 1, 0, 10, pendingRemoval);

            expect(result).toEqual([1]);
            expect(pendingRemoval).toEqual([]); // Should be modified in place
        });
    });

    describe("when containers are out of view", () => {
        it("should return containers that are before the buffered range", () => {
            const containerData = {
                containerItemKey0: "item0",
                containerItemKey1: "item1",
                containerItemKey2: "item15",
                numContainers: 3,
            };

            mockState.indexByKey.set("item0", 0);
            mockState.indexByKey.set("item1", 1);
            mockState.indexByKey.set("item15", 15);

            // Buffered range is 5-10, so items 0 and 1 are out of view (before), item15 is out of view (after)
            const result = findAvailableContainers(containerData, mockState, 2, 5, 10, []);

            // Should return containers 0 and 2 (item15 has distance 5, item0 has distance 5, item1 has distance 4)
            // So item15 and item0 should be picked (furthest distances)
            expect(result).toEqual([0, 2]);
        });

        it("should return containers that are after the buffered range", () => {
            const containerData = {
                containerItemKey0: "item0",
                containerItemKey1: "item15",
                containerItemKey2: "item20",
                numContainers: 3,
            };

            mockState.indexByKey.set("item0", 0);
            mockState.indexByKey.set("item15", 15);
            mockState.indexByKey.set("item20", 20);

            // Buffered range is 5-10, so items 0, 15 and 20 are all out of view
            // item0 has distance 5, item15 has distance 5, item20 has distance 10
            // Should return containers 2 and 0 (furthest distances: 10 and 5)
            const result = findAvailableContainers(containerData, mockState, 2, 5, 10, []);

            expect(result).toEqual([0, 2]);
        });

        it("should prioritize containers furthest from the buffered range", () => {
            const containerData = {
                containerItemKey0: "item0", // distance: 5
                containerItemKey1: "item1", // distance: 4
                containerItemKey2: "item15", // distance: 5
                containerItemKey3: "item20", // distance: 10
                numContainers: 4,
            };

            mockState.indexByKey.set("item0", 0);
            mockState.indexByKey.set("item1", 1);
            mockState.indexByKey.set("item15", 15);
            mockState.indexByKey.set("item20", 20);

            // Buffered range is 5-10, need only 2 containers
            const result = findAvailableContainers(containerData, mockState, 2, 5, 10, []);

            // Should return containers 3 and 0 (furthest distances: 10 and 5)
            expect(result).toEqual([0, 3]);
        });
    });

    describe("when creating new containers", () => {
        it("should create new containers when needed", () => {
            const containerData = {
                containerItemKey0: "item5",
                containerItemKey1: "item6",
                numContainers: 2,
                numContainersPooled: 5,
            };

            mockState.indexByKey.set("item5", 5);
            mockState.indexByKey.set("item6", 6);

            // Buffered range is 4-8, both items are in view, need 3 containers total
            // Since no containers are available from existing pool, should create 3 new ones
            const result = findAvailableContainers(containerData, mockState, 3, 4, 8, []);

            expect(result).toEqual([2, 3, 4]); // Creates new container indices 2, 3, 4
        });
    });

    describe("mixed scenarios", () => {
        it("should combine unallocated, out-of-view, and new containers", () => {
            const containerData = {
                containerItemKey0: undefined, // unallocated
                containerItemKey1: "item0", // out of view (before)
                containerItemKey2: "item15", // out of view (after)
                numContainers: 3,
                numContainersPooled: 5,
            };

            mockState.indexByKey.set("item0", 0);
            mockState.indexByKey.set("item15", 15);

            const result = findAvailableContainers(containerData, mockState, 5, 5, 10, []);

            // Should get: unallocated (0), out of view (1, 2), new containers (3, 4)
            expect(result).toEqual([0, 1, 2, 3, 4]);
        });

        it("should return results sorted by index", () => {
            const containerData = {
                containerItemKey0: "item20", // out of view (after)
                containerItemKey1: undefined, // unallocated
                containerItemKey2: "item0", // out of view (before)
                containerItemKey3: undefined, // unallocated
                numContainers: 4,
                numContainersPooled: 6,
            };

            mockState.indexByKey.set("item0", 0);
            mockState.indexByKey.set("item20", 20);

            const result = findAvailableContainers(containerData, mockState, 5, 5, 10, []);

            // Should return sorted indices even though they were found in different order
            expect(result).toEqual([0, 1, 2, 3, 4]);
        });
    });

    describe("edge cases", () => {
        it("should handle empty container pool", () => {
            const containerData = {
                numContainers: 0,
                numContainersPooled: 2,
            };

            const result = findAvailableContainers(containerData, mockState, 2, 0, 10, []);

            expect(result).toEqual([0, 1]);
        });

        it("should handle zero containers needed", () => {
            const containerData = {
                containerItemKey0: undefined, // This will be found in first pass
                numContainers: 5,
            };

            const result = findAvailableContainers(containerData, mockState, 0, 0, 10, []);

            expect(result).toEqual([]);
        });

        it("should handle pendingRemoval array with non-existent indices", () => {
            const containerData = {
                containerItemKey0: "item0",
                containerItemKey1: "item1",
                numContainers: 2,
            };

            const pendingRemoval = [0, 5]; // 5 doesn't exist
            const result = findAvailableContainers(containerData, mockState, 1, 0, 10, pendingRemoval);

            expect(result).toEqual([0]);
            expect(pendingRemoval).toEqual([5]); // Only existing index should be removed
        });
    });
});
