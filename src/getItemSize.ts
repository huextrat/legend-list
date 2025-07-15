import type { InternalState } from "./types";

export function getItemSize(
    state: InternalState,
    key: string,
    index: number,
    data: any,
    useAverageSize?: number | undefined,
) {
    const { sizesKnown, sizes, scrollingTo, estimatedItemSize, getEstimatedItemSize } = state;
    const sizeKnown = sizesKnown.get(key)!;
    if (sizeKnown !== undefined) {
        return sizeKnown;
    }

    let size: number | undefined;

    if ((useAverageSize !== undefined && sizeKnown) === undefined && !getEstimatedItemSize && !scrollingTo) {
        // TODO: Hook this up to actual item type later once we have item types
        size = useAverageSize;
    }

    if (size === undefined) {
        size = sizes.get(key)!;

        if (size !== undefined) {
            return size;
        }
    }

    if (size === undefined) {
        // Get estimated size if we don't have an average or already cached size
        size = getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize!;
    }

    // Save to rendered sizes
    sizes.set(key, size);
    return size;
}
